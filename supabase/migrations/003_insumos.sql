begin;
alter table purapolpa.itens
  add column quantidade numeric,
  alter column peso drop not null,
  drop constraint itens_tipo_check,
  add constraint itens_tipo_check check (tipo in ('produto','receita','insumo')),
  add constraint itens_medida_check check (
    (tipo = 'insumo' and peso is null and uso is null and quantidade is not null
      and quantidade between 1 and 9007199254740991 and quantidade = trunc(quantidade))
    or (tipo <> 'insumo' and peso is not null and quantidade is null)
  );

create or replace function public.pp_catalogo() returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare resultado jsonb;
begin
  if not exists(select 1 from purapolpa.administradores) then
    raise exception 'Acesso administrativo não autorizado.' using errcode='42501';
  end if;
  select jsonb_build_object('revisao', e.revisao, 'itens', coalesce((
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', i.id, 'tipo', i.tipo, 'nome', i.nome, 'peso', coalesce(c.peso,i.peso),
      'quantidade', i.quantidade, 'preco', coalesce(c.preco,i.preco), 'uso', i.uso, 'componentes', c.partes
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

create or replace function public.pp_alterar(versao bigint, acao text, dados jsonb) returns jsonb
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
      insert into purapolpa.itens(id,tipo,nome,peso,preco,uso,quantidade)
        values ((item->>'id')::uuid,item->>'tipo',trim(item->>'nome'),(item->>'peso')::numeric,
          (item->>'preco')::numeric,(item->>'uso')::numeric,(item->>'quantidade')::numeric)
        on conflict(id) do update set tipo=excluded.tipo, nome=excluded.nome, peso=excluded.peso, preco=excluded.preco, uso=excluded.uso, quantidade=excluded.quantidade;
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
commit;
