const pastaGarrafas = "garrafas/";
function urlFoto(arquivo) {
  return pastaGarrafas + arquivo;
}
const apresentacoes = [
  { volume: "250 ml", foto: "garrafa-250.png", altura: "84%" },
  { volume: "300 ml", foto: "garrafa-300.png", altura: "88%" },
  { volume: "500 ml", foto: "garrafa-500.png", altura: "93%" },
  { volume: "900 ml", foto: "garrafa-900.png", semRotulo: "garrafa-900-sem-rotulo.png", altura: "99%" }
];

const fotosGenericas = ["sem-rotulo-a.png", "sem-rotulo-b.png"];
const semRotulo = document.querySelector("#sem-rotulo");
let proximaGenerica = 0;

const stage = document.querySelector("#stage");
const volumes = document.querySelector("#volumes");
const motion = document.querySelector("#motion");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
let active = 0;
let paused = false;
let timer;
let animations = [];

const slides = apresentacoes.map(({ volume, foto, altura }, i) => {
  const slide = document.createElement("a");
  slide.href = "#pedido";
  slide.setAttribute("aria-label", "Personalizar açaí de " + volume);
  slide.onclick = () => abrirPedido(i);
  slide.className = "slide";
  slide.hidden = i !== active;
  slide.style.setProperty("--height", altura);
  const photo = new Image();
  photo.alt = "Garrafa de açaí PuraPolpa de " + volume;
  photo.onerror = () => {
    if (photo.getAttribute("src") === "assets/reserva.svg") return;
    photo.src = "assets/reserva.svg";
    photo.alt = "Ilustração de garrafa";
  };
  photo.src = urlFoto(foto);
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
let volumePedido;
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
  const acompanhamentos = new FormData(formulario).getAll("acompanhamento");
  const notas = document.querySelector("#observacoes").value.trim();
  const mensagem = [
    "Olá, PuraPolpa! Gostaria de pedir " + quantidade + (quantidade === 1 ? " garrafa" : " garrafas") + " de açaí de " + volumePedido + ".",
    acompanhamentos.length ? "Acompanhamentos: " + acompanhamentos.join(", ") + "." : "Sem acompanhamentos.",
  ];
  if (notas) mensagem.push("Observações: " + notas);
  const destino = new URL("https://wa.me/5551985870775");
  destino.searchParams.set("text", mensagem.join("\n"));
  document.querySelector("#enviar-pedido").href = destino.href;
}

function escolherVolume(i, imagem) {
  volumePedido = apresentacoes[i].volume;
  fotoPedido.src = imagem.src;
  fotoPedido.alt = imagem.alt;
  document.querySelector("#pedido-volume").textContent = volumePedido;
  Array.from(volumesPedido.children).forEach((botao, indice) => botao.setAttribute("aria-pressed", String(indice === i)));
  atualizarMensagem();
}
function abrirPedido(i) {
  escolherVolume(i, slides[i].querySelector("img"));
  pedido.hidden = false;
  document.querySelector("#pedido-titulo").focus({ preventScroll: true });
}
fotoPedido.onerror = () => {
  if (fotoPedido.getAttribute("src") !== "assets/reserva.svg") fotoPedido.src = "assets/reserva.svg";
};
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
    src: urlFoto(caminho),
    alt: semRotulo.checked ? "Garrafa de açaí PuraPolpa sem rótulo" : "Garrafa de açaí PuraPolpa de " + item.volume
  };
}
function mostrarFoto(i) {
  Object.assign(slides[i].querySelector("img"), fotoApresentacao(i));
}
semRotulo.onchange = () => {
  mostrarFoto(active);
  agendar();
};

function agendar() {
  clearTimeout(timer);
  if (!paused && !reduced.matches && !document.hidden && !stage.contains(document.activeElement)) {
    timer = setTimeout(() => selecionar((active + 1) % slides.length), 3000);
  }
}

function selecionar(next) {
  if (next === active) return;
  clearTimeout(timer);
  for (const animation of animations) {
    animation.onfinish = null;
    animation.cancel();
  }
  animations = [];
  const anterior = slides[active];
  active = next;
  mostrarFoto(next);
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
motion.onclick = () => { paused = !paused; atualizarControle(); };
reduced.addEventListener("change", () => {
  if (reduced.matches) animations.forEach(animation => animation.finish());
  atualizarControle();
});
document.addEventListener("visibilitychange", agendar);
stage.addEventListener("focusin", agendar);
stage.addEventListener("focusout", () => queueMicrotask(agendar));
atualizarControle();
