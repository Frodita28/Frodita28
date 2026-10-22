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
          <div className="flex h-44 flex-col justify-between text-right text-[11px] text-parchment" aria-hidden>
            {ticks.map((t) => <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0 leading-none">{money(t)}</span>)}
          </div>
        )}
        <div className="flex-1">
          <div className="relative h-44 border-b border-smoke">
            {!empty && <div className="absolute inset-x-0 top-0 border-t border-ash" aria-hidden />}
            {!empty && <div className="absolute inset-x-0 top-1/2 border-t border-ash" aria-hidden />}
            {empty && (
              <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-parchment">
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
                        className="w-3/5 max-w-10 bg-gold transition-colors group-hover:bg-gold-soft"
                        style={{ height: `${(m.revenue / max) * 100}%` }}
                      />
                    )}
                    {/* Detalle al pasar el cursor (y en lectores de pantalla). */}
                    <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-md border border-smoke bg-obsidian px-2 py-1 text-xs text-ivory group-hover:block">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-1 flex text-[11px] text-parchment" aria-hidden>
            {months.map((m) => <span key={m.month} className="flex-1 text-center capitalize">{monthLabel(m.month)}</span>)}
          </div>
        </div>
      </div>
      <details className="mt-3 text-xs text-parchment">
        <summary className="cursor-pointer">Ver datos en tabla</summary>
        <div className="table-wrap mt-2">
          <table className="table">
            <thead>
              <tr><th>Mes</th><th className="text-right">Total</th><th className="text-right">Prendas</th></tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.month}>
                  <td className="capitalize">{monthLabel(m.month, true)}</td>
                  <td className="text-right">{money(m.revenue)}</td>
                  <td className="text-right">{m.units}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
