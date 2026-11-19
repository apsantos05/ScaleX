/**
 * Exporta arquivos da marca para uso externo (redes sociais, apresentações).
 *   npx tsx scripts/export-brand.tsx
 * Saída em /brand.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createElement as h } from "react";
import { ImageResponse } from "next/og";
import { BLADE_RED, BLADE_WHITE, BRAND } from "../src/components/brand/mark";

const OUT = path.join(process.cwd(), "brand");

function blades(size: number, first: string = BRAND.red, second: string = BRAND.white) {
  return h(
    "svg",
    { width: size, height: size, viewBox: "0 0 64 64" },
    h("path", { d: BLADE_RED, fill: first }),
    h("path", { d: BLADE_WHITE, fill: second }),
  );
}

/** Foto de perfil: o Instagram recorta em círculo — as pontas das lâminas ficam a ~85% do raio do círculo (sem corte). */
function profile(bg: string, markScale = 0.95, first?: string, second?: string) {
  const S = 1080;
  return h(
    "div",
    { style: { width: S, height: S, display: "flex", alignItems: "center", justifyContent: "center", background: bg } },
    blades(Math.round(S * markScale), first, second),
  );
}

async function save(name: string, element: ReturnType<typeof h>, width: number, height: number) {
  const res = new ImageResponse(element, { width, height });
  await fs.writeFile(path.join(OUT, name), Buffer.from(await res.arrayBuffer()));
  console.log("ok", name);
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  await save("scalex-instagram-perfil-preto.png", profile(BRAND.black), 1080, 1080);
  await save("scalex-instagram-perfil-vermelho.png", profile(BRAND.red, 0.95, BRAND.black, BRAND.white), 1080, 1080);
  // Versão vetorial do símbolo com quadro, para designers / impressão.
  await fs.writeFile(
    path.join(OUT, "scalex-simbolo.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="0.5" y="0.5" width="63" height="63" rx="7" fill="${BRAND.tile}" stroke="${BRAND.tileStroke}"/><path d="${BLADE_RED}" fill="${BRAND.red}"/><path d="${BLADE_WHITE}" fill="${BRAND.white}"/></svg>\n`,
  );
  console.log("ok", "scalex-simbolo.svg");
}

void main();
