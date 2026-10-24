"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RankAvatar, RankBadge, RankEmblem, MaxRankInsignia, initials } from "@/components/rangos";
import { Icon } from "@/components/icons";
import { TEXTOS_CLASIFICACION as T } from "@/content/rangos";
import { rangoPorSlug } from "@/lib/rangos";

export type BoardEntry = {
  place: number;
  alias: string;
  totalXp: number;
  isMe: boolean;
  nivel: number;
  slug: string;
  rangoNombre: string;
  /** Progreso dentro del rango, de 0 a 1. */
  progreso: number;
  siguiente: string | null;
  maximoCompletado: boolean;
};

const fmt = (n: number) => new Intl.NumberFormat("es-VE").format(Math.round(n));
const STORAGE_KEY = "gn:clasificacion:posiciones";

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** XP que suben desde 0 al cargar (valor final directo con movimiento reducido). */
function useCountUp(value: number, delay = 0) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const reduce = reducedMotion();
    let raf = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now + delay;
      const t = reduce ? 1 : Math.max(0, Math.min((now - start) / 1000, 1));
      setN(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, delay]);
  return n;
}

/**
 * Puestos ganados (+) o perdidos (−) desde la última visita, por nombre visible.
 * Sin dato en la primera visita ni para nombres repetidos (no se pueden distinguir).
 */
