import Link from "next/link";
import { Flash } from "@/components/flash";
import { PageTitle } from "@/components/nav";
import { ProgressBar } from "@/components/progress";
import { Pill, StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import {
  FREQUENCY_LABEL,
  canSubmitEvidence,
  formatDay,
  formatXp,
  isPeriodOpen,
  todayIn,
  type Frequency,
  type ParticipationStatus,
} from "@/lib/missions";
import { daysAgoIso, formatDateTime } from "@/lib/time";
import type { EvidenceRow, LedgerRow, MissionRow, ParticipationRow } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { submitEvidence } from "./actions";

export const metadata = { title: "Misiones" };

type Row = ParticipationRow & { missions: MissionRow };

const TABS = [
  { key: "daily", label: "Diarias" },
  { key: "weekly", label: "Semanales" },
  { key: "monthly", label: "Mensuales" },
  { key: "review", label: "En revisión" },
  { key: "completed", label: "Completadas" },
  { key: "rejected", label: "Rechazadas" },
  { key: "xp", label: "Historial de XP" },
] as const;
type Tab = (typeof TABS)[number]["key"];

/** Días consecutivos (hasta hoy o ayer) con al menos una misión diaria completada. */
function streak(rows: Row[], today: string) {
  const days = new Set(rows.filter((r) => r.missions.frequency === "daily" && r.status === "completed").map((r) => r.period_start));
  const d = new Date(`${today}T12:00:00Z`);
  if (!days.has(today)) d.setUTCDate(d.getUTCDate() - 1);
  let n = 0;
  while (days.has(d.toISOString().slice(0, 10))) {
    n++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return n;
}

export default async function MissionsPage({ searchParams }: PageProps<"/panel/misiones">) {
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "daily";
  const user = await requireUser("/panel/misiones");
  const supabase = await createClient();

  // Abre los períodos actuales y actualiza estados (idempotente, en el servidor).
  const { error: refreshError } = await supabase.rpc("refresh_my_missions");

  const since = daysAgoIso(62);
  const [{ data: rowsData }, { data: ledgerData }, { data: balance }, { data: license }] = await Promise.all([
    supabase
      .from("mission_participations")
      .select("*, missions(*)")
      .eq("user_id", user.id)
      .gte("period_end", since)
      .order("period_start", { ascending: false }),
    supabase.from("xp_ledger").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
    supabase.from("user_xp_balances").select("total_xp").eq("user_id", user.id).maybeSingle(),
    supabase.from("licenses").select("id").eq("user_id", user.id).eq("status", "active").maybeSingle(),
  ]);
  const rows = (rowsData ?? []) as Row[];
  const ledger = (ledgerData ?? []) as LedgerRow[];

  const ids = rows.map((r) => r.id);
  const { data: evData } = ids.length
    ? await supabase.from("mission_evidences").select("*").in("participation_id", ids).order("submitted_at", { ascending: false })
    : { data: [] };
  const evidences = (evData ?? []) as EvidenceRow[];

  const tz = rows[0]?.missions.timezone ?? "America/Caracas";
  const today = todayIn(tz);
  const isCurrent = (r: Row) => r.period_start <= todayIn(r.missions.timezone) && todayIn(r.missions.timezone) <= r.period_end;

  const byTab: Record<Exclude<Tab, "xp">, Row[]> = {
    daily: rows.filter((r) => r.missions.frequency === "daily" && isCurrent(r)),
    weekly: rows.filter((r) => r.missions.frequency === "weekly" && isCurrent(r)),
    monthly: rows.filter((r) => r.missions.frequency === "monthly" && isCurrent(r)),
    review: rows.filter((r) => r.status === "pending_review"),
    completed: rows.filter((r) => r.status === "completed"),
    rejected: rows.filter((r) => r.status === "rejected"),
  };
  const inProgress = rows.filter((r) => r.status === "in_progress" && isCurrent(r)).length;
  const total = Number(balance?.total_xp ?? 0);
  const monthStart = `${today.slice(0, 8)}01`;
  const monthXp = ledger.filter((l) => todayIn(tz, new Date(l.created_at)) >= monthStart).reduce((s, l) => s + l.amount, 0);

  return (
    <>
      <Flash ok={sp.ok} error={sp.error ?? (refreshError ? "No se pudieron actualizar tus misiones" : undefined)} />
      <PageTitle eyebrow="Gamificación" title="Misiones">
        Completa misiones con ventas verificadas y contenido real para sumar XP. Los XP no representan dinero ni
        garantizan beneficios económicos.
      </PageTitle>

      {!license && (
        <div className="card mb-4 border-warn/40 text-sm text-warn">
          Necesitas una licencia activa para participar en las misiones.
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="XP acumulados" value={formatXp(total)} />
        <Stat label="XP este mes" value={formatXp(monthXp)} />
        <Stat label="Racha diaria" value={`${streak(rows, today)} ${streak(rows, today) === 1 ? "día" : "días"}`} />
        <Stat label="En progreso" value={String(inProgress)} />
        <Stat label="En revisión" value={String(byTab.review.length)} />
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <ComingSoon title="Nivel" text="Los ocho niveles (Aspirante → Leyenda Gallo Negro) se activan en la Fase 2, cuando Gallo Negro configure sus umbrales de XP." />
        <ComingSoon title="Insignias y ranking" text="Insignias permanentes y rankings diario, semanal y mensual llegan en la Fase 2. Tus XP actuales ya contarán." />
        <ComingSoon title="Recompensas" text="Ninguna recompensa está aprobada todavía. Se publicarán solo cuando Gallo Negro las confirme (Fase 3)." />
      </div>

      <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-ash" aria-label="Filtros de misiones">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/panel/misiones?tab=${t.key}`}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === t.key ? "border-bronze text-ivory" : "border-transparent text-parchment hover:text-ivory"}`}
            aria-current={tab === t.key ? "page" : undefined}
          >
            {t.label}
            {t.key !== "xp" && <span className="ml-1 text-xs text-parchment">({byTab[t.key].length})</span>}
          </Link>
        ))}
      </nav>

      {tab === "xp" ? (
        <XpHistory ledger={ledger} tz={tz} />
      ) : byTab[tab].length === 0 ? (
        <p className="card text-sm text-parchment">No hay misiones en esta sección.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {byTab[tab].map((r) => (
            <MissionCard key={r.id} row={r} evidences={evidences.filter((e) => e.participation_id === r.id)} returnTo={`/panel/misiones?tab=${tab}`} />
          ))}
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="label">{label}</p>
      <p className="font-display text-xl">{value}</p>
    </div>
  );
}

function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-smoke p-4">
      <p className="mb-1 flex items-center gap-2 text-sm font-semibold">
        {title} <Pill>Próximamente</Pill>
      </p>
      <p className="text-xs text-parchment">{text}</p>
    </div>
  );
}

function MissionCard({ row, evidences, returnTo }: { row: Row; evidences: EvidenceRow[]; returnTo: string }) {
  const m = row.missions;
  const progress = row.current_progress === null ? null : Number(row.current_progress);
  const target = Number(row.target_value);
  const open = isPeriodOpen(row.period_end, todayIn(m.timezone));
  const showForm = canSubmitEvidence(row.status as ParticipationStatus, m.validation_method, open);
  const pendingOrApproved = evidences.filter((e) => e.status !== "rejected").length;
  const needed = m.metric === "manual_approval" ? 1 : target;
  const canAddMore = pendingOrApproved < needed;

  return (
    <article className="card flex flex-col gap-3">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-parchment">
            {m.code} · {m.category} · {FREQUENCY_LABEL[m.frequency as Frequency]}
          </p>
          <h3 className="text-base font-semibold">{m.title}</h3>
        </div>
        <div className="text-right">
          <p className="font-display text-lg text-bronze">+{row.xp_reward}</p>
          <p className="text-[10px] uppercase tracking-wider text-parchment">XP</p>
        </div>
      </header>
      <p className="text-sm text-linen">{m.description}</p>

      <div>
        <div className="mb-1 flex justify-between text-xs text-parchment">
          <span>
            {m.metric === "net_sales_growth_pct" && progress === null
              ? "Sin datos comparables del período anterior"
              : `${progress ?? 0} / ${target} ${m.target_unit}`}
          </span>
          <span>Fecha límite: {formatDay(row.period_end)}</span>
        </div>
        <ProgressBar value={progress} target={target} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={row.status as ParticipationStatus} />
        <Pill tone={m.validation_method === "auto" ? "bronze" : "neutral"}>
          {m.validation_method === "auto" ? "Validación automática" : "Revisión manual"}
        </Pill>
      </div>

      <p className="text-xs text-parchment">
        <span className="font-semibold text-linen">{m.evidence_required ? "Evidencia necesaria: " : "Validación: "}</span>
        {m.evidence_instructions}
      </p>

      {row.status === "rejected" && row.rejection_reason && (
        <p className="rounded-lg border border-bad/40 bg-bad/10 p-2 text-xs text-bad">
          Motivo del rechazo: {row.rejection_reason}. Puedes volver a presentar una evidencia nueva.
        </p>
      )}

      {evidences.length > 0 && (
        <ul className="space-y-1 text-xs">
          {evidences.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2">
              <Pill tone={e.status === "approved" ? "ok" : e.status === "rejected" ? "bad" : "warn"}>
                {e.status === "approved" ? "Aprobada" : e.status === "rejected" ? "Rechazada" : "Pendiente"}
              </Pill>
              <span className="truncate text-linen">{e.url ?? "Captura adjunta"}</span>
              {e.rejection_reason && <span className="text-bad">— {e.rejection_reason}</span>}
            </li>
          ))}
        </ul>
      )}

      {showForm && canAddMore && (
        <form action={submitEvidence} className="space-y-2 border-t border-ash pt-3">
          <input type="hidden" name="participation_id" value={row.id} />
          <input type="hidden" name="return_to" value={returnTo} />
          <label className="label" htmlFor={`url-${row.id}`}>Enlace de la publicación</label>
          <input className="input" id={`url-${row.id}`} name="url" type="url" placeholder="https://instagram.com/reel/…" />
          <label className="label" htmlFor={`file-${row.id}`}>…o captura (PNG, JPG, WEBP · máx. 5 MB)</label>
          <input className="block w-full text-xs text-parchment file:mr-3 file:rounded-md file:border-0 file:bg-ash file:px-3 file:py-1.5 file:text-ivory" id={`file-${row.id}`} name="file" type="file" accept="image/png,image/jpeg,image/webp" />
          <input className="input" name="note" maxLength={1000} placeholder="Nota opcional para el revisor" />
          <p className="text-[11px] text-parchment">Nunca te pediremos contraseñas de tus redes sociales.</p>
          <button className="btn-bronze">Enviar evidencia</button>
        </form>
      )}
    </article>
  );
}

function XpHistory({ ledger, tz }: { ledger: LedgerRow[]; tz: string }) {
  if (ledger.length === 0) return <p className="card text-sm text-parchment">Todavía no tienes movimientos de XP.</p>;
  const TYPE = { mission_reward: "Misión", admin_adjustment: "Ajuste", reversal: "Reversión" } as const;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th className="text-right">XP</th></tr>
        </thead>
        <tbody>
          {ledger.map((l) => (
            <tr key={l.id}>
              <td className="whitespace-nowrap text-parchment">{formatDateTime(l.created_at, tz)}</td>
              <td>{TYPE[l.transaction_type]}</td>
              <td>{l.description}</td>
              <td className={`text-right font-semibold ${l.amount < 0 ? "text-bad" : "text-ok"}`}>{l.amount > 0 ? `+${l.amount}` : l.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
