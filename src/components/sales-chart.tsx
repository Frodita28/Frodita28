"use client";

import { useState } from "react";
import { money, monthLabel, niceMax, units, type StoreMonth } from "@/lib/store";

/**
 * Gráfica de barras de ventas verificadas por mes (una sola serie).
 * Se dibuja con HTML/CSS para que los textos mantengan su tamaño en el móvil. Cada barra
 * se puede tocar (o enfocar) para ver su dato, sin depender del cursor; la tabla sigue debajo.
 */
export function SalesChart({ months }: { months: StoreMonth[] }) {
  const max = niceMax(Math.max(0, ...months.map((m) => m.revenue)));
  const empty = max === 0;
  const ticks = empty ? [] : [max, max / 2, 0];
  const [sel, setSel] = useState<number | null>(null);
  const label = (m: StoreMonth) => `${monthLabel(m.month, true)}: ${money(m.revenue)} · ${units(m.units)}`;
  const elegido = sel !== null ? months[sel] : null;

  return (
    <figure>
      {!empty && (
        <p className="mb-2 min-h-6 text-[13px] text-fg-2 first-letter:uppercase" aria-live="polite">
          {elegido ? label(elegido) : "Toca una barra para ver su dato."}
        </p>
      )}
      <div className="flex gap-2" role="group" aria-label="Ventas registradas por mes">
        {!empty && (
          <div className="ui-num flex h-32 flex-col justify-between text-right text-[11px] font-normal text-fg-2 sm:h-44 sm:text-xs" aria-hidden>
            {ticks.map((t) => <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0 leading-none">{money(t)}</span>)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="relative h-32 border-b border-line sm:h-44">
            {!empty && <div className="absolute inset-x-0 top-0 border-t border-line/60" aria-hidden />}
            {!empty && <div className="absolute inset-x-0 top-1/2 border-t border-line/60" aria-hidden />}
            {empty && (
              <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-fg-2">
                Aún no hay ventas registradas en estos meses.
              </p>
            )}
            {!empty && (
              <div className="relative flex h-full items-end">
                {months.map((m, i) => (
                  <button
                    key={m.month}
                    type="button"
                    onClick={() => setSel(sel === i ? null : i)}
                    aria-pressed={sel === i}
                    aria-label={label(m)}
                    className="group relative flex h-full flex-1 items-end justify-center rounded-t-[2px] focus-visible:bg-surface-2"
                  >
                    {m.revenue > 0 && (
                      <span
                        className={`block w-3/5 max-w-10 rounded-t-[2px] bg-accent transition-opacity duration-150 group-hover:opacity-80 ${
                          sel !== null && sel !== i ? "opacity-50" : ""
                        }`}
                        style={{ height: `${(m.revenue / max) * 100}%` }}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mt-2 flex text-[11px] text-fg-2 sm:text-xs" aria-hidden>
            {months.map((m, i) => (
              <span key={m.month} className={`flex-1 text-center capitalize ${sel === i ? "font-semibold text-fg" : ""}`}>{monthLabel(m.month)}</span>
            ))}
          </div>
        </div>
      </div>
      <details className="mt-4">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-[13px] text-fg-2 underline decoration-fg-3 underline-offset-4 hover:text-fg sm:min-h-9">Ver datos en tabla</summary>
        <div className="ui-table-wrap mt-2">
          <table className="ui-table">
            <thead>
              <tr><th>Mes</th><th className="text-right">Total</th><th className="text-right">Prendas</th></tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.month}>
                  <td className="capitalize">{monthLabel(m.month, true)}</td>
                  <td className="ui-num text-right">{money(m.revenue)}</td>
                  <td className="ui-num text-right">{m.units}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
