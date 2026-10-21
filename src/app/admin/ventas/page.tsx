import Link from "next/link";
import { Flash } from "@/components/flash";
import { PageTitle } from "@/components/nav";
import { SaleStatus, saleTotal, type SaleWithItems } from "@/components/sale-status";
import { formatDateTime } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { cancelSaleAdmin, reviewSale } from "../actions";

export const metadata = { title: "Ventas · Admin" };

const FILTERS = [["pending", "Por verificar"], ["verified", "Verificadas"], ["rejected", "Rechazadas"], ["cancelled", "Anuladas"]] as const;
type Sale = SaleWithItems & { licensee_id: string; notes: string | null; profiles: { full_name: string | null; public_alias: string | null } | null };

export default async function AdminSales({ searchParams }: PageProps<"/admin/ventas">) {
  const sp = await searchParams;
  const status = FILTERS.some(([k]) => k === sp.status) ? (sp.status as string) : "pending";
  const supabase = await createClient();
  const { data } = await supabase
    .from("sales")
    .select("id, licensee_id, reference, sold_at, channel, customer_ref, notes, status, rejection_reason, cancel_reason, profiles!sales_licensee_id_fkey(full_name, public_alias), sale_items(quantity, unit_price, products(name))")
    .eq("status", status)
    .order("sold_at", { ascending: status === "pending" })
    .limit(200);
  const sales = (data ?? []) as unknown as Sale[];

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <PageTitle eyebrow="Verificación" title="Ventas de licenciados">
        Verifica solo ventas reales con comprobante. Las ventas verificadas alimentan las misiones automáticamente.
        No puedes verificar tus propias ventas.
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
                <td>{s.profiles?.public_alias ?? s.profiles?.full_name ?? s.licensee_id.slice(0, 8)}</td>
                <td>
                  {s.reference}
                  <div className="text-xs capitalize text-parchment">{s.channel}{s.customer_ref ? ` · ${s.customer_ref}` : ""}</div>
                  {s.notes && <div className="text-xs text-parchment">{s.notes}</div>}
                </td>
                <td className="text-xs">{s.sale_items.map((i, k) => <div key={k}>{i.quantity} × {i.products?.name} @ {Number(i.unit_price)}</div>)}</td>
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
