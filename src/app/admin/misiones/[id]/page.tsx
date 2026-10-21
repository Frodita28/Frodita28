import { notFound } from "next/navigation";
import { Flash } from "@/components/flash";
import { PageTitle } from "@/components/nav";
import { STATUS_LABEL, type ParticipationStatus } from "@/lib/missions";
import type { MissionRow } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { MissionForm } from "../mission-form";

export const metadata = { title: "Editar misión" };

export default async function EditMission({ params, searchParams }: PageProps<"/admin/misiones/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: mission }, { data: plans }, { data: categories }, { data: parts }] = await Promise.all([
    supabase.from("missions").select("*").eq("id", id).maybeSingle(),
    supabase.from("license_plans").select("id, name, is_demo").order("sort_order"),
    supabase.from("product_categories").select("slug, name").order("sort_order"),
    supabase.from("mission_participations").select("status").eq("mission_id", id),
  ]);
  if (!mission) notFound();
  const counts = new Map<string, number>();
  for (const p of parts ?? []) counts.set(p.status, (counts.get(p.status) ?? 0) + 1);

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <PageTitle eyebrow={`Misión ${mission.code}`} title={mission.title} />
      <section className="card mb-6">
        <h2 className="eyebrow mb-2">Participación histórica</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          <span>Total: {parts?.length ?? 0}</span>
          {(Object.keys(STATUS_LABEL) as ParticipationStatus[]).map((s) => (
            <span key={s} className="text-linen">{STATUS_LABEL[s]}: {counts.get(s) ?? 0}</span>
          ))}
        </div>
      </section>
      <MissionForm mission={mission as MissionRow} plans={plans ?? []} categories={categories ?? []} />
    </>
  );
}
