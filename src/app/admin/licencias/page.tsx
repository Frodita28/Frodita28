import { Flash } from "@/components/flash";
import { PageTitle } from "@/components/nav";
import { Pill } from "@/components/status-badge";
import { formatDay } from "@/lib/missions";
import { createClient } from "@/lib/supabase/server";
import { saveLicense, setLicenseStatus } from "../actions";

export const metadata = { title: "Licencias · Admin" };

const STATUSES = [["pending", "Pendiente"], ["active", "Activa"], ["suspended", "Suspendida"], ["expired", "Vencida"], ["cancelled", "Cancelada"]] as const;

type License = { id: string; user_id: string; territory: string | null; status: string; starts_at: string | null; ends_at: string | null; contract_ref: string | null; license_plans: { name: string } | null; profiles: { full_name: string | null; public_alias: string | null } | null };

export default async function Licenses({ searchParams }: PageProps<"/admin/licencias">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: profiles }, { data: plans }, { data: licData }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, public_alias, role").order("created_at", { ascending: false }).limit(500),
    supabase.from("license_plans").select("id, name, is_demo, status").order("sort_order"),
    supabase.from("licenses").select("id, user_id, territory, status, starts_at, ends_at, contract_ref, license_plans(name), profiles!licenses_user_id_fkey(full_name, public_alias)").order("created_at", { ascending: false }),
  ]);
  const licenses = (licData ?? []) as unknown as License[];

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <PageTitle eyebrow="Red de licenciados" title="Licencias">
        Activa una licencia solo después de aprobar la solicitud y formalizar contrato y pago. Activarla convierte al
        solicitante en licenciado. Los planes siguen siendo provisionales hasta que Gallo Negro confirme sus condiciones.
      </PageTitle>

      <section className="card mb-6">
        <h2 className="eyebrow mb-4">Registrar licencia</h2>
        <form action={saveLicense} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="user_id">Usuario</label>
            <select className="input" id="user_id" name="user_id" required defaultValue="">
              <option value="" disabled>Elige…</option>
              {(profiles ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name ?? p.public_alias ?? p.id.slice(0, 8)} · {p.role}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="plan_id">Plan</label>
            <select className="input" id="plan_id" name="plan_id" required defaultValue="">
              <option value="" disabled>Elige…</option>
              {(plans ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}{p.is_demo ? " (provisional)" : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="status">Estado</label>
            <select className="input" id="status" name="status" defaultValue="active">
              {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div><label className="label" htmlFor="territory">Territorio</label><input className="input" id="territory" name="territory" maxLength={120} /></div>
          <div><label className="label" htmlFor="starts_at">Inicio</label><input className="input" id="starts_at" name="starts_at" type="date" /></div>
          <div><label className="label" htmlFor="ends_at">Fin</label><input className="input" id="ends_at" name="ends_at" type="date" /></div>
          <div><label className="label" htmlFor="contract_ref">Referencia de contrato</label><input className="input" id="contract_ref" name="contract_ref" maxLength={120} /></div>
          <button className="btn-bronze sm:col-span-2 lg:col-span-4 lg:justify-self-start">Registrar</button>
        </form>
      </section>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Licenciado</th><th>Plan</th><th>Territorio</th><th>Vigencia</th><th>Estado</th><th>Cambiar estado</th></tr></thead>
          <tbody>
            {licenses.length === 0 && <tr><td colSpan={6} className="text-parchment">Sin licencias registradas.</td></tr>}
            {licenses.map((l) => (
              <tr key={l.id}>
                <td>{l.profiles?.full_name ?? l.profiles?.public_alias ?? l.user_id.slice(0, 8)}<div className="text-xs text-parchment">{l.contract_ref ?? "Sin contrato registrado"}</div></td>
                <td>{l.license_plans?.name}</td>
                <td>{l.territory ?? "—"}</td>
                <td className="whitespace-nowrap text-xs">{l.starts_at ? formatDay(l.starts_at) : "—"} – {l.ends_at ? formatDay(l.ends_at) : "—"}</td>
                <td><Pill tone={l.status === "active" ? "ok" : "neutral"}>{STATUSES.find(([v]) => v === l.status)?.[1]}</Pill></td>
                <td>
                  <form action={setLicenseStatus} className="flex gap-1">
                    <input type="hidden" name="id" value={l.id} />
                    <select className="input px-2 py-1 text-xs" name="status" defaultValue={l.status} aria-label="Nuevo estado">
                      {STATUSES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                    </select>
                    <button className="btn-ghost px-3 py-1 text-xs">Aplicar</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
