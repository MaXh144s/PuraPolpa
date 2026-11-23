const el = id => document.getElementById(id);
const moeda = new Intl.NumberFormat("pt-BR", {style:"currency", currency:"BRL"});
const gramas = new Intl.NumberFormat("pt-BR", {maximumFractionDigits:3});
const tipos = {receita:"Receita", produto:"Produto", insumo:"Insumo"};
function tamanhoLote(item) {
  return item.tipo === "insumo" ? item.quantidade : item.peso;
}
function descricaoLote(item) {
  return gramas.format(tamanhoLote(item)) + (item.tipo === "insumo" ? " un." : " g");
}
const normalizar = nome => nome.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
let registro, chave, chaveSenha, editando;
let itens = [];
let idNovo;
const modoOnline = document.documentElement.dataset.catalogo === "online";

async function persistir(novos, acao, dados) {
  if (modoOnline) {
    itens = await window.catalogoOnline.alterar(acao, dados);
  } else {
    registro = await gravarCatalogo(registro, chave, novos);
    itens = novos;
  }
}


function aviso(texto) { el("aviso").textContent = texto; }
function numero(valor, campo, aceitaZero = false) {
  const limpo = valor.trim();
  const n = Number(limpo.replace(",", "."));
  if (!/^\d+(?:[,.]\d+)?$/.test(limpo) || !Number.isFinite(n) || (aceitaZero ? n < 0 : n <= 0)) {
    throw new Error("Informe um valor válido para " + campo + ".");
  }
  return n;
}

// Preço e peso permanecem sem arredondamento até a exibição.
function adaptarCatalogo(catalogo) {
  const mapa = new Map(catalogo.map(i => [i.id, i]));
  const cache = new Map();
  const visitando = new Set();
  function calcular(id) {
    if (cache.has(id)) return cache.get(id);
    const item = mapa.get(id);
    if (!item || visitando.has(id)) throw new Error("Revise a composição. Uma receita não pode depender dela mesma.");
    visitando.add(id);
    let custo = item.preco, peso = item.peso;
    if (Array.isArray(item.partes)) {
      custo = 0; peso = 0;
      for (const parte of item.partes) {
        const base = calcular(parte.id);
        custo += base.custo * (parte.peso / base.peso);
        peso += parte.peso;
      }
      peso = item.rendimento ?? peso;
    }
    if (!Number.isFinite(custo) || !Number.isFinite(peso) || peso <= 0) throw new Error("Revise os pesos e os preços informados.");
    visitando.delete(id);
    const resultado = {peso, custo};
    cache.set(id, resultado);
    return resultado;
  }
  return catalogo.map(item => {
    if (item.tipo !== "simples" && !Array.isArray(item.partes)) return item;
    const {peso, custo} = calcular(item.id);
    return {id:item.id, nome:item.nome, tipo:item.tipo === "simples" ? "produto" : item.tipo, peso, preco:custo};
  });
}

