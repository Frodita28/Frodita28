"use client";

import dynamic from "next/dynamic";

/** El punto de venta usa cámara y localStorage: solo se renderiza en el navegador. */
export const PointOfSale = dynamic(() => import("./pos-client"), {
  ssr: false,
  loading: () => <section className="ui-card h-40 motion-safe:animate-pulse" aria-label="Cargando punto de venta" />,
});
