import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const origem = "polpapura/dist";
const destino = "out";
await cp(origem, destino, { recursive: true });
await mkdir(path.join(destino, "fotos"), { recursive: true });
const fotos = {};
for (const arquivo of await readdir(path.join(origem, "garrafas"))) {
  if (!arquivo.endsWith(".png")) continue;
  const original = path.join(origem, "garrafas", arquivo);
  const { width, height } = await sharp(original).metadata();
  const proporcao = width / height;
  const candidatos = [];
  for (const altura of new Set([360, 500, 720, 1000, 1500, height].map(h => Math.min(h, height)))) {
    const { data, info } = await sharp(original).resize({ height: altura })
      .webp({ lossless: true, exact: true }).toBuffer({ resolveWithObject: true });
    const hash = createHash("sha256").update(data).digest("hex").slice(0, 16);
    const url = "fotos/" + hash + ".webp";
    await writeFile(path.join(destino, url), data);
    candidatos.push(url + " " + info.width + "w");
  }
  // O carrossel limita a altura a 330 px no celular e a 485 px no desktop.
  const sizes = "(max-width: 760px) " + Math.ceil(330 * proporcao) + "px, " + Math.ceil(485 * proporcao) + "px";
  fotos[arquivo] = { srcset: candidatos.join(", "), sizes };
}
const primeira = fotos["garrafa-250.png"];
const preload = primeira ? '<link rel="preload" as="image" type="image/webp" imagesrcset="' + primeira.srcset + '" imagesizes="' + primeira.sizes + '">' : "";
const html = await readFile(path.join(origem, "index.html"), "utf8");
await writeFile(path.join(destino, "index.html"), html.replace("<!-- fotos responsivas -->",
  preload + '<script id="fotos-responsivas" type="application/json">' + JSON.stringify(fotos).replaceAll("<", "\\u003c") + '</script>'));