async function iniciar() {
  try {
    registro = await lerCofre();
    if (!crypto.subtle) throw new Error();
    el("titulo-acesso").textContent = registro ? "Entrar no painel" : "Criar acesso local";
    el("instrucao").textContent = registro ? "Entre para consultar os custos e editar o catálogo." : "Escolha um usuário e uma senha de pelo menos 8 caracteres para este navegador.";
    el("senha").autocomplete = registro ? "current-password" : "new-password";
    el("senha").minLength = registro ? 1 : 8;
    el("entrar").textContent = registro ? "Entrar" : "Criar acesso";
    el("entrar").disabled = false;
    el("esqueci").hidden = !registro;
  } catch { aviso("O armazenamento local está indisponível. Abra o site em uma conexão segura e permita o armazenamento neste navegador."); }
}
el("login").onsubmit = async evento => {
  evento.preventDefault();
  if (modoOnline) return;
  const usuario = el("usuario").value.trim();
  if (!usuario) return aviso("Informe o nome do usuário.");
  el("entrar").disabled = true;
  aviso("");
  try {
    const base = registro ?? {usuario, sal:crypto.getRandomValues(new Uint8Array(16)), revisao:0};
    const tentativa = await chaveLocal(el("senha").value, base.sal);
    if (registro) {
      if (usuario !== registro.usuario) throw new Error("Credenciais inválidas.");
      try {
        chave = await chaveDoCatalogo(registro, tentativa);
        itens = await abrirCatalogo(registro, chave);
      }
      catch { throw new Error("Credenciais inválidas."); }
      itens = adaptarCatalogo(itens);
    } else {
      registro = await gravarCatalogo(base, tentativa, []);
      chave = tentativa;
    }
    chaveSenha = tentativa;
    el("ativar-recuperacao").hidden = Boolean(registro.recuperacao);
    el("login").reset();
    el("acesso").hidden = true;
    el("sair").hidden = el("painel").hidden = false;
    editar();
    listar();
    el("busca").focus();
  } catch (erro) { aviso(erro.message); }
  finally { el("entrar").disabled = false; }
};
el("sair").onclick = () => location.reload();

function listar() {
  atualizarLinhasCusto();
  const insumos = itens.filter(item => item.tipo === "insumo").length;
  el("resumo-catalogo").textContent = (modoOnline ? "Catálogo online" : "Catálogo deste navegador") +
    " · " + itens.length + " itens · " + insumos + (insumos === 1 ? " insumo" : " insumos");
  const busca = normalizar(el("busca").value);
  const lista = el("lista");
  lista.replaceChildren();

  const filtrados = itens.filter(i => normalizar(i.nome).includes(busca)).sort((a,b) => a.nome.localeCompare(b.nome, "pt-BR"));
  for (const i of filtrados) {
    const li = document.createElement("li");
    const botao = document.createElement("button");
    botao.dataset.item = i.id;
    const detalhe = document.createElement("small");

    detalhe.textContent = tipos[i.tipo] + " · " + descricaoLote(i) + " · " + moeda.format(i.preco);
    if (i.tipo === "insumo") detalhe.textContent += " · " + moeda.format(i.preco / i.quantidade) + " por unidade";
    botao.append(i.nome, detalhe);
    botao.setAttribute("aria-current", String(i.id === editando));
    botao.onclick = () => { editar(i); listar(); el("nome").focus(); };
    const acoes = document.createElement("div");
    acoes.className = "acoes";
    for (const acao of ["Editar", "Remover"]) {
      const controle = document.createElement("button");
      controle.textContent = acao;
      controle.setAttribute("aria-label", acao + " " + i.nome);
      controle.onclick = acao === "Editar" ? botao.onclick : () => remover(i);
      acoes.append(controle);
    }
    li.append(botao, acoes); lista.append(li);
  }
  if (!filtrados.length) lista.textContent = itens.length ? "Nenhum item encontrado." : "Seu catálogo está vazio. Cadastre o primeiro produto ou receita.";
}
el("busca").oninput = listar;

let catalogoPlanilha;
function atualizarLinhasCusto() {
  if (catalogoPlanilha === itens) return;
  catalogoPlanilha = itens;
  const corpo = el("linhas-custo");
  const insumos = el("linhas-insumos");
  const usos = new Map(Array.from(el("planilha").querySelectorAll("input[data-id]"), campo => [campo.dataset.id + campo.inputMode, campo.value]));
  corpo.replaceChildren();
  insumos.replaceChildren();
  for (const item of [...itens].sort((a,b) => a.nome.localeCompare(b.nome, "pt-BR"))) {
    const porUnidade = item.tipo === "insumo";
    const linha = (porUnidade ? insumos : corpo).insertRow();
    const nome = document.createElement("th");
    nome.scope = "row";
    nome.textContent = item.nome;
    linha.append(nome);
    linha.insertCell().textContent = descricaoLote(item);
    linha.insertCell().textContent = moeda.format(item.preco);
    const uso = document.createElement("input");
    uso.inputMode = item.tipo === "insumo" ? "numeric" : "decimal";
    uso.dataset.id = item.id;
    uso.placeholder = "0";
    uso.value = usos.get(item.id + uso.inputMode) ?? (porUnidade ? "1" : "");
    uso.setAttribute("aria-label", (item.tipo === "insumo" ? "Unidades de " : "Gramas de ") + item.nome + " por garrafa");
    linha.insertCell().append(uso);
    linha.insertCell();
  }
  el("grupo-insumos").hidden = !insumos.rows.length;
  if (!itens.length) {
    const celula = corpo.insertRow().insertCell();
    celula.colSpan = 5;
    celula.textContent = "Adicione um produto ao catálogo para calcular seu custo na garrafa.";
  }
  calcularGarrafa();
}

