import { Barlow_Condensed, Inter } from "next/font/google";

/**
 * Fuentes del panel de licenciatarios. Se cargan solo en las rutas del panel y
 * escriben directamente los tokens --font-heading y --font-body (ver globals.css).
 */
const heading = Barlow_Condensed({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
  fallback: ["Oswald", "sans-serif"],
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const panelFonts = `${heading.variable} ${body.variable}`;
