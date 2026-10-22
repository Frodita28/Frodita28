import Link from "next/link";
import { Flash } from "@/components/flash";
import { PageTitle } from "@/components/nav";
import { SaleSource, SaleStatus, saleTotal, type SaleWithItems } from "@/components/sale-status";
import { SALE_CHANNELS } from "@/lib/pos";
import { formatDateTime } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { cancelSaleAdmin, reviewSale } from "../actions";

export const metadata = { title: "Ventas · Admin" };

const CHANNEL_LABEL: Record<string, string> = Object.fromEntries(SALE_CHANNELS);
const FILTERS = [["verified", "Registradas"], ["pending", "Manuales por verificar"], ["cancelled", "Anuladas"], ["rejected", "Rechazadas"]] as const;
type Sale = SaleWithItems & { licensee_id: string; notes: string | null; profiles: { full_name: string | null; public_alias: string | null; store_name: string | null } | null };

export default async function AdminSales({ searchParams }: PageProps<"/admin/ventas">) {
  const sp = await searchParams;
  const status = FILTERS.some(([k]) => k === sp.status) ? (sp.status as string) : "verified";
  const supabase = await createClient();
  const { data } = await supabase
    .from("sales")
    .select("id, licensee_id, reference, source, sold_at, created_at, channel, customer_ref, notes, status, rejection_reason, cancel_reason, profiles!sales_licensee_id_fkey(full_name, public_alias, store_name), sale_items(quantity, unit_price, products(name), garment_units(code))")
    .eq("status", status)
    .order("sold_at", { ascending: status === "pending" })
    .limit(200);
  const sales = (data ?? []) as unknown as Sale[];

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <PageTitle eyebrow="Punto de venta" title="Ventas de las tiendas">
        Cada venta se registra en el punto de venta de la tienda escaneando el QR de las prendas: cuenta al instante para Tu
        Tienda y las misiones. Si una venta no corresponde, anúlala con un motivo: las prendas vuelven al stock y, si ya dio
        XP, se genera una alerta. Las ventas manuales anteriores al punto de venta se siguen verificando aquí.
      </PageTitle>
      <nav className="mb-4 flex gap-2 overflow-x-auto">
        {FILTERS.map(([k, l]) => (
          <Link key={k} href={`/admin/ventas?status=${k}`} className={`rounded-md px-3 py-1.5 text-sm ${status === k ? "bg-ash text-ivory" : "text-parchment hover:text-ivory"}`}>{l}</Link>
        ))}
      </nav>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Fecha</th><th>Licenciado</th><th>Referencia</th><th>Productos</th><th className="text-right">Total</th><th>Estado</th><th>Acción</th></tr></thead>
          <tbody>
            {sales.length === 0 && <tr><td colSpan={7} className="text-parchment">No hay ventas en este estado.</td></tr>}
            {sales.map((s) => (
              <tr key={s.id}>
                <td className="whitespace-nowrap text-parchment">{formatDateTime(s.sold_at)}</td>
                <td>{s.profiles?.store_name ?? s.profiles?.public_alias ?? s.profiles?.full_name ?? s.licensee_id.slice(0, 8)}</td>
                <td>
                  <div className="flex items-center gap-2">{s.reference} <SaleSource source={s.source} /></div>
                  <div className="text-xs text-parchment">{CHANNEL_LABEL[s.channel] ?? s.channel}{s.customer_ref ? ` · ${s.customer_ref}` : ""}</div>
                  {s.notes && <div className="text-xs text-parchment">{s.notes}</div>}
                </td>
                <td className="text-xs">
                  {s.sale_items.map((i, k) => (
                    <div key={k}>
                      {i.quantity} × {i.products?.name} @ {Number(i.unit_price)}
                      {i.garment_units?.code && <span className="ml-1 font-mono text-parchment">{i.garment_units.code}</span>}
                    </div>
                  ))}
                </td>
                <td className="text-right">{saleTotal(s).toFixed(2)}</td>
                <td><SaleStatus status={s.status} />{(s.rejection_reason || s.cancel_reason) && <div className="mt-1 text-xs text-parchment">{s.rejection_reason ?? s.cancel_reason}</div>}</td>
                <td className="min-w-56">
                  {s.status === "pending" && (
                    <form action={reviewSale} className="space-y-1">
                      <input type="hidden" name="sale_id" value={s.id} />
                      <input className="input px-2 py-1 text-xs" name="reason" placeholder="Motivo si rechazas" maxLength={500} />
                      <div className="flex gap-2">
                        <button name="decision" value="approve" className="btn-primary px-3 py-1 text-xs">Verificar</button>
                        <button name="decision" value="reject" className="btn-danger px-3 py-1 text-xs">Rechazar</button>
                      </div>
                    </form>
                  )}
                  {s.status === "verified" && (
                    <form action={cancelSaleAdmin} className="flex gap-1">
                      <input type="hidden" name="sale_id" value={s.id} />
                      <input className="input px-2 py-1 text-xs" name="reason" placeholder="Motivo de anulación" required minLength={3} maxLength={500} />
                      <button className="btn-danger px-3 py-1 text-xs">Anular</button>
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
