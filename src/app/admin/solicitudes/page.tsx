import Link from "next/link";
import { ApplicationStatusPill } from "@/components/application-status";
import { Flash } from "@/components/flash";
import { PageTitle } from "@/components/nav";
import { channelLabel, type ApplicationStatus } from "@/lib/applications";
import { formatDateTime } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Solicitudes · Admin" };

const FILTERS = [
  ["open", "Por resolver"],
  ["approved", "Aprobadas"],
  ["rejected", "Rechazadas"],
  ["withdrawn", "Retiradas"],
  ["all", "Todas"],
] as const;

type Row = {
  id: string;
  status: ApplicationStatus;
  full_name: string;
  email: string | null;
  country: string;
  city: string;
  sales_channels: string[];
  submitted_at: string;
  license_id: string | null;
  preferred: { name: string } | null;
};

export default async function AdminApplications({ searchParams }: PageProps<"/admin/solicitudes">) {
  const sp = await searchParams;
  const filter = FILTERS.some(([k]) => k === sp.status) ? (sp.status as string) : "open";
  const supabase = await createClient();
  let query = supabase
    .from("license_applications")
    .select("id, status, full_name, email, country, city, sales_channels, submitted_at, license_id, preferred:license_plans!license_applications_preferred_plan_id_fkey(name)")
    .order("submitted_at", { ascending: filter === "open" })
    .limit(300);
  if (filter === "open") query = query.in("status", ["submitted", "in_review", "needs_info"]);
  else if (filter !== "all") query = query.eq("status", filter);
  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <PageTitle eyebrow="Red de licenciados" title="Solicitudes">
        Revisa cada solicitud, pide correcciones si falta información y aprueba asignando un plan. Aprobar no activa la
        licencia: actívala desde la solicitud cuando el contrato y el pago estén formalizados.
      </PageTitle>
      <nav className="mb-4 flex gap-2 overflow-x-auto">
        {FILTERS.map(([k, l]) => (
          <Link key={k} href={`/admin/solicitudes?status=${k}`} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${filter === k ? "bg-ash text-ivory" : "text-parchment hover:text-ivory"}`}>{l}</Link>
        ))}
      </nav>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Enviada</th><th>Solicitante</th><th>Ubicación</th><th>Canales</th><th>Plan de interés</th><th>Estado</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="text-parchment">No hay solicitudes en este estado.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-parchment">{formatDateTime(r.submitted_at)}</td>
                <td>
                  <Link href={`/admin/solicitudes/${r.id}`} className="font-semibold text-ivory underline decoration-bronze underline-offset-4">{r.full_name}</Link>
                  <div className="text-xs text-parchment">{r.email}</div>
                </td>
                <td>{r.city}, {r.country}</td>
                <td className="text-xs">{r.sales_channels.map(channelLabel).join(", ")}</td>
                <td>{r.preferred?.name ?? "—"}</td>
                <td>
                  <ApplicationStatusPill status={r.status} />
                  {r.license_id && <div className="mt-1 text-xs text-ok">Licencia activa</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
