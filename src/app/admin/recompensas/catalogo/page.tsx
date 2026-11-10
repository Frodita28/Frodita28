import Link from "next/link";
import { Flash } from "@/components/flash";
import { PageTitle } from "@/components/nav";
import { RANGOS } from "@/content/rangos";
import { CATEGORIAS, TIERS, type CategoriaSlug, type TierSlug } from "@/content/recompensas";
import { formatGn, formatNum, formatUsd, leerConfig } from "@/lib/gn";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, utcToZonedLocal } from "@/lib/time";
import { duplicateProduct, saveEdition } from "../actions";
import { ProductForm, type ProductDraft } from "./product-form";

export const metadata = { title: "Catálogo Tienda Clan · Admin" };

type Edition = { id: string; month: string; title: string; status: string; publish_at: string | null };
type Product = {
  id: string;
  name: string;
  description: string;
  photos: string[];
  tier: TierSlug;
  category: CategoriaSlug;
  min_rank: number;
  price_gn: number;
  stock: number | null;
  limit_per_user: number | null;
  is_permanent: boolean;
  available_from: string | null;
  available_until: string | null;
  status: string;
  kind: string;
  supplier: string | null;
  lead_days: number | null;
  needs_address: boolean;
  edition_id: string | null;
  is_demo: boolean;
};

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const mesLabel = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const ESTADO_EDICION: Record<string, string> = { borrador: "Borrador", programado: "Programada", publicado: "Publicada", cerrado: "Cerrada" };
const ESTADO_PREMIO: Record<string, string> = { borrador: "Borrador", programado: "Programado", activo: "Activo", pausado: "Pausado", archivado: "Archivado" };

