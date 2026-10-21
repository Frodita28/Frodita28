import { Flash } from "@/components/flash";
import { PageTitle } from "@/components/nav";
import { formatDay } from "@/lib/missions";
import { formatDateTime } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { reviewEvidence } from "../actions";

export const metadata = { title: "Evidencias · Admin" };

type Ev = {
  id: string;
  url: string | null;
  storage_path: string | null;
  note: string | null;
  submitted_at: string;
  user_id: string;
  profiles: { full_name: string | null; public_alias: string | null } | null;
  missions: { code: string; title: string; evidence_instructions: string; target_unit: string } | null;
  mission_participations: { period_start: string; period_end: string; current_progress: number | null; target_value: number } | null;
};

export default async function Reviews({ searchParams }: PageProps<"/admin/revisiones">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("mission_evidences")
    .select("id, url, storage_path, note, submitted_at, user_id, profiles(full_name, public_alias), missions(code, title, evidence_instructions, target_unit), mission_participations(period_start, period_end, current_progress, target_value)")
    .eq("status", "pending")
    .order("submitted_at")
    .limit(100);
  const evidences = (data ?? []) as unknown as Ev[];

  // Enlaces firmados de corta duración para ver capturas privadas.
  const paths = evidences.map((e) => e.storage_path).filter((p): p is string => !!p);
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await supabase.storage.from("evidences").createSignedUrls(paths, 600);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <PageTitle eyebrow="Validación manual" title="Evidencias pendientes">
        Aprueba solo contenido real, original y que identifique el producto. No se piden contraseñas de redes sociales.
        No puedes revisar tus propias evidencias.
      </PageTitle>
      {evidences.length === 0 && <p className="card text-sm text-parchment">No hay evidencias pendientes.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {evidences.map((e) => {
          const fileUrl = e.storage_path ? signed.get(e.storage_path) : null;
          return (
            <article key={e.id} className="card space-y-3">
              <header>
                <p className="text-xs text-parchment">{e.missions?.code} · {e.profiles?.public_alias ?? e.profiles?.full_name ?? e.user_id.slice(0, 8)}</p>
                <h2 className="font-semibold">{e.missions?.title}</h2>
                <p className="text-xs text-parchment">
                  Período {e.mission_participations && `${formatDay(e.mission_participations.period_start)} – ${formatDay(e.mission_participations.period_end)}`} ·
                  Progreso {Number(e.mission_participations?.current_progress ?? 0)} / {Number(e.mission_participations?.target_value)} {e.missions?.target_unit} ·
                  Enviada {formatDateTime(e.submitted_at)}
                </p>
              </header>
              <p className="text-xs text-linen">{e.missions?.evidence_instructions}</p>
              {e.url && (
                <a href={e.url} target="_blank" rel="noopener noreferrer nofollow" className="block break-all text-sm text-bronze underline">{e.url}</a>
              )}
              {fileUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <a href={fileUrl} target="_blank" rel="noopener noreferrer"><img src={fileUrl} alt="Captura enviada como evidencia" className="max-h-80 rounded-lg border border-ash" /></a>
              )}
              {e.note && <p className="rounded-lg bg-obsidian p-2 text-xs">Nota: {e.note}</p>}
              <form action={reviewEvidence} className="space-y-2 border-t border-ash pt-3">
                <input type="hidden" name="evidence_id" value={e.id} />
                <input className="input" name="reason" maxLength={500} placeholder="Motivo (obligatorio para rechazar)" />
                <div className="flex gap-2">
                  <button name="decision" value="approve" className="btn-primary">Aprobar</button>
                  <button name="decision" value="reject" className="btn-danger">Rechazar</button>
                </div>
              </form>
            </article>
          );
        })}
      </div>
    </>
  );
}
