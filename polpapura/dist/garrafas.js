const pastaGarrafas = "garrafas/";
const fotosResponsivas = JSON.parse(document.querySelector("#fotos-responsivas")?.textContent || "{}");
function carregarFoto(img, arquivo, alt) {
  const variante = fotosResponsivas[arquivo];
  img.alt = alt;
  img.dataset.arquivo = arquivo;
  if (variante) {
    img.sizes = variante.sizes;
    img.srcset = variante.srcset;
  } else {
    img.removeAttribute("srcset");
  }
  img.src = urlFoto(arquivo);
}

function recuperarFoto(evento) {
  const img = evento.currentTarget;
  if (img.hasAttribute("srcset")) img.removeAttribute("srcset");
  else if (img.getAttribute("src") !== "assets/reserva.svg") img.src = "assets/reserva.svg";
}
function urlFoto(arquivo) {
  return pastaGarrafas + arquivo;
}
const apresentacoes = [
  { volume: "250 ml", centavos: 1290, foto: "garrafa-250.png", altura: "84%" },
  { volume: "300 ml", centavos: 1490, foto: "garrafa-300.png", altura: "88%" },
  { volume: "500 ml", centavos: 1990, foto: "garrafa-500.png", altura: "93%" },
  { volume: "900 ml", centavos: 2990, foto: "garrafa-900.png", semRotulo: "garrafa-900-sem-rotulo.png", altura: "99%" }
];
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const fotosGenericas = ["sem-rotulo-a.png", "sem-rotulo-b.png"];
const semRotulo = document.querySelector("#sem-rotulo");
let proximaGenerica = 0;

const stage = document.querySelector("#stage");
const volumes = document.querySelector("#volumes");
const motion = document.querySelector("#motion");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
let active = 0;
let paused = Boolean(navigator.connection?.saveData || ["slow-2g", "2g"].includes(navigator.connection?.effectiveType));
let timer;
let animations = [];
let troca = 0;

const slides = apresentacoes.map(({ volume, foto, altura }, i) => {
  const slide = document.createElement("a");
  slide.href = "#pedido";
  slide.setAttribute("aria-label", "Personalizar açaí de " + volume);
  slide.onclick = () => abrirPedido(i);
  slide.className = "slide";
  slide.hidden = i !== active;
  slide.style.setProperty("--height", altura);
  const photo = new Image();
  photo.onerror = recuperarFoto;
  if (i === active) {
    photo.fetchPriority = "high";
    carregarFoto(photo, foto, "Garrafa de açaí PuraPolpa de " + volume);
  }
  slide.append(photo);
  stage.append(slide);
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = volume;
  button.setAttribute("aria-pressed", String(i === active));
  button.onclick = () => selecionar(i);
  volumes.append(button);
  return slide;
});

const pedido = document.querySelector("#pedido");
const formulario = document.querySelector("#personalizar");
const fotoPedido = document.querySelector("#pedido-foto");
let itemPedido = apresentacoes[0];
let quantidade = 1;
const volumesPedido = document.querySelector("#volumes-pedido");
for (const [i, item] of apresentacoes.entries()) {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.textContent = item.volume;
  botao.onclick = () => escolherVolume(i, fotoApresentacao(i));
  volumesPedido.append(botao);
}

function mudarQuantidade(delta) {
  quantidade = Math.max(1, quantidade + delta);
  document.querySelector("#quantidade").value = String(quantidade);
  document.querySelector("#diminuir").disabled = quantidade === 1;
  atualizarMensagem();
}
document.querySelector("#diminuir").onclick = () => mudarQuantidade(-1);
document.querySelector("#aumentar").onclick = () => mudarQuantidade(1);

function atualizarMensagem() {
  const total = moeda.format(quantidade * itemPedido.centavos / 100);
  document.querySelector("#pedido-total").textContent = total;
  const acompanhamentos = new FormData(formulario).getAll("acompanhamento");
  const notas = document.querySelector("#observacoes").value.trim();
  const mensagem = [
    "Olá, PuraPolpa! Gostaria de pedir " + quantidade + (quantidade === 1 ? " garrafa" : " garrafas") + " de açaí de " + itemPedido.volume + ".",
    "Total das garrafas: " + total + ".",
    acompanhamentos.length ? "Condimentos: " + acompanhamentos.join(", ") + "." : "Sem condimentos.",
  ];
  if (notas) mensagem.push("Observações: " + notas);
  const destino = new URL("https://wa.me/5551985870775");
  destino.searchParams.set("text", mensagem.join("\n"));
  document.querySelector("#enviar-pedido").href = destino.href;
}

