// A mesma URL é reutilizada durante a visita. Reabrir a página busca as fotos atuais.
const pastaGarrafas = "garrafas/";
const versaoDasFotos = Date.now();
function urlFoto(arquivo) {
  return pastaGarrafas + arquivo + "?v=" + versaoDasFotos;
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
const caption = document.createElement("p");
caption.className = "caption";
stage.after(caption);
let active = 0;
let paused = false;
let timer;
let animations = [];

function atualizarLegenda() {
  caption.textContent = slides[active].dataset.foto ? "\u00a0" : "Imagem ilustrativa";
}

const slides = apresentacoes.map(({ volume, foto, altura }, i) => {
  const slide = document.createElement("div");
  slide.className = "slide";
  slide.hidden = i !== active;
  slide.style.setProperty("--height", altura);
  const photo = new Image();
  photo.alt = "Garrafa de açaí PuraPolpa de " + volume;
  photo.onerror = () => {
    slide.dataset.foto = "";
    photo.onerror = null;
    photo.src = "assets/reserva.svg";
    photo.alt = "Ilustração de garrafa";
    atualizarLegenda();
  };
  photo.src = urlFoto(foto);
  slide.dataset.foto = "sim";
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

function mostrarFoto(i) {
  const item = apresentacoes[i];
  let caminho = item.foto;
  if (semRotulo.checked) {
    caminho = item.semRotulo || fotosGenericas[proximaGenerica];
    if (!item.semRotulo) proximaGenerica = (proximaGenerica + 1) % fotosGenericas.length;
  }
  const photo = slides[i].querySelector("img");
  slides[i].dataset.foto = "sim";
  photo.alt = semRotulo.checked ? "Garrafa de açaí PuraPolpa sem rótulo" : "Garrafa de açaí PuraPolpa de " + item.volume;
  photo.src = urlFoto(caminho);
  atualizarLegenda();
}
semRotulo.onchange = () => {
  mostrarFoto(active);
  agendar();
};

function agendar() {
  clearTimeout(timer);
  if (!paused && !reduced.matches && !document.hidden) {
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
  atualizarLegenda();
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
atualizarLegenda();
atualizarControle();
