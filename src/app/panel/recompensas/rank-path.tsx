"use client";

import Link from "next/link";
import { useState } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import { Icon } from "@/components/icons";
import { RankEmblem } from "@/components/rangos";
import { Badge } from "@/components/ui";
import { TEXTOS_RECOMPENSAS as R } from "@/content/recompensas";
import { formatGn, formatNum, formatUsd } from "@/lib/gn";
import { todosLosRangos } from "@/lib/rangos";

export type NodoRango = {
  nivel: number;
  xp: number;
  ventas: number;
  identidad: { name: string; met: boolean }[];
  beneficios: string[];
  premios: { id: string; name: string; price: number }[];
};

/** Camino de los 5 rangos; al tocar uno se abre una hoja con requisitos, beneficios y premios. */
export function RankPath({ nodos, nivelActual }: { nodos: NodoRango[]; nivelActual: number }) {
  const rangos = todosLosRangos();
  const [abierto, setAbierto] = useState<number | null>(null);
  const nodo = nodos.find((n) => n.nivel === abierto) ?? null;
  const rango = rangos.find((r) => r.nivel === abierto);

  return (
    <section className="ui-card" aria-labelledby="camino-titulo">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <h2 id="camino-titulo" className="ui-title-section">{R.camino}</h2>
        <p className="text-[13px] text-fg-2">{R.caminoAyuda}</p>
      </div>
      <ol className="relative grid grid-cols-5 gap-1">
        <span className="absolute top-6 right-[10%] left-[10%] h-0.5 bg-line" aria-hidden />
        <span
          className="absolute top-6 left-[10%] h-0.5 bg-gold"
          style={{ width: `${(Math.max(0, Math.min(nivelActual, 5) - 1) / 4) * 80}%` }}
          aria-hidden
        />
        {rangos.map((r) => {
          const estado = r.nivel < nivelActual ? "hecho" : r.nivel === nivelActual ? "actual" : "bloqueado";
          return (
            <li key={r.nivel} className="relative flex min-w-0 flex-col items-center">
              <button
                type="button"
                onClick={() => setAbierto(r.nivel)}
                className="flex min-h-11 w-full flex-col items-center gap-1 rounded-ui px-0.5 py-1 focus-visible:outline-2 focus-visible:outline-gold"
                aria-label={`${r.nombre}: ${estado === "bloqueado" ? "bloqueado" : estado === "actual" ? "tu rango" : "alcanzado"}`}
              >
                <span className={`relative grid h-12 w-12 place-items-center rounded-full bg-bg ${estado === "actual" ? "ring-2 ring-gold" : ""}`}>
                  <RankEmblem rango={r} className={`h-11 w-11 ${estado === "bloqueado" ? "opacity-40 grayscale" : ""}`} />
                  {estado === "bloqueado" && <Icon name="lock" className="absolute -right-0.5 -bottom-0.5 h-4 w-4 text-fg-2" />}
                </span>
                <span className={`text-center text-[10px] leading-tight font-bold tracking-tight uppercase sm:text-[11px] sm:tracking-normal ${estado === "actual" ? "text-gold" : estado === "bloqueado" ? "text-fg-3" : "text-fg"}`}>
                  {r.nombre}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <BottomSheet open={nodo !== null} onClose={() => setAbierto(null)} title={rango?.nombre ?? ""}>
        {nodo && rango && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <RankEmblem rango={rango} className="h-14 w-14" />
              <Badge tone={nodo.nivel <= nivelActual ? "success" : "neutral"}>
                {nodo.nivel < nivelActual ? "Alcanzado" : nodo.nivel === nivelActual ? R.rangoActual : "Por desbloquear"}
              </Badge>
            </div>
            <div>
              <h3 className="ui-label mb-2">{R.requisitos}</h3>
              {nodo.nivel === 1 && nodo.identidad.length === 0 ? (
                <p className="text-fg-2">Rango de entrada.</p>
              ) : (
                <ul className="flex flex-col gap-1.5 text-[15px]">
                  {nodo.xp > 0 && <li>{formatNum(nodo.xp)} XP</li>}
                  {nodo.ventas > 0 && <li>{formatUsd(nodo.ventas)} en ventas verificadas</li>}
                  {nodo.identidad.map((q) => (
                    <li key={q.name} className="flex items-start gap-2">
                      <Icon name={q.met ? "check" : "lock"} className={`mt-0.5 h-4 w-4 shrink-0 ${q.met ? "text-success" : "text-fg-3"}`} />
                      {q.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {nodo.beneficios.length > 0 && (
              <div>
                <h3 className="ui-label mb-2">{R.beneficios}</h3>
                <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px]">
                  {nodo.beneficios.map((b) => <li key={b}>{b}</li>)}
                </ul>
              </div>
            )}
            <div>
              <h3 className="ui-label mb-2">{R.premiosRango}</h3>
              {nodo.premios.length === 0 ? (
                <p className="text-fg-2">{R.sinPremiosRango}</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {nodo.premios.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0 [overflow-wrap:anywhere]">{p.name}</span>
                      <span className="ui-num shrink-0 text-gold">{formatGn(p.price)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Link href="/panel/tienda-clan" className="ui-btn-primary w-full">{R.irTienda}</Link>
          </div>
        )}
      </BottomSheet>
    </section>
  );
}
