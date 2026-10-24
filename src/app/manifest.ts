import type { MetadataRoute } from "next";

/** Manifest web para «Añadir a pantalla de inicio» (sin service worker). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gallo Negro Licencias",
    short_name: "Gallo Negro",
    description: "Panel de las tiendas licenciatarias de Gallo Negro.",
    start_url: "/panel",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B0B0C",
    theme_color: "#0B0B0C",
    lang: "es",
    icons: [
      { src: "/iconos/gn-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/iconos/gn-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/iconos/gn-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
