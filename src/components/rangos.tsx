import Image from "next/image";
import type { RangoSlug } from "@/content/rangos";
import { TEXTOS_RANGOS } from "@/content/rangos";
import type { RangoConUmbral } from "@/lib/rangos";
import { Icon } from "./icons";

/*
 * Piezas visuales de los rangos (sin estado): imagen del rango, avatar con el marco
 * del rango, insignia de rango y brasas. Las usan Tu tienda, la cabecera y la clasificación.
 */

/** Imagen circular del rango: la de /public si existe en el contenido, si no un marcador SVG. */
export function RankEmblem({ rango, className = "h-24 w-24", priority }: { rango: RangoConUmbral; className?: string; priority?: boolean }) {
  return (
    <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-surface-2 ${className}`}>
      {rango.imagen ? (
        <Image src={rango.imagen} alt="" fill sizes="(min-width: 640px) 220px, 160px" className="object-contain p-[8%]" priority={priority} />
      ) : (
        <RankPlaceholder slug={rango.slug} />
      )}
    </span>
  );
}

/** Marcador temporal alusivo a cada rango mientras no existan sus imágenes. */
function RankPlaceholder({ slug }: { slug: RangoSlug }) {
  const common = { fill: "none", stroke: "var(--text)", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg viewBox="0 0 64 64" className="h-[70%] w-[70%]" aria-hidden="true">
      {slug === "umbral" && (
        <>
          <path d="M28 54l14-10V22l-14 6z" fill="var(--accent)" opacity={0.3} />
          <path d="M16 54V28a16 16 0 0132 0v26M12 54h40" {...common} />
          <path d="M22 54V30l8-4v28" {...common} stroke="var(--accent)" />
          <path d="M34 34l8-4M34 42l10-3M34 50l12-2" {...common} stroke="var(--accent)" strokeWidth={1.5} />
        </>
      )}
      {slug === "vigia" && (
        <>
          <path d="M32 6l20 7v15c0 14-9 24-20 29C21 52 12 42 12 28V13z" {...common} />
          <path d="M19 31c8-9 18-9 26 0-8 9-18 9-26 0z" {...common} stroke="var(--accent)" />
          <circle cx={32} cy={31} r={4} fill="var(--accent)" />
        </>
      )}
      {slug === "centurion" && (
        <>
          <path d="M10 22c10-12 34-12 44 0" {...common} stroke="var(--brand-red)" strokeWidth={5} />
          <path d="M18 42V32a14 14 0 0128 0v10M18 42l4 12h7V38M46 42l-4 12h-7V38" {...common} />
          <path d="M25 35h14" {...common} stroke="var(--accent)" />
        </>
      )}
      {slug === "soberano" && (
        <>
          <path d="M14 46h36v7H14z" {...common} />
          <path d="M14 46l-2-22 9 8 5-14 6 10 6-10 5 14 9-8-2 22" {...common} stroke="var(--accent)" />
          <circle cx={12} cy={23} r={3} fill="var(--brand-red)" />
          <circle cx={26} cy={17} r={3} fill="var(--brand-red)" />
          <circle cx={38} cy={17} r={3} fill="var(--brand-red)" />
          <circle cx={52} cy={23} r={3} fill="var(--brand-red)" />
        </>
      )}
      {slug === "ayam-cemani" && (
        <>
          <circle cx={32} cy={32} r={27} {...common} stroke="var(--accent)" strokeWidth={2.5} />
          <path
            d="M22 48c-7-4-9-13-4-19 2-3 6-3 8-1l2-7c1-4 5-6 8-4l2-3 2 3 3-1-1 3c2 1 3 3 2 5l3 2-4 1c0 4-2 7-5 9 6 0 11-3 15-9 3 9-2 18-10 22l1 5h-4l-2-4h-4l1 4h-4l-1-5c-3 0-5-1-7-1z"
            {...common}
            fill="var(--bg)"
            strokeWidth={1.5}
          />
          <circle cx={39} cy={21} r={1.2} fill="var(--accent)" />
        </>
      )}
    </svg>
  );
}

const AVATAR_SIZE = { sm: "h-9 w-9 text-[13px]", md: "h-10 w-10 text-[13px]", lg: "h-14 w-14 text-lg" } as const;

/** Marco del avatar según el rango (tabla de cosméticos de src/content/rangos.ts). */
const FRAME: Record<number, string> = {
  1: "border-2 border-fg-3",
  2: "border-2 border-accent",
  3: "border-2 border-accent shadow-[0_0_0_2px_var(--bg),0_0_0_4px_var(--brand-red)]",
  4: "border-2 border-accent shadow-[0_0_0_2px_var(--bg),0_0_0_4px_var(--brand-red)]",
  5: "border-2 border-accent shadow-[0_0_0_2px_var(--bg),0_0_0_4px_var(--accent)]",
};

/** Avatar circular con la inicial de la tienda y el marco de su rango. */
export function RankAvatar({ nivel, label, size = "md" }: { nivel: number; label: string; size?: keyof typeof AVATAR_SIZE }) {
  return (
    <span className={`relative grid shrink-0 place-items-center rounded-full bg-surface-2 font-semibold ${AVATAR_SIZE[size]} ${FRAME[nivel] ?? FRAME[1]}`} aria-hidden>
      {nivel >= 5 && (
        <span className="gn-motion-only pointer-events-none absolute -inset-[5px] rounded-full">
          <span className="gn-halo gn-anim-spin absolute inset-0 rounded-full [mask:radial-gradient(farthest-side,transparent_calc(100%-2px),#000_calc(100%-2px))]" />
        </span>
      )}
      {nivel >= 4 && <Embers count={3} spread={1} small />}
      <span className="relative">{label}</span>
    </span>
  );
}

/** Iniciales de un nombre (máximo dos letras). */
export function initials(name: string, max = 2) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, max)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "GN"
  );
}

/** Insignia con el nombre del rango; el rango máximo lleva una corona. */
export function RankBadge({ rango }: { rango: RangoConUmbral }) {
  const max = rango.nivel === 5;
  return (
    <span
      className={`inline-flex min-h-6 items-center gap-1 rounded-[2px] border px-2 py-1 text-xs leading-tight font-medium tracking-[0.04em] uppercase ${max ? "border-accent text-accent" : "border-line text-fg-2"}`}
    >
      {max && <Icon name="crown" className="h-3.5 w-3.5" />}
      {rango.nombre}
    </span>
  );
}

/** Insignia de rango máximo junto al nombre (Tu tienda, cabecera y clasificación). */
export function MaxRankInsignia() {
  return (
    <span className="inline-flex shrink-0 items-center text-accent" title={TEXTOS_RANGOS.insigniaMaxima}>
      <Icon name="crown" className="h-4 w-4" />
      <span className="sr-only">{TEXTOS_RANGOS.insigniaMaxima}</span>
    </span>
  );
}

/** Brasas pequeñas que suben despacio (máximo 12; `mobileCount` en el teléfono). Se ocultan con movimiento reducido. */
export function Embers({ count = 12, mobileCount, spread = 1, small }: { count?: number; mobileCount?: number; spread?: number; small?: boolean }) {
  const n = Math.min(Math.max(count, 0), 12);
  return (
    <span className="gn-motion-only pointer-events-none absolute inset-0" aria-hidden>
      {Array.from({ length: n }, (_, i) => {
        // Reparto fijo (sin azar) alrededor de la mitad inferior del círculo.
        const angle = Math.PI * (0.15 + (0.7 * i) / Math.max(n - 1, 1));
        const x = 50 + Math.cos(angle) * 48 * spread;
        const y = 50 + Math.sin(angle) * 40 * spread;
        return (
          <span
            key={i}
            className={`absolute rounded-full ${small ? "h-1 w-1" : "h-1.5 w-1.5"} ${i % 3 === 0 ? "bg-brand-red" : "bg-accent"} ${mobileCount !== undefined && i % Math.ceil(n / Math.max(mobileCount, 1)) !== 0 ? "max-md:hidden" : ""}`}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              animation: `gn-ember ${3.2 + (i % 4) * 0.6}s ease-out ${(i * 0.45) % 3}s infinite`,
            }}
          />
        );
      })}
    </span>
  );
}
