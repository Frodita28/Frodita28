import { Flash } from "@/components/flash";
import { PageTitle } from "@/components/nav";
import { SaleStatus, saleTotal, saleUnits, type SaleWithItems } from "@/components/sale-status";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TZ, formatDateTime, utcToZonedLocal } from "@/lib/time";
import { cancelOwnSale, createSale } from "./actions";

export const metadata = { title: "Ventas" };

const CHANNELS = [
  ["instagram", "Instagram"],
  ["whatsapp", "WhatsApp"],
  ["tiktok", "TikTok"],
  ["presencial", "Presencial"],
  ["evento", "Evento"],
  ["otro", "Otro"],
] as const;

const money = (n: number) => new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export default async function SalesPage({ searchParams }: PageProps<"/panel/ventas">) {
  const sp = await searchParams;
  const user = await requireUser("/panel/ventas");
  const supabase = await createClient();
  const [{ data: products }, { data: salesData }] = await Promise.all([
    supabase.from("products").select("id, name, sku, is_demo, product_categories(name)").eq("is_active", true).order("name"),
    supabase
      .from("sales")
      .select("id, reference, sold_at, channel, customer_ref, status, rejection_reason, cancel_reason, sale_items(quantity, unit_price, products(name))")
      .eq("licensee_id", user.id)
      .order("sold_at", { ascending: false })
      .limit(100),
  ]);
  const sales = (salesData ?? []) as unknown as SaleWithItems[];
  const verified = sales.filter((s) => s.status === "verified");
  const now = utcToZonedLocal(new Date(), DEFAULT_TZ);

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <PageTitle eyebrow="Registro comercial" title="Ventas de tu tienda">
        Registra cada venta real con una referencia única (número de pedido, chat o factura). Solo las ventas
        verificadas por Gallo Negro cuentan para tus misiones.
      </PageTitle>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card"><p className="label">Ventas verificadas</p><p className="font-display text-xl">{verified.length}</p></div>
        <div className="card"><p className="label">Unidades verificadas</p><p className="font-display text-xl">{verified.reduce((s, v) => s + saleUnits(v), 0)}</p></div>
        <div className="card"><p className="label">Ingresos brutos verificados</p><p className="font-display text-xl">{money(verified.reduce((s, v) => s + saleTotal(v), 0))}</p></div>
        <div className="card"><p className="label">Pendientes</p><p className="font-display text-xl">{sales.filter((s) => s.status === "pending").length}</p></div>
      </div>

      <section className="card mb-6">
        <h2 className="eyebrow mb-4">Registrar venta</h2>
        <form action={createSale} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label" htmlFor="reference">Referencia</label>
              <input className="input" id="reference" name="reference" required maxLength={80} placeholder="IG-2026-001" />
            </div>
            <div>
              <label className="label" htmlFor="sold_at">Fecha y hora (Caracas)</label>
              <input className="input" id="sold_at" name="sold_at" type="datetime-local" required defaultValue={now} max={now} />
            </div>
            <div>
              <label className="label" htmlFor="channel">Canal</label>
              <select className="input" id="channel" name="channel" required>
                {CHANNELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="customer_ref">Cliente (alias privado)</label>
              <input className="input" id="customer_ref" name="customer_ref" maxLength={120} placeholder="Ej.: @usuario o nombre" />
            </div>
          </div>
          <p className="text-xs text-parchment">El identificador del cliente solo lo ven tú y Gallo Negro. Sirve para misiones de fidelización.</p>

          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="grid grid-cols-6 gap-2">
                <select className="input col-span-6 sm:col-span-3" name={`product_${i}`} defaultValue="" required={i === 0} aria-label={`Producto ${i + 1}`}>
                  <option value="">{i === 0 ? "Producto…" : "Otro producto (opcional)"}</option>
                  {(products ?? []).map((p) => (
                    <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>
                  ))}
                </select>
                <input className="input col-span-3 sm:col-span-1" name={`quantity_${i}`} type="number" min={1} max={1000} defaultValue={1} aria-label="Cantidad" />
                <input className="input col-span-3 sm:col-span-2" name={`price_${i}`} type="number" min={0} step="0.01" placeholder="Precio unitario" aria-label="Precio unitario" required={i === 0} />
              </div>
            ))}
          </div>
          <input className="input" name="notes" maxLength={1000} placeholder="Notas (opcional)" />
          <button className="btn-primary">Registrar venta</button>
        </form>
      </section>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Fecha</th><th>Referencia</th><th>Productos</th><th className="text-right">Total</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {sales.length === 0 && (
              <tr><td colSpan={6} className="text-parchment">Aún no registraste ventas.</td></tr>
            )}
            {sales.map((s) => (
              <tr key={s.id}>
                <td className="whitespace-nowrap text-parchment">{formatDateTime(s.sold_at)}</td>
                <td>{s.reference}<div className="text-xs capitalize text-parchment">{s.channel}{s.customer_ref ? ` · ${s.customer_ref}` : ""}</div></td>
                <td className="text-xs">{s.sale_items.map((i, k) => <div key={k}>{i.quantity} × {i.products?.name}</div>)}</td>
                <td className="text-right">{money(saleTotal(s))}</td>
                <td>
                  <SaleStatus status={s.status} />
                  {s.rejection_reason && <div className="mt-1 text-xs text-bad">{s.rejection_reason}</div>}
                </td>
                <td>
                  {s.status === "pending" && (
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
    </>
  );
}
