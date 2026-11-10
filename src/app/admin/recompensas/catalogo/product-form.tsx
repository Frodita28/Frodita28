"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { RANGOS } from "@/content/rangos";
import { TIERS, type TierSlug } from "@/content/recompensas";
import { ayudaProducto, formatGn, formatNum, formatUsd, type GnConfig } from "@/lib/gn";
import { ProductCard } from "@/app/panel/tienda-clan/catalog";
import { saveProduct } from "../actions";

export type ProductDraft = {
  id: string | null;
  name: string;
  description: string;
  photos: string[];
  tier: TierSlug;
  min_rank: number;
  price_gn: number | null;
  cost_usd: number | null;
  stock: number | null;
  limit_per_user: number | null;
  is_permanent: boolean;
  needs_address: boolean;
  available_from: string;
  available_until: string;
  status: string;
  kind: string;
  supplier: string;
  lead_days: number | null;
  edition_id: string | null;
};

const ESTADOS = [
  ["borrador", "Borrador (no se ve)"],
  ["programado", "Programado"],
  ["activo", "Activo"],
  ["pausado", "Pausado"],
  ["archivado", "Archivado"],
] as const;

/** Formulario de premio con ayuda en vivo (ventas equivalentes y % devuelto) y vista previa móvil. */
export function ProductForm({
  draft,
  editions,
  cfg,
  valorInterno,
  objetivoPct,
}: {
  draft: ProductDraft;
  editions: { id: string; label: string }[];
  cfg: GnConfig;
  valorInterno: number;
  objetivoPct: number;
}) {
  const [name, setName] = useState(draft.name);
  const [price, setPrice] = useState(draft.price_gn?.toString() ?? "");
  const [cost, setCost] = useState(draft.cost_usd?.toString() ?? "");
  const [tier, setTier] = useState<TierSlug>(draft.tier);
  const [rank, setRank] = useState(draft.min_rank);
  const [permanent, setPermanent] = useState(draft.is_permanent);

  const precio = Number.parseInt(price, 10);
  const costo = cost === "" ? null : Number(cost.replace(",", "."));
  const ayuda = Number.isFinite(precio) && precio > 0 ? ayudaProducto(precio, costo !== null && Number.isFinite(costo) ? costo : null, cfg, valorInterno) : null;
  const unidad = cfg.gn_modo_venta === "por_prenda" ? "prendas" : "ventas";
  const rangoNombre = RANGOS.find((r) => r.nivel === rank)?.nombre ?? `Rango ${rank}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <form action={saveProduct} className="card space-y-4">
        <input type="hidden" name="id" value={draft.id ?? ""} />
        <input type="hidden" name="return_to" value={draft.id ? `/admin/recompensas/catalogo?editar=${draft.id}` : "/admin/recompensas/catalogo?nuevo=1"} />
        <div>
          <label className="label" htmlFor="name">Nombre del premio</label>
          <input className="input text-base" id="name" name="name" required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="description">Descripción</label>
          <textarea className="input text-base" id="description" name="description" rows={3} maxLength={1000} defaultValue={draft.description} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="price_gn">Precio en GN</label>
            <input className="input text-base" id="price_gn" name="price_gn" type="number" inputMode="numeric" min={1} required value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="cost_usd">Costo real (USD, solo admin)</label>
            <input className="input text-base" id="cost_usd" name="cost_usd" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Ej. 450" />
          </div>
        </div>

        {ayuda && (
          <div className="rounded-lg border border-smoke bg-obsidian p-3 text-sm" aria-live="polite">
            <p>
              Equivale a ≈ <strong>{formatNum(ayuda.ventas)} {unidad}</strong> ({formatGn(ayuda.gnPorVenta)} por {unidad === "prendas" ? "prenda" : "venta"}).
            </p>
            {ayuda.devuelvePct !== null ? (
              <p className={ayuda.devuelvePct > objetivoPct ? "text-bad" : "text-ok"}>
                Devuelve ≈ {ayuda.devuelvePct.toFixed(1).replace(".", ",")} % de lo vendido (objetivo {formatNum(objetivoPct)} %).
              </p>
            ) : (
              <p className="text-parchment">Escribe el costo real para ver qué % de lo vendido devuelve.</p>
            )}
            <p className="text-parchment">Valor interno de control: {formatUsd(ayuda.valorGnUsd, true)}.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="tier">Nivel del premio</label>
            <select className="input text-base" id="tier" name="tier" value={tier} onChange={(e) => setTier(e.target.value as TierSlug)}>
              {TIERS.map((t) => <option key={t.slug} value={t.slug}>{t.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="min_rank">Rango mínimo</label>
            <select className="input text-base" id="min_rank" name="min_rank" value={rank} onChange={(e) => setRank(Number(e.target.value))}>
              {RANGOS.map((r) => <option key={r.nivel} value={r.nivel}>{r.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="stock">Unidades (vacío = sin límite)</label>
            <input className="input text-base" id="stock" name="stock" type="number" min={0} defaultValue={draft.stock ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="limit_per_user">Límite por licenciatario</label>
            <input className="input text-base" id="limit_per_user" name="limit_per_user" type="number" min={1} defaultValue={draft.limit_per_user ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="kind">Tipo</label>
            <select className="input text-base" id="kind" name="kind" defaultValue={draft.kind}>
              <option value="fisico">Físico</option>
              <option value="experiencia">Experiencia</option>
              <option value="digital">Digital</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="status">Estado</label>
            <select className="input text-base" id="status" name="status" defaultValue={draft.status}>
              {ESTADOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="is_permanent" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} className="h-5 w-5" /> Permanente (destacado, fuera de la edición)
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="needs_address" defaultChecked={draft.needs_address} className="h-5 w-5" /> Pide dirección de entrega
          </label>
        </div>

        {!permanent && (
          <div>
            <label className="label" htmlFor="edition_id">Edición</label>
            <select className="input text-base" id="edition_id" name="edition_id" defaultValue={draft.edition_id ?? ""}>
              <option value="">Sin edición</option>
              {editions.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="available_from">Disponible desde</label>
            <input className="input text-base" id="available_from" name="available_from" type="datetime-local" defaultValue={draft.available_from} />
          </div>
          <div>
            <label className="label" htmlFor="available_until">Disponible hasta</label>
            <input className="input text-base" id="available_until" name="available_until" type="datetime-local" defaultValue={draft.available_until} />
          </div>
          <div>
            <label className="label" htmlFor="supplier">Proveedor (solo admin)</label>
            <input className="input text-base" id="supplier" name="supplier" maxLength={120} defaultValue={draft.supplier} />
          </div>
          <div>
            <label className="label" htmlFor="lead_days">Días de entrega</label>
            <input className="input text-base" id="lead_days" name="lead_days" type="number" min={0} max={365} defaultValue={draft.lead_days ?? ""} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="photo_file">Foto (PNG, JPG o WebP, hasta 3 MB)</label>
          <input className="input text-base" id="photo_file" name="photo_file" type="file" accept="image/png,image/jpeg,image/webp" />
        </div>
        <div>
          <label className="label" htmlFor="photos">Fotos actuales (una URL por línea)</label>
          <textarea className="input text-base" id="photos" name="photos" rows={2} defaultValue={draft.photos.join("\n")} />
        </div>

        <GuardarBoton nuevo={!draft.id} />
      </form>

      <aside aria-label="Vista previa en el móvil" className="space-y-2">
        <p className="label">Vista previa (móvil)</p>
        <div className="mx-auto w-[200px] rounded-2xl border border-smoke bg-bg p-2">
          <ProductCard
            item={{
              id: draft.id ?? "nuevo",
              name: name || "Nombre del premio",
              description: "",
              photo: draft.photos[0] ?? null,
              tier,
              minRank: rank,
              minRankName: rangoNombre,
              price: Number.isFinite(precio) && precio > 0 ? precio : 0,
              permanent,
              until: null,
              needsAddress: draft.needs_address,
              leadDays: draft.lead_days,
              estado: { tipo: "canjear" },
            }}
            unidadVenta={unidad}
            isGoal={false}
            disabled
            onRedeem={() => {}}
            onGoal={() => {}}
          />
        </div>
      </aside>
    </div>
  );
}

/** Se desactiva mientras se guarda (la foto puede tardar unos segundos) para no crear el premio dos veces. */
function GuardarBoton({ nuevo }: { nuevo: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-bronze min-h-11 disabled:opacity-60" disabled={pending} aria-busy={pending}>
      {pending ? "Guardando…" : nuevo ? "Crear premio" : "Guardar cambios"}
    </button>
  );
}
