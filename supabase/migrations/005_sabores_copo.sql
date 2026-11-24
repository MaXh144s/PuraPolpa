begin;

create or replace function public.pp_registrar_pedido(tentativa_id uuid, pedido jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  linha jsonb;
  precos jsonb := '{"250 ml":1290,"300 ml":1490,"500 ml":1990,"900 ml":2990}';
  itens jsonb := '[]';
  classicos constant jsonb := '["Musse de maracujá","Leite em pó","Leite condensado"]';
  completos constant jsonb := '["Creme de chocolate branco","Paçoca","Creme de avelã","Leite em pó","Leite condensado"]';
  permitidos jsonb;
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
    preco := case coalesce(linha->>'formato','garrafa')
      when 'garrafa' then (precos->>(linha->>'volume'))::integer
      when 'copo' then ('{"330 ml":1490,"550 ml":1990}'::jsonb->>(linha->>'volume'))::integer
    end;
    permitidos := classicos;
    if linha ? 'sabor' then
      if (linha->>'formato') is distinct from 'copo' then raise exception 'Sabor inválido.'; end if;
      permitidos := case linha->>'sabor'
        when 'Tentação em Dobro' then completos
        when 'Explosão de Paçoca' then completos
        when 'Branca de Neve' then '["Creme de chocolate branco","Leite em pó","Leite condensado"]'::jsonb
      end;
    end if;
    if permitidos is null or preco is null or jsonb_typeof(linha->'quantidade') is distinct from 'number'
      or (linha->>'quantidade') !~ '^[1-9][0-9]?$'
      or jsonb_typeof(linha->'condimentos') is distinct from 'array'
      or not (linha->'condimentos' <@ permitidos)
      or jsonb_typeof(linha->'observacoes') is distinct from 'string'
      or length(linha->>'observacoes') > 500
    then raise exception 'Item inválido.'; end if;
    if jsonb_array_length(linha->'condimentos') > jsonb_array_length(permitidos) then raise exception 'Condimentos inválidos.'; end if;
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

commit;
