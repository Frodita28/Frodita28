import { Flash } from "@/components/flash";
import { PageTitle } from "@/components/nav";
import { SaleSource, SaleStatus, saleTotal, saleUnits, type SaleWithItems } from "@/components/sale-status";
import { requireUser } from "@/lib/auth";
import { canUndoPosSale, normalizeGarmentCode, SALE_CHANNELS } from "@/lib/pos";
import { money } from "@/lib/store";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TZ, formatDateTime, utcToZonedLocal } from "@/lib/time";
import { cancelOwnSale } from "./actions";
import { PointOfSale } from "./pos";

export const metadata = { title: "Ventas" };

const CHANNEL_LABEL: Record<string, string> = Object.fromEntries(SALE_CHANNELS);

type Unit = { product_id: string; unit_price: number; products: { name: string; sku: string } | null };

export default async function SalesPage({ searchParams }: PageProps<"/panel/ventas">) {
  const sp = await searchParams;
  const user = await requireUser("/panel/ventas");
  const supabase = await createClient();
  const [{ data: salesData }, { data: unitData }, { data: license }] = await Promise.all([
    supabase
      .from("sales")
      .select("id, reference, source, sold_at, created_at, channel, customer_ref, status, rejection_reason, cancel_reason, sale_items(quantity, unit_price, products(name), garment_units(code))")
      .eq("licensee_id", user.id)
      .order("sold_at", { ascending: false })
      .limit(100),
    supabase.from("garment_units").select("product_id, unit_price, products(name, sku)").eq("licensee_id", user.id).eq("status", "in_store"),
    supabase.from("licenses").select("id").eq("user_id", user.id).eq("status", "active").maybeSingle(),
  ]);
  const sales = (salesData ?? []) as unknown as SaleWithItems[];
  const units = (unitData ?? []) as unknown as Unit[];
  const verified = sales.filter((s) => s.status === "verified");
  const today = utcToZonedLocal(new Date(), DEFAULT_TZ).slice(0, 10);
  const todays = verified.filter((s) => utcToZonedLocal(new Date(s.sold_at), DEFAULT_TZ).startsWith(today));

  const stock = new Map<string, { name: string; sku: string; count: number; prices: Set<number> }>();
  for (const u of units) {
    const row = stock.get(u.product_id) ?? { name: u.products?.name ?? "—", sku: u.products?.sku ?? "", count: 0, prices: new Set<number>() };
    row.count++;
    row.prices.add(Number(u.unit_price));
    stock.set(u.product_id, row);
  }
  const code = typeof sp.codigo === "string" ? normalizeGarmentCode(sp.codigo) : null;

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <PageTitle eyebrow="Punto de venta" title="Ventas de tu tienda">
        Cada prenda que sale se registra escaneando su QR. La venta queda registrada al instante, la prenda sale de tu stock
        y cuenta para Tu Tienda y tus misiones.
      </PageTitle>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card"><p className="label">Ventas de hoy</p><p className="font-display text-xl">{todays.length}</p></div>
        <div className="card"><p className="label">Prendas vendidas hoy</p><p className="font-display text-xl">{todays.reduce((s, v) => s + saleUnits(v), 0)}</p></div>
        <div className="card"><p className="label">Total de hoy</p><p className="font-display text-xl">{money(todays.reduce((s, v) => s + saleTotal(v), 0))}</p></div>
        <div className="card"><p className="label">Prendas con QR en tienda</p><p className="font-display text-xl">{units.length}</p></div>
      </div>

      <PointOfSale userId={user.id} initialCode={code} disabled={!license} />

      {stock.size > 0 && (
        <details className="card mb-6">
          <summary className="cursor-pointer text-sm font-semibold">Prendas disponibles para vender ({units.length})</summary>
          <ul className="mt-3 divide-y divide-ash text-sm">
            {[...stock.values()].sort((a, b) => a.name.localeCompare(b.name)).map((r) => (
              <li key={r.sku} className="flex justify-between gap-3 py-2">
                <span>{r.name} <span className="text-xs text-parchment">· {r.sku}</span></span>
                <span className="whitespace-nowrap text-parchment">{r.count} × {[...r.prices].map(money).join(" / ")}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <h2 className="eyebrow mb-3">Registro de ventas</h2>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Fecha</th><th>Venta</th><th>Prendas</th><th className="text-right">Total</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {sales.length === 0 && (
              <tr><td colSpan={6} className="text-parchment">Todavía no hay ventas. Escanea una prenda para registrar la primera.</td></tr>
            )}
            {sales.map((s) => (
              <tr key={s.id}>
                <td className="whitespace-nowrap text-parchment">{formatDateTime(s.sold_at)}</td>
                <td>
                  <div className="flex items-center gap-2">{s.reference} <SaleSource source={s.source} /></div>
                  <div className="text-xs text-parchment">{CHANNEL_LABEL[s.channel] ?? s.channel}{s.customer_ref ? ` · ${s.customer_ref}` : ""}</div>
                </td>
                <td className="text-xs">
                  {s.sale_items.map((i, k) => (
                    <div key={k}>
                      {i.quantity} × {i.products?.name}
                      {i.garment_units?.code && <span className="ml-1 font-mono text-parchment">{i.garment_units.code}</span>}
                    </div>
                  ))}
                </td>
                <td className="text-right">{money(saleTotal(s))}</td>
                <td>
                  <SaleStatus status={s.status} />
                  {(s.rejection_reason || s.cancel_reason) && <div className="mt-1 text-xs text-parchment">{s.rejection_reason ?? s.cancel_reason}</div>}
                </td>
                <td>
                  {s.source === "pos" && s.status === "verified" && canUndoPosSale(s.created_at) && (
                    <form action={cancelOwnSale}>
                      <input type="hidden" name="sale_id" value={s.id} />
                      <button className="text-xs text-parchment underline hover:text-bad">Anular</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-parchment">
        Puedes anular una venta en sus primeros 15 minutos si fue un error de caja; después, pídeselo a Gallo Negro.
      </p>
    </>
  );
}
