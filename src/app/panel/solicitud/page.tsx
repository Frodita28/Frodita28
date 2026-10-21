import Link from "next/link";
import { ApplicationStatusPill, ApplicationTimeline, type ApplicationEvent } from "@/components/application-status";
import { Flash } from "@/components/flash";
import { PageTitle } from "@/components/nav";
import { APPLICATION_STATUS, OPEN_STATUSES, channelLabel, type ApplicationStatus } from "@/lib/applications";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { submitApplication, updateApplication, withdrawApplication } from "./actions";
import { ApplicationForm } from "./application-form";

export const metadata = { title: "Mi solicitud" };

type Application = {
  id: string;
  status: ApplicationStatus;
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
  admin_message: string | null;
  license_id: string | null;
  submitted_at: string;
  preferred: { name: string } | null;
  assigned: { name: string } | null;
  application_events: ApplicationEvent[];
};

export default async function MyApplication({ searchParams }: PageProps<"/panel/solicitud">) {
  const sp = await searchParams;
  const user = await requireUser("/panel/solicitud");
  const supabase = await createClient();
  const [{ data }, { data: plans }] = await Promise.all([
    supabase
      .from("license_applications")
      .select(
        "id, status, full_name, phone, country, city, business_name, experience, sales_channels, social_links, motivation, preferred_plan_id, admin_message, license_id, submitted_at, preferred:license_plans!license_applications_preferred_plan_id_fkey(name), assigned:license_plans!license_applications_assigned_plan_id_fkey(name), application_events(id, event, message, is_internal, created_at)",
      )
      .eq("user_id", user.id)
      .order("submitted_at", { ascending: false }),
    supabase.from("license_plans").select("id, name, status").neq("status", "inactive").order("sort_order"),
  ]);
  const apps = (data ?? []) as unknown as Application[];
  const current = apps.find((a) => OPEN_STATUSES.includes(a.status));
  const past = apps.filter((a) => a !== current);
  const canApply = user.role === "applicant" && !current;

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <PageTitle eyebrow="Licencias" title="Mi solicitud">
        Aquí envías tu solicitud para ser licenciado y sigues su estado. Una solicitud no es una licencia: si se aprueba,
        Gallo Negro formaliza contigo el contrato y el pago, y después activa tu licencia.
      </PageTitle>

      {user.role === "admin" && (
        <p className="card text-sm text-linen">
          Las cuentas de administrador no envían solicitudes. Revisa las recibidas en{" "}
          <Link href="/admin/solicitudes" className="text-bronze underline">Administración · Solicitudes</Link>.
        </p>
      )}

      {current && <CurrentApplication app={current} plans={plans ?? []} />}

      {canApply && (
        <section className="card max-w-3xl">
          <h2 className="eyebrow mb-4">{past.length ? "Nueva solicitud" : "Solicitar licencia"}</h2>
          <ApplicationForm action={submitApplication} plans={plans ?? []} defaults={{ full_name: user.fullName }} submitLabel="Enviar solicitud" />
        </section>
      )}

      {user.role === "licensee" && !current && (
        <p className="card text-sm text-linen">Tu cuenta ya tiene una licencia. Consulta sus datos en <Link href="/panel" className="text-bronze underline">Inicio</Link>.</p>
      )}

      {past.length > 0 && (
        <section className="mt-6 max-w-3xl">
          <h2 className="eyebrow mb-2">Solicitudes anteriores</h2>
          <ul className="space-y-2">
            {past.map((a) => (
              <li key={a.id} className="card flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>Enviada el {formatDateTime(a.submitted_at)}</span>
                <span className="flex items-center gap-2">
                  <ApplicationStatusPill status={a.status} />
                </span>
                {a.admin_message && <p className="w-full text-xs text-parchment">{a.admin_message}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function CurrentApplication({ app, plans }: { app: Application; plans: { id: string; name: string; status: string }[] }) {
  const editable = app.status === "submitted" || app.status === "needs_info";
  const info = APPLICATION_STATUS[app.status];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="card lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="eyebrow">Estado</h2>
          <ApplicationStatusPill status={app.status} />
        </div>
        <p className="mt-3 text-sm text-linen">{app.license_id ? "Tu licencia está activa. Ya puedes abrir y gestionar tu tienda." : info.help}</p>
        {app.admin_message && (
          <div className={`mt-4 rounded-lg border p-3 text-sm ${app.status === "needs_info" ? "border-warn/60" : "border-ash"}`}>
            <p className="label">Mensaje de Gallo Negro</p>
            <p className="whitespace-pre-line">{app.admin_message}</p>
          </div>
        )}
        {app.status === "approved" && app.assigned && (
          <p className="mt-3 text-sm">Plan asignado: <strong>{app.assigned.name}</strong></p>
        )}

        {editable ? (
          <div className="mt-6 border-t border-ash pt-4">
            <h3 className="eyebrow mb-4">{app.status === "needs_info" ? "Corrige y vuelve a enviar" : "Editar mi solicitud"}</h3>
            <ApplicationForm
              action={updateApplication}
              plans={plans}
              defaults={app}
              submitLabel={app.status === "needs_info" ? "Enviar correcciones" : "Guardar cambios"}
            />
          </div>
        ) : (
          <dl className="mt-6 grid gap-3 border-t border-ash pt-4 text-sm sm:grid-cols-2">
            <div><dt className="label">Nombre</dt><dd>{app.full_name}</dd></div>
            <div><dt className="label">Ubicación</dt><dd>{app.city}, {app.country}</dd></div>
            <div><dt className="label">Canales</dt><dd>{app.sales_channels.map(channelLabel).join(", ")}</dd></div>
            <div><dt className="label">Plan de interés</dt><dd>{app.preferred?.name ?? "Sin preferencia"}</dd></div>
          </dl>
        )}
      </section>

      <aside className="space-y-4">
        <section className="card">
          <h2 className="eyebrow mb-3">Historial</h2>
          <ApplicationTimeline events={app.application_events} />
        </section>
        {!app.license_id && (
          <section className="card">
            <h2 className="eyebrow mb-2">Retirar solicitud</h2>
            <form action={withdrawApplication} className="space-y-2">
              <input type="hidden" name="id" value={app.id} />
              <input className="input" name="reason" maxLength={500} placeholder="Motivo (opcional)" aria-label="Motivo" />
              <button className="btn-danger w-full">Retirar</button>
            </form>
          </section>
        )}
      </aside>
    </div>
  );
}
