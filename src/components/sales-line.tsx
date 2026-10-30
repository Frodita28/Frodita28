"use client";

import { useState } from "react";
import Link from "next/link";
import { money, units, type PuntoVentas, type RangoVentas } from "@/lib/store";
import { Icon } from "./icons";

const RANGOS: { id: RangoVentas; label: string; nombre: string }[] = [
  { id: "1m", label: "1M", nombre: "1 mes" },
  { id: "3m", label: "3M", nombre: "3 meses" },
  { id: "6m", label: "6M", nombre: "6 meses" },
  { id: "1a", label: "1A", nombre: "1 año" },
];

/**
 * Panel de Ventas de Perfil: título, selector de período (1 mes por días; 3, 6 y 12 meses por mes)
 * y la línea dorada. `mensuales` trae los últimos 12 meses, del más antiguo al actual.
 */
export function VentasPanel({ diarias, mensuales }: { diarias: PuntoVentas[]; mensuales: PuntoVentas[] }) {
  const [rango, setRango] = useState<RangoVentas>("6m");
  const puntos = rango === "1m" ? diarias : mensuales.slice(-{ "3m": 3, "6m": 6, "1a": 12 }[rango]);

  return (
    <section className="ui-card" aria-labelledby="ventas-titulo">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="ventas-titulo" className="flex items-center gap-2 ui-title-section">
          <Icon name="chartBars" className="h-6 w-6 text-gold" /> Ventas
        </h2>
        <Link href="/panel/ventas" className="ui-btn-sm min-h-11">
          Ver registro <Icon name="chevronRight" className="h-4 w-4" />
        </Link>
      </div>
      <div className="mb-2 grid grid-cols-4 gap-1 rounded-ui border border-line p-1" role="group" aria-label="Período de la gráfica">
        {RANGOS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRango(r.id)}
            aria-pressed={rango === r.id}
            aria-label={r.nombre}
            className={`min-h-10 rounded-[8px] text-[13px] font-bold tracking-[0.04em] transition-colors ${
              rango === r.id ? "bg-gold text-black" : "text-fg-2 hover:bg-surface-2"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <SalesLine key={rango} puntos={puntos} />
    </section>
  );
}

/** Línea dorada con puntos; cada punto se puede tocar o enfocar para ver su dato. */
function SalesLine({ puntos }: { puntos: PuntoVentas[] }) {
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(0, ...puntos.map((p) => p.revenue));
  const W = 300;
  const H = 120;
  const pad = 8;
  const pts = puntos.map((p, i) => ({
    x: puntos.length > 1 ? pad + (i * (W - 2 * pad)) / (puntos.length - 1) : W / 2,
    y: H - pad - (max === 0 ? 0 : (p.revenue / max) * (H - 2 * pad)),
  }));
  const line = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const area = pts.length ? `${pts[0].x},${H} ${line} ${pts[pts.length - 1].x},${H}` : "";
  const elegido = sel !== null ? puntos[sel] : null;
  // Con muchos puntos (1 mes por días) se rotula uno de cada cinco.
  const cadaCuanto = puntos.length > 12 ? 5 : 1;

  return (
    <figure>
      <p className="mb-2 min-h-6 text-[13px] text-fg-2 first-letter:uppercase" aria-live="polite">
        {elegido ? `${elegido.largo}: ${money(elegido.revenue)} · ${units(elegido.units)}` : ""}
      </p>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-36 w-full overflow-visible sm:h-44" aria-hidden>
          <defs>
            <linearGradient id="gn-ventas-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--gold)" stopOpacity="0.28" />
              <stop offset="1" stopColor="var(--gold)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.5, 1].map((f) => (
            <line key={f} x1="0" x2={W} y1={H - pad - f * (H - 2 * pad)} y2={H - pad - f * (H - 2 * pad)} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          <line x1="0" x2={W} y1={H - pad} y2={H - pad} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {max > 0 && <polygon points={area} fill="url(#gn-ventas-area)" />}
          <polyline points={line} fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* Puntos en HTML para que mantengan su forma aunque la gráfica se estire. */}
        {pts.map((p, i) => (
          <button
            key={puntos[i].key}
            type="button"
            onClick={() => setSel(i)}
            onFocus={() => setSel(i)}
            aria-label={`${puntos[i].largo}: ${money(puntos[i].revenue)}`}
            className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full ${puntos.length > 12 ? "h-6 w-6" : "h-8 w-8"}`}
            style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%` }}
          >
            <span className={`block rounded-full bg-gold ring-2 ring-surface ${sel === i ? "h-3 w-3" : puntos.length > 12 ? "h-1.5 w-1.5" : "h-2 w-2"}`} />
          </button>
        ))}
      </div>
      <div className="relative mt-2 h-4 text-[12px] text-fg-2" aria-hidden>
        {pts.map((p, i) =>
          i % cadaCuanto === (puntos.length - 1) % cadaCuanto ? (
            <span key={puntos[i].key} className="absolute -translate-x-1/2 first-letter:uppercase" style={{ left: `${(p.x / W) * 100}%` }}>
              {puntos[i].label}
            </span>
          ) : null,
        )}
      </div>
      <table className="sr-only">
        <caption>Ventas por período</caption>
        <tbody>
          {puntos.map((p) => (
            <tr key={p.key}>
              <th scope="row">{p.largo}</th>
              <td>{money(p.revenue)}</td>
              <td>{units(p.units)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
