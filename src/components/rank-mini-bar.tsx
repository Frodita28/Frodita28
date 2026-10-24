"use client";

import { useEffect, useState } from "react";
import { estadoRango } from "@/lib/rangos";
import { RankEmblem } from "./rangos";

/**
 * Mini barra fija del teléfono en Tu tienda: aparece al desplazarse cuando el hero de rango
 * (#rango-hero) sale de la pantalla, con el medallón pequeño, el rango y una barra fina.
 */
export function RankMiniBar({ totalXp }: { totalXp: number }) {
  const { rango, progreso, maximoCompletado } = estadoRango(totalXp);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("rango-hero");
    if (!hero || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  const pct = Math.round(progreso * 100);
  return (
    <div
      className={`fixed inset-x-0 top-0 z-40 border-b border-line bg-bg pt-[env(safe-area-inset-top)] transition-[transform,opacity] duration-200 md:hidden ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0"
      }`}
      aria-hidden={!visible}
    >
      <div className="flex items-center gap-3 px-4 py-2">
        <RankEmblem rango={rango} className="h-8 w-8" />
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline justify-between gap-2">
            <span className="truncate font-title text-base leading-none font-bold tracking-[0.02em] uppercase">{rango.nombre}</span>
            <span className="ui-num shrink-0 text-xs text-fg-2">{maximoCompletado ? "Máximo" : `${pct} %`}</span>
          </p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-ui bg-surface-2">
            <div className="h-full origin-left rounded-ui bg-accent" style={{ transform: `scaleX(${progreso})` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
