import { money, monthLabel, niceMax, units, type StoreMonth } from "@/lib/store";

/**
 * Gráfica de barras de ventas verificadas por mes (una sola serie).
 * Se dibuja con HTML/CSS para que los textos mantengan su tamaño en el móvil.
 */
export function SalesChart({ months }: { months: StoreMonth[] }) {
  const max = niceMax(Math.max(0, ...months.map((m) => m.revenue)));
  const empty = max === 0;
  const ticks = empty ? [] : [max, max / 2, 0];

  return (
    <figure>
      <div className="flex gap-2" role="img" aria-label="Ventas registradas por mes">
        {!empty && (
          <div className="ui-num flex h-44 flex-col justify-between text-right text-xs font-normal text-fg-2" aria-hidden>
            {ticks.map((t) => <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0 leading-none">{money(t)}</span>)}
          </div>
        )}
        <div className="flex-1">
          <div className="relative h-44 border-b border-line">
            {!empty && <div className="absolute inset-x-0 top-0 border-t border-line/60" aria-hidden />}
            {!empty && <div className="absolute inset-x-0 top-1/2 border-t border-line/60" aria-hidden />}
            {empty && (
              <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-fg-2">
                Aún no hay ventas registradas en estos meses.
              </p>
            )}
            <div className="relative flex h-full items-end">
              {months.map((m) => {
                const label = `${monthLabel(m.month, true)}: ${money(m.revenue)} · ${units(m.units)}`;
                return (
                  <div key={m.month} className="group relative flex h-full flex-1 items-end justify-center" title={label}>
                    {m.revenue > 0 && (
                      <div
                        className="w-3/5 max-w-10 rounded-t-[2px] bg-accent transition-opacity duration-150 group-hover:opacity-80"
                        style={{ height: `${(m.revenue / max) * 100}%` }}
                      />
                    )}
                    {/* Detalle al pasar el cursor (y en lectores de pantalla). */}
                    <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-ui border border-line bg-surface-2 px-2 py-1 text-[13px] whitespace-nowrap text-fg group-hover:block">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-2 flex text-xs text-fg-2" aria-hidden>
            {months.map((m) => <span key={m.month} className="flex-1 text-center capitalize">{monthLabel(m.month)}</span>)}
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
