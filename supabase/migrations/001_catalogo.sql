begin;

create schema purapolpa;
revoke all on schema purapolpa from public, anon;
grant usage on schema purapolpa to authenticated;

create table purapolpa.administradores (
  usuario uuid primary key references auth.users(id) on delete cascade
);
alter table purapolpa.administradores enable row level security;
create policy consultar_proprio_acesso on purapolpa.administradores
  for select to authenticated using (usuario = (select auth.uid()));
grant select on purapolpa.administradores to authenticated;

create table purapolpa.estado (
  id integer primary key check (id = 1),
  revisao bigint not null default 0
);
insert into purapolpa.estado(id) values (1);

create table purapolpa.itens (
  id uuid primary key,
  tipo text not null check (tipo in ('produto','receita')),
  nome text not null check (length(trim(nome)) > 0),
  peso numeric not null check (peso > 0),
  preco numeric not null check (preco >= 0),
  uso numeric check (uso >= 0),
  unique (id,tipo)
);
create unique index itens_nome on purapolpa.itens (lower(trim(nome)));
create table purapolpa.receita_componentes (
  receita uuid not null,
  tipo_receita text generated always as ('receita'::text) stored,
  ordem integer not null,
  produto uuid not null,
  tipo_produto text generated always as ('produto'::text) stored,
  peso numeric not null check (peso > 0),
  primary key(receita,ordem),
  foreign key(receita,tipo_receita) references purapolpa.itens(id,tipo) on delete cascade,
  foreign key(produto,tipo_produto) references purapolpa.itens(id,tipo) on delete restrict
);
create index componentes_produto on purapolpa.receita_componentes(produto);

do $$
declare t text;
begin
  foreach t in array array['estado','itens','receita_componentes'] loop
    execute format('alter table purapolpa.%I enable row level security', t);
    execute format('create policy acesso_admin on purapolpa.%I to authenticated
      using (exists (select 1 from purapolpa.administradores))
      with check (exists (select 1 from purapolpa.administradores))', t);
  end loop;
end $$;
grant select, update on purapolpa.estado to authenticated;
grant select, insert, update, delete on purapolpa.itens, purapolpa.receita_componentes to authenticated;

create function public.pp_catalogo() returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare resultado jsonb;
begin
  if not exists(select 1 from purapolpa.administradores) then
    raise exception 'Acesso administrativo não autorizado.' using errcode='42501';
  end if;
  select jsonb_build_object('revisao', e.revisao, 'itens', coalesce((
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', i.id, 'tipo', i.tipo, 'nome', i.nome, 'peso', coalesce(c.peso,i.peso),
      'preco', coalesce(c.preco,i.preco), 'uso', i.uso, 'componentes', c.partes
    )) order by i.nome)
    from purapolpa.itens i left join lateral (
      select sum(p.peso) as peso, sum((p.peso * produto.preco) / produto.peso) as preco,
        jsonb_agg(jsonb_build_object('id',p.produto,'peso',p.peso) order by p.ordem) as partes
      from purapolpa.receita_componentes p join purapolpa.itens produto on produto.id=p.produto
      where p.receita=i.id
    ) c on true
  ), '[]'::jsonb)) into resultado from purapolpa.estado e where id=1;
  return resultado;
end $$;

create function public.pp_alterar(versao bigint, acao text, dados jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare atual bigint; lote jsonb; item jsonb;
begin
  select revisao into atual from purapolpa.estado where id=1 for update;
  if not found then raise exception 'Acesso administrativo não autorizado.' using errcode='42501'; end if;
  if atual is distinct from versao then raise exception 'O catálogo mudou em outro dispositivo. Recarregue o painel antes de salvar.'; end if;
  if acao='remover' then
    delete from purapolpa.itens where id=(dados->>'id')::uuid;
    if not found then raise exception 'Item não encontrado.'; end if;
  elsif acao in ('salvar','importar') then
    lote := case when acao='salvar' then jsonb_build_array(dados) else dados end;
    if jsonb_typeof(lote) is distinct from 'array' or jsonb_array_length(lote)=0 then raise exception 'Lista de itens inválida.'; end if;
    if acao='importar' and exists(select 1 from purapolpa.itens) then
      raise exception 'A importação inicial exige um catálogo online vazio.';
    end if;
    for item in select value from jsonb_array_elements(lote) loop
      delete from purapolpa.receita_componentes where receita=(item->>'id')::uuid;
      insert into purapolpa.itens(id,tipo,nome,peso,preco,uso)
        values ((item->>'id')::uuid,item->>'tipo',trim(item->>'nome'),(item->>'peso')::numeric,
          (item->>'preco')::numeric,(item->>'uso')::numeric)
        on conflict(id) do update set tipo=excluded.tipo, nome=excluded.nome, peso=excluded.peso, preco=excluded.preco, uso=excluded.uso;
    end loop;
    for item in select value from jsonb_array_elements(lote) where value ? 'componentes' loop
      if jsonb_array_length(item->'componentes')=0 then raise exception 'Receita sem componentes.'; end if;
      insert into purapolpa.receita_componentes(receita,ordem,produto,peso)
        select (item->>'id')::uuid, n, (parte->>'id')::uuid, (parte->>'peso')::numeric
        from jsonb_array_elements(item->'componentes') with ordinality as p(parte,n);
    end loop;
  else raise exception 'Operação inválida.';
  end if;
  update purapolpa.estado set revisao=revisao+1 where id=1;
  return public.pp_catalogo();
end $$;
revoke all on function public.pp_catalogo(), public.pp_alterar(bigint,text,jsonb) from public, anon;
grant execute on function public.pp_catalogo(), public.pp_alterar(bigint,text,jsonb) to authenticated;
commit;
