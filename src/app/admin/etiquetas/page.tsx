import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { Flash } from "@/components/flash";
import { PageTitle } from "@/components/nav";
import { Pill } from "@/components/status-badge";
import { formatDay } from "@/lib/missions";
import { garmentQrPayload } from "@/lib/pos";
import { money } from "@/lib/store";
import { createClient } from "@/lib/supabase/server";
import { issueGarments, returnGarment } from "./actions";
import { PrintButton } from "./print-button";

export const metadata = { title: "Etiquetas QR · Admin" };

type Store = { id: string; store_name: string | null; full_name: string | null; public_alias: string | null };
type Unit = {
  id: string;
  code: string;
  batch_id: string;
  licensee_id: string;
  unit_price: number;
  status: "in_store" | "sold" | "returned";
  created_at: string;
  products: { name: string; sku: string } | null;
};

const STATUS = { in_store: ["En tienda", "bronze"], sold: ["Vendida", "ok"], returned: ["Devuelta", "neutral"] } as const;
const storeLabel = (s: Store | undefined) => s?.store_name ?? s?.public_alias ?? s?.full_name ?? "Tienda sin nombre";
const uuid = /^[0-9a-f-]{36}$/i;

/** Dominio público de la app, para que la cámara nativa del móvil abra el punto de venta. */
async function siteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return null;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function Labels({ searchParams }: PageProps<"/admin/etiquetas">) {
  const sp = await searchParams;
  const batch = typeof sp.lote === "string" && uuid.test(sp.lote) ? sp.lote : null;
  const store = typeof sp.tienda === "string" && uuid.test(sp.tienda) ? sp.tienda : null;
  const supabase = await createClient();

  let unitsQuery = supabase
    .from("garment_units")
    .select("id, code, batch_id, licensee_id, unit_price, status, created_at, products(name, sku)")
    .order("created_at", { ascending: false })
    .order("code");
  if (batch) unitsQuery = unitsQuery.eq("batch_id", batch);
  else if (store) unitsQuery = unitsQuery.eq("licensee_id", store).eq("status", "in_store");
  const [{ data: storeData }, { data: products }, { data: unitData }] = await Promise.all([
    supabase.from("profiles").select("id, store_name, full_name, public_alias").eq("role", "licensee").order("store_name"),
    supabase.from("products").select("id, sku, name, authorized_price").eq("is_active", true).order("name"),
    unitsQuery.limit(batch || store ? 500 : 1000),
  ]);
  const stores = (storeData ?? []) as Store[];
  const byId = new Map(stores.map((s) => [s.id, s]));
  const units = (unitData ?? []) as unknown as Unit[];
  const printing = Boolean(batch || store);

  const origin = printing ? await siteOrigin() : null;
  const labels = printing
    ? await Promise.all(
        units
          .filter((u) => u.status === "in_store")
          .map(async (u) => ({
            ...u,
            svg: await QRCode.toString(garmentQrPayload(origin, u.code), { type: "svg", margin: 1, errorCorrectionLevel: "M" }),
          })),
      )
    : [];

  // Lotes recientes (agrupados a partir de las últimas prendas emitidas).
  const batches = new Map<string, { id: string; store: string; product: string; date: string; total: number; inStore: number }>();
  if (!printing) {
    for (const u of units) {
      const b = batches.get(u.batch_id) ?? {
        id: u.batch_id,
        store: storeLabel(byId.get(u.licensee_id)),
        product: u.products?.name ?? "—",
        date: u.created_at,
        total: 0,
        inStore: 0,
      };
      b.total++;
      if (u.status === "in_store") b.inStore++;
      batches.set(u.batch_id, b);
    }
  }

  if (printing) {
    const title = batch ? `Lote del ${units[0] ? formatDay(units[0].created_at.slice(0, 10)) : "—"}` : `En tienda · ${storeLabel(byId.get(store!))}`;
    return (
      <>
        <div className="print:hidden">
          <Flash ok={sp.ok} error={sp.error} />
          <PageTitle eyebrow="Etiquetas QR" title={title}>
            Imprime y pega una etiqueta en cada prenda. La tienda la escanea en su punto de venta; cada QR solo puede venderse
            una vez. {origin ? "El QR abre el punto de venta de la tienda con la prenda ya agregada." : ""}
          </PageTitle>
          <div className="mb-6 flex flex-wrap gap-3">
            {labels.length > 0 && <PrintButton />}
            <Link href="/admin/etiquetas" className="btn-ghost">Volver</Link>
          </div>
          {batch && units.length > labels.length && (
            <p className="mb-4 text-sm text-parchment">
              {units.length - labels.length} prendas de este lote ya se vendieron o devolvieron y no se vuelven a imprimir.
            </p>
          )}
          {labels.length === 0 && <p className="card text-sm text-parchment">No hay prendas en tienda para imprimir.</p>}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-4 print:gap-2">
          {labels.map((l) => (
            <div key={l.id} className="break-inside-avoid rounded-lg border border-ash bg-white p-3 text-center text-black print:border-black">
              <div className="mx-auto w-full max-w-40" dangerouslySetInnerHTML={{ __html: l.svg }} />
              <p className="mt-1 font-mono text-sm font-bold tracking-wider">{l.code}</p>
              <p className="truncate text-xs">{l.products?.name}</p>
              <p className="text-sm font-semibold">{money(Number(l.unit_price))}</p>
              <p className="truncate text-[10px] uppercase tracking-wider">Gallo Negro · {storeLabel(byId.get(l.licensee_id))}</p>
            </div>
          ))}
        </div>
      </>
    );
  }

  const storeSelect = (
    <select className="input" name="licensee_id" required defaultValue="">
      <option value="" disabled>Elige…</option>
      {stores.map((s) => <option key={s.id} value={s.id}>{storeLabel(s)}</option>)}
    </select>
  );

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <PageTitle eyebrow="Punto de venta" title="Etiquetas QR">
        Cada prenda que entregas a una tienda lleva un QR único con su precio de venta. La tienda vende escaneándolo y la
        prenda sale de su stock automáticamente. Los precios los fijas tú aquí; no hay precios por defecto.
      </PageTitle>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="eyebrow mb-4">Entregar prendas con QR</h2>
          <form action={issueGarments} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label">Tienda</label>{storeSelect}</div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="product_id">Producto</label>
              <select className="input" id="product_id" name="product_id" required defaultValue="">
                <option value="" disabled>Elige…</option>
                {(products ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.sku}{p.authorized_price !== null ? ` · precio autorizado ${money(Number(p.authorized_price))}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div><label className="label" htmlFor="quantity">Prendas</label><input className="input" id="quantity" name="quantity" type="number" min={1} max={500} step={1} required defaultValue={1} /></div>
            <div><label className="label" htmlFor="unit_price">Precio de venta por prenda</label><input className="input" id="unit_price" name="unit_price" type="number" min={0} step="0.01" required /></div>
            <fieldset className="space-y-1 text-sm sm:col-span-2">
              <legend className="label">Inventario</legend>
              <label className="flex items-start gap-2">
                <input type="radio" name="mode" value="delivery" defaultChecked className="mt-1" />
                <span>Es una entrega nueva: súmalas al stock de la tienda.</span>
              </label>
              <label className="flex items-start gap-2">
                <input type="radio" name="mode" value="existing" className="mt-1" />
                <span>La tienda ya las tiene: solo etiquetar stock entregado antes sin QR.</span>
              </label>
            </fieldset>
            <div className="sm:col-span-2"><label className="label" htmlFor="note">Nota</label><input className="input" id="note" name="note" maxLength={500} placeholder="Ej.: guía de despacho" /></div>
            <button className="btn-bronze sm:justify-self-start">Generar etiquetas</button>
          </form>
        </section>

        <div className="space-y-4">
          <section className="card">
            <h2 className="eyebrow mb-4">Reimprimir lo que hay en una tienda</h2>
            <form action="/admin/etiquetas" className="flex gap-2">
              <select className="input" name="tienda" required defaultValue="">
                <option value="" disabled>Elige…</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{storeLabel(s)}</option>)}
              </select>
              <button className="btn-ghost whitespace-nowrap">Ver etiquetas</button>
            </form>
          </section>
          <section className="card">
            <h2 className="eyebrow mb-4">Devolución a Gallo Negro</h2>
            <form action={returnGarment} className="grid gap-3 sm:grid-cols-2">
              <div><label className="label" htmlFor="code">Código QR</label><input className="input font-mono uppercase" id="code" name="code" required placeholder="GN-XXXXXXXX" /></div>
              <div><label className="label" htmlFor="ret_note">Motivo</label><input className="input" id="ret_note" name="note" maxLength={500} /></div>
              <p className="text-xs text-parchment sm:col-span-2">La prenda sale del stock de la tienda y su QR deja de poder venderse.</p>
              <button className="btn-danger sm:justify-self-start">Registrar devolución</button>
            </form>
          </section>
        </div>
      </div>

      <h2 className="eyebrow mb-3 mt-8">Lotes recientes</h2>
      {batches.size === 0 ? (
        <p className="text-sm text-parchment">Todavía no se emitieron etiquetas.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Fecha</th><th>Tienda</th><th>Producto</th><th className="text-right">Prendas</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {[...batches.values()].map((b) => (
                <tr key={b.id}>
                  <td>{formatDay(b.date.slice(0, 10))}</td>
                  <td>{b.store}</td>
                  <td>{b.product}</td>
                  <td className="text-right">{b.total}</td>
                  <td>
                    <Pill tone={b.inStore > 0 ? STATUS.in_store[1] : STATUS.sold[1]}>
                      {b.inStore > 0 ? `${b.inStore} en tienda` : "Todo vendido o devuelto"}
                    </Pill>
                  </td>
                  <td><Link href={`/admin/etiquetas?lote=${b.id}`} className="text-sm text-bronze underline">Etiquetas</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
