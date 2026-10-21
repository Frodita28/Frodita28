import Link from "next/link";
import { Flash } from "@/components/flash";
import { PageTitle } from "@/components/nav";
import { Pill } from "@/components/status-badge";
import { FREQUENCY_LABEL, MISSION_STATUS_LABEL, type Frequency } from "@/lib/missions";
import type { MissionRow } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { duplicateMission, setMissionStatus } from "./actions";

export const metadata = { title: "Misiones · Admin" };

export default async function AdminMissions({ searchParams }: PageProps<"/admin/misiones">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("missions").select("*").order("frequency").order("code");
  const missions = (data ?? []) as MissionRow[];
  const groups: Frequency[] = ["daily", "weekly", "monthly"];

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <PageTitle eyebrow="Administración" title="Misiones">
        Las misiones se guardan en la base de datos. Crear, editar, duplicar o desactivar no requiere tocar código.
      </PageTitle>
      <Link href="/admin/misiones/nueva" className="btn-bronze mb-6">Nueva misión</Link>

      {groups.map((g) => (
        <section key={g} className="mb-8">
          <h2 className="eyebrow mb-2">{FREQUENCY_LABEL[g]}s</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Código</th><th>Misión</th><th>Objetivo</th><th className="text-right">XP</th><th>Validación</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {missions.filter((m) => m.frequency === g).map((m) => (
                  <tr key={m.id}>
                    <td className="text-parchment">{m.code}</td>
                    <td>
                      <Link className="font-semibold hover:text-bronze" href={`/admin/misiones/${m.id}`}>{m.title}</Link>
                      <div className="text-xs text-parchment">{m.category}{m.inactive_reason ? ` · ${m.inactive_reason}` : ""}</div>
                    </td>
                    <td className="whitespace-nowrap">{Number(m.target_value)} {m.target_unit}</td>
                    <td className="text-right">{m.xp_reward}</td>
                    <td>{m.validation_method === "auto" ? "Automática" : "Manual"}</td>
                    <td><Pill tone={m.status === "active" ? "ok" : m.status === "draft" ? "warn" : "neutral"}>{MISSION_STATUS_LABEL[m.status]}</Pill></td>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        <form action={setMissionStatus}>
                          <input type="hidden" name="id" value={m.id} />
                          <input type="hidden" name="status" value={m.status === "active" ? "inactive" : "active"} />
                          <button className="text-xs underline">{m.status === "active" ? "Desactivar" : "Activar"}</button>
                        </form>
                        <form action={duplicateMission} className="flex items-center gap-1">
                          <input type="hidden" name="id" value={m.id} />
                          <input className="input w-20 px-2 py-1 text-xs" name="new_code" placeholder="Código" required aria-label="Código de la copia" />
                          <button className="text-xs underline">Duplicar</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
