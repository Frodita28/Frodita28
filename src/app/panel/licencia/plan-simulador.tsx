"use client";

import { useState } from "react";
import { Figure, ProgressBar, SectionHeader, StatCard } from "@/components/ui";
import { licencia, type PlanId } from "@/content/licencia";
import { costoMercancia, formatPct, formatUsd, recuperacion, simular } from "@/lib/licencia";

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
      <section className="flex flex-col gap-6" aria-labelledby="numeros-titulo">
        <div className="space-y-4">
          <div>
            <p className="ui-label mb-2" id="plan-titulo">{selectorPlan.titulo}</p>
            <div className="grid grid-cols-1 gap-2 sm:inline-flex sm:flex-wrap" role="group" aria-labelledby="plan-titulo">
              {planes.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={p.id === plan.id}
                  onClick={() => elegirPlan(p.id)}
                  className="ui-tab justify-center border border-line text-center whitespace-normal aria-pressed:border-gold aria-pressed:bg-gold aria-pressed:text-black"
                >
                  {p.nombre}
                </button>
              ))}
            </div>
          </div>
          {plan.escalones.length > 1 && (
            <div>
              <p className="ui-label mb-2" id="escalon-titulo">{selectorPlan.escalonTitulo}</p>
              <div className="flex flex-wrap gap-2" role="group" aria-labelledby="escalon-titulo">
                {plan.escalones.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    aria-pressed={e.id === escalon.id}
                    onClick={() => setEscalonId(e.id)}
                    className="ui-chip"
                  >
                    {e.etiqueta}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <SectionHeader title={n.titulo} id="numeros-titulo" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={n.inversion}
              size="lg"
              value={formatUsd(escalon.inversionUsd)}
              hint={plan.escalones.length > 1 ? plan.inversionResumen : plan.inversionSufijo}
            />
            <StatCard label={n.margen} size="lg" value={formatPct(escalon.margenMinimo)} />
            <StatCard
              label={n.pvp}
              size="lg"
              value={formatUsd(escalon.pvpUsd)}
              hint={`${n.costo}: ${formatUsd(costoMercancia(escalon))} (${n.costoNota})`}
            />
            <StatCard label={n.recuperacion} size="lg" value={formatPct(recuperacion(escalon))} hint={n.recuperacionSufijo} />
            <StatCard label={n.exclusividad} value={<span className="font-title font-bold tracking-[0.02em] uppercase">{plan.exclusividad}</span>} />
            <StatCard label={n.vigencia} value={<span className="font-title font-bold tracking-[0.02em] uppercase">{plan.vigencia}</span>} />
            <StatCard
              label={n.recompra}
              value={plan.recompraAnualMinimaUsd === null ? <span className="font-title font-bold tracking-[0.02em] uppercase">{n.noAplica}</span> : formatUsd(plan.recompraAnualMinimaUsd)}
            />
          </div>
        </div>
      </section>

      <section className="ui-card" aria-labelledby="simulador-titulo">
        <SectionHeader title={t.titulo} id="simulador-titulo">
          {plan.nombre}
          {plan.escalones.length > 1 && ` · ${escalon.etiqueta}`}
        </SectionHeader>
        <label className="block">
          <span className="flex items-end justify-between gap-4">
            <span className="font-medium">{t.pregunta}</span>
            <span className="ui-num text-[40px] leading-none">{pct}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={pct}
            aria-valuetext={`${pct}%`}
            onChange={(e) => setPct(Number(e.target.value))}
            className="mt-4 h-11 w-full cursor-pointer accent-[var(--gold)]"
          />
        </label>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Figure label={t.ventas} value={formatUsd(sim.ventasUsd)} />
          <Figure label={t.margen} value={formatUsd(sim.margenUsd)} />
          <Figure
            label={t.recuperado}
            value={<>{formatUsd(sim.recuperadoUsd)} <span className="text-[15px] font-normal text-fg-2">/ {formatUsd(escalon.inversionUsd)}</span></>}
          />
        </div>
        <div className="mt-6 space-y-2">
          <p className="ui-label">{t.puntoRecuperacion}: <span className="ui-num">{punto}%</span></p>
          <ProgressBar value={sim.avance} target={100} done={sim.recuperado} label={t.barra} />
          <p className={sim.recuperado ? "font-medium text-success" : "text-fg-2"} aria-live="polite">
            {sim.recuperado ? t.mensajeRecuperado : `${t.faltaPrefijo} ${sim.faltaPct}% ${t.faltaSufijo}`}
          </p>
        </div>
        <p className="mt-6 border-t border-line pt-4 text-[13px] text-fg-2">{t.descargo}</p>
      </section>
    </>
  );
}
