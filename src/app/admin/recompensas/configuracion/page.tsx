import Link from "next/link";
import { Flash } from "@/components/flash";
import { PageTitle } from "@/components/nav";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { setConfig, setTester } from "../actions";
import { nombre } from "../shared";

export const metadata = { title: "Configuración GN · Admin" };

type Row = { key: string; value: unknown; is_draft: boolean; description: string; updated_at: string };

// Orden y agrupación en pantalla; las claves no listadas van al final.
const GRUPOS: { titulo: string; claves: string[] }[] = [
  { titulo: "Lanzamiento", claves: ["recompensas_v3_activa"] },
  { titulo: "Ganancia por ventas", claves: ["gn_modo_venta", "gn_por_unidad", "gn_por_dolar", "gn_venta_minima_usd", "gn_max_diario", "pvp_defecto_usd", "pvp_por_categoria"] },
  { titulo: "Misiones y validaciones", claves: ["gn_misiones_tope_diario", "validacion_sla_horas", "validacion_limite_semanal"] },
  { titulo: "Espera y vencimiento", claves: ["gn_dias_espera", "gn_meses_vencimiento", "gn_avisos_vencimiento"] },
  { titulo: "Canjes", claves: ["canjes_por_dia", "canje_segundos_entre", "fraude"] },
  { titulo: "Control de costo", claves: ["gn_valor_interno_usd", "costo_objetivo_pct", "costo_produccion_usd", "precio_base_licenciado_usd", "tope_mensual_canjes_usd", "margen_precio_pct"] },
  { titulo: "Rangos", claves: ["rangos", "beneficios_rango"] },
];
const OCULTAS = new Set(["recompensas_v3_testers"]);
const OPCIONES: Record<string, string[]> = { gn_modo_venta: ["por_prenda", "por_venta", "por_dolar"] };

const kindOf = (key: string, v: unknown) =>
  typeof v === "boolean" ? "boolean" : typeof v === "number" || (v === null && key.endsWith("_usd")) ? "number" : typeof v === "string" ? "string" : "json";

export default async function ConfiguracionGnAdmin({ searchParams }: PageProps<"/admin/recompensas/configuracion">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data }, { data: people }] = await Promise.all([
    supabase.from("gn_config").select("key, value, is_draft, description, updated_at").order("key"),
    supabase.from("profiles").select("id, full_name, public_alias").eq("role", "licensee").order("full_name"),
  ]);
  const rows = (data ?? []) as Row[];
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const listed = new Set(GRUPOS.flatMap((g) => g.claves));
  const grupos = [...GRUPOS, { titulo: "Otras", claves: rows.map((r) => r.key).filter((k) => !listed.has(k) && !OCULTAS.has(k)) }];
  const testers = new Set<string>(Array.isArray(byKey.get("recompensas_v3_testers")?.value) ? (byKey.get("recompensas_v3_testers")!.value as string[]) : []);
  const borradores = rows.filter((r) => r.is_draft).length;

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <PageTitle eyebrow="Recompensas GN" title="Configuración">
        Todas las cifras del programa. Las marcadas BORRADOR están pendientes de confirmar ({borradores}). Cada cambio queda en la{" "}
        <Link className="underline" href="/admin/auditoria">auditoría</Link>.
      </PageTitle>

      {grupos.map((g) => {
        const items = g.claves.map((k) => byKey.get(k)).filter((r): r is Row => !!r);
        if (items.length === 0) return null;
        return (
          <section key={g.titulo} className="mb-8">
            <h2 className="eyebrow mb-3">{g.titulo}</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {items.map((r) => {
                const kind = kindOf(r.key, r.value);
                return (
                  <form key={r.key} id={r.key} action={setConfig} className="card scroll-mt-20 space-y-2 text-sm">
                    <input type="hidden" name="key" value={r.key} />
                    <input type="hidden" name="kind" value={kind} />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="font-semibold" htmlFor={`v-${r.key}`}>{r.key}</label>
                      {r.is_draft && <span className="rounded-full border border-bronze px-2 py-0.5 text-xs text-bronze">BORRADOR</span>}
                    </div>
                    {r.description && <p className="text-xs text-parchment">{r.description}</p>}
                    {kind === "boolean" ? (
                      <label className="flex min-h-11 items-center gap-2">
                        <input id={`v-${r.key}`} type="checkbox" name="value" defaultChecked={r.value === true} className="h-5 w-5" /> Activo
                      </label>
                    ) : OPCIONES[r.key] ? (
                      <select className="input text-base" id={`v-${r.key}`} name="value" defaultValue={String(r.value)}>
                        {OPCIONES[r.key].map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : kind === "json" ? (
                      <textarea className="input font-mono text-base" id={`v-${r.key}`} name="value" rows={Math.min(10, JSON.stringify(r.value, null, 2).split("\n").length)} defaultValue={JSON.stringify(r.value, null, 2)} />
                    ) : (
                      <input className="input text-base" id={`v-${r.key}`} name="value" inputMode={kind === "number" ? "decimal" : undefined} defaultValue={r.value === null ? "" : String(r.value)} placeholder={r.value === null ? "Sin valor" : undefined} />
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="flex min-h-11 items-center gap-2 text-xs">
                        <input type="checkbox" name="is_draft" defaultChecked={r.is_draft} className="h-5 w-5" /> Sigue en BORRADOR
                      </label>
                      <button className="btn-ghost min-h-11">Guardar</button>
                    </div>
                    <p className="text-xs text-parchment">Actualizado {formatDateTime(r.updated_at)}</p>
                  </form>
                );
              })}
            </div>
          </section>
        );
      })}

      <section id="recompensas_v3_testers" className="mb-8 scroll-mt-20">
        <h2 className="eyebrow mb-3">Lista de prueba</h2>
        <p className="mb-3 text-sm text-parchment">
          Con el programa apagado, solo estas personas (y el administrador) ven las pestañas nuevas. Úsala para el lanzamiento controlado.
        </p>
        <div className="grid gap-3 lg:grid-cols-2">
          <ul className="card space-y-2 text-sm">
            {testers.size === 0 && <li className="text-parchment">Nadie en la lista.</li>}
            {(people ?? []).filter((p) => testers.has(p.id)).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span>{nombre(p, p.id)}</span>
                <form action={setTester}>
                  <input type="hidden" name="user_id" value={p.id} />
                  <input type="hidden" name="action" value="remove" />
                  <button className="btn-ghost px-3 py-1 text-xs">Quitar</button>
                </form>
              </li>
            ))}
          </ul>
          <form action={setTester} className="card flex flex-wrap items-end gap-2">
            <input type="hidden" name="action" value="add" />
            <div className="min-w-0 flex-1">
              <label className="label" htmlFor="tester">Agregar licenciatario</label>
              <select className="input text-base" id="tester" name="user_id" required defaultValue="">
                <option value="" disabled>Elige…</option>
                {(people ?? []).filter((p) => !testers.has(p.id)).map((p) => <option key={p.id} value={p.id}>{nombre(p, p.id)}</option>)}
              </select>
            </div>
            <button className="btn-bronze min-h-11">Agregar</button>
          </form>
        </div>
      </section>
    </>
  );
}
