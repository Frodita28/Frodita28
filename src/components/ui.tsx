import { progressPercent } from "@/lib/missions";
import { Icon, type IconName } from "./icons";

/*
 * Componentes del sistema de diseño del panel de licenciatarios.
 * Tokens y utilidades (ui-card, ui-btn-primary, ui-label…) en src/app/globals.css;
 * guía completa en docs/DESIGN_SYSTEM.md.
 */

/** Banner de página: título grande, subtítulo en gris y borde izquierdo rojo (uno por página). */
export function PageBanner({ title, aside, children }: { title: string; aside?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6 border-l-4 border-brand-red py-1 pl-4 sm:pl-6">
      <div className="min-w-0 max-w-3xl">
        <h1 className="ui-title-page [overflow-wrap:anywhere]">{title}</h1>
        {children && <div className="mt-3 text-base text-fg-2">{children}</div>}
      </div>
      {aside}
    </div>
  );
}

/** Título de sección (24 px) con descripción y acción opcionales. */
export function SectionHeader({
  title,
  id,
  aside,
  children,
  as: Tag = "h2",
}: {
  title: string;
  id?: string;
  aside?: React.ReactNode;
  children?: React.ReactNode;
  as?: "h2" | "h3";
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div className="min-w-0">
        <Tag id={id} className="ui-title-section">{title}</Tag>
        {children && <div className="mt-1 text-[15px] text-fg-2">{children}</div>}
      </div>
      {aside}
    </div>
  );
}

/** Tarjeta de cifra: etiqueta pequeña, número grande y una línea de explicación. */
export function StatCard({
  label,
  value,
  hint,
  icon,
  size = "md",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: IconName;
  size?: "md" | "lg";
}) {
  return (
    <div className="ui-card flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <p className="ui-label">{label}</p>
        {icon && <Icon name={icon} className="h-5 w-5 shrink-0 text-fg-2" />}
      </div>
      <div
        className={`ui-num mt-2 leading-none [overflow-wrap:anywhere] ${size === "lg" ? "text-[clamp(1.75rem,9vw,3rem)]" : "text-[clamp(1.375rem,6.5vw,2rem)]"}`}
      >
        {value}
      </div>
      {hint && <div className="mt-3 text-[13px] text-fg-2">{hint}</div>}
    </div>
  );
}

/** Pequeño bloque de cifra para usar dentro de una tarjeta. */
export function Figure({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="ui-card-inset">
      <p className="ui-label">{label}</p>
      <div className="ui-num mt-2 text-2xl leading-tight">{value}</div>
    </div>
  );
}

/** Barra de progreso de 8 px: amarilla, porcentaje a la derecha y verde al alcanzar la meta. */
export function ProgressBar({
  value,
  target,
  label,
  done,
  showPercent = true,
}: {
  value: number | null;
  target: number;
  label?: string;
  /** Fuerza el estado de meta alcanzada (si no, se alcanza al llegar al 100 %). */
  done?: boolean;
  showPercent?: boolean;
}) {
  const pct = progressPercent(value, target);
  const reached = done ?? pct >= 100;
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-2 flex-1 overflow-hidden rounded-ui bg-surface-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={label}
      >
        <div
          className={`h-full rounded-ui transition-[width,background-color] duration-200 ${reached ? "bg-success" : "bg-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showPercent && (
        <span className={`ui-num w-11 shrink-0 text-right text-[13px] ${reached ? "text-success" : "text-fg"}`} aria-hidden>
          {pct}%
        </span>
      )}
    </div>
  );
}

const BADGE_TONE = {
  neutral: "border-line text-fg-2",
  accent: "border-accent text-accent",
  success: "border-success text-success",
  alert: "border-brand-red text-fg",
} as const;
export type BadgeTone = keyof typeof BADGE_TONE;

/** Badge: rectángulo pequeño con borde y texto en mayúsculas de 12 px. */
export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex min-h-6 items-center gap-1 rounded-[2px] border px-2 py-1 text-xs leading-tight font-medium tracking-[0.04em] uppercase ${BADGE_TONE[tone]}`}>
      {children}
    </span>
  );
}

/** Acordeón: número a la izquierda, título y flecha a la derecha; abre con una transición suave. */
export function Accordion({
  index,
  title,
  defaultOpen,
  children,
}: {
  index?: number;
  title: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-ui border border-line bg-surface" open={defaultOpen}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-4 rounded-ui px-4 py-3 transition-colors duration-150 hover:bg-surface-2 sm:px-6 [&::-webkit-details-marker]:hidden">
        {index !== undefined && <span className="ui-num w-6 shrink-0 text-[15px] text-fg-2">{String(index).padStart(2, "0")}</span>}
        <span className="min-w-0 flex-1 font-title text-lg leading-tight font-bold tracking-[0.02em] uppercase">{title}</span>
        <Icon name="chevronDown" className="h-5 w-5 shrink-0 text-fg-2 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className={`px-4 pb-4 sm:px-6 ${index !== undefined ? "sm:pl-16" : ""}`}>{children}</div>
    </details>
  );
}

/** Alerta: borde izquierdo rojo, icono y texto legible. */
export function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-ui border border-line border-l-4 border-l-brand-red bg-surface p-4 text-[15px]">
      <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-brand-red" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Aviso de algo que aún no existe en la plataforma (sin datos de ejemplo). */
export function ComingSoon({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-ui border border-dashed border-line p-4 sm:p-6">
      <p className="mb-2 flex flex-wrap items-center gap-2 font-title text-lg leading-tight font-bold tracking-[0.02em] uppercase">
        {title}
        <Badge>Próximamente</Badge>
      </p>
      <div className="text-[15px] text-fg-2">{children}</div>
    </div>
  );
}

/** Mensaje de lista vacía. */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="ui-card text-fg-2">{children}</p>;
}
