import { progressPercent } from "@/lib/missions";

export function ProgressBar({ value, target }: { value: number | null; target: number }) {
  const pct = progressPercent(value, target);
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-ash"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <div className="h-full rounded-full bg-bronze transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}
