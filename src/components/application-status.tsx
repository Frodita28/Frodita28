import { APPLICATION_STATUS, EVENT_LABEL, type ApplicationStatus } from "@/lib/applications";
import { formatDateTime } from "@/lib/time";
import { Pill } from "./status-badge";

export function ApplicationStatusPill({ status }: { status: ApplicationStatus }) {
  const s = APPLICATION_STATUS[status];
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export type ApplicationEvent = { id: number; event: string; message: string | null; is_internal: boolean; created_at: string };

/** Historial de una solicitud, del más reciente al más antiguo. */
export function ApplicationTimeline({ events }: { events: ApplicationEvent[] }) {
  const sorted = [...events].sort((a, b) => b.id - a.id);
  if (sorted.length === 0) return <p className="text-sm text-parchment">Sin movimientos.</p>;
  return (
    <ol className="space-y-3 border-l border-ash pl-4">
      {sorted.map((e) => (
        <li key={e.id} className="relative">
          <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${e.is_internal ? "bg-smoke" : "bg-bronze"}`} aria-hidden="true" />
          <p className="text-sm font-semibold">
            {EVENT_LABEL[e.event] ?? e.event}
            {e.is_internal && <span className="ml-2 text-xs font-normal text-parchment">(solo equipo)</span>}
          </p>
          <p className="text-xs text-parchment">{formatDateTime(e.created_at)}</p>
          {e.message && <p className="mt-1 whitespace-pre-line text-sm text-linen">{e.message}</p>}
        </li>
      ))}
    </ol>
  );
}
