import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { progressPercent } from "@/lib/missions";
import { ClubTabs, type ClubTab } from "./club-tabs";
import { Icon, type IconName } from "./icons";

/**
 * Estructura del panel de las tiendas ("Club de licenciatarios"): cabecera con la
 * marca y la tienda, pestañas de secciones y el contenido.
 */
export function StoreShell({
  tabs,
  storeName,
  roleLabel,
  children,
}: {
  tabs: ClubTab[];
  storeName: string;
  roleLabel: string;
  children: React.ReactNode;
}) {
  const initials = storeName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "GN";
  return (
    <div className="flex min-h-full flex-1 flex-col bg-pit">
      <header className="border-b border-ash bg-obsidian print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/panel" className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center bg-gold font-display text-base text-obsidian">GN</span>
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="font-display text-lg uppercase leading-none tracking-wide sm:text-2xl">Gallo Negro</span>
                <span className="tag hidden bg-blood text-ivory sm:inline-flex">Licencias</span>
              </span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-gold sm:text-xs">Club de licenciatarios</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[10px] font-bold uppercase tracking-wider text-parchment">{roleLabel}</p>
              <p className="flex items-center justify-end gap-1.5 text-sm font-bold">
                <Icon name="store" className="h-4 w-4 text-gold" />
                {storeName}
              </p>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-gold bg-ash text-sm font-bold" aria-hidden>
              {initials}
            </span>
            <form action={signOut}>
              <button className="btn-ghost rounded-none px-3 py-1.5 text-xs">Salir</button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl px-4 pt-4 print:hidden">
        <ClubTabs tabs={tabs} />
      </div>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">{children}</main>
    </div>
  );
}

const ACCENT = {
  gold: { border: "border-l-gold", text: "text-gold", bar: "bg-gold" },
  blood: { border: "border-l-blood", text: "text-blood", bar: "bg-blood" },
  violet: { border: "border-l-violet", text: "text-violet", bar: "bg-violet" },
  ok: { border: "border-l-ok", text: "text-ok", bar: "bg-ok" },
  ash: { border: "border-l-smoke", text: "text-parchment", bar: "bg-smoke" },
} as const;
export type Accent = keyof typeof ACCENT;

/** Encabezado de sección: bloque con borde de color a la izquierda. */
export function Banner({
  title,
  accent = "gold",
  aside,
  children,
}: {
  title: string;
  accent?: Accent;
  aside?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className={`slab mb-5 flex flex-wrap items-center justify-between gap-4 border-l-4 ${ACCENT[accent].border}`}>
      <div className="min-w-0">
        <h1 className="font-display text-xl uppercase leading-tight tracking-wide sm:text-3xl">{title}</h1>
        {children && <div className="mt-1 max-w-3xl text-sm text-linen">{children}</div>}
      </div>
      {aside}
    </section>
  );
}

/** Tarjeta de resumen grande (Ranking, XP, Rango…). */
export function HeroCard({
  label,
  icon,
  accent = "gold",
  watermark,
  children,
}: {
  label: string;
  icon: IconName;
  accent?: Accent;
  watermark?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`slab relative overflow-hidden border-l-4 ${ACCENT[accent].border}`}>
      {watermark && (
        <span className="pointer-events-none absolute -bottom-3 right-2 select-none font-display text-6xl text-ivory/[0.04] sm:text-7xl" aria-hidden>
          {watermark}
        </span>
      )}
      <div className="relative">
        <div className="mb-3 flex items-start justify-between gap-2">
          <p className="kicker">{label}</p>
          <Icon name={icon} className={`h-5 w-5 shrink-0 ${ACCENT[accent].text}`} />
        </div>
        {children}
      </div>
    </div>
  );
}

/** Tarjeta pequeña de cifra. */
export function StatSlab({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="slab">
      <p className="kicker">{label}</p>
      <p className="mt-1 font-display text-xl sm:text-2xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-parchment">{hint}</p>}
    </div>
  );
}

/** Barra de progreso recta, del color de acento. */
export function Bar({ value, target, accent = "gold", label }: { value: number | null; target: number; accent?: Accent; label?: string }) {
  const pct = progressPercent(value, target);
  return (
    <div
      className="h-1.5 w-full bg-ash"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
    >
      <div className={`h-full ${ACCENT[accent].bar} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Aviso de algo que aún no existe en la plataforma (sin datos de ejemplo). */
export function ComingSoon({ title, children, accent = "violet" }: { title: string; children: React.ReactNode; accent?: Accent }) {
  return (
    <div className="border border-dashed border-smoke p-4">
      <p className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
        {title}
        <span className={`tag border ${accent === "violet" ? "border-violet/60 text-violet" : "border-gold/60 text-gold"}`}>Próximamente</span>
      </p>
      <div className="text-xs text-parchment">{children}</div>
    </div>
  );
}
