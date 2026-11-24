(() => {
  const busca = document.querySelector("#pesquisa");
  const filtros = document.querySelectorAll("[data-filtro]");
  const normalizar = texto => texto.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/(\d)\s+ml/g, "$1ml");
  let categoria = "todos";
  const cards = produtosDelivery.map((item, indice) => {
    const copo = item.formato === "copo";
    const nome = item.sabor || (copo ? "Açaí no copo" : "Açaí na garrafa");
    const card = document.createElement("a");
    card.className = "produto-menu";
    card.href = "#pedido";
    card.setAttribute("aria-label", "Pedir " + nome + " de " + item.volume + " por " + moeda.format(item.centavos / 100));
    card.onclick = () => abrirPedido(indice);
    const foto = new Image();
    foto.loading = "lazy";
    if (copo) {
      foto.src = "assets/" + (item.foto || "acai-copo.webp");
      foto.alt = "";
    } else {
      carregarFoto(foto, item.foto, "");
      foto.sizes = "110px";
    }
    const moldura = document.createElement("div");
    moldura.className = copo ? "foto-menu foto-copo" : "foto-menu";
    moldura.append(foto);
    const info = document.createElement("div");
    info.className = "produto-info";
    const titulo = document.createElement("h4");
    titulo.textContent = nome;
    const tamanho = document.createElement("span");
    tamanho.textContent = item.volume;
    const preco = document.createElement("strong");
    preco.textContent = moeda.format(item.centavos / 100);
    const adicionar = document.createElement("span");
    adicionar.className = "pedir-produto";
    adicionar.setAttribute("aria-hidden", "true");
    adicionar.textContent = "+";
    info.append(titulo, tamanho, preco);
    card.append(moldura, info, adicionar);
    document.querySelector(copo ? "#produtos-copo" : "#produtos-garrafa").append(card);
    return { card, categoria: copo ? "copos" : "garrafas", texto: normalizar([nome, item.volume, copo ? "açaí no copo" : "trufado", ...(item.complementos || [])].join(" ")) };
  });

  function filtrar() {
    const termos = normalizar(busca.value.trim()).split(/\s+/);
    const visiveis = new Set();
    for (const produto of cards) {
      produto.card.hidden = (categoria !== "todos" && produto.categoria !== categoria) ||
        !termos.every(termo => produto.texto.includes(termo));
      if (!produto.card.hidden) visiveis.add(produto.categoria);
    }
    if (["todos","bebidas"].includes(categoria) && termos.every(termo => "bebidas".includes(termo))) visiveis.add("bebidas");
    document.querySelectorAll(".secao-menu").forEach(secao => { secao.hidden = !visiveis.has(secao.id); });
    document.querySelector("#sem-resultados").hidden = visiveis.size > 0;
    filtros.forEach(botao => botao.setAttribute("aria-pressed", String(botao.dataset.filtro === categoria)));
  }
  busca.oninput = filtrar;
  document.querySelectorAll('a[href="#cardapio"]').forEach(link => {
    link.addEventListener("click", () => { busca.value = ""; categoria = "todos"; filtrar(); });
  });
  filtros.forEach(botao => { botao.onclick = () => { categoria = botao.dataset.filtro; filtrar(); }; });

  function mostrarTela() {
    const hash = location.hash;
    const sobre = hash === "#sobre-nos" || hash === "#historia";
    document.querySelector("#inicio").hidden = sobre;
    document.querySelector("#sobre-nos").hidden = !sobre;
    document.querySelector("#historia").hidden = !sobre;
    document.body.classList.toggle("tela-sobre", sobre);
    const destino = ["#pedidos", "#pedido", "#carrinho", "#comprovante"].includes(hash)
      ? "#pedidos" : hash === "#pesquisa" ? "#pesquisa" : "#inicio";
    document.querySelectorAll(".nav-inferior a").forEach(link => {
      if (!sobre && link.hash === destino) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
    if (sobre) agendar();
    else clearTimeout(timer);
    if (hash === "#garrafas") {
      categoria = "garrafas";
      busca.value = "";
      filtrar();
    }
    if (hash === "#pesquisa") busca.focus();
    if (hash === "#pedido" && pedido.hidden) abrirPedido(0);
    const alvo = document.getElementById(hash.slice(1));
    if (hash === "#inicio") window.scrollTo({ top: 0 });
    else if (alvo && !alvo.hidden) alvo.scrollIntoView();
  }
  document.querySelector('.nav-inferior a[href="#pesquisa"]').onclick = () => {
    document.querySelector("#inicio").hidden = false;
    busca.focus();
  };
  document.querySelector('.nav-inferior a[href="#inicio"]').onclick = evento => {
    if (location.hash === "#inicio") {
      evento.preventDefault();
      window.scrollTo({ top: 0 });
    }
  };
  window.addEventListener("hashchange", mostrarTela);
  mostrarTela();
})();
