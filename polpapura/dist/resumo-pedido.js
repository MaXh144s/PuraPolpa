globalThis.resumoPedido = function (pedido) {
  const real = centavos => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const linhas = [
    pedido.codigo ? "Pedido #" + pedido.codigo : "Olá! Poderia verificar o registro deste pedido?",
    "Cliente: " + pedido.cliente,
    "Modalidade: " + pedido.modalidade,
  ];
  if (pedido.modalidade === "Entrega") linhas.push("Endereço: " + pedido.endereco);
  linhas.push("Pagamento: " + pedido.pagamento, "", "Itens:");
  for (const item of pedido.itens) {
    linhas.push(item.quantidade + " × Açaí de " + item.volume + " — " + real(item.quantidade * item.centavos));
    linhas.push(item.condimentos.length ? item.condimentos.join(", ") : "Sem condimentos");
    if (item.observacoes) linhas.push("Observação: " + item.observacoes);
  }
  linhas.push("", "Subtotal das garrafas: " + real(pedido.subtotal));
  if (pedido.modalidade === "Entrega") {
    linhas.push("Frete a combinar com o atendente pelo WhatsApp.", "Total a confirmar após o frete.");
  } else {
    linhas.push("Retirada sem frete.", "Total: " + real(pedido.subtotal));
  }
  return linhas.join("\n");
};
