import type { Metadata, Viewport } from "next";
import { Archivo, Archivo_Black } from "next/font/google";
import "./globals.css";

const body = Archivo({ variable: "--font-archivo", subsets: ["latin"] });
const display = Archivo_Black({ variable: "--font-display-face", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: { default: "Gallo Negro Licencias", template: "%s · Gallo Negro Licencias" },
  description: "Ropa exclusiva con identidad propia. Plataforma de licenciados de Gallo Negro.",
  applicationName: "Gallo Negro Licencias",
  appleWebApp: { capable: true, title: "Gallo Negro", statusBarStyle: "black-translucent" },
  icons: { apple: "/iconos/gn-180.png" },
};

// viewport-fit=cover deja usar env(safe-area-inset-*) en teléfonos con muesca o barra de gestos.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0B0B0C",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${body.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
