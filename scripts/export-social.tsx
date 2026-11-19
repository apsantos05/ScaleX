/**
 * Gera as artes do Instagram da ScaleX (capas de destaque + carrosséis) no estilo da marca.
 *   npx tsx scripts/export-social.tsx
 * Saída em /brand/instagram. Textos dos carrosséis definidos abaixo (fonte única).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createElement as h, type ReactElement } from "react";
import { ImageResponse } from "next/og";
import { BLADE_RED, BLADE_WHITE, BRAND } from "../src/components/brand/mark";

const OUT = path.join(process.cwd(), "brand", "instagram");
const MUTED = "#9898A3";
const SUBTLE = "#6B6B76";
const GRID =
  "linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)";

type Font = { name: string; data: ArrayBuffer; weight: 400 | 600 | 800; style: "normal" };

async function loadFonts(): Promise<Font[]> {
  const css = await (await fetch("https://fonts.googleapis.com/css2?family=Geist:wght@400;600;800")).text();
  const faces = [...css.matchAll(/font-weight: (\d+);[\s\S]*?url\((https:[^)]+\.ttf)\)/g)];
  return Promise.all(
    faces.map(async ([, w, url]) => ({
      name: "Geist",
      data: await (await fetch(url!)).arrayBuffer(),
      weight: Number(w) as Font["weight"],
      style: "normal" as const,
    })),
  );
}

const mark = (size: number) =>
  h(
    "svg",
    { width: size, height: size, viewBox: "0 0 64 64" },
    h("path", { d: BLADE_RED, fill: BRAND.red }),
    h("path", { d: BLADE_WHITE, fill: BRAND.white }),
  );

// ───────────── Carrosséis ─────────────
type Slide =
  | { kind: "hook"; title: string; sub?: string }
  | { kind: "point"; tag: string; title: string; body: string; fix?: string }
  | { kind: "payoff"; title: string; items: string[]; ask: string };

const CARROSSEIS: Record<string, Slide[]> = {
  "carrossel-1-atalhos-de-risco": [
    { kind: "hook", title: "4 atalhos de automação que colocam suas contas do Instagram em risco", sub: "O terceiro parece inofensivo." },
    {
      kind: "point",
      tag: "01",
      title: "Entregar a senha para uma ferramenta",
      body: "Login com senha fora do Instagram vai contra os termos da plataforma e abre a porta para roubo de conta.",
      fix: "Use login oficial: você autoriza no próprio Instagram e revoga quando quiser.",
    },
    {
      kind: "point",
      tag: "02",
      title: "Robôs que imitam gente",
      body: "Ferramentas que clicam, rolam e “aquecem” contas fingindo ser humano são automação não autorizada.",
      fix: "Use a API oficial da Meta, feita para publicar.",
    },
    {
      kind: "point",
      tag: "03",
      title: "Disparar tudo de uma vez",
      body: "A própria Meta limita quantas publicações cada conta faz via API a cada 24 horas.",
      fix: "Use uma fila que respeita o limite de cada conta.",
    },
    {
      kind: "point",
      tag: "04",
      title: "Proxies para esconder contas",
      body: "Trocar de IP para driblar o Instagram é contornar o sistema de segurança dele.",
      fix: "Conecte contas profissionais abertamente, pela integração oficial.",
    },
    {
      kind: "payoff",
      title: "Antes de escolher uma ferramenta, confira:",
      items: ["Login oficial, sem pedir sua senha", "Publica pela API oficial da Meta", "Respeita o limite de cada conta", "Sem proxy, sem robô imitando gente"],
      ask: "Salve para conferir na próxima ferramenta",
    },
  ],
  "carrossel-2-o-que-e-a-scalex": [
    { kind: "hook", title: "Operar 30 contas não devia exigir 30 abas abertas", sub: "Conheça a ScaleX." },
    { kind: "point", tag: "01", title: "Um painel para todas as contas", body: "Organize suas contas profissionais por grupos e etiquetas e veja o status de cada uma." },
    { kind: "point", tag: "02", title: "Suba uma vez, publique em várias", body: "Escolha a mídia, a legenda, as contas e o horário. A ScaleX agenda em lote." },
    { kind: "point", tag: "03", title: "Cada publicação, conta por conta", body: "Agendada, publicada ou com o motivo da falha. Sem precisar adivinhar." },
    {
      kind: "point",
      tag: "04",
      title: "Do jeito que o Instagram permite",
      body: "Login oficial, API da Meta e limites respeitados. Nada de senha compartilhada.",
    },
    {
      kind: "payoff",
      title: "Acesso antecipado aberto",
      items: ["Teste com contas de demonstração", "Feed, Reels, Stories e carrossel", "Calendário e histórico de cada conta"],
      ask: "Link na bio",
    },
  ],
  "carrossel-3-habitos-multicontas": [
    { kind: "hook", title: "5 hábitos de quem opera 20+ contas do Instagram sem viver de planilha", sub: "O segundo é o mais ignorado." },
    {
      kind: "point",
      tag: "01",
      title: "Agrupe as contas antes de postar",
      body: "Por nicho, por cliente ou por objetivo. Quem separa antes não precisa lembrar onde cada post vai.",
      fix: "Dica: dê a cada grupo uma etiqueta e um horário fixo de publicação.",
    },
    {
      kind: "point",
      tag: "02",
      title: "Saiba de onde veio cada mídia",
      body: "Conteúdo sem direito de uso é o caminho mais curto para denúncia e remoção de post.",
      fix: "Dica: só deixe entrar na fila a mídia com origem e direitos registrados.",
    },
    {
      kind: "point",
      tag: "03",
      title: "Tenha legendas-base, não legendas copiadas",
      body: "Uma estrutura reutilizável, adaptada ao tom de cada conta. Legenda idêntica em todas parece automação de baixa qualidade.",
    },
    {
      kind: "point",
      tag: "04",
      title: "Um calendário só, com status por conta",
      body: "Agendado, publicado ou falhou: tudo no mesmo lugar, conta por conta. Planilha não avisa quando algo dá errado.",
    },
    {
      kind: "point",
      tag: "05",
      title: "Leia o motivo da falha antes de repostar",
      body: "Formato errado, mídia recusada ou conta desconectada pedem soluções diferentes. Repostar no escuro repete o erro.",
      fix: "Dica: corrija a causa e só então reagende.",
    },
    {
      kind: "payoff",
      title: "Sua rotina multicontas em 5 hábitos:",
      items: ["Contas agrupadas e etiquetadas", "Mídia com direitos registrados", "Legendas-base adaptadas por conta", "Calendário único com status", "Falha lida antes de repostar"],
      ask: "Salve e mande para quem divide as contas com você",
    },
  ],
};

function slideFrame(children: ReactElement[], index: number, total: number, isLast: boolean) {
  return h(
    "div",
    {
      style: {
        width: 1080,
        height: 1350,
        display: "flex",
        flexDirection: "column",
        padding: "84px 88px",
        background: BRAND.black,
        backgroundImage: GRID,
        backgroundSize: "60px 60px",
        color: BRAND.white,
        fontFamily: "Geist",
      },
    },
    h(
      "div",
      { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 18 } },
        mark(52),
        h("div", { style: { display: "flex", fontSize: 30, fontWeight: 600, letterSpacing: 5 } }, "SCALE", h("span", { style: { color: BRAND.red } }, "X")),
      ),
      h("div", { style: { display: "flex", fontSize: 28, color: SUBTLE, fontWeight: 400 } }, `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`),
    ),
    h("div", { style: { display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" } }, ...children),
    h(
      "div",
      { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
      h("div", { style: { display: "flex", height: 8, width: 140, background: BRAND.red } }),
      h("div", { style: { display: "flex", fontSize: 30, color: isLast ? BRAND.white : MUTED, fontWeight: 600 } }, isLast ? "@scalexspam" : "Arrasta →"),
    ),
  );
}

function slideContent(s: Slide): ReactElement[] {
  if (s.kind === "hook") {
    return [
      h("div", { style: { display: "flex", fontSize: 96, fontWeight: 800, lineHeight: 1.04, letterSpacing: -2 } }, s.title),
      ...(s.sub ? [h("div", { style: { display: "flex", marginTop: 44, fontSize: 44, color: BRAND.red, fontWeight: 600 } }, s.sub)] : []),
    ];
  }
  if (s.kind === "point") {
    return [
      h("div", { style: { display: "flex", fontSize: 160, fontWeight: 800, color: BRAND.red, lineHeight: 1, letterSpacing: -4 } }, s.tag),
      h("div", { style: { display: "flex", marginTop: 36, fontSize: 72, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5 } }, s.title),
      h("div", { style: { display: "flex", marginTop: 36, fontSize: 40, color: MUTED, lineHeight: 1.4 } }, s.body),
      ...(s.fix
        ? [
            h(
              "div",
              { style: { display: "flex", marginTop: 48, padding: "28px 32px", borderLeft: `8px solid ${BRAND.red}`, background: "#141417", fontSize: 38, lineHeight: 1.35, color: BRAND.white } },
              s.fix,
            ),
          ]
        : []),
    ];
  }
  return [
    h("div", { style: { display: "flex", fontSize: 76, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5 } }, s.title),
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", marginTop: 48, gap: 26 } },
      ...s.items.map((item) =>
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: 26, fontSize: 44, lineHeight: 1.25 } },
          h("div", { style: { display: "flex", width: 52, height: 52, flexShrink: 0, alignItems: "center", justifyContent: "center", background: BRAND.red, borderRadius: 6 } },
            h("svg", { width: 32, height: 32, viewBox: "0 0 24 24" }, h("path", { d: "M5 12.5l4.5 4.5L19 7.5", fill: "none", stroke: BRAND.white, strokeWidth: 3.2, strokeLinecap: "round", strokeLinejoin: "round" })),
          ),
          item,
        ),
      ),
    ),
    h("div", { style: { display: "flex", marginTop: 64, fontSize: 46, fontWeight: 800, color: BRAND.red } }, s.ask),
  ];
}

// ───────────── Capas de destaque (1080×1920; o Instagram mostra o círculo central) ─────────────
const stroke = { fill: "none", stroke: BRAND.red, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const ICONS: Record<string, ReactElement> = {
  comece: h("svg", { width: 360, height: 360, viewBox: "0 0 24 24" }, h("path", { d: "M8 5.5v13l10.5-6.5z", fill: BRAND.red })),
  recursos: h(
    "svg",
    { width: 360, height: 360, viewBox: "0 0 24 24" },
    h("rect", { x: 4, y: 4, width: 7, height: 7, rx: 1.2, ...stroke }),
    h("rect", { x: 13, y: 4, width: 7, height: 7, rx: 1.2, ...stroke }),
    h("rect", { x: 4, y: 13, width: 7, height: 7, rx: 1.2, ...stroke }),
    h("rect", { x: 13, y: 13, width: 7, height: 7, rx: 1.2, fill: BRAND.red }),
  ),
  seguranca: h(
    "svg",
    { width: 360, height: 360, viewBox: "0 0 24 24" },
    h("path", { d: "M12 3l7.5 3v5.5c0 4.6-3.1 8-7.5 9.5-4.4-1.5-7.5-4.9-7.5-9.5V6z", ...stroke }),
    h("path", { d: "M8.8 12.2l2.3 2.3 4.4-4.6", ...stroke }),
  ),
  planos: h(
    "svg",
    { width: 360, height: 360, viewBox: "0 0 24 24" },
    h("rect", { x: 3, y: 6, width: 18, height: 12.5, rx: 2, ...stroke }),
    h("path", { d: "M3 10.2h18M7 15h4", ...stroke }),
  ),
  duvidas: h(
    "svg",
    { width: 360, height: 360, viewBox: "0 0 24 24" },
    h("circle", { cx: 12, cy: 12, r: 8.8, ...stroke }),
    h("path", { d: "M9.6 9.4a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2.1-2.4 3.6", ...stroke }),
    h("circle", { cx: 12, cy: 17, r: 0.6, fill: BRAND.red }),
  ),
};

function cover(icon: ReactElement) {
  return h(
    "div",
    { style: { width: 1080, height: 1920, display: "flex", alignItems: "center", justifyContent: "center", background: BRAND.black } },
    h(
      "div",
      { style: { width: 760, height: 760, borderRadius: 380, display: "flex", alignItems: "center", justifyContent: "center", background: "#0E0E11", border: "6px solid #1F1F25" } },
      icon,
    ),
  );
}

async function render(file: string, el: ReactElement, width: number, height: number, fonts: Font[]) {
  const res = new ImageResponse(el, { width, height, fonts });
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
}

async function main() {
  const fonts = await loadFonts();
  for (const [name, icon] of Object.entries(ICONS)) {
    await render(path.join(OUT, "destaques", `capa-${name}.png`), cover(icon), 1080, 1920, fonts);
    console.log("ok destaque", name);
  }
  for (const [folder, slides] of Object.entries(CARROSSEIS)) {
    for (const [i, s] of slides.entries()) {
      const el = slideFrame(slideContent(s), i, slides.length, i === slides.length - 1);
      await render(path.join(OUT, folder, `${String(i + 1).padStart(2, "0")}.png`), el, 1080, 1350, fonts);
    }
    console.log("ok", folder, slides.length, "slides");
  }
}

void main();