function valorPlanilha(campo) {
  try {
    const valor = numero(campo.value.trim() || "0", "o custo", true);
    if (campo.inputMode === "numeric" && !Number.isSafeInteger(valor)) throw new Error("Informe unidades inteiras.");
    campo.removeAttribute("aria-invalid");
    return valor;
  } catch {
    campo.setAttribute("aria-invalid", "true");
    return NaN;
  }
}
function calcularGarrafa() {
  const catalogo = new Map(itens.map(item => [item.id, item]));
  let total = 0;
  for (const campo of el("planilha").querySelectorAll("input[data-id]")) {
    const item = catalogo.get(campo.dataset.id);
    const custo = item.preco * (valorPlanilha(campo) / tamanhoLote(item));
    campo.closest("tr").lastElementChild.textContent = Number.isFinite(custo) ? moeda.format(custo) : "—";
    total += custo;
  }
  el("custo-unitario").value = Number.isFinite(total) ? moeda.format(total) : "Revise os valores destacados.";
}
el("planilha").oninput = calcularGarrafa;
el("novo-produto").onclick = evento => {
  evento.preventDefault();
  editar();
  listar();
  el("nome").focus();
};

function receitaDependente(id) {
  return itens.find(i => i.componentes?.some(parte => parte.id === id));
}
async function remover(item) {
  const receita = receitaDependente(item.id);
  if (receita) return aviso("Retire o produto da receita “" + receita.nome + "” antes de removê-lo do catálogo.");
  if (!confirm("Remover “" + item.nome + "” do catálogo?")) return;
  try {
    const novos = itens.filter(i => i.id !== item.id);
    await persistir(novos, "remover", {id:item.id});
    if (editando === item.id) editar();
    for (const select of el("ingredientes").querySelectorAll("select")) {
      const opcao = Array.from(select.options).find(o => o.value === item.id);
      if (opcao) opcao.remove();
    }
    resumo();
    listar();
    aviso(item.nome + " removido do catálogo.");
  } catch (erro) { aviso(erro.message); }
}

function adicionarParte(parte) {
  const linha = document.createElement("div");
  linha.className = "ingrediente";
  linha.innerHTML = '<label>Produto<select required></select></label><label>Quantidade (g)<input required inputmode="decimal"></label><button type="button" aria-label="Retirar produto da receita" title="Retirar produto da receita">×</button>';
  const select = linha.querySelector("select");
  select.add(new Option("Selecione…", ""));
  const produtos = itens.filter(i => i.tipo === "produto" && i.id !== editando);
  for (const i of produtos.sort((a,b) => a.nome.localeCompare(b.nome,"pt-BR"))) select.add(new Option(i.nome, i.id));
  select.value = parte?.id ?? "";
  linha.querySelector("input").value = String(parte?.peso ?? "").replace(".", ",");
  linha.querySelector("button").onclick = () => {
    const proximo = linha.nextElementSibling?.querySelector("select") ?? el("adicionar");
    linha.remove();
    resumo();
    proximo.focus();
  };
  el("ingredientes").append(linha);
  return select;
}
el("adicionar").onclick = () => { adicionarParte().focus(); resumo(); };

