import Link from "next/link";
import { Banner, Bar, ComingSoon, StatSlab, type Accent } from "@/components/club";
import { Flash } from "@/components/flash";
import { Icon } from "@/components/icons";
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

type Row = ParticipationRow & { missions: MissionRow; mission_evidences: EvidenceRow[] };

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
      .select("*, missions(*), mission_evidences(*)")
      .eq("user_id", user.id)
      .gte("period_end", since)
      .order("period_start", { ascending: false })
      .order("submitted_at", { referencedTable: "mission_evidences", ascending: false }),
    supabase.from("xp_ledger").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
    supabase.from("user_xp_balances").select("total_xp").eq("user_id", user.id).maybeSingle(),
    supabase.from("licenses").select("id").eq("user_id", user.id).eq("status", "active").maybeSingle(),
  ]);
  // Las evidencias llegan en la misma consulta que las participaciones.
  const rows = (rowsData ?? []) as Row[];
  const ledger = (ledgerData ?? []) as LedgerRow[];

  const tz = rows[0]?.missions.timezone ?? "America/Caracas";
  const today = todayIn(tz);
  // Las misiones retiradas solo aparecen en el historial (completadas, rechazadas, XP).
  const isCurrent = (r: Row) => r.missions.status === "active" && r.period_start <= todayIn(r.missions.timezone) && todayIn(r.missions.timezone) <= r.period_end;

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
      <Banner
        title="Misiones y desafíos"
        accent="blood"
        aside={
          <div className="border border-ash bg-pit px-4 py-2 text-center">
            <p className="kicker">XP ganados este mes</p>
            <p className="font-display text-xl text-gold">{formatXp(monthXp)}</p>
          </div>
        }
      >
        Completa misiones con las ventas de tu punto de venta y contenido real para sumar XP. Los XP no representan dinero ni
        garantizan beneficios económicos.
      </Banner>

      {!license && (
        <div className="slab mb-4 border-l-4 border-l-warn text-sm text-warn">
          Necesitas una licencia activa para participar en las misiones.
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatSlab label="XP acumulados" value={formatXp(total)} />
        <StatSlab label="XP este mes" value={formatXp(monthXp)} />
        <StatSlab label="En progreso" value={String(inProgress)} />
        <StatSlab label="En revisión" value={String(byTab.review.length)} />
      </div>

      <div className="mb-5">
        <ComingSoon title="Insignias">
          Insignias permanentes por logros llegan en la Fase 2. Tus XP actuales ya cuentan para la{" "}
          <Link href="/panel/clasificacion" className="text-gold">clasificación</Link>.
        </ComingSoon>
      </div>

      <nav className="-mx-4 mb-4 overflow-x-auto px-4" aria-label="Filtros de misiones">
        <ul className="flex gap-2">
          {TABS.map((t) => (
            <li key={t.key}>
              <Link href={`/panel/misiones?tab=${t.key}`} className="chip" aria-current={tab === t.key ? "page" : undefined}>
                {t.label}
                {t.key !== "xp" && <span className="ml-1 opacity-70">({byTab[t.key].length})</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "xp" ? (
        <XpHistory ledger={ledger} tz={tz} />
      ) : byTab[tab].length === 0 ? (
        <p className="slab text-sm text-parchment">No hay misiones en esta sección.</p>
      ) : (
        <div className="grid gap-4">
          {byTab[tab].map((r) => (
            <MissionCard key={r.id} row={r} evidences={r.mission_evidences} returnTo={`/panel/misiones?tab=${tab}`} />
          ))}
        </div>
      )}
    </>
  );
}

const ACCENT_BORDER: Record<Accent, string> = {
  gold: "border-l-gold",
  blood: "border-l-blood",
  violet: "border-l-violet",
  ok: "border-l-ok",
  ash: "border-l-smoke",
};

const STATUS_ACCENT: Record<ParticipationStatus, Accent> = {
  available: "ash",
  in_progress: "gold",
  pending_review: "violet",
  completed: "ok",
  rejected: "blood",
  expired: "ash",
};

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
    <article className={`slab flex flex-col gap-3 border-l-4 ${ACCENT_BORDER[STATUS_ACCENT[row.status as ParticipationStatus]]}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="tag border border-smoke bg-pit text-gold">{m.category}</span>
            <span className="text-xs font-extrabold text-blood">+{row.xp_reward} XP</span>
            <span className="text-[11px] text-parchment">{m.code} · {FREQUENCY_LABEL[m.frequency as Frequency]}</span>
          </p>
          <h3 className="mt-2 font-display text-base uppercase leading-snug tracking-wide sm:text-lg">{m.title}</h3>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {row.status === "completed" && <Icon name="check" className="h-4 w-4 text-ok" />}
          <StatusBadge status={row.status as ParticipationStatus} />
        </div>
      </header>
      <p className="text-sm text-linen">{m.description}</p>

      <div className="max-w-2xl">
        <Bar value={progress} target={target} accent={row.status === "completed" ? "ok" : "gold"} label={`Progreso de ${m.title}`} />
        <div className="mt-1 flex flex-wrap justify-between gap-2 text-[11px] text-parchment">
          <span>
            {m.metric === "net_sales_growth_pct" && progress === null
              ? "Sin datos comparables del período anterior"
              : `Progreso: ${progress ?? 0} / ${target} ${m.target_unit}`}
          </span>
          <span>Fecha límite: {formatDay(row.period_end)}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
        <details className="group border-t border-ash pt-3" open={row.status === "rejected"}>
          <summary className="btn-gold w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Enviar evidencia</span>
            <span className="hidden group-open:inline">Ocultar formulario</span>
          </summary>
        <form action={submitEvidence} className="mt-3 max-w-2xl space-y-2">
          <input type="hidden" name="participation_id" value={row.id} />
          <input type="hidden" name="return_to" value={returnTo} />
          <label className="label" htmlFor={`url-${row.id}`}>Enlace de la publicación</label>
          <input className="input" id={`url-${row.id}`} name="url" type="url" placeholder="https://instagram.com/reel/…" />
          <label className="label" htmlFor={`file-${row.id}`}>…o captura (PNG, JPG, WEBP · máx. 5 MB)</label>
          <input className="block w-full text-xs text-parchment file:mr-3 file:rounded-md file:border-0 file:bg-ash file:px-3 file:py-1.5 file:text-ivory" id={`file-${row.id}`} name="file" type="file" accept="image/png,image/jpeg,image/webp" />
          <input className="input" name="note" maxLength={1000} placeholder="Nota opcional para el revisor" />
          <p className="text-[11px] text-parchment">Nunca te pediremos contraseñas de tus redes sociales.</p>
          <button className="btn-gold">Enviar evidencia</button>
        </form>
        </details>
      )}
    </article>
  );
}

function XpHistory({ ledger, tz }: { ledger: LedgerRow[]; tz: string }) {
  if (ledger.length === 0) return <p className="slab text-sm text-parchment">Todavía no tienes movimientos de XP.</p>;
  const TYPE = { mission_reward: "Misión", admin_adjustment: "Ajuste", reversal: "Reversión" } as const;
  return (
    <div className="table-wrap rounded-none">
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
