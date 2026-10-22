"use client";

import { useState } from "react";
import { Bar, StatSlab } from "@/components/club";
import { licencia, type PlanId } from "@/content/licencia";
import { costoMercancia, formatPct, formatUsd, recuperacion, simular } from "@/lib/licencia";

/** Mismo estado activo (amarillo) que las pestañas del panel. */
const ACTIVO = "border-gold! bg-gold! text-obsidian!";

/** Selector de plan, "Tu inversión en números" y simulador de recuperación (cálculo en el cliente). */
export function PlanSimulador({ planInicial }: { planInicial: PlanId }) {
  const { planes, numeros: n, simulador: t, selectorPlan } = licencia;
  const [planId, setPlanId] = useState<PlanId>(planInicial);
  const plan = planes.find((p) => p.id === planId) ?? planes[0];
  const [escalonId, setEscalonId] = useState(plan.escalones[0].id);
  const escalon = plan.escalones.find((e) => e.id === escalonId) ?? plan.escalones[0];
  const [pct, setPct] = useState(t.porcentajeInicial);
  const sim = simular(escalon, pct);
  const punto = Math.round(recuperacion(escalon) * 100);

  function elegirPlan(id: PlanId) {
    const siguiente = planes.find((p) => p.id === id) ?? planes[0];
    setPlanId(siguiente.id);
    setEscalonId(siguiente.escalones[0].id);
  }

  return (
    <>
      <section className="mb-5" aria-label={selectorPlan.titulo}>
        <p className="kicker mb-2">{selectorPlan.titulo}</p>
        <div className="grid grid-cols-2 gap-2 sm:inline-grid" role="radiogroup" aria-label={selectorPlan.titulo}>
          {planes.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={p.id === plan.id}
              onClick={() => elegirPlan(p.id)}
              className={`tab justify-center text-center whitespace-normal ${p.id === plan.id ? ACTIVO : ""}`}
            >
              {p.nombre}
            </button>
          ))}
        </div>
        {plan.escalones.length > 1 && (
          <div className="mt-3">
            <p className="kicker mb-2">{selectorPlan.escalonTitulo}</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={selectorPlan.escalonTitulo}>
              {plan.escalones.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  role="radio"
                  aria-checked={e.id === escalon.id}
                  onClick={() => setEscalonId(e.id)}
                  className={`chip ${e.id === escalon.id ? ACTIVO : ""}`}
                >
                  {e.etiqueta}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mb-6">
        <h2 className="slab-title mb-3">{n.titulo}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatSlab
            label={n.inversion}
            value={<span className="text-gold">{formatUsd(escalon.inversionUsd)}</span>}
            hint={plan.escalones.length > 1 ? plan.inversionResumen : plan.inversionSufijo}
          />
          <StatSlab label={n.margen} value={formatPct(escalon.margenMinimo)} />
          <StatSlab
            label={n.pvp}
            value={formatUsd(escalon.pvpUsd)}
            hint={`${n.costo}: ${formatUsd(costoMercancia(escalon))} (${n.costoNota})`}
          />
          <StatSlab
            label={n.recuperacion}
            value={<span className="text-gold">{formatPct(recuperacion(escalon))}</span>}
            hint={n.recuperacionSufijo}
          />
          <StatSlab label={n.exclusividad} value={plan.exclusividad} />
          <StatSlab label={n.vigencia} value={plan.vigencia} />
          <StatSlab
            label={n.recompra}
            value={plan.recompraAnualMinimaUsd === null ? n.noAplica : formatUsd(plan.recompraAnualMinimaUsd)}
          />
        </div>
      </section>

      <section className="slab mb-6 border-l-4 border-l-gold">
        <h2 className="slab-title">{t.titulo}</h2>
        <p className="mt-1 text-xs text-parchment">
          {plan.nombre}
          {plan.escalones.length > 1 && ` · ${escalon.etiqueta}`}
        </p>
        <label className="mt-4 block">
          <span className="flex items-end justify-between gap-3 text-sm font-bold">
            <span>{t.pregunta}</span>
            <span className="font-display text-3xl leading-none text-gold">{pct}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={pct}
            onChange={(e) => setPct(Number(e.target.value))}
            className="mt-3 w-full accent-gold"
          />
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="border border-ash bg-pit p-3">
            <p className="kicker">{t.ventas}</p>
            <p className="mt-1 font-display text-xl sm:text-2xl">{formatUsd(sim.ventasUsd)}</p>
          </div>
          <div className="border border-ash bg-pit p-3">
            <p className="kicker">{t.margen}</p>
            <p className="mt-1 font-display text-xl sm:text-2xl">{formatUsd(sim.margenUsd)}</p>
          </div>
          <div className="border border-ash bg-pit p-3">
            <p className="kicker">{t.recuperado}</p>
            <p className="mt-1 font-display text-xl sm:text-2xl">
              {formatUsd(sim.recuperadoUsd)} <span className="text-sm text-parchment">/ {formatUsd(escalon.inversionUsd)}</span>
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <p className="flex justify-between text-xs font-bold">
            <span>{t.puntoRecuperacion}: {punto}%</span>
            <span className={sim.recuperado ? "text-ok" : "text-gold"}>{Math.round(sim.avance)}%</span>
          </p>
          <Bar value={sim.avance} target={100} accent={sim.recuperado ? "ok" : "gold"} label={t.barra} />
          <p className={`text-sm ${sim.recuperado ? "font-bold text-ok" : "text-linen"}`} aria-live="polite">
            {sim.recuperado ? t.mensajeRecuperado : `${t.faltaPrefijo} ${sim.faltaPct}% ${t.faltaSufijo}`}
          </p>
        </div>
        <p className="mt-4 border-t border-ash pt-3 text-xs text-parchment">{t.descargo}</p>
      </section>
    </>
  );
}