function totaisComponentes(componentes, produtos) {
  let peso = 0, preco = 0;
  if (!componentes.length) throw new Error("Adicione ao menos um produto à receita.");
  for (const parte of componentes) {
    const produto = produtos.get(parte.id);
    if (produto?.tipo !== "produto") throw new Error("Selecione um produto do catálogo para cada componente.");
    peso += parte.peso;
    preco += produto.preco * (parte.peso / produto.peso);
  }
  if (!Number.isFinite(peso) || !Number.isFinite(preco)) throw new Error("Revise as quantidades da receita.");
  return {peso, preco};
}

function editar(item) {
  idNovo = null;
  retornoCadastro("");
  editando = item?.id ?? null;
  el("item").reset();
  el("titulo-editor").textContent = item ? "Editar " + item.nome : "Novo item";
  el("salvar").textContent = item ? "Salvar alterações" : "Cadastrar item";
  el("novo").hidden = !item;
  el("tipo").value = item?.tipo ?? "produto";
  el("nome").value = item?.nome ?? "";
  el("ingredientes").replaceChildren();
  el("automatico").checked = Boolean(item?.componentes);
  for (const parte of item?.componentes ?? []) adicionarParte(parte);
  for (const campo of ["peso","preco","uso"]) {
    el(campo).value = String(item?.[campo] ?? "").replace(".", ",");
  }
  el("quantidade-lote").value = item?.quantidade ?? "";
  modo();
  aviso("");
}
el("novo").onclick = () => { editar(); listar(); el("nome").focus(); };

function modo() {
  const receita = el("tipo").value === "receita";
  const insumo = el("tipo").value === "insumo";
  const automatico = receita && el("automatico").checked;
  el("opcao-composicao").hidden = !receita;
  el("composicao").hidden = el("composicao").disabled = !automatico;
  el("totais-manuais").hidden = el("preco").disabled = automatico;
  el("peso").parentElement.hidden = insumo;
  el("peso").disabled = automatico || insumo;
  el("quantidade-lote").parentElement.hidden = el("quantidade-lote").disabled = !insumo;
  el("uso").parentElement.hidden = el("uso").disabled = insumo;
  if (automatico && !el("ingredientes").children.length) adicionarParte();
  el("sem-produtos").hidden = itens.some(i => i.tipo === "produto" && i.id !== editando);
  resumo();
}
el("tipo").onchange = el("automatico").onchange = modo;

