import "../polpapura/dist/resumo-pedido.js";

export function abrirPedidos(supabase) {
  document.getElementById("pedidos-admin")?.remove();
  const secao = document.createElement("section");
  secao.id = "pedidos-admin";
  secao.innerHTML = `<h2>Pedidos</h2>
    <form autocomplete="off" autocorrect="off" autocapitalize="none"><label>Buscar por número do pedido ou nome do cliente
      <input type="search" name="termo" maxlength="100" spellcheck="false" placeholder="Ex.: PP-1001">
    </label><button type="submit">Buscar pedidos</button></form>
    <p role="status"></p><div class="resultados"></div>`;
  const painel = document.getElementById("painel");
  painel.insertBefore(secao, painel.querySelector(".colunas"));
  const form = secao.querySelector("form");
  const status = secao.querySelector('[role="status"]');
  const resultados = secao.querySelector(".resultados");
  let consulta = 0;
  async function buscar() {
    const atual = ++consulta;
    status.textContent = "Buscando pedidos…";
    resultados.replaceChildren();
    try {
      const { data, error } = await supabase.rpc("pp_buscar_pedidos", { termo: form.elements.termo.value.trim() });
      if (!secao.isConnected || atual !== consulta) return;
      if (error) throw error;
      for (const pedido of data) {
        const detalhes = document.createElement("details");
        const titulo = document.createElement("summary");
        const dataLocal = new Date(pedido.criado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
        titulo.textContent = "#" + pedido.codigo + " · " + pedido.cliente + " · " + dataLocal;
        const resumo = document.createElement("pre");
        resumo.className = "resumo-pedido";
        resumo.textContent = globalThis.resumoPedido(pedido);
        detalhes.append(titulo, resumo);
        resultados.append(detalhes);
      }
      status.textContent = data.length ? "Exibindo " + data.length + " pedido(s) mais recente(s)." : "Nenhum pedido encontrado.";
    } catch {
      if (atual === consulta) status.textContent = "Falha ao consultar os pedidos. Tente buscar novamente.";
    }
  }
  form.onsubmit = evento => { evento.preventDefault(); buscar(); };
  buscar();
}