function useMovement(entries: BoardEntry[]) {
  const [moves, setMoves] = useState<Record<string, number>>({});
  useEffect(() => {
    const counts = new Map<string, number>();
    entries.forEach((e) => counts.set(e.alias, (counts.get(e.alias) ?? 0) + 1));
    const unique = entries.filter((e) => counts.get(e.alias) === 1);
    let prev: Record<string, number> = {};
    try {
      prev = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") ?? {};
    } catch {
      prev = {};
    }
    const next: Record<string, number> = {};
    for (const e of unique) {
      const before = Number(prev[e.alias]);
      if (Number.isFinite(before) && before !== e.place) next[e.alias] = before - e.place;
    }
    const raf = requestAnimationFrame(() => {
      setMoves(next);
      try {
        const merged = { ...prev };
        unique.forEach((e) => (merged[e.alias] = e.place));
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch {
        // Sin almacenamiento: no se muestran movimientos.
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [entries]);
  return moves;
}

/** Podio (si no hay filtros) y lista de la clasificación. */
export function LeaderboardBoard({ entries, filtered }: { entries: BoardEntry[]; filtered: boolean }) {
  const moves = useMovement(entries);
  const podium = filtered ? [] : entries.slice(0, 3);
  const rest = filtered ? entries : entries.slice(3);
  const meRef = useRef<HTMLElement | null>(null);
  const [meVisible, setMeVisible] = useState(true);
  const hasMe = entries.some((e) => e.isMe);

  useEffect(() => {
    const el = meRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setMeVisible(entry.isIntersecting), { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [entries]);

  const goToMe = () => {
    const el = meRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
    el.focus({ preventScroll: true });
  };

  return (
    <div className="flex flex-col gap-6">
      {!filtered && <Podium entries={podium} meRef={meRef} />}

      {rest.length > 0 && (
        <ol className="overflow-hidden rounded-ui border border-line bg-surface" aria-label={filtered ? "Tiendas que coinciden" : "Clasificación desde el puesto 4"}>
          {rest.map((e, i) => (
            <Row key={`${e.place}-${e.alias}-${i}`} entry={e} move={moves[e.alias]} index={i} meRef={e.isMe ? meRef : undefined} />
          ))}
        </ol>
      )}

      {hasMe && !meVisible && (
        <button
          type="button"
          onClick={goToMe}
          className="ui-btn-primary fixed right-4 bottom-[calc(88px+env(safe-area-inset-bottom))] z-30 shadow-[0_0_0_4px_var(--bg)] md:right-6 md:bottom-6"
        >
          <Icon name="target" className="h-5 w-5" /> {T.irAMiPosicion}
        </button>
      )}
    </div>
  );
}

// El podio se mantiene en 3 columnas (2-1-3) también en el teléfono, en versión compacta.
const PODIUM_ORDER = ["order-2", "order-1", "order-3"];

function Podium({ entries, meRef }: { entries: BoardEntry[]; meRef: React.RefObject<HTMLElement | null> }) {
  const slots = [0, 1, 2].map((i) => entries[i] ?? null);
  return (
    <ol className="grid grid-cols-3 items-end gap-2 pt-4 sm:gap-4" aria-label="Podio">
      {slots.map((e, i) =>
        e ? (
          <PodiumCard key={`${e.place}-${e.alias}`} entry={e} index={i} meRef={e.isMe ? meRef : undefined} />
        ) : (
          <li key={`libre-${i}`} className={`${PODIUM_ORDER[i]} gn-anim-rise`} style={{ animationDelay: `${i * 180}ms` }}>
            <div className={`flex flex-col items-center justify-center gap-2 rounded-ui border border-dashed border-line px-2 py-4 text-center sm:p-6 ${i === 0 ? "min-h-48 sm:min-h-80" : "min-h-40 sm:min-h-64"}`}>
              <span className="ui-num text-2xl leading-none text-fg-3 sm:text-[32px]">#{i + 1}</span>
              <p className="font-title text-base leading-tight font-bold tracking-[0.02em] uppercase sm:text-xl">{T.puestoLibre}</p>
              <p className="hidden text-[13px] text-fg-2 sm:block">{T.puestoLibreAyuda}</p>
              <Link href="/panel/misiones" className="ui-link inline-flex min-h-11 items-center text-[13px] sm:min-h-0">Ir a misiones</Link>
            </div>
          </li>
        ),
      )}
    </ol>
  );
}

function PodiumCard({ entry: e, index, meRef }: { entry: BoardEntry; index: number; meRef?: React.RefObject<HTMLElement | null> }) {
  const xp = useCountUp(e.totalXp, index * 180);
  const first = index === 0;
  const rango = rangoPorSlug(e.slug);
  return (
    <li
      ref={meRef as React.Ref<HTMLLIElement>}
      tabIndex={e.isMe ? -1 : undefined}
      className={`${PODIUM_ORDER[index]} ${first ? "gn-anim-pop" : "gn-anim-rise"} rounded-ui`}
      style={{ animationDelay: `${(first ? 0 : index) * 180}ms` }}
    >
      <article
        className={`ui-card relative flex flex-col items-center px-2! pb-4! text-center sm:px-6! sm:pb-6! ${first ? "border-accent! pt-6! sm:min-h-80 sm:pt-10!" : "pt-4! sm:min-h-64"} ${e.isMe ? "bg-surface-2!" : ""}`}
        aria-label={`Puesto ${e.place}: ${e.alias}${e.isMe ? " (tú)" : ""}, ${e.rangoNombre}, ${fmt(e.totalXp)} XP`}
      >
        {first && (
          <span className="absolute -top-4 left-1/2 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full border-2 border-accent bg-bg text-accent" aria-hidden>
            <Icon name="crown" className="h-4 w-4" />
          </span>
        )}
        {e.isMe && <span className="absolute top-2 right-2 rounded-[2px] bg-accent px-1.5 py-0.5 text-[11px] font-semibold tracking-[0.04em] text-bg uppercase sm:top-3 sm:right-3 sm:px-2 sm:text-xs">Tú</span>}
        <span className={`ui-num leading-none ${first ? "text-[32px] text-accent sm:text-[44px]" : "text-2xl text-fg-2 sm:text-[32px]"}`}>#{e.place}</span>
        {/* Medallón L para el primer puesto y M para el segundo y el tercero. */}
        {rango && <RankEmblem rango={rango} className={`mt-3 sm:mt-4 ${first ? "h-20 w-20 sm:h-28 sm:w-28" : "h-14 w-14 sm:h-20 sm:w-20"}`} />}
        <div className="mt-3 flex max-w-full min-w-0 items-center gap-2 sm:mt-4">
          <span className="hidden sm:inline-flex"><RankAvatar nivel={e.nivel} label={initials(e.alias, 1)} size="sm" /></span>
          <p className="min-w-0 truncate text-[13px] font-medium sm:text-[15px]">{e.alias}</p>
          {e.nivel === 5 && <MaxRankInsignia />}
        </div>
        <p className="mt-1 max-w-full truncate font-title text-sm leading-none font-bold tracking-[0.02em] text-fg-2 uppercase sm:mt-2 sm:text-lg">{e.rangoNombre}</p>
        <p className={`ui-num mt-2 sm:mt-3 ${first ? "text-lg sm:text-[32px]" : "text-base sm:text-2xl"}`} aria-hidden>
          {fmt(xp)} <span className="text-xs text-fg-2 sm:text-[15px]">XP</span>
        </p>
      </article>
    </li>
  );
}

function Row({ entry: e, move, index, meRef }: { entry: BoardEntry; move?: number; index: number; meRef?: React.RefObject<HTMLElement | null> }) {
  const pct = Math.round(e.progreso * 100);
  return (
    <li
      ref={meRef as React.Ref<HTMLLIElement>}
      tabIndex={e.isMe ? -1 : undefined}
      className={`relative flex items-center gap-3 border-b border-line px-3 py-3 transition-colors duration-150 last:border-b-0 hover:bg-surface-2 sm:gap-4 sm:px-6 ${
        e.isMe ? "bg-surface-2 shadow-[inset_4px_0_0_var(--accent)]" : ""
      } ${index < 12 ? "gn-anim-rise" : ""}`}
      style={index < 12 ? { animationDelay: `${index * 40}ms` } : undefined}
    >
      <span className="ui-num w-9 shrink-0 text-fg-2 sm:w-10">#{e.place}</span>
      <Movement value={move} />
      <RankAvatar nivel={e.nivel} label={initials(e.alias, 1)} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-2">
          <span className={`truncate ${e.isMe ? "font-semibold" : "font-medium"}`}>{e.alias}</span>
          {e.nivel === 5 && <MaxRankInsignia />}
          {e.isMe && <span className="shrink-0 rounded-[2px] bg-accent px-1.5 py-0.5 text-[11px] font-semibold tracking-[0.04em] text-bg uppercase">Tú</span>}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="hidden sm:inline-flex"><RankBadge rango={rangoPorSlug(e.slug)!} /></span>
          <span className="font-title text-sm font-bold tracking-[0.02em] text-fg-2 uppercase sm:hidden">{e.rangoNombre}</span>
          <div
            className="h-1 w-full max-w-40 overflow-hidden rounded-ui bg-surface-2"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label={e.maximoCompletado ? "Rango máximo completado" : `Progreso hacia ${e.siguiente ?? `completar ${e.rangoNombre}`}`}
          >
            <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <span className="ui-num shrink-0 text-right">
        {fmt(e.totalXp)} <span className="text-[13px] text-fg-2">XP</span>
      </span>
    </li>
  );
}

/** ▲ verde al subir, ▼ gris neutro al bajar (nunca rojo). Sin indicador si no hay dato. */
function Movement({ value }: { value?: number }) {
  if (!value) return <span className="hidden w-8 shrink-0 sm:block" aria-hidden />;
  const up = value > 0;
  const n = Math.abs(value);
  return (
    <span className={`ui-num inline-flex w-8 shrink-0 items-center gap-0.5 text-xs ${up ? "text-success" : "text-fg-2"}`}>
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      <span aria-hidden>{n}</span>
      <span className="sr-only">{up ? `Subió ${n} ${n === 1 ? "puesto" : "puestos"}` : `Bajó ${n} ${n === 1 ? "puesto" : "puestos"}`} desde tu última visita</span>
    </span>
  );
}
