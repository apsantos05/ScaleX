import type { MetadataRoute } from "next";

/** Permite "Adicionar à tela inicial" no celular com o ícone e as cores da marca. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ScaleX",
    short_name: "ScaleX",
    description: "Central de operações de marketing orgânico em escala.",
    start_url: "/app",
    display: "standalone",
    background_color: "#09090B",
    theme_color: "#09090B",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
