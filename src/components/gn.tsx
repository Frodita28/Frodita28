import { TEXTOS_CLAN as T } from "@/content/recompensas";
import type { Notice } from "@/lib/clan-server";
import { formatGn } from "@/lib/gn";
import type { GnResumen } from "@/lib/gn-server";
import { formatDateTime } from "@/lib/time";
import type { NoticeView } from "./gn-notices";
import { Icon } from "./icons";

/** Aviso fijo del programa (va en Tienda Clan y Recompensas). */
export function GnDisclaimer() {
  return (
    <p className="flex items-start gap-2 text-[13px] text-fg-2">
      <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0" />
      {T.aviso}
    </p>
  );
}

/** Cabecera de saldo: disponibles, pendientes y por vencer en 30 días. */
export function GnBalance({ resumen, diasEspera }: { resumen: GnResumen; diasEspera: number }) {
  return (
    <section aria-label="Tu saldo de GN" className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Cifra label={T.disponibles} value={resumen.available} destacado />
        <Cifra label={T.pendientes} value={resumen.pending} hint={T.pendientesAyuda(diasEspera)} />
        <Cifra label={T.porVencer} value={resumen.expiring_30} hint={T.porVencerAyuda} />
      </div>
      {resumen.held > 0 && <p className="text-[13px] text-fg-2">{T.retenidos(formatGn(resumen.held))}</p>}
      {resumen.debt > 0 && (
        <p role="alert" className="ui-card flex items-start gap-2 border-brand-red text-[15px]">
          <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
          {T.porCubrir(formatGn(resumen.debt))}
        </p>
      )}
    </section>
  );
}

function Cifra({ label, value, hint, destacado }: { label: string; value: number; hint?: string; destacado?: boolean }) {
  return (
    <div className={`ui-card flex min-w-0 flex-col p-3 sm:p-5 ${destacado ? "border-gold/60" : ""}`}>
      <p className="ui-label [overflow-wrap:anywhere]">{label}</p>
      <p className={`ui-num mt-2 text-[clamp(1.125rem,5.5vw,2rem)] leading-none [overflow-wrap:anywhere] ${destacado ? "text-gold" : ""}`}>
        {formatGn(value)}
      </p>
      {hint && <p className="mt-2 text-[12px] leading-snug text-fg-2 sm:text-[13px]">{hint}</p>}
    </div>
  );
}

export function noticeViews(items: Notice[]): NoticeView[] {
  return items.map((n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, unread: n.read_at === null, at: formatDateTime(n.created_at) }));
}
