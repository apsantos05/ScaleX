import { ImageResponse } from "next/og";
import { BLADE_RED, BLADE_WHITE, BRAND } from "@/components/brand/mark";

/** Imagem de pré-visualização ao compartilhar o link (WhatsApp, Instagram, X, LinkedIn…). */
export const alt = "ScaleX — operações de marketing orgânico em escala";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: BRAND.black,
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          color: BRAND.white,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ display: "flex", width: 112, height: 112, alignItems: "center", justifyContent: "center", background: BRAND.tile, border: `2px solid ${BRAND.tileStroke}`, borderRadius: 12 }}>
            <svg width="92" height="92" viewBox="0 0 64 64">
              <path d={BLADE_RED} fill={BRAND.red} />
              <path d={BLADE_WHITE} fill={BRAND.white} />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 700, letterSpacing: 6 }}>
            SCALE<span style={{ color: BRAND.red }}>X</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.1, maxWidth: 980 }}>
            A central de comando para quem opera dezenas de contas.
          </div>
          <div style={{ fontSize: 28, color: "#9898A3" }}>Multicontas · publicação em lote · integrações oficiais</div>
        </div>
        <div style={{ display: "flex", height: 6, width: 160, background: BRAND.red }} />
      </div>
    ),
    size,
  );
}
