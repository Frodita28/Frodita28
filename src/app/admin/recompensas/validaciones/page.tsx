import { Flash } from "@/components/flash";
import { PageTitle } from "@/components/nav";
import { formatNum } from "@/lib/gn";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { decideEvidence, saveValidationRule, startEvidenceReview } from "../actions";
import { nombre, type ProfileRef } from "../shared";

export const metadata = { title: "Validaciones · Admin" };

type Ev = {
  id: string;
  user_id: string;
  url: string | null;
  storage_path: string | null;
  evidence_key: string;
  note: string | null;
  submitted_at: string;
  review_started_at: string | null;
  profiles: ProfileRef;
  missions: { code: string; title: string; category: string; evidence_instructions: string; gn_reward: number; xp_reward: number } | null;
};
type Rule = { category: string; criteria: string; weekly_limit: number | null; sla_hours: number | null };

/** Horas que faltan para vencer el plazo de respuesta (negativo = vencido). */
function horasRestantes(desde: string, sla: number) {
  return Math.round((new Date(desde).getTime() + sla * 3600_000 - Date.now()) / 3600_000);
}

export default async function ValidacionesAdmin({ searchParams }: PageProps<"/admin/recompensas/validaciones">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: evData }, { data: rulesData }, { data: cfg }, { data: flags }] = await Promise.all([
    supabase
      .from("mission_evidences")
      .select("id, user_id, url, storage_path, evidence_key, note, submitted_at, review_started_at, profiles(full_name, public_alias), missions(code, title, category, evidence_instructions, gn_reward, xp_reward)")
      .eq("status", "pending")
      .order("submitted_at")
      .limit(100),
    supabase.from("mission_validation_rules").select("category, criteria, weekly_limit, sla_hours").order("category"),
    supabase.from("gn_config").select("key, value").in("key", ["validacion_sla_horas", "validacion_limite_semanal"]),
    supabase.from("fraud_flags").select("details").in("kind", ["duplicate_evidence", "duplicate_evidence_cross"]).is("resolved_at", null),
  ]);
  const evidences = (evData ?? []) as unknown as Ev[];
  const rules = (rulesData ?? []) as Rule[];
  const ruleOf = new Map(rules.map((r) => [r.category, r]));
  const cfgOf = Object.fromEntries((cfg ?? []).map((c) => [c.key, Number(c.value)]));
  const slaGeneral = cfgOf.validacion_sla_horas || 72;
  const limiteGeneral = cfgOf.validacion_limite_semanal || 10;
  const duplicadas = new Set((flags ?? []).map((f) => String((f.details as { evidence_key?: string })?.evidence_key ?? "")));

  const paths = evidences.map((e) => e.storage_path).filter((p): p is string => !!p);
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await supabase.storage.from("evidences").createSignedUrls(paths, 600);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <PageTitle eyebrow="Recompensas GN" title="Validaciones de misiones">
        Estados: enviada → en revisión → aprobada, rechazada o requiere corrección. Al aprobar se acreditan los XP y los GN de
        la misión con el flujo de siempre. Plazo de respuesta general: {formatNum(slaGeneral)} h.
      </PageTitle>

      <section className="mb-8">
        <h2 className="eyebrow mb-3">Pendientes ({formatNum(evidences.length)})</h2>
        {evidences.length === 0 && <p className="card text-sm text-parchment">No hay evidencias pendientes.</p>}
        <div className="grid gap-4 lg:grid-cols-2">
          {evidences.map((e) => {
            const rule = e.missions ? ruleOf.get(e.missions.category) : undefined;
            const sla = rule?.sla_hours ?? slaGeneral;
            const horas = horasRestantes(e.submitted_at, sla);
            const link = e.storage_path ? signed.get(e.storage_path) : e.url;
            return (
              <article key={e.id} className="card space-y-3 text-sm">
                <header className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-parchment">{e.missions?.code} · {nombre(e.profiles, e.user_id)} · {formatDateTime(e.submitted_at)}</p>
                    <h3 className="font-semibold">{e.missions?.title}</h3>
                    <p className="text-xs text-parchment">
                      +{formatNum(e.missions?.xp_reward ?? 0)} XP{(e.missions?.gn_reward ?? 0) > 0 ? ` · +${formatNum(e.missions!.gn_reward)} GN` : ""}
                    </p>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${horas < 0 ? "border-bad/60 text-bad" : "border-smoke"}`}>
                    {e.review_started_at ? "En revisión" : "Enviada"} · {horas < 0 ? `vencida hace ${formatNum(-horas)} h` : `quedan ${formatNum(horas)} h`}
                  </span>
                </header>
                {duplicadas.has(e.evidence_key) && <p className="text-xs text-bad">Esta evidencia también aparece en otra misión o tienda.</p>}
                {rule?.criteria && <p className="rounded-lg border border-smoke p-2 text-xs text-parchment">Criterios: {rule.criteria}</p>}
                {e.note && <p className="text-parchment">Nota: {e.note}</p>}
                {link && <a className="underline" href={link} target="_blank" rel="noopener noreferrer">Ver evidencia</a>}

                {!e.review_started_at && (
                  <form action={startEvidenceReview}>
                    <input type="hidden" name="id" value={e.id} />
                    <button className="btn-ghost min-h-11">Empezar revisión</button>
                  </form>
                )}
                <form action={decideEvidence} className="space-y-2">
                  <input type="hidden" name="id" value={e.id} />
                  <div>
                    <label className="label" htmlFor={`m-${e.id}`}>Motivo (obligatorio si rechazas o pides corrección)</label>
                    <input className="input text-base" id={`m-${e.id}`} name="reason" maxLength={500} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button name="decision" value="aprobar" className="btn-bronze min-h-11">Aprobar</button>
                    <button name="decision" value="corregir" className="btn-ghost min-h-11">Requiere corrección</button>
                    <button name="decision" value="rechazar" className="btn-danger min-h-11">Rechazar</button>
                  </div>
                </form>
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="eyebrow mb-3">Criterios por tipo de misión</h2>
        <p className="mb-3 text-sm text-parchment">
          Vacío = valor general (límite {formatNum(limiteGeneral)} evidencias por semana, plazo {formatNum(slaGeneral)} h). BORRADOR: confirma los límites.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {rules.length === 0 && <p className="card text-sm text-parchment">No hay misiones con validación manual.</p>}
          {rules.map((r) => (
            <form key={r.category} action={saveValidationRule} className="card space-y-2">
              <input type="hidden" name="category" value={r.category} />
              <p className="font-semibold">{r.category}</p>
              <div>
                <label className="label" htmlFor={`c-${r.category}`}>Qué se acepta</label>
                <textarea className="input text-base" id={`c-${r.category}`} name="criteria" rows={2} maxLength={2000} defaultValue={r.criteria} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label" htmlFor={`w-${r.category}`}>Límite semanal</label>
                  <input className="input text-base" id={`w-${r.category}`} name="weekly_limit" type="number" min={1} max={100} defaultValue={r.weekly_limit ?? ""} />
                </div>
                <div>
                  <label className="label" htmlFor={`s-${r.category}`}>Plazo (h)</label>
                  <input className="input text-base" id={`s-${r.category}`} name="sla_hours" type="number" min={1} max={720} defaultValue={r.sla_hours ?? ""} />
                </div>
              </div>
              <button className="btn-ghost min-h-11">Guardar</button>
            </form>
          ))}
        </div>
      </section>
    </>
  );
}
