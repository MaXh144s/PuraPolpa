(() => {
  const porId = id => document.getElementById(id);
  const checkout = porId("checkout");
  const campos = checkout.elements;
  const menu = document.querySelector(".menu-principal");
  new ResizeObserver(() => {
    document.documentElement.style.scrollPaddingTop = (menu.offsetHeight + 8) + "px";
  }).observe(menu);
  const chave = "purapolpa.carrinho.v1";
  const catalogo = new Map(apresentacoes.map(item => [item.volume, item.centavos]));
  const dinheiro = centavos => moeda.format(centavos / 100);
  let estado = { itens: [] };
  try {
    const salvo = JSON.parse(sessionStorage.getItem(chave));
    if (Array.isArray(salvo?.itens)) estado = salvo;
  } catch { /* O carrinho também funciona em memória. */ }
  let registrando = false;

  function salvar() {
    try { sessionStorage.setItem(chave, JSON.stringify(estado)); } catch { /* Armazenamento indisponível. */ }
  }
  function avisar(texto) { porId("aviso-compra").textContent = texto; }
  function subtotal() {
    return estado.itens.reduce((soma, item) => soma + item.quantidade * catalogo.get(item.volume), 0);
  }
  function atualizarFrete() {
    const entrega = campos.modalidade.value === "Entrega";
    porId("campo-endereco").hidden = !entrega;
    campos.endereco.disabled = !entrega;
    porId("frete").textContent = entrega ? "Frete a combinar com o atendente pelo WhatsApp."
      : "Retirada sem frete. Total: " + dinheiro(subtotal());
  }
  function mostrarComprovante(registro) {
    const texto = resumoPedido(registro);
    porId("texto-comprovante").textContent = texto;
    porId("enviar-pedido").href = "https://wa.me/5551985870775?text=" + encodeURIComponent(texto);
    porId("comprovante").hidden = false;
  }
  function renderizar() {
    const lista = porId("itens-carrinho");
    lista.replaceChildren();
    estado.itens.forEach((item, indice) => {
      const linha = document.createElement("li");
      const titulo = document.createElement("strong");
      titulo.textContent = item.quantidade + " × Açaí de " + item.volume + " · " + dinheiro(item.quantidade * catalogo.get(item.volume));
      const detalhes = document.createElement("p");
      detalhes.textContent = [item.condimentos.join(", ") || "Sem condimentos", item.observacoes].filter(Boolean).join(" · ");
      const remover = document.createElement("button");
      remover.type = "button";
      remover.textContent = "Remover";
      remover.setAttribute("aria-label", "Remover item " + (indice + 1) + ", açaí de " + item.volume);
      remover.onclick = () => {
        if (registrando) return;
        estado.itens.splice(indice, 1);
        salvar();
        renderizar();
        avisar("Item removido.");
      };
      linha.append(titulo, detalhes, remover);
      lista.append(linha);
    });
    const quantidade = estado.itens.reduce((soma, item) => soma + item.quantidade, 0);
    const valor = dinheiro(subtotal());
    porId("contagem").textContent = String(quantidade);
    for (const atalho of document.querySelectorAll('a[href="#carrinho"]')) {
      atalho.hidden = quantidade === 0;
    }
    document.querySelector(".atalho-carrinho").setAttribute("aria-label",
      quantidade ? "Ver carrinho com " + quantidade + (quantidade === 1 ? " garrafa" : " garrafas") : "Ver carrinho vazio");
    porId("subtotal").textContent = valor;
    porId("carrinho").hidden = quantidade === 0;
    atualizarFrete();
  }

  formulario.onsubmit = evento => {
    evento.preventDefault();
    if (registrando) return;
    const item = { volume: itemPedido.volume, quantidade,
      condimentos: new FormData(formulario).getAll("acompanhamento"),
      observacoes: porId("observacoes").value.trim() };
    if (estado.itens.length >= 30 || quantidade > 99) {
      avisar("Use até 30 itens no carrinho e até 99 garrafas por item.");
    } else {
      estado.itens.push(item);
      delete estado.registro;
      porId("comprovante").hidden = true;
      salvar();
      renderizar();
      avisar("Adicionado ao carrinho.");
      mudarQuantidade(1 - quantidade);
    }
    porId("titulo-carrinho").focus();
  };
  if (estado.dados) {
    for (const [nome, valor] of Object.entries(estado.dados)) campos.namedItem(nome).value = valor;
  }
  checkout.oninput = () => {
    atualizarFrete();
    estado.dados = Object.fromEntries(new FormData(checkout));
    salvar();
  };
  checkout.onsubmit = async evento => {
    evento.preventDefault();
    if (registrando || !estado.itens.length) return;
    const dados = { cliente: campos.cliente.value.trim(), modalidade: campos.modalidade.value,
      endereco: campos.endereco.disabled ? "" : campos.endereco.value.trim(), pagamento: campos.pagamento.value };
    if (!dados.cliente || (dados.modalidade === "Entrega" && !dados.endereco)) {
      avisar("Preencha o nome e, para entrega, o endereço.");
      return;
    }
    const pedido = { ...dados, itens: estado.itens };
    const assinatura = JSON.stringify(pedido);
    estado.dados = dados;
    salvar();
    registrando = porId("dados-pedido").disabled = true;
    avisar("Abrindo o WhatsApp…");
    let resumo = { ...pedido, subtotal: subtotal(),
      itens: pedido.itens.map(item => ({ ...item, centavos: catalogo.get(item.volume) })) };
    const config = document.querySelector('meta[name="pedidos-api"]');
    if (config) {
      try {
        if (estado.tentativa?.assinatura !== assinatura) {
          estado.tentativa = { assinatura, id: crypto.randomUUID() };
          salvar();
        }
        const resposta = await fetch(config.content + "/rest/v1/rpc/pp_registrar_pedido", {
          method: "POST", headers: { "Content-Type": "application/json", apikey: config.dataset.chave },
          body: JSON.stringify({ tentativa_id: estado.tentativa.id, pedido }),
          signal: AbortSignal.timeout(2500)
        });
        if (!resposta.ok) throw new Error();
        const registro = await resposta.json();
        resumo = registro;
        estado = { itens: [], registro };
        salvar();
        checkout.reset();
        renderizar();
      } catch {
        // O atendente também recebe o resumo quando o registro online está indisponível.
      }
    }
    registrando = porId("dados-pedido").disabled = false;
    mostrarComprovante(resumo);
    location.assign(porId("enviar-pedido").href);
  };
  renderizar();
  if (estado.registro) mostrarComprovante(estado.registro);
})();
