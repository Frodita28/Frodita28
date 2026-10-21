import { Flash } from "@/components/flash";
import { PageTitle } from "@/components/nav";
import { formatDay } from "@/lib/missions";
import { money } from "@/lib/store";
import { createClient } from "@/lib/supabase/server";
import { recordInvestment, recordStockMovement } from "./actions";

export const metadata = { title: "Tiendas · Admin" };

const KIND = { delivery: "Entrega", return: "Devolución", adjustment: "Ajuste" } as const;
const CONCEPT = { license: "Licencia", merchandise: "Mercancía", other: "Otro", correction: "Corrección" } as const;

type Store = { id: string; store_name: string | null; full_name: string | null; public_alias: string | null };
type Movement = { id: string; licensee_id: string; kind: keyof typeof KIND; quantity: number; note: string | null; created_at: string; products: { name: string; sku: string } | null };
type Investment = { id: string; licensee_id: string; concept: keyof typeof CONCEPT; amount: number; invested_at: string; note: string | null };

const storeLabel = (s: Store | undefined) => s?.store_name ?? s?.public_alias ?? s?.full_name ?? "Tienda sin nombre";

export default async function Stores({ searchParams }: PageProps<"/admin/tiendas">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: storeData }, { data: products }, { data: movData }, { data: invData }] = await Promise.all([
    supabase.from("profiles").select("id, store_name, full_name, public_alias").eq("role", "licensee").order("store_name"),
    supabase.from("products").select("id, sku, name").eq("is_active", true).order("name"),
    supabase.from("store_stock_movements").select("id, licensee_id, kind, quantity, note, created_at, products(name, sku)").order("created_at", { ascending: false }).limit(50),
    supabase.from("store_investments").select("id, licensee_id, concept, amount, invested_at, note").order("invested_at", { ascending: false }).limit(50),
  ]);
  const stores = (storeData ?? []) as Store[];
  const byId = new Map(stores.map((s) => [s.id, s]));
  const movements = (movData ?? []) as unknown as Movement[];
  const investments = (invData ?? []) as unknown as Investment[];
  const today = new Date().toISOString().slice(0, 10);

  const storeSelect = (
    <select className="input" name="licensee_id" required defaultValue="">
      <option value="" disabled>Elige…</option>
      {stores.map((s) => <option key={s.id} value={s.id}>{storeLabel(s)}</option>)}
    </select>
  );

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <PageTitle eyebrow="Red de tiendas" title="Tiendas">
        Registra aquí las prendas que entregas a cada tienda y lo que cada licenciado ha invertido. Estos datos alimentan
        “Tu Tienda”: existencias = entregas, devoluciones y ajustes menos prendas de ventas verificadas. Los registros no se
        editan ni se borran; para corregir, registra un ajuste o una corrección.
      </PageTitle>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="eyebrow mb-4">Movimiento de inventario</h2>
          <form action={recordStockMovement} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label">Tienda</label>{storeSelect}</div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="product_id">Producto</label>
              <select className="input" id="product_id" name="product_id" required defaultValue="">
                <option value="" disabled>Elige…</option>
                {(products ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="kind">Tipo</label>
              <select className="input" id="kind" name="kind" defaultValue="delivery">
                {Object.entries(KIND).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div><label className="label" htmlFor="quantity">Prendas</label><input className="input" id="quantity" name="quantity" type="number" step={1} required /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="stock_note">Nota</label><input className="input" id="stock_note" name="note" maxLength={500} /></div>
            <p className="text-xs text-parchment sm:col-span-2">En un ajuste usa un número negativo para retirar prendas.</p>
            <button className="btn-bronze sm:justify-self-start">Registrar movimiento</button>
          </form>
        </section>

        <section className="card">
          <h2 className="eyebrow mb-4">Inversión del licenciado</h2>
          <form action={recordInvestment} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label">Tienda</label>{storeSelect}</div>
            <div>
              <label className="label" htmlFor="concept">Concepto</label>
              <select className="input" id="concept" name="concept" defaultValue="license">
                {Object.entries(CONCEPT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div><label className="label" htmlFor="amount">Monto</label><input className="input" id="amount" name="amount" type="number" step="0.01" required /></div>
            <div><label className="label" htmlFor="invested_at">Fecha</label><input className="input" id="invested_at" name="invested_at" type="date" max={today} defaultValue={today} required /></div>
            <div><label className="label" htmlFor="inv_note">Nota</label><input className="input" id="inv_note" name="note" maxLength={500} /></div>
            <p className="text-xs text-parchment sm:col-span-2">Solo una corrección puede ser negativa.</p>
            <button className="btn-bronze sm:justify-self-start">Registrar inversión</button>
          </form>
        </section>
      </div>

      <h2 className="eyebrow mb-3 mt-8">Últimos movimientos de inventario</h2>
      {movements.length === 0 ? (
        <p className="text-sm text-parchment">Todavía no hay movimientos registrados.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Fecha</th><th>Tienda</th><th>Producto</th><th>Tipo</th><th className="text-right">Prendas</th><th>Nota</th></tr></thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td>{formatDay(m.created_at.slice(0, 10))}</td>
                  <td>{storeLabel(byId.get(m.licensee_id))}</td>
                  <td>{m.products?.name ?? "—"}</td>
                  <td>{KIND[m.kind]}</td>
                  <td className="text-right">{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                  <td className="text-parchment">{m.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="eyebrow mb-3 mt-8">Últimas inversiones</h2>
      {investments.length === 0 ? (
        <p className="text-sm text-parchment">Todavía no hay inversiones registradas.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Fecha</th><th>Tienda</th><th>Concepto</th><th className="text-right">Monto</th><th>Nota</th></tr></thead>
            <tbody>
              {investments.map((i) => (
                <tr key={i.id}>
                  <td>{formatDay(i.invested_at)}</td>
                  <td>{storeLabel(byId.get(i.licensee_id))}</td>
                  <td>{CONCEPT[i.concept]}</td>
                  <td className="text-right">{money(Number(i.amount))}</td>
                  <td className="text-parchment">{i.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
