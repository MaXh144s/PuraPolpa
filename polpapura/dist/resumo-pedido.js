function chaveItem(item) {
  return JSON.stringify([item.volume, [...item.condimentos].sort(), item.observacoes, item.centavos]);
}

function agruparItens(itens) {
  const grupos = new Map();
  for (const item of itens) {
    const chave = chaveItem(item);
    const grupo = grupos.get(chave);
    if (grupo) grupo.quantidade += item.quantidade;
    else grupos.set(chave, { ...item });
  }
  return [...grupos.values()];
}

function descricaoItem(item, preco) {
  return item.quantidade + " × Garrafa de " + item.volume + " · " + preco + " cada";
}

globalThis.resumoPedido = function (pedido) {
  const real = centavos => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const linhas = [
    pedido.codigo ? "Pedido #" + pedido.codigo : "Olá, PuraPolpa! Gostaria de fazer este pedido.",
    "Cliente: " + pedido.cliente,
    (pedido.modalidade === "Entrega" ? "🛵" : "🛍️") + " Modalidade: " + pedido.modalidade,
  ];
  if (pedido.modalidade === "Entrega") linhas.push("Endereço: " + pedido.endereco);
  const simbolosPagamento = { Dinheiro: "❖ ", Pix: "🔹 ", Crédito: "💳 ", Débito: "💳 " };
  linhas.push((simbolosPagamento[pedido.pagamento] || "") + "Pagamento: " + pedido.pagamento, "", "Itens:");
  for (const item of agruparItens(pedido.itens)) {
    linhas.push(descricaoItem(item, real(item.centavos)));
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
