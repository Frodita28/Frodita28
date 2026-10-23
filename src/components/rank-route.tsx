"use client";

import { useState } from "react";
import { TEXTOS_RANGOS, recompensasPorNivel } from "@/content/rangos";
import { todosLosRangos } from "@/lib/rangos";
import { Icon } from "./icons";
import { Badge } from "./ui";

const fmt = (n: number) => new Intl.NumberFormat("es-VE").format(n);

/** Ruta de rangos: nodos conectados; al tocar uno se ve qué se libera en ese rango. */
export function RankRoute({ nivelActual }: { nivelActual: number }) {
  const rangos = todosLosRangos();
  const [selected, setSelected] = useState(nivelActual);
  const sel = rangos.find((r) => r.nivel === selected) ?? rangos[0];
  const recompensas = recompensasPorNivel.filter((r) => r.nivel === sel.nivel);
  const bloqueado = sel.nivel > nivelActual;

  return (
    <section className="ui-card" aria-labelledby="ruta-titulo">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <h2 id="ruta-titulo" className="ui-title-section">{TEXTOS_RANGOS.rutaTitulo}</h2>
        <p className="text-[13px] text-fg-2">{TEXTOS_RANGOS.rutaAyuda}</p>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
        <ol className="relative flex min-w-[560px] justify-between gap-2 py-2">
          {/* Línea que conecta los nodos: amarilla hasta el rango actual. */}
          <span className="absolute top-[34px] right-[10%] left-[10%] h-0.5 bg-line" aria-hidden />
          <span
            className="absolute top-[34px] left-[10%] h-0.5 bg-accent"
            style={{ width: `${(80 * (nivelActual - 1)) / Math.max(rangos.length - 1, 1)}%` }}
            aria-hidden
          />
          {rangos.map((r) => {
            const done = r.nivel < nivelActual;
            const current = r.nivel === nivelActual;
            const locked = r.nivel > nivelActual;
            return (
              <li key={r.slug} className="relative flex flex-1 flex-col items-center">
                <button
                  type="button"
                  onClick={() => setSelected(r.nivel)}
                  aria-pressed={selected === r.nivel}
                  aria-label={`${r.nombre}, nivel ${r.nivel}: ${done ? "completado" : current ? "rango actual" : `bloqueado, se alcanza con ${fmt(r.xpInicio)} XP`}`}
                  className={`flex flex-col items-center gap-2 rounded-ui px-2 py-1 transition-colors duration-150 hover:bg-surface-2 ${selected === r.nivel ? "bg-surface-2" : ""}`}
                >
                  <span
                    className={`grid h-12 w-12 place-items-center rounded-full border-2 font-title text-xl font-bold ${
                      done
                        ? "border-accent bg-accent text-bg"
                        : current
                          ? "border-accent bg-surface text-accent shadow-[0_0_0_4px_var(--bg),0_0_0_6px_var(--accent)]"
                          : "border-line bg-surface text-fg-3"
                    }`}
                  >
                    {done ? <Icon name="check" className="h-5 w-5" /> : locked ? <Icon name="lock" className="h-5 w-5" /> : r.nivel}
                  </span>
                  <span className={`font-title text-base leading-none font-bold tracking-[0.02em] uppercase ${locked ? "text-fg-2" : "text-fg"}`}>{r.nombre}</span>
                  <span className="ui-num text-xs text-fg-2">{locked ? `${fmt(r.xpInicio)} XP` : current ? "Actual" : "Completado"}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="ui-card-inset mt-4" aria-live="polite">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-title text-lg font-bold tracking-[0.02em] uppercase">{sel.nombre}</span>
          <span className="ui-label">Nivel {sel.nivel} · {fmt(sel.xpInicio)} – {fmt(sel.xpFin)} XP</span>
          {bloqueado && <Badge><Icon name="lock" className="h-3.5 w-3.5" /> Bloqueado</Badge>}
        </p>
        <ul className="mt-2 space-y-1 text-[15px] text-fg-2">
          <li>{sel.cosmetico}</li>
          {recompensas.map((r) => (
            <li key={r.titulo}>{r.publicada ? r.titulo : `Recompensa del rango: ${TEXTOS_RANGOS.proximamente.toLowerCase()}`}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