function escolherVolume(i, imagem) {
  itemPedido = apresentacoes[i];
  carregarFoto(fotoPedido, imagem.arquivo, imagem.alt);
  document.querySelector("#pedido-volume").textContent = itemPedido.volume;
  document.querySelector("#preco-unitario").textContent = moeda.format(itemPedido.centavos / 100);
  Array.from(volumesPedido.children).forEach((botao, indice) => botao.setAttribute("aria-pressed", String(indice === i)));
  atualizarMensagem();
}
function abrirPedido(i) {
  const foto = slides[i].querySelector("img");
  escolherVolume(i, {arquivo: foto.dataset.arquivo, alt: foto.alt});
  pedido.hidden = false;
  document.querySelector("#pedido-titulo").focus({ preventScroll: true });
}
fotoPedido.onerror = recuperarFoto;
document.querySelector("#pedir").onclick = () => abrirPedido(active);
formulario.addEventListener("input", atualizarMensagem);

function fotoApresentacao(i) {
  const item = apresentacoes[i];
  let caminho = item.foto;
  if (semRotulo.checked) {
    caminho = item.semRotulo || fotosGenericas[proximaGenerica];
    if (!item.semRotulo) proximaGenerica = (proximaGenerica + 1) % fotosGenericas.length;
  }
  return {
    arquivo: caminho,
    alt: semRotulo.checked ? "Garrafa de açaí PuraPolpa sem rótulo" : "Garrafa de açaí PuraPolpa de " + item.volume
  };
}
function mostrarFoto(i) {
  const img = slides[i].querySelector("img");
  const foto = fotoApresentacao(i);
  carregarFoto(img, foto.arquivo, foto.alt);
  return img;
}
semRotulo.onchange = () => {
  troca++;
  mostrarFoto(active);
  agendar();
};

function agendar() {
  clearTimeout(timer);
  if (!paused && !reduced.matches && !document.hidden && !stage.contains(document.activeElement)) {
    timer = setTimeout(() => selecionar((active + 1) % slides.length), 3000);
  }
}

async function selecionar(next) {
  const pedidoTroca = ++troca;
  if (next === active) { agendar(); return; }
  clearTimeout(timer);
  const foto = mostrarFoto(next);
  try { await foto.decode(); } catch { /* O carregamento alternativo é tratado em recuperarFoto. */ }
  if (pedidoTroca !== troca) return;
  for (const animation of animations) {
    animation.onfinish = null;
    animation.cancel();
  }
  animations = [];
  const anterior = slides[active];
  active = next;
  slides.forEach((slide, i) => {
    slide.hidden = i !== next;
    volumes.children[i].setAttribute("aria-pressed", String(i === next));
  });
  if (reduced.matches) { agendar(); return; }
  anterior.hidden = false;
  const saida = anterior.animate([{ transform: "translateX(0)" }, { transform: "translateX(105%)" }], { duration: 600, easing: "ease-in" });
  const entrada = slides[next].animate([{ transform: "translateX(-105%)" }, { transform: "translateX(0)" }], { duration: 600, easing: "ease-out" });
  animations = [saida, entrada];
  saida.onfinish = () => { anterior.hidden = true; };
  entrada.onfinish = agendar;
}

function atualizarControle() {
  motion.hidden = reduced.matches;
  motion.classList.toggle("play", paused);
  motion.setAttribute("aria-label", paused ? "Retomar animação" : "Pausar animação");
  motion.title = motion.getAttribute("aria-label");
  agendar();
}
motion.onclick = () => { troca++; paused = !paused; atualizarControle(); };
reduced.addEventListener("change", () => {
  if (reduced.matches) animations.forEach(animation => animation.finish());
  atualizarControle();
});
document.addEventListener("visibilitychange", agendar);
stage.addEventListener("focusin", agendar);
stage.addEventListener("focusout", () => queueMicrotask(agendar));
atualizarControle();
clearTimeout(timer);
slides[active].querySelector("img").decode().then(agendar, agendar);
