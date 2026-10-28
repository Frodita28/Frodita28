import { Accordion, Badge, PageBanner, SectionHeader, StatCard, type BadgeTone } from "@/components/ui";
import { Flash } from "@/components/flash";
import { SALE_STATUS, saleTotal, saleUnits, type SaleWithItems } from "@/components/sale-status";
import { requireUser } from "@/lib/auth";
import { canUndoPosSale, normalizeGarmentCode, SALE_CHANNELS } from "@/lib/pos";
import { money } from "@/lib/store";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TZ, formatDateTime, utcToZonedLocal } from "@/lib/time";
import { cancelOwnSale } from "./actions";
import { PointOfSale } from "./pos";

export const metadata = { title: "Ventas" };

const CHANNEL_LABEL: Record<string, string> = Object.fromEntries(SALE_CHANNELS);

/** Estado de la venta con los tonos del panel (rojo solo para rechazos). */
const SALE_TONE: Record<SaleWithItems["status"], BadgeTone> = { pending: "accent", verified: "neutral", rejected: "alert", cancelled: "neutral" };

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
      <div className="flex flex-col gap-4">
        <Flash ok={sp.ok} error={sp.error} variant="panel" />
        <PageBanner title="Ventas de tu tienda">
          Cada prenda que sale se registra escaneando su QR. La venta queda registrada al instante, la prenda sale de tu stock
          y cuenta para tu Perfil y tus misiones.
        </PageBanner>
      </div>

      <section className="flex flex-col gap-4" aria-label="Punto de venta">
        <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
          <StatCard label="Ventas de hoy" value={todays.length} />
          <StatCard label="Prendas vendidas hoy" value={todays.reduce((s, v) => s + saleUnits(v), 0)} />
          <StatCard label="Total de hoy" value={money(todays.reduce((s, v) => s + saleTotal(v), 0))} />
          <StatCard label="Prendas con QR en tienda" value={units.length} />
        </div>

        <PointOfSale userId={user.id} initialCode={code} disabled={!license} />

        {stock.size > 0 && (
          <Accordion title={`Prendas disponibles para vender (${units.length})`}>
            <ul className="divide-y divide-line">
              {[...stock.values()].sort((a, b) => a.name.localeCompare(b.name)).map((r) => (
                <li key={r.sku} className="flex justify-between gap-4 py-3">
                  <span className="min-w-0 [overflow-wrap:anywhere]">{r.name} <span className="text-[13px] text-fg-2">· {r.sku}</span></span>
                  <span className="ui-num text-right whitespace-nowrap text-fg-2">{r.count} × {[...r.prices].map(money).join(" / ")}</span>
                </li>
              ))}
            </ul>
          </Accordion>
        )}
      </section>

      <section>
        <SectionHeader title="Registro de ventas" />
        {/* Teléfono: cada venta es una tarjeta de dos líneas. */}
        <ul className="divide-y divide-line rounded-ui border border-line bg-surface md:hidden">
          {sales.length === 0 && <li className="p-4 text-fg-2">Todavía no hay ventas. Escanea una prenda para registrar la primera.</li>}
          {sales.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {s.reference} <Badge>{s.source === "pos" ? "QR" : "Manual"}</Badge>
                  </p>
                  <p className="mt-1 text-[13px] text-fg-2">
                    {formatDateTime(s.sold_at)} · {CHANNEL_LABEL[s.channel] ?? s.channel}
                    {s.customer_ref ? ` · ${s.customer_ref}` : ""}
                  </p>
                </div>
                <span className="ui-num shrink-0 text-right">{money(saleTotal(s))}</span>
              </div>
              <ul className="text-[13px] text-fg-2">
                {s.sale_items.map((i, k) => (
                  <li key={k} className="[overflow-wrap:anywhere]">
                    {i.quantity} × {i.products?.name}
                    {i.garment_units?.code && <span className="ml-1 font-mono">{i.garment_units.code}</span>}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <Badge tone={SALE_TONE[s.status]}>{SALE_STATUS[s.status].label}</Badge>
                  {(s.rejection_reason || s.cancel_reason) && <p className="mt-1 text-[13px] text-fg-2">{s.rejection_reason ?? s.cancel_reason}</p>}
                </div>
                {s.source === "pos" && s.status === "verified" && canUndoPosSale(s.created_at) && (
                  <form action={cancelOwnSale}>
                    <input type="hidden" name="sale_id" value={s.id} />
                    <button className="ui-btn-sm">Anular</button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="ui-table-wrap hidden md:block">
          <table className="ui-table">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Venta</th>
                <th scope="col">Prendas</th>
                <th scope="col" className="text-right">Total</th>
                <th scope="col">Estado</th>
                <th scope="col"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 && (
                <tr><td colSpan={6} className="text-fg-2">Todavía no hay ventas. Escanea una prenda para registrar la primera.</td></tr>
              )}
              {sales.map((s) => (
                <tr key={s.id}>
                  <td className="whitespace-nowrap text-fg-2">{formatDateTime(s.sold_at)}</td>
                  <td>
                    <div className="flex items-center gap-2 whitespace-nowrap">{s.reference} <Badge>{s.source === "pos" ? "QR" : "Manual"}</Badge></div>
                    <div className="mt-1 text-[13px] text-fg-2">{CHANNEL_LABEL[s.channel] ?? s.channel}{s.customer_ref ? ` · ${s.customer_ref}` : ""}</div>
                  </td>
                  <td className="text-[13px]">
                    {s.sale_items.map((i, k) => (
                      <div key={k}>
                        {i.quantity} × {i.products?.name}
                        {i.garment_units?.code && <span className="ml-1 font-mono text-fg-2">{i.garment_units.code}</span>}
                      </div>
                    ))}
                  </td>
                  <td className="ui-num text-right whitespace-nowrap">{money(saleTotal(s))}</td>
                  <td>
                    <Badge tone={SALE_TONE[s.status]}>{SALE_STATUS[s.status].label}</Badge>
                    {(s.rejection_reason || s.cancel_reason) && <div className="mt-1 text-[13px] text-fg-2">{s.rejection_reason ?? s.cancel_reason}</div>}
                  </td>
                  <td>
                    {s.source === "pos" && s.status === "verified" && canUndoPosSale(s.created_at) && (
                      <form action={cancelOwnSale}>
                        <input type="hidden" name="sale_id" value={s.id} />
                        <button className="ui-btn-sm">Anular</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[13px] text-fg-2">
          Puedes anular una venta en sus primeros 15 minutos si fue un error de caja; después, pídeselo a Gallo Negro.
        </p>
      </section>
    </>
  );
}
