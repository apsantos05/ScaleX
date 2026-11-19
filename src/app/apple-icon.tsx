import { ImageResponse } from "next/og";
import { BLADE_RED, BLADE_WHITE, BRAND } from "@/components/brand/mark";

/** Ícone da tela inicial do iPhone/iPad (o iOS aplica as bordas arredondadas). */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: BRAND.tile }}>
        <svg width="132" height="132" viewBox="0 0 64 64">
          <path d={BLADE_RED} fill={BRAND.red} />
          <path d={BLADE_WHITE} fill={BRAND.white} />
        </svg>
      </div>
    ),
    size,
  );
}
