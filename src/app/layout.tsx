import type { Metadata, Viewport } from "next";
import { Archivo, Archivo_Black } from "next/font/google";
import "./globals.css";

const body = Archivo({ variable: "--font-body", subsets: ["latin"] });
const display = Archivo_Black({ variable: "--font-display-face", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: { default: "Gallo Negro Licencias", template: "%s · Gallo Negro Licencias" },
  description: "Ropa exclusiva con identidad propia. Plataforma de licenciados de Gallo Negro.",
};

export const viewport: Viewport = { themeColor: "#0b0b0c" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${body.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
