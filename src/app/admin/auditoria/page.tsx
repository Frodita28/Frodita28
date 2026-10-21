import { PageTitle } from "@/components/nav";
import { formatDateTime } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Auditoría · Admin" };

export default async function Audit() {
  const supabase = await createClient();
  const { data } = await supabase.from("audit_log").select("id, actor_id, action, entity_type, entity_id, details, created_at").order("id", { ascending: false }).limit(200);
  return (
    <>
      <PageTitle eyebrow="Control" title="Auditoría">
        Registro inmutable de acciones críticas: cambios de misiones, licencias, roles, revisiones y ajustes de XP.
      </PageTitle>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Fecha</th><th>Acción</th><th>Entidad</th><th>Actor</th><th>Detalle</th></tr></thead>
          <tbody>
            {(data ?? []).map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap text-parchment">{formatDateTime(a.created_at)}</td>
                <td>{a.action}</td>
                <td className="text-xs">{a.entity_type} · {String(a.entity_id ?? "").slice(0, 8)}</td>
                <td className="text-xs">{a.actor_id ? String(a.actor_id).slice(0, 8) : "sistema"}</td>
                <td><pre className="max-w-md overflow-x-auto whitespace-pre-wrap text-[11px] text-parchment">{JSON.stringify(a.details).slice(0, 400)}</pre></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
