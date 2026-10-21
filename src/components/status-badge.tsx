import { STATUS_LABEL, type ParticipationStatus } from "@/lib/missions";

const STYLE: Record<ParticipationStatus, string> = {
  available: "border-smoke text-linen",
  in_progress: "border-bronze/60 text-bronze-soft",
  pending_review: "border-warn/60 text-warn",
  completed: "border-ok/60 text-ok",
  rejected: "border-bad/60 text-bad",
  expired: "border-smoke text-parchment",
};

export function StatusBadge({ status }: { status: ParticipationStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "bronze" | "ok" | "warn" | "bad" }) {
  const tones = {
    neutral: "border-smoke text-linen",
    bronze: "border-bronze/60 text-bronze-soft",
    ok: "border-ok/60 text-ok",
    warn: "border-warn/60 text-warn",
    bad: "border-bad/60 text-bad",
  };
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${tones[tone]}`}>
      {children}
    </span>
  );
}
