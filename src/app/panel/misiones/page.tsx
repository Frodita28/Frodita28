import Link from "next/link";
import { Alert, Badge, ComingSoon, EmptyState, PageBanner, ProgressBar, StatCard, type BadgeTone } from "@/components/ui";
import { Flash } from "@/components/flash";
import { Icon } from "@/components/icons";
import { requireUser } from "@/lib/auth";
import {
  FREQUENCY_LABEL,
  STATUS_LABEL,
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
import { EvidenceForm } from "./evidence-form";

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
      <div className="flex flex-col gap-4">
        <Flash ok={sp.ok} error={sp.error ?? (refreshError ? "No se pudieron actualizar tus misiones" : undefined)} variant="panel" />
        <PageBanner
          title="Misiones y desafíos"
          aside={
            <div className="ui-card-inset min-w-40 text-center">
              <p className="ui-label">XP ganados este mes</p>
              <p className="ui-num mt-2 text-2xl text-accent">{formatXp(monthXp)}</p>
            </div>
          }
        >
          Completa misiones con las ventas de tu punto de venta y contenido real para sumar XP. Los XP no representan dinero ni
          garantizan beneficios económicos.
        </PageBanner>
        {!license && <Alert>Necesitas una licencia activa para participar en las misiones.</Alert>}
      </div>

      <section className="flex flex-col gap-4" aria-label="Resumen de XP">
        <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
          <StatCard label="XP acumulados" value={formatXp(total)} />
          <StatCard label="XP este mes" value={formatXp(monthXp)} />
          <StatCard label="En progreso" value={String(inProgress)} />
          <StatCard label="En revisión" value={String(byTab.review.length)} />
        </div>
        <ComingSoon title="Insignias">
          Insignias permanentes por logros llegan en la Fase 2. Tus XP actuales ya cuentan para tu rango.
        </ComingSoon>
      </section>

      <section className="flex flex-col gap-4">
        <nav className="gn-snap-x -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0" aria-label="Filtros de misiones">
          <ul className="flex gap-2 pb-1">
            {TABS.map((t) => (
              <li key={t.key}>
                <Link href={`/panel/misiones?tab=${t.key}`} className="ui-chip" aria-current={tab === t.key ? "page" : undefined}>
                  {t.label}
                  {t.key !== "xp" && <span className="ui-num font-medium">({byTab[t.key].length})</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {tab === "xp" ? (
          <XpHistory ledger={ledger} tz={tz} />
        ) : byTab[tab].length === 0 ? (
          <EmptyState>No hay misiones en esta sección.</EmptyState>
        ) : (
          <div className="grid gap-4">
            {byTab[tab].map((r) => (
              <MissionCard key={r.id} row={r} evidences={r.mission_evidences} returnTo={`/panel/misiones?tab=${tab}`} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

/** Estados de una misión con los tonos del sistema: amarillo en curso, verde completada, rojo rechazada. */
const STATUS_TONE: Record<ParticipationStatus, BadgeTone> = {
  available: "neutral",
  in_progress: "accent",
  pending_review: "neutral",
  completed: "success",
  rejected: "alert",
  expired: "neutral",
};

function MissionCard({ row, evidences, returnTo }: { row: Row; evidences: EvidenceRow[]; returnTo: string }) {
  const m = row.missions;
  const status = row.status as ParticipationStatus;
  const progress = row.current_progress === null ? null : Number(row.current_progress);
  const target = Number(row.target_value);
  const open = isPeriodOpen(row.period_end, todayIn(m.timezone));
  const showForm = canSubmitEvidence(status, m.validation_method, open);
  const pendingOrApproved = evidences.filter((e) => e.status !== "rejected").length;
  const needed = m.metric === "manual_approval" ? 1 : target;
  const canAddMore = pendingOrApproved < needed;

  return (
    <article id={`mision-${row.id}`} className="ui-card flex scroll-mt-24 flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <Badge>{m.category}</Badge>
            <span className="ui-num text-[13px]">+{row.xp_reward} XP</span>
            <span className="text-[13px] text-fg-2">{m.code} · {FREQUENCY_LABEL[m.frequency as Frequency]}</span>
          </p>
          <h3 className="ui-title-card mt-3">{m.title}</h3>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {status === "completed" && <Icon name="check" className="h-4 w-4 text-success" />}
          <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
        </div>
      </header>
      <p className="max-w-3xl">{m.description}</p>

      <div className="max-w-2xl">
        <ProgressBar value={progress} target={target} done={status === "completed"} label={`Progreso de ${m.title}`} />
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-[13px] text-fg-2">
          <span className="tabular-nums">
            {m.metric === "net_sales_growth_pct" && progress === null
              ? "Sin datos comparables del período anterior"
              : `Progreso: ${progress ?? 0} / ${target} ${m.target_unit}`}
          </span>
          <span>Fecha límite: {formatDay(row.period_end)}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge>{m.validation_method === "auto" ? "Validación automática" : "Revisión manual"}</Badge>
      </div>

      <p className="text-fg-2">
        <span className="font-medium text-fg">{m.evidence_required ? "Evidencia necesaria: " : "Validación: "}</span>
        {m.evidence_instructions}
      </p>

      {row.status === "rejected" && row.rejection_reason && (
        <Alert>Motivo del rechazo: {row.rejection_reason}. Puedes volver a presentar una evidencia nueva.</Alert>
      )}

      {evidences.length > 0 && (
        <ul className="space-y-2 text-[13px]">
          {evidences.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2">
              <Badge tone={e.status === "approved" ? "success" : e.status === "rejected" ? "alert" : "neutral"}>
                {e.status === "approved" ? "Aprobada" : e.status === "rejected" ? "Rechazada" : "Pendiente"}
              </Badge>
              <span className="min-w-0 truncate">{e.url ?? "Captura adjunta"}</span>
              {e.rejection_reason && <span className="text-fg-2">— {e.rejection_reason}</span>}
            </li>
          ))}
        </ul>
      )}

      {showForm && canAddMore && (
        <details className="group border-t border-line pt-4" open={row.status === "rejected"}>
          <summary className="ui-btn-secondary w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Enviar evidencia</span>
            <span className="hidden group-open:inline">Ocultar formulario</span>
            <Icon name="chevronDown" className="h-4 w-4 transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <div className="mt-4">
            <EvidenceForm participationId={row.id} returnTo={returnTo} />
          </div>
        </details>
      )}
    </article>
  );
}

function XpHistory({ ledger, tz }: { ledger: LedgerRow[]; tz: string }) {
  if (ledger.length === 0) return <EmptyState>Todavía no tienes movimientos de XP.</EmptyState>;
  const TYPE = { mission_reward: "Misión", admin_adjustment: "Ajuste", reversal: "Reversión" } as const;
  return (
    <>
      {/* Teléfono: lista de dos líneas. */}
      <ul className="divide-y divide-line rounded-ui border border-line bg-surface md:hidden">
        {ledger.map((l) => (
          <li key={l.id} className="flex items-start justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[15px] [overflow-wrap:anywhere]">{l.description}</p>
              <p className="mt-1 text-[13px] text-fg-2">{TYPE[l.transaction_type]} · {formatDateTime(l.created_at, tz)}</p>
            </div>
            <span className={`ui-num shrink-0 ${l.amount > 0 ? "text-accent" : ""}`}>{l.amount > 0 ? `+${l.amount}` : l.amount}</span>
          </li>
        ))}
      </ul>
      <div className="ui-table-wrap hidden md:block">
        <table className="ui-table">
          <thead>
            <tr><th scope="col">Fecha</th><th scope="col">Tipo</th><th scope="col">Detalle</th><th scope="col" className="text-right">XP</th></tr>
          </thead>
          <tbody>
            {ledger.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap text-fg-2">{formatDateTime(l.created_at, tz)}</td>
                <td>{TYPE[l.transaction_type]}</td>
                <td>{l.description}</td>
                <td className="ui-num text-right whitespace-nowrap">{l.amount > 0 ? `+${l.amount}` : l.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
