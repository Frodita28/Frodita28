import { Inter, JetBrains_Mono } from "next/font/google";

/**
 * Fuentes del panel de licenciatarios (tema «Mando Central»). Se cargan solo en las rutas
 * del panel y escriben directamente los tokens --font-body y --font-mono (ver globals.css).
 * Los títulos (--font-heading) usan la misma Inter en peso 800-900 y mayúsculas.
 */
const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
  fallback: ["ui-monospace", "monospace"],
});

export const panelFonts = `${body.variable} ${mono.variable}`;