function rascunho() {
  const item = {
    id:editando,
    tipo:el("tipo").value,
    nome:el("nome").value.trim()
  };
  if (item.tipo === "receita" && el("automatico").checked) {
    item.componentes = Array.from(el("ingredientes").children, linha => ({
      id:linha.querySelector("select").value,
      peso:numero(linha.querySelector("input").value, "a quantidade do produto")
    }));
    Object.assign(item, totaisComponentes(item.componentes, new Map(itens.map(i => [i.id, i]))));
  } else {
    if (item.tipo === "insumo") {
      item.quantidade = numero(el("quantidade-lote").value, "a quantidade de itens");
      if (!Number.isSafeInteger(item.quantidade)) throw new Error("Informe uma quantidade inteira de itens.");
    } else item.peso = numero(el("peso").value, "o peso total");
    item.preco = numero(el("preco").value, "o valor total", true);
  }
  if (!el("uso").disabled && el("uso").value.trim()) item.uso = numero(el("uso").value, "a quantidade usada", true);
  return item;
}
function resumo() {
  const insumo = el("tipo").value === "insumo";
  const porcao = !insumo && Boolean(el("uso").value.trim());
  el("rotulo-preco").textContent = insumo ? "Valor total do lote (R$)" : el("tipo").value === "receita" ? "Custo total (R$)" : "Preço total (R$)";
  el("legenda-total").textContent = insumo ? "Custo por unidade" : porcao ? "Custo da quantidade usada" : "Custo total";
  try {
    const item = rascunho();
    if (insumo) {
      el("total").textContent = moeda.format(item.preco / item.quantidade);
      el("detalhe").textContent = moeda.format(item.preco) + " por " + descricaoLote(item);
      return;
    }
    const custo = porcao ? item.preco * (item.uso / item.peso) : item.preco;
    el("total").textContent = moeda.format(custo);
    el("detalhe").textContent = porcao
      ? gramas.format(item.uso) + " g usados · " + moeda.format(item.preco) + " por " + gramas.format(item.peso) + " g"
      : gramas.format(item.peso) + " g · " + moeda.format(item.preco / item.peso * 100) + " por 100 g";
  } catch {
    el("total").textContent = "—";
    el("detalhe").textContent = "Preencha os valores para calcular.";
  }
}
el("item").oninput = resumo;
function retornoCadastro(texto, estado = "") {
  el("retorno-cadastro").textContent = texto;
  el("retorno-cadastro").dataset.estado = estado;
  el("ver-cadastro").hidden = true;
}
el("item").addEventListener("invalid", evento => {
  retornoCadastro("Confira o campo " + (evento.target.labels?.[0]?.textContent.trim() || "destacado") + ".", "erro");
}, true);
el("ver-cadastro").onclick = () => {
  el("busca").value = "";
  listar();
  const linha = el("lista").querySelector('[data-item="' + el("ver-cadastro").dataset.item + '"]');
  if (linha) { linha.focus(); linha.scrollIntoView({ block: "center" }); }
};
el("item").onsubmit = async evento => {
  evento.preventDefault();
  if (el("salvar").disabled) return;
  el("salvar").disabled = true;
  const botao = el("salvar");
  botao.textContent = "Salvando…";
  retornoCadastro("Salvando no catálogo…");
  try {
    const item = rascunho();
    if (!item.nome) throw new Error("Informe um nome.");
    if (itens.some(i => i.id !== editando && normalizar(i.nome) === normalizar(item.nome))) throw new Error("Já existe um item com esse nome. Encontre-o pela busca para editar.");
    if (editando && item.tipo !== "produto" && receitaDependente(editando)) throw new Error("Este produto faz parte de uma receita. Retire-o da composição antes de mudar o tipo.");
    let novos;
    if (editando === null) {
      idNovo ??= crypto.randomUUID();
      item.id = idNovo;
      novos = [...itens, item];
    } else {
      novos = itens.map(i => i.id === editando ? item : i);
    }

    const produtos = new Map(novos.map(i => [i.id, i]));
    novos = novos.map(i => i.componentes ? {...i, ...totaisComponentes(i.componentes, produtos)} : i);
    if (modoOnline) {
      if (editando === null) await window.catalogoOnline.cadastrar(item);
      else await window.catalogoOnline.alterar("salvar", item);
      retornoCadastro("Conferindo o item no catálogo online…");
      const confirmados = await window.catalogoOnline.ler();
      const salvo = confirmados.find(i => i.id === item.id);
      if (!salvo || salvo.tipo !== item.tipo || salvo.nome !== item.nome ||
          (item.tipo === "insumo" && (salvo.quantidade !== item.quantidade || salvo.preco !== item.preco))) {
        throw new Error("O catálogo online não confirmou os dados deste item. Confira o catálogo antes de tentar novamente.");
      }
      itens = confirmados;
    } else {
      await persistir(novos, "salvar", item);
    }
    el("busca").value = "";
    editar();
    listar();
    retornoCadastro(tipos[item.tipo] + " “" + item.nome + "” salvo " +
      (modoOnline ? "no catálogo online." : "no catálogo deste navegador."), "sucesso");
    el("ver-cadastro").dataset.item = item.id;
    el("ver-cadastro").hidden = false;
  } catch (erro) { retornoCadastro(erro.message, "erro"); }
  finally {
    botao.disabled = false;
    botao.textContent = editando ? "Salvar alterações" : "Cadastrar item";
  }
};
if (!modoOnline) iniciar();
