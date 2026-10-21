import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplicationStatusPill, ApplicationTimeline, type ApplicationEvent } from "@/components/application-status";
import { Flash } from "@/components/flash";
import { PageTitle } from "@/components/nav";
import { channelLabel, type ApplicationStatus } from "@/lib/applications";
import { formatDateTime } from "@/lib/time";
import { todayIn } from "@/lib/missions";
import { createClient } from "@/lib/supabase/server";
import { activateLicense, reviewApplication } from "../actions";

export const metadata = { title: "Solicitud · Admin" };

type Detail = {
  id: string;
  user_id: string;
  status: ApplicationStatus;
  email: string | null;
  full_name: string;
  phone: string;
  country: string;
  city: string;
  business_name: string | null;
  experience: string;
  sales_channels: string[];
  social_links: string | null;
  motivation: string | null;
  preferred_plan_id: string | null;
  assigned_plan_id: string | null;
  admin_message: string | null;
  license_id: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  preferred: { name: string } | null;
  assigned: { name: string } | null;
  application_events: ApplicationEvent[];
};

export default async function AdminApplication({ params, searchParams }: PageProps<"/admin/solicitudes/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data }, { data: plans }] = await Promise.all([
    supabase
      .from("license_applications")
      .select(
        "*, preferred:license_plans!license_applications_preferred_plan_id_fkey(name), assigned:license_plans!license_applications_assigned_plan_id_fkey(name), application_events(id, event, message, is_internal, created_at)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("license_plans").select("id, name, status, is_demo").neq("status", "inactive").order("sort_order"),
  ]);
  if (!data) notFound();
  const app = data as unknown as Detail;
  const reviewable = ["submitted", "in_review", "needs_info"].includes(app.status);
  const canDecide = app.status === "submitted" || app.status === "in_review";

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <Link href="/admin/solicitudes" className="mb-3 inline-block text-sm text-parchment hover:text-ivory">← Solicitudes</Link>
      <PageTitle eyebrow="Solicitud de licencia" title={app.full_name}>
        Enviada el {formatDateTime(app.submitted_at)}{app.reviewed_at ? ` · última revisión ${formatDateTime(app.reviewed_at)}` : ""}
      </PageTitle>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="card">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="eyebrow">Datos del solicitante</h2>
              <ApplicationStatusPill status={app.status} />
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Field label="Correo" value={app.email} />
              <Field label="Teléfono" value={app.phone} />
              <Field label="Ubicación" value={`${app.city}, ${app.country}`} />
              <Field label="Nombre comercial" value={app.business_name} />
              <Field label="Canales" value={app.sales_channels.map(channelLabel).join(", ")} />
              <Field label="Plan de interés" value={app.preferred?.name ?? "Sin preferencia"} />
              <Field label="Redes / enlaces" value={app.social_links} wide />
              <Field label="Experiencia" value={app.experience} wide />
              <Field label="Motivación" value={app.motivation} wide />
            </dl>
            {app.admin_message && (
              <div className="mt-4 rounded-lg border border-ash p-3 text-sm">
                <p className="label">Último mensaje enviado al solicitante</p>
                <p className="whitespace-pre-line">{app.admin_message}</p>
              </div>
            )}
          </section>

          {reviewable && (
            <section className="card space-y-5">
              <h2 className="eyebrow">Resolver</h2>
              {app.status === "submitted" && (
                <form action={reviewApplication}>
                  <input type="hidden" name="id" value={app.id} />
                  <input type="hidden" name="action" value="start_review" />
                  <button className="btn-ghost">Marcar en revisión</button>
                </form>
              )}

              {canDecide && (
                <form action={reviewApplication} className="grid gap-3 rounded-lg border border-ok/30 p-3 sm:grid-cols-2">
                  <input type="hidden" name="id" value={app.id} />
                  <input type="hidden" name="action" value="approve" />
                  <div>
                    <label className="label" htmlFor="plan_id">Plan asignado</label>
                    <select className="input" id="plan_id" name="plan_id" required defaultValue={app.preferred_plan_id ?? ""}>
                      <option value="" disabled>Elige…</option>
                      {(plans ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}{p.status !== "active" ? " (provisional)" : ""}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="approve_message">Mensaje (opcional)</label>
                    <input className="input" id="approve_message" name="message" maxLength={2000} placeholder="Próximos pasos para el contrato" />
                  </div>
                  <button className="btn-bronze sm:col-span-2 sm:justify-self-start">Aprobar solicitud</button>
                </form>
              )}

              {canDecide && (
                <form action={reviewApplication} className="space-y-2 rounded-lg border border-warn/30 p-3">
                  <input type="hidden" name="id" value={app.id} />
                  <input type="hidden" name="action" value="request_info" />
                  <label className="label" htmlFor="info_message">Pedir información o correcciones</label>
                  <textarea className="input min-h-20" id="info_message" name="message" required maxLength={2000} placeholder="Qué debe completar o corregir el solicitante" />
                  <button className="btn-ghost">Pedir correcciones</button>
                </form>
              )}

              <form action={reviewApplication} className="space-y-2 rounded-lg border border-bad/30 p-3">
                <input type="hidden" name="id" value={app.id} />
                <input type="hidden" name="action" value="reject" />
                <label className="label" htmlFor="reject_message">Motivo del rechazo (lo verá el solicitante)</label>
                <textarea className="input min-h-20" id="reject_message" name="message" required maxLength={2000} />
                <button className="btn-danger">Rechazar</button>
              </form>
            </section>
          )}

          {app.status === "approved" && !app.license_id && (
            <section className="card">
              <h2 className="eyebrow mb-1">Activar licencia</h2>
              <p className="mb-4 text-sm text-linen">
                Plan asignado: <strong>{app.assigned?.name}</strong>. Activa solo cuando el contrato esté firmado y el pago
                verificado. Esta acción crea la licencia, convierte a la persona en licenciada y queda auditada.
              </p>
              <form action={activateLicense} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="id" value={app.id} />
                <div><label className="label" htmlFor="contract_ref">Referencia del contrato</label><input className="input" id="contract_ref" name="contract_ref" required maxLength={120} /></div>
                <div><label className="label" htmlFor="territory">Territorio</label><input className="input" id="territory" name="territory" maxLength={120} defaultValue={app.city} /></div>
                <div><label className="label" htmlFor="starts_at">Inicio</label><input className="input" id="starts_at" name="starts_at" type="date" required defaultValue={todayIn("America/Caracas")} /></div>
                <div><label className="label" htmlFor="ends_at">Vencimiento (opcional)</label><input className="input" id="ends_at" name="ends_at" type="date" /></div>
                <label className="flex items-start gap-3 text-sm sm:col-span-2">
                  <input type="checkbox" name="formalized" value="true" required className="mt-1 accent-bronze" />
                  Confirmo que el contrato está firmado y el pago fue verificado.
                </label>
                <button className="btn-bronze sm:col-span-2 sm:justify-self-start">Activar licencia</button>
              </form>
            </section>
          )}

          {app.license_id && (
            <p className="card text-sm text-ok">
              Licencia activada. Gestiona su estado y vigencia en <Link href="/admin/licencias" className="underline">Licencias</Link>.
            </p>
          )}
        </div>

        <aside className="space-y-4">
          <section className="card">
            <h2 className="eyebrow mb-3">Historial</h2>
            <ApplicationTimeline events={app.application_events} />
          </section>
          <section className="card">
            <h2 className="eyebrow mb-2">Nota interna</h2>
            <form action={reviewApplication} className="space-y-2">
              <input type="hidden" name="id" value={app.id} />
              <input type="hidden" name="action" value="note" />
              <textarea className="input min-h-20" name="message" required maxLength={2000} aria-label="Nota interna" placeholder="Solo la ve el equipo" />
              <button className="btn-ghost w-full">Guardar nota</button>
            </form>
          </section>
        </aside>
      </div>
    </>
  );
}

function Field({ label, value, wide }: { label: string; value: string | null; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="label">{label}</dt>
      <dd className="whitespace-pre-line break-words">{value || "—"}</dd>
    </div>
  );
}
