begin;

create table purapolpa.pedidos (
  numero bigint generated always as identity (start with 1001) primary key,
  tentativa uuid not null unique,
  criado_em timestamptz not null default now(),
  dados jsonb not null,
  itens jsonb not null,
  subtotal integer not null check (subtotal > 0)
);
alter table purapolpa.pedidos enable row level security;
create policy consultar_pedidos on purapolpa.pedidos for select to authenticated
  using (exists (select 1 from purapolpa.administradores));
grant select on purapolpa.pedidos to authenticated;

create function public.pp_registrar_pedido(tentativa_id uuid, pedido jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  linha jsonb;
  precos jsonb := '{"250 ml":1290,"300 ml":1490,"500 ml":1990,"900 ml":2990}';
  itens jsonb := '[]';
  preco integer;
  quantidade integer;
  soma integer := 0;
  registro purapolpa.pedidos;
begin
  if tentativa_id is null or pedido is null or length(pedido::text) > 32000
    or jsonb_typeof(pedido->'cliente') is distinct from 'string'
    or length(trim(pedido->>'cliente')) not between 1 and 100
    or coalesce(pedido->>'modalidade','') not in ('Entrega','Retirada')
    or coalesce(pedido->>'pagamento','') not in ('Pix','Crédito','Débito','Dinheiro')
    or jsonb_typeof(pedido->'endereco') is distinct from 'string'
    or length(pedido->>'endereco') > 300
    or (pedido->>'modalidade' = 'Entrega' and trim(pedido->>'endereco') = '')
    or jsonb_typeof(pedido->'itens') is distinct from 'array'
  then raise exception 'Dados do pedido inválidos.'; end if;
  if jsonb_array_length(pedido->'itens') not between 1 and 30 then
    raise exception 'Quantidade de itens inválida.';
  end if;
  for linha in select value from jsonb_array_elements(pedido->'itens') loop
    preco := (precos->>(linha->>'volume'))::integer;
    if preco is null or jsonb_typeof(linha->'quantidade') is distinct from 'number'
      or (linha->>'quantidade') !~ '^[1-9][0-9]?$'
      or jsonb_typeof(linha->'condimentos') is distinct from 'array'
      or not (linha->'condimentos' <@ '["Musse de maracujá","Leite em pó","Leite condensado"]'::jsonb)
      or jsonb_typeof(linha->'observacoes') is distinct from 'string'
      or length(linha->>'observacoes') > 500
    then raise exception 'Item inválido.'; end if;
    if jsonb_array_length(linha->'condimentos') > 3 then raise exception 'Condimentos inválidos.'; end if;
    quantidade := (linha->>'quantidade')::integer;
    soma := soma + quantidade * preco;
    itens := itens || jsonb_build_array(linha || jsonb_build_object('centavos',preco));
  end loop;
  insert into purapolpa.pedidos(tentativa,dados,itens,subtotal)
    values(tentativa_id,pedido,itens,soma) on conflict (tentativa) do nothing
    returning * into registro;
  if not found then
    select * into strict registro from purapolpa.pedidos where tentativa = tentativa_id;
    if registro.dados <> pedido then raise exception 'Tentativa já utilizada.'; end if;
  end if;
  return registro.dados || jsonb_build_object('codigo','PP-' || registro.numero,
    'criado_em',registro.criado_em,'itens',registro.itens,'subtotal',registro.subtotal);
end $$;

create function public.pp_buscar_pedidos(termo text default '') returns setof jsonb
language sql stable security invoker set search_path = '' as $$
  select dados || jsonb_build_object('codigo','PP-' || numero,'criado_em',criado_em,
    'itens',itens,'subtotal',subtotal)
  from purapolpa.pedidos
  where trim(termo) = '' or upper(trim(leading '#' from trim(termo))) in ('PP-' || numero, numero::text)
    or strpos(lower(dados->>'cliente'),lower(trim(termo))) > 0
  order by criado_em desc, numero desc limit 50;
$$;
revoke all on function public.pp_registrar_pedido(uuid,jsonb), public.pp_buscar_pedidos(text) from public, anon, authenticated;
grant execute on function public.pp_registrar_pedido(uuid,jsonb) to anon, authenticated;
grant execute on function public.pp_buscar_pedidos(text) to authenticated;
commit;