export default async function CatalogoAdmin({ searchParams }: PageProps<"/admin/recompensas/catalogo">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: eds }, { data: prods }, { data: costs }, { data: cfgRows }] = await Promise.all([
    supabase.from("clan_editions").select("id, month, title, status, publish_at").order("month", { ascending: false }),
    supabase.from("clan_products").select("*").order("is_permanent", { ascending: false }).order("min_rank").order("price_gn"),
    supabase.from("clan_product_costs").select("product_id, cost_usd"),
    supabase.from("gn_config").select("key, value"),
  ]);
  const editions = (eds ?? []) as Edition[];
  const products = (prods ?? []) as Product[];
  const costOf = new Map((costs ?? []).map((c) => [c.product_id as string, Number(c.cost_usd)]));
  const raw = Object.fromEntries((cfgRows ?? []).map((r) => [r.key, r.value]));
  const cfg = leerConfig(raw);
  const valorInterno = Number(raw.gn_valor_interno_usd ?? 0.18);
  const objetivo = Number(raw.costo_objetivo_pct ?? 6);
  const edLabel = new Map(editions.map((e) => [e.id, mesLabel(e.month)]));

  const editId = typeof sp.editar === "string" ? sp.editar : null;
  const editing = editId ? products.find((p) => p.id === editId) : null;
  const showForm = !!editing || sp.nuevo === "1";
  const draft: ProductDraft | null = !showForm
    ? null
    : editing
      ? {
          ...editing,
          description: editing.description,
          cost_usd: costOf.get(editing.id) ?? null,
          supplier: editing.supplier ?? "",
          available_from: editing.available_from ? utcToZonedLocal(new Date(editing.available_from)) : "",
          available_until: editing.available_until ? utcToZonedLocal(new Date(editing.available_until)) : "",
        }
      : {
          id: null, name: "", description: "", photos: [], tier: "calle", category: "accesorios", min_rank: 1, price_gn: null, cost_usd: null, stock: null,
          limit_per_user: null, is_permanent: false, needs_address: true, available_from: "", available_until: "", status: "borrador",
          kind: "fisico", supplier: "", lead_days: null, edition_id: editions[0]?.id ?? null,
        };

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <PageTitle eyebrow="Recompensas GN" title="Catálogo Tienda Clan">
        Cada mes se publica una edición con sus premios; los permanentes siempre están. El costo real y el proveedor solo los ve
        el administrador. Un premio en borrador no lo ve nadie.
      </PageTitle>

      {draft && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="eyebrow">{draft.id ? "Editar premio" : "Nuevo premio"}</h2>
            <Link className="btn-ghost min-h-11" href="/admin/recompensas/catalogo">Cerrar</Link>
          </div>
          <ProductForm
            key={draft.id ?? "nuevo"}
            draft={draft}
            editions={editions.map((e) => ({ id: e.id, label: mesLabel(e.month) }))}
            cfg={cfg}
            valorInterno={valorInterno}
            objetivoPct={objetivo}
          />
        </section>
      )}

      <section className="mb-8">
        <h2 className="eyebrow mb-3">Ediciones</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <form action={saveEdition} className="card space-y-3">
            <p className="text-sm text-parchment">Crea o cambia la edición de un mes. Al publicarla se avisa a los licenciatarios.</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label" htmlFor="month">Mes</label><input className="input text-base" id="month" name="month" type="month" required /></div>
              <div>
                <label className="label" htmlFor="ed_status">Estado</label>
                <select className="input text-base" id="ed_status" name="status" defaultValue="borrador">
                  {Object.entries(ESTADO_EDICION).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div><label className="label" htmlFor="title">Título (opcional)</label><input className="input text-base" id="title" name="title" maxLength={80} /></div>
              <div><label className="label" htmlFor="publish_at">Publicar el (si es programada)</label><input className="input text-base" id="publish_at" name="publish_at" type="datetime-local" /></div>
            </div>
            <button className="btn-bronze min-h-11">Guardar edición</button>
          </form>
          <ul className="space-y-2">
            {editions.length === 0 && <li className="card text-sm text-parchment">Aún no hay ediciones.</li>}
            {editions.map((e) => (
              <li key={e.id} className="card flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-semibold">{mesLabel(e.month)}{e.title ? ` · ${e.title}` : ""}</span>
                <span className="text-parchment">
                  {ESTADO_EDICION[e.status] ?? e.status}
                  {e.publish_at ? ` · ${formatDateTime(e.publish_at)}` : ""} · {formatNum(products.filter((p) => p.edition_id === e.id).length)} premios
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="eyebrow">Premios ({formatNum(products.length)})</h2>
          <Link className="btn-bronze min-h-11" href="/admin/recompensas/catalogo?nuevo=1">Nuevo premio</Link>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Premio</th><th>Categoría</th><th>Nivel</th><th>Rango</th><th className="text-right">GN</th><th className="text-right">Costo</th><th>Unidades</th><th>Edición</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {products.length === 0 && <tr><td colSpan={10} className="text-parchment">Sin premios.</td></tr>}
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="font-semibold">{p.name}{p.is_demo ? <span className="ml-1 text-xs text-parchment">(demo)</span> : null}</td>
                  <td className="whitespace-nowrap">{CATEGORIAS.find((c) => c.slug === p.category)?.nombre}</td>
                  <td>{TIERS.find((t) => t.slug === p.tier)?.nombre}</td>
                  <td>{RANGOS.find((r) => r.nivel === p.min_rank)?.nombre}</td>
                  <td className="text-right whitespace-nowrap">{formatGn(p.price_gn)}</td>
                  <td className="text-right whitespace-nowrap">{costOf.has(p.id) ? formatUsd(costOf.get(p.id)!) : "—"}</td>
                  <td>{p.stock === null ? "Sin límite" : formatNum(p.stock)}</td>
                  <td className="whitespace-nowrap">{p.is_permanent ? "Permanente" : p.edition_id ? edLabel.get(p.edition_id) : "—"}</td>
                  <td>{ESTADO_PREMIO[p.status] ?? p.status}</td>
                  <td className="whitespace-nowrap">
                    <div className="flex gap-2">
                      <Link className="btn-ghost px-3 py-1 text-xs" href={`/admin/recompensas/catalogo?editar=${p.id}`}>Editar</Link>
                      <form action={duplicateProduct}>
                        <input type="hidden" name="id" value={p.id} />
                        <button className="btn-ghost px-3 py-1 text-xs">Duplicar</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
