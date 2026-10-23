"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TEXTOS_RANGOS, recompensasPorNivel } from "@/content/rangos";
import { estadoRango, rangosAlcanzados, type RangoConUmbral } from "@/lib/rangos";
import { Embers, RankEmblem } from "./rangos";

const fmt = (n: number) => new Intl.NumberFormat("es-VE").format(Math.round(n));
const DURATION = 1000;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function readLastXp(key: string): number | null {
  try {
    const v = window.localStorage.getItem(key);
    if (v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeLastXp(key: string, xp: number) {
  try {
    window.localStorage.setItem(key, String(xp));
  } catch {
    // Sin almacenamiento (modo privado, bloqueado): solo se pierde la animación de "+XP".
  }
}

/**
 * Hero de rango de Tu tienda: anillo radial con la imagen del rango, contador de XP,
 * etiqueta "+N XP" y superposición de subida de rango (una sola vez por subida).
 */
export function RankHero({ totalXp, storageKey }: { totalXp: number; storageKey: string }) {
  const estado = estadoRango(totalXp);
  const { rango, siguiente, xpEnRango, xpRestantes, maximoCompletado } = estado;
  const tramo = rango.xpParaCompletar;

  // Valores que se pintan (animados); el texto accesible usa siempre los finales.
  const [shown, setShown] = useState({ progress: 0, xp: 0 });
  const [gain, setGain] = useState<number | null>(null);
  const [levelUp, setLevelUp] = useState<RangoConUmbral[]>([]);
  const frame = useRef<number>(0);

  useEffect(() => {
    const prev = readLastXp(storageKey);
    writeLastXp(storageKey, estado.totalXp);
    const reduce = reducedMotion();
    const target = { progress: estado.progreso, xp: estado.totalXp };
    const gained = prev !== null && estado.totalXp > prev ? estado.totalXp - prev : 0;
    const subidas = prev !== null && gained ? rangosAlcanzados(prev, estado.totalXp) : [];
    // Primera visita (o XP igual/menor): el anillo se llena desde 0.
    // Con XP nuevos: parte de la posición anterior si sigue en el mismo rango.
    let from = { progress: 0, xp: 0 };
    if (prev !== null && gained) {
      const antes = estadoRango(prev);
      from = { progress: antes.rango.nivel === estado.rango.nivel ? antes.progreso : 0, xp: prev };
    }
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) {
        start = now;
        if (gained && !reduce) setGain(gained);
      }
      // Con movimiento reducido se pinta directamente el estado final.
      const t = reduce ? 1 : Math.min((now - start) / DURATION, 1);
      const e = easeOut(t);
      setShown({ progress: from.progress + (target.progress - from.progress) * e, xp: from.xp + (target.xp - from.xp) * e });
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else if (subidas.length) setLevelUp(subidas);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [storageKey, estado.totalXp, estado.progreso, estado.rango.nivel]);

  const pct = Math.round(estado.progreso * 100);
  const valueText = maximoCompletado
    ? `${rango.nombre}, nivel ${rango.nivel}: ${TEXTOS_RANGOS.rangoMaximo}`
    : `${rango.nombre}, nivel ${rango.nivel}: ${fmt(xpEnRango)} de ${fmt(tramo)} XP del rango (${pct} %)`;

  return (
    <section className="ui-card relative overflow-hidden" aria-labelledby="rango-titulo">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-10">
        <div className="relative shrink-0">
          <RankRing
            nivel={rango.nivel}
            progress={shown.progress}
            emblem={<RankEmblem rango={rango} className="h-full w-full border-0" priority />}
            ariaNow={pct}
            ariaText={valueText}
          />
          {gain !== null && gain > 0 && (
            <span
              className="gn-motion-only ui-num pointer-events-none absolute top-4 left-1/2 rounded-ui bg-accent px-2 py-1 text-[15px] text-bg"
              style={{ animation: "gn-float-up 1.6s ease-out 200ms both" }}
              aria-hidden
            >
              +{fmt(gain)} XP
            </span>
          )}
        </div>

        <div className="flex w-full min-w-0 flex-col items-center text-center sm:items-start sm:text-left">
          <p className="ui-label">{TEXTOS_RANGOS.heroEtiqueta} · Nivel {rango.nivel}</p>
          <h2 id="rango-titulo" className="mt-2 font-title text-[44px] leading-none font-bold tracking-[0.02em] uppercase sm:text-[56px]">
            {rango.nombre}
          </h2>

          <dl className="mt-6 grid w-full max-w-md grid-cols-2 gap-4 text-left">
            <div className="ui-card-inset">
              <dt className="ui-label">XP del rango</dt>
              <dd className="ui-num mt-2 text-lg whitespace-nowrap sm:text-xl">
                {fmt(Math.min(xpEnRango, tramo))} <span className="text-fg-2">/ {fmt(tramo)}</span>
              </dd>
            </div>
            <div className="ui-card-inset">
              <dt className="ui-label">XP total</dt>
              <dd className="ui-num mt-2 text-lg whitespace-nowrap text-accent sm:text-xl">{fmt(shown.xp)}</dd>
            </div>
          </dl>

          <p className="mt-4 text-[15px]" aria-live="polite">
            {maximoCompletado ? (
              <span className="font-medium text-accent">{TEXTOS_RANGOS.rangoMaximo}</span>
            ) : siguiente ? (
              <>
                Te faltan <span className="ui-num">{fmt(xpRestantes)} XP</span> para{" "}
                <span className="font-title text-lg font-bold tracking-[0.02em] uppercase">{siguiente.nombre}</span>
              </>
            ) : (
              <>
                Te faltan <span className="ui-num">{fmt(xpRestantes)} XP</span> para completar{" "}
                <span className="font-title text-lg font-bold tracking-[0.02em] uppercase">{rango.nombre}</span>
              </>
            )}
          </p>
          <p className="mt-4 text-[13px] text-fg-2">{TEXTOS_RANGOS.avisoXp}</p>
        </div>
      </div>

      {levelUp.length > 0 && <LevelUpOverlay rangos={levelUp} onClose={() => setLevelUp([])} />}
    </section>
  );
}

const R = 88;
const C = 2 * Math.PI * R;

/** Anillo SVG: pista gris y progreso amarillo, empieza arriba. Las capas extra dependen del nivel. */
export function RankRing({
  nivel,
  progress,
  emblem,
  ariaNow,
  ariaText,
  className = "h-60 w-60 sm:h-80 sm:w-80",
}: {
  nivel: number;
  progress: number;
  emblem: React.ReactNode;
  ariaNow: number;
  ariaText: string;
  className?: string;
}) {
  const p = Math.max(0, Math.min(1, progress));
  return (
    <div
      className={`relative ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={ariaNow}
      aria-valuetext={ariaText}
      aria-label="Progreso del rango"
    >
      {nivel >= 5 && (
        <span className="gn-motion-only pointer-events-none absolute inset-[3%] rounded-full" aria-hidden>
          <span className="gn-halo gn-anim-spin absolute inset-0 rounded-full opacity-70 [mask:radial-gradient(farthest-side,transparent_calc(100%-10px),#000_calc(100%-9px))]" />
        </span>
      )}
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
        <circle cx={100} cy={100} r={R} fill="none" stroke="var(--border)" strokeWidth={10} />
        {nivel >= 2 &&
          Array.from({ length: 40 }, (_, i) => {
            const a = (i / 40) * 2 * Math.PI;
            const r1 = 97;
            const r2 = i % 5 === 0 ? 92 : 94.5;
            return (
              <line
                key={i}
                x1={100 + Math.cos(a) * r1}
                y1={100 + Math.sin(a) * r1}
                x2={100 + Math.cos(a) * r2}
                y2={100 + Math.sin(a) * r2}
                stroke="var(--text-3)"
                strokeWidth={1}
              />
            );
          })}
        <circle
          cx={100}
          cy={100}
          r={R}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - p)}
          className={nivel >= 3 ? "gn-anim-pulse" : undefined}
          opacity={p === 0 ? 0 : 1}
        />
        {nivel >= 2 && (
          <circle
            cx={100}
            cy={100}
            r={R}
            fill="none"
            stroke="var(--text)"
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={`14 ${C}`}
            className="gn-motion-only"
            style={{ ["--gn-sweep-to" as string]: `${-C}`, animation: "gn-sweep 1.4s ease-in-out 1.05s 1 both" } as React.CSSProperties}
          />
        )}
      </svg>
      {nivel >= 4 && <Embers count={12} spread={1.02} />}
      <div className={`absolute inset-[16%] ${nivel >= 3 ? "gn-anim-pop" : ""}`}>
        <div className={`h-full w-full ${nivel >= 5 ? "gn-anim-breathe" : ""}`}>{emblem}</div>
      </div>
    </div>
  );
}

/** Superposición breve de subida de rango: se cierra sola, con Escape, con clic fuera o con sus botones. */
function LevelUpOverlay({ rangos, onClose }: { rangos: RangoConUmbral[]; onClose: () => void }) {
  const nuevo = rangos[rangos.length - 1];
  const closeRef = useRef<HTMLButtonElement>(null);
  const [hold, setHold] = useState(false);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Breve (3 s), salvo que la persona esté usándola.
  useEffect(() => {
    if (hold) return;
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [hold, onClose]);

  const niveles = new Set(rangos.map((r) => r.nivel));
  const liberado = [
    ...rangos.map((r) => r.cosmetico),
    ...recompensasPorNivel.filter((r) => niveles.has(r.nivel) && r.publicada).map((r) => r.titulo),
  ];

  return (
    <div className="gn-anim-fade fixed inset-0 z-50 grid place-items-center bg-bg/85 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="subida-titulo"
        className="ui-card gn-anim-pop w-full max-w-sm border-accent! text-center"
        onClick={(e) => e.stopPropagation()}
        onPointerEnter={() => setHold(true)}
      >
        <p className="ui-label">{TEXTOS_RANGOS.subisteA}</p>
        <h2 id="subida-titulo" className="mt-2 font-title text-[40px] leading-none font-bold tracking-[0.02em] text-accent uppercase">
          {nuevo.nombre}
        </h2>
        <div className="mx-auto mt-4 h-32 w-32">
          <RankEmblem rango={nuevo} className="h-full w-full" />
        </div>
        <ul className="mt-4 space-y-1 text-[15px]">
          {liberado.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/panel/recompensas" className="ui-btn-primary">
            {TEXTOS_RANGOS.verRecompensas}
          </Link>
          <button ref={closeRef} type="button" className="ui-btn-secondary" onClick={onClose}>
            {TEXTOS_RANGOS.cerrar}
          </button>
        </div>
      </div>
    </div>
  );
}
