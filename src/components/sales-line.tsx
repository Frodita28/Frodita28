"use client";

import { useState } from "react";
import { money, monthLabel, units, type StoreMonth } from "@/lib/store";

/**
 * Ventas por mes como línea dorada con puntos (tema de Perfil). Cada punto se puede tocar o
 * enfocar para ver su dato; la tabla para lectores de pantalla va oculta debajo.
 */
export function SalesLine({ months }: { months: StoreMonth[] }) {
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(0, ...months.map((m) => m.revenue));
  const empty = max === 0;
  const W = 300;
  const H = 120;
  const pad = 8;
  const pts = months.map((m, i) => ({
    x: months.length > 1 ? pad + (i * (W - 2 * pad)) / (months.length - 1) : W / 2,
    y: H - pad - (empty ? 0 : (m.revenue / max) * (H - 2 * pad)),
  }));
  const line = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const area = pts.length ? `${pts[0].x},${H} ${line} ${pts[pts.length - 1].x},${H}` : "";
  const elegido = sel !== null ? months[sel] : null;

  return (
    <figure>
      <p className="mb-2 min-h-6 text-[13px] text-fg-2 first-letter:uppercase" aria-live="polite">
        {empty ? "Aún no hay ventas registradas en estos meses." : elegido ? `${monthLabel(elegido.month, true)}: ${money(elegido.revenue)} · ${units(elegido.units)}` : "Toca un punto para ver su dato."}
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
          {!empty && <polygon points={area} fill="url(#gn-ventas-area)" />}
          <polyline points={line} fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* Puntos en HTML para que mantengan su forma aunque la gráfica se estire. */}
        {pts.map((p, i) => (
          <button
            key={months[i].month}
            type="button"
            onClick={() => setSel(i)}
            onFocus={() => setSel(i)}
            aria-label={`${monthLabel(months[i].month, true)}: ${money(months[i].revenue)}`}
            className="absolute grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
            style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%` }}
          >
            <span className={`block rounded-full bg-gold ring-4 ring-surface ${sel === i ? "h-3 w-3" : "h-2 w-2"}`} />
          </button>
        ))}
      </div>
      <div className="mt-2 grid text-center text-[12px] text-fg-2" style={{ gridTemplateColumns: `repeat(${Math.max(months.length, 1)}, minmax(0, 1fr))` }} aria-hidden>
        {months.map((m) => (
          <span key={m.month} className="first-letter:uppercase">{monthLabel(m.month)}</span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Ventas por mes</caption>
        <tbody>
          {months.map((m) => (
            <tr key={m.month}>
              <th scope="row">{monthLabel(m.month, true)}</th>
              <td>{money(m.revenue)}</td>
              <td>{units(m.units)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
