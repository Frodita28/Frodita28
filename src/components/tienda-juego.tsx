"use client";

import { useCallback, useLayoutEffect, useOptimistic, useRef, useState } from "react";
import Link from "next/link";
import { submitEvidenceInline } from "@/app/panel/misiones/actions";
import { EvidenceForm } from "@/app/panel/misiones/evidence-form";
import { TEXTOS_TIENDA as T } from "@/content/rangos";
import type { Frequency } from "@/lib/missions";
import {
  diaSemana,
  diasDeRacha,
  estadoVisible,
  ordenarMisiones,
  resumenMisiones,
  siguienteJugada,
  tipoDeMision,
  ultimos7Dias,
  nuevasCompletadas,
  type EstadoVisible,
  type MisionHoy,
} from "@/lib/misiones-hoy";
import { estadoRango } from "@/lib/rangos";
import { VUELO_MS, anunciarVuelo } from "@/lib/xp-celebracion";
import { BottomSheet } from "./bottom-sheet";
import { Icon } from "./icons";

const fmt = (n: number) => new Intl.NumberFormat("es-VE").format(n);
const FRECUENCIAS: Frequency[] = ["daily", "weekly", "monthly"];

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function leerVistas(key: string): string[] | null {
  try {
    const v = window.localStorage.getItem(key);
    if (v === null) return null;
    const arr = JSON.parse(v);
    return Array.isArray(arr) ? arr.map(String) : null;
  } catch {
    return null;
  }
}

function guardarVistas(key: string, ids: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Sin almacenamiento: solo se pierde la celebración de la próxima visita.
  }
}

/** Enlace a la misión dentro de /panel/misiones (la tarjeta lleva el id de la participación). */
const enlaceMision = (m: MisionHoy) => `/panel/misiones?tab=${m.frequency}${m.status ? `#mision-${m.id}` : ""}`;

export type DiaRacha = { dia: string; misiones: { titulo: string; xp: number }[] };

/**
 * Parte interactiva de Tu tienda: «Misiones de hoy» y «Racha» (columna izquierda en escritorio),
 * «Tu siguiente jugada» y las acciones rápidas (derecha). Comparten el panel de evidencia.
 */
export function TiendaJuego({
  misiones,
  diasConDiaria,
  semana,
  hoy,
  totalXp,
  tieneLicencia,
  userId,
  acciones,
}: {
  misiones: MisionHoy[];
  /** Días (YYYY-MM-DD) con al menos una misión diaria completada (últimas semanas). */
  diasConDiaria: string[];
  /** Detalle de los últimos 7 días para la tira de la racha. */
  semana: DiaRacha[];
  hoy: string;
  totalXp: number;
  tieneLicencia: boolean;
  userId: string;
  acciones: React.ReactNode;
}) {
  const [enviadas, marcarEnviada] = useOptimistic<string[], string>([], (s, id) => [...s, id]);
  const [hoja, setHoja] = useState<MisionHoy | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Las evidencias en envío se ven ya «En revisión» (si el envío falla, vuelven a su estado).
  const lista = misiones.map((m) => (enviadas.includes(m.id) ? { ...m, status: "pending_review" as const, canSend: false } : m));
  const jugada = siguienteJugada(lista, estadoRango(totalXp));

  const abrir = (m: MisionHoy) => {
    setAviso(null);
    setHoja(m);
  };

  const enviar = async (fd: FormData) => {
    const m = hoja;
    if (!m) return { ok: false as const, error: T.errorEnvio };
    marcarEnviada(m.id);
    const r = await submitEvidenceInline(fd);
    if (r.ok) {
      setHoja(null);
      setAviso(`${T.enviadaOk} (${m.title})`);
    }
    return r;
  };

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start lg:gap-6">
      <div className="flex min-w-0 flex-col gap-4">
        <MisionesHoy misiones={lista} enviadas={enviadas} tieneLicencia={tieneLicencia} userId={userId} onEnviar={abrir} aviso={aviso} />
        <Racha dias={diasConDiaria} semana={semana} hoy={hoy} />
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <SiguienteJugadaCard jugada={jugada} onEnviar={abrir} />
        {acciones}
      </div>

      <BottomSheet open={hoja !== null} onClose={() => setHoja(null)} title={hoja?.title ?? ""}>
        {hoja && (
          <div className="space-y-4">
            <p className="flex flex-wrap items-center gap-2">
              <XpChip xp={hoja.xp} />
              <span className="text-[13px] text-fg-2">{hoja.code} · Revisión de Gallo Negro</span>
            </p>
            {hoja.instructions && (
              <p className="text-[15px] text-fg-2">
                <span className="font-medium text-fg">Evidencia necesaria: </span>
                {hoja.instructions}
              </p>
            )}
            {hoja.status === "rejected" && <p className="text-[15px]">{T.rechazada}</p>}
            <EvidenceForm participationId={hoja.id} returnTo="/panel" onSend={enviar} />
            <Link href={enlaceMision(hoja)} className="ui-link inline-flex min-h-11 items-center text-[13px]">
              {T.verMision}
            </Link>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

/* ---------- Misiones de hoy ---------- */

function MisionesHoy({
  misiones,
  enviadas,
  tieneLicencia,
  userId,
  onEnviar,
  aviso,
}: {
  misiones: MisionHoy[];
  enviadas: string[];
  tieneLicencia: boolean;
  userId: string;
  onEnviar: (m: MisionHoy) => void;
  aviso: string | null;
}) {
  const [tab, setTab] = useState<Frequency>("daily");
  const [todas, setTodas] = useState(false);
  const [vuelos, setVuelos] = useState<MisionHoy[]>([]);
  const [anuncio, setAnuncio] = useState("");
  const listaRef = useRef<HTMLUListElement>(null);
  const terminarVuelo = useCallback((id: string) => setVuelos((v) => v.filter((x) => x.id !== id)), []);

  // Celebración: misiones que pasaron a completadas desde la última visita. Va en un efecto de
  // diseño para que el hero de rango sepa, antes de animar el anillo, que una etiqueta vuela hacia él.
  const storageKey = `gn:misiones-completadas:${userId}`;
  // Clave estable de las completadas (el efecto solo se repite si cambian).
  const completadasClave = JSON.stringify(misiones.filter((m) => m.status === "completed"));
  useLayoutEffect(() => {
    const completadas = JSON.parse(completadasClave) as MisionHoy[];
    const nuevas = nuevasCompletadas(leerVistas(storageKey), completadas);
    const guardar = () => guardarVistas(storageKey, completadas.map((m) => m.id));
    if (nuevas.length === 0) return guardar();
    const xp = nuevas.reduce((s, m) => s + m.xp, 0);
    const reduce = reducedMotion();
    // Se anuncia ya (antes del efecto del hero); la etiqueta sale en el siguiente fotograma.
    if (!reduce) anunciarVuelo(VUELO_MS + (nuevas.length - 1) * 150);
    const raf = requestAnimationFrame(() => {
      guardar();
      setAnuncio(`${T.misionCompletada}: ${nuevas.map((m) => m.title).join(", ")}. +${fmt(xp)} XP.`);
      try {
        navigator.vibrate?.(30);
      } catch {
        // Vibración no disponible.
      }
      if (!reduce) setVuelos(nuevas);
    });
    return () => cancelAnimationFrame(raf);
  }, [storageKey, completadasClave]);

  const visibles = ordenarMisiones(misiones.filter((m) => m.frequency === tab));
  const r = resumenMisiones(visibles);
  const periodo = T.periodo[tab];
  const pct = r.total ? Math.round((r.completadas / r.total) * 100) : 0;
  const ocultas = Math.max(visibles.length - T.visiblesMovil, 0);

  return (
    <section className="ui-card" aria-labelledby="misiones-hoy-titulo">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <h2 id="misiones-hoy-titulo" className="ui-title-section">{T.misionesTitulo}</h2>
        <Link href={`/panel/misiones?tab=${tab}`} className="ui-link inline-flex min-h-11 items-center text-[13px] sm:min-h-0">
          {T.verMisiones}
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-ui border border-line p-1" role="group" aria-label="Frecuencia de las misiones">
        {FRECUENCIAS.map((f) => (
          <button
            key={f}
            type="button"
            className="ui-tab justify-center px-2 text-base sm:text-lg"
            aria-pressed={tab === f}
            onClick={() => {
              setTab(f);
              setTodas(false);
            }}
          >
            {T.pestanas[f]}
          </button>
        ))}
      </div>

      {!tieneLicencia ? (
        <p className="mt-4 text-fg-2">{T.sinLicencia}</p>
      ) : (
        <div className="mt-4" aria-live="polite">
          <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-[15px]">
              <span className="ui-num">{r.completadas}</span> de <span className="ui-num">{r.total}</span> completadas
              <span className="text-fg-2"> · </span>
              <span className="ui-num text-accent">+{fmt(r.xpGanado)} XP</span> {periodo}
            </span>
          </p>
          <div
            className="mt-2 h-1 overflow-hidden rounded-ui bg-surface-2"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label={`Misiones completadas ${periodo}`}
          >
            <div className={`h-full rounded-ui transition-[width] duration-500 ${pct === 100 ? "bg-success" : "bg-accent"}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-[13px] text-fg-2">
            {r.total > 0 && r.xpPosible === 0 ? T.todoCompletado : `Puedes ganar hasta +${fmt(r.xpPosible)} XP más ${periodo}`}
          </p>
        </div>
      )}

      {aviso && (
        <p role="status" className="mt-4 flex items-start gap-2 text-[15px] text-fg-2">
          <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0" /> {aviso}
        </p>
      )}

      {visibles.length === 0 ? (
        <p className="mt-4 text-fg-2">{T.sinMisionesPeriodo}</p>
      ) : (
        <>
          <ul ref={listaRef} className="mt-4 divide-y divide-line border-t border-line">
            {visibles.map((m, i) => (
              <FilaMision
                key={m.id}
                m={m}
                enviando={enviadas.includes(m.id)}
                oculta={!todas && i >= T.visiblesMovil}
                onEnviar={onEnviar}
              />
            ))}
          </ul>
          {ocultas > 0 && (
            <button type="button" className="ui-btn-secondary mt-4 w-full md:hidden" onClick={() => setTodas((v) => !v)} aria-expanded={todas}>
              {todas ? T.verMenos : `${T.verTodas} (${visibles.length})`}
              <Icon name="chevronDown" className={`h-4 w-4 transition-transform duration-200 ${todas ? "rotate-180" : ""}`} />
            </button>
          )}
        </>
      )}

      <p className="sr-only" aria-live="polite">{anuncio}</p>
      {vuelos.map((m, i) => (
        <XpVuelo key={m.id} mision={m} index={i} lista={listaRef} onDone={terminarVuelo} />
      ))}
    </section>
  );
}

const ESTADO_ESTILO: Record<EstadoVisible, string> = {
  pendiente: "text-fg-2",
  revision: "text-fg",
  completada: "text-success",
  no_disponible: "text-fg-3",
};

function FilaMision({ m, enviando, oculta, onEnviar }: { m: MisionHoy; enviando: boolean; oculta: boolean; onEnviar: (m: MisionHoy) => void }) {
  const estado = estadoVisible(m);
  const tipo = tipoDeMision(m);
  const hecha = estado === "completada";
  const progreso =
    tipo !== "evidencia" && m.status && !hecha && estado !== "no_disponible"
      ? `${fmt(Math.min(Number(m.progress ?? 0), m.target))} / ${fmt(m.target)} ${m.unit}`
      : null;

  return (
    <li data-mision-id={m.id} className={`flex min-h-16 items-center gap-3 py-3 ${oculta ? "max-md:hidden" : ""}`}>
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${hecha ? "border-success text-success" : "border-line text-fg-3"}`}
        aria-hidden
      >
        {hecha ? <Icon name="check" className="h-4 w-4" /> : estado === "revision" ? <Icon name="clock" className="h-4 w-4" /> : null}
      </span>
      <div className={`min-w-0 flex-1 ${hecha || estado === "no_disponible" ? "opacity-60" : ""}`}>
        <p className="line-clamp-2 text-[15px] leading-snug font-medium">{m.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <XpChip xp={m.xp} />
          <span className={`font-medium tracking-[0.04em] uppercase ${ESTADO_ESTILO[estado]}`}>
            {enviando ? T.enviando : T.estados[estado]}
          </span>
          {progreso && <span className="ui-num font-normal text-fg-2">{progreso}</span>}
          {m.status === "rejected" && <span className="text-fg-2">· Rechazada</span>}
        </p>
      </div>
      {m.canSend && !enviando ? (
        <button type="button" className="ui-btn-sm shrink-0" onClick={() => onEnviar(m)}>
          <Icon name="upload" className="h-4 w-4" />
          {m.status === "rejected" ? T.reenviar : T.enviar}
        </button>
      ) : !hecha && estado !== "no_disponible" && tipo !== "evidencia" ? (
        <Link
          href={tipo === "ventas" ? "/panel/ventas" : enlaceMision(m)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-ui border border-line text-fg-2 hover:border-fg-2 hover:text-fg"
          aria-label={tipo === "ventas" ? `${m.title}: abrir punto de venta` : `${m.title}: ${T.verMision}`}
        >
          <Icon name={tipo === "ventas" ? "qr" : "chevronRight"} className="h-4 w-4" />
        </Link>
      ) : null}
    </li>
  );
}

function XpChip({ xp }: { xp: number }) {
  return (
    <span className="ui-num inline-flex min-h-6 items-center rounded-[2px] border border-accent px-1.5 text-xs leading-none text-accent">
      +{fmt(xp)} XP
    </span>
  );
}

/** Etiqueta "+N XP" que vuela desde la fila de la misión hasta el anillo del hero (solo transform y opacity). */
function XpVuelo({
  mision,
  index,
  lista,
  onDone,
}: {
  mision: MisionHoy;
  index: number;
  lista: React.RefObject<HTMLUListElement | null>;
  onDone: (id: string) => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== "function") {
      onDone(mision.id);
      return;
    }
    const fila = document.querySelector<HTMLElement>(`[data-mision-id="${CSS.escape(mision.id)}"]`);
    const destino = document.querySelector<HTMLElement>("[data-gn-xp-destino]");
    const vh = window.innerHeight;
    const desdeRect = fila && fila.offsetParent ? fila.getBoundingClientRect() : lista.current?.getBoundingClientRect();
    // Si la fila está fuera de la pantalla, la etiqueta sale del borde inferior.
    const desde = desdeRect && desdeRect.top < vh ? { x: desdeRect.left + desdeRect.width / 2, y: desdeRect.top + 24 } : { x: window.innerWidth / 2, y: vh - 96 };
    const d = destino?.getBoundingClientRect();
    const hasta = d ? { x: d.left + d.width / 2, y: d.top + d.height / 2 } : { x: window.innerWidth / 2, y: 80 };
    const w = el.offsetWidth / 2;
    const h = el.offsetHeight / 2;
    const anim = el.animate(
      [
        { transform: `translate(${desde.x - w}px, ${desde.y - h}px) scale(1)`, opacity: 0 },
        { transform: `translate(${desde.x - w}px, ${desde.y - h - 16}px) scale(1.1)`, opacity: 1, offset: 0.15 },
        { transform: `translate(${hasta.x - w}px, ${hasta.y - h}px) scale(0.9)`, opacity: 1, offset: 0.85 },
        { transform: `translate(${hasta.x - w}px, ${hasta.y - h}px) scale(0.6)`, opacity: 0 },
      ],
      { duration: VUELO_MS, delay: index * 150, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", fill: "both" },
    );
    anim.onfinish = () => onDone(mision.id);
    return () => anim.cancel();
  }, [mision.id, index, lista, onDone]);

  return (
    <span
      ref={ref}
      className="ui-num pointer-events-none fixed top-0 left-0 z-[55] rounded-ui bg-accent px-2 py-1 text-[15px] text-bg opacity-0"
      aria-hidden
    >
      +{fmt(mision.xp)} XP
    </span>
  );
}

/* ---------- Racha ---------- */

function Racha({ dias, semana, hoy }: { dias: string[]; semana: DiaRacha[]; hoy: string }) {
  const n = diasDeRacha(dias, hoy);
  const [sel, setSel] = useState<string | null>(null);
  const porDia = new Map(semana.map((d) => [d.dia, d.misiones]));
  const elegido = sel ? porDia.get(sel) ?? [] : null;

  return (
    <section className="ui-card" aria-labelledby="racha-titulo">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="racha-titulo" className="flex items-center gap-2">
          <Icon name="flame" className="h-5 w-5 text-accent" />
          <span className="ui-title-card">
            {n > 0 ? `${T.rachaTitulo}: ${n} ${n === 1 ? "día" : "días seguidos"}` : T.rachaTitulo}
          </span>
        </h2>
        <p className="text-[13px] text-fg-2">{n > 0 ? T.rachaAyuda : T.rachaVacia}</p>
      </div>

      <ol className="mt-4 grid grid-cols-7 gap-1 sm:gap-2" aria-label="Últimos 7 días">
        {ultimos7Dias(hoy).map((d) => {
          const hecho = (porDia.get(d)?.length ?? 0) > 0;
          const esHoy = d === hoy;
          const [, mm, dd] = d.split("-");
          return (
            <li key={d}>
              <button
                type="button"
                onClick={() => setSel(sel === d ? null : d)}
                aria-pressed={sel === d}
                aria-label={`${esHoy ? "Hoy, " : ""}${Number(dd)}/${Number(mm)}: ${hecho ? "con misiones diarias completadas" : "sin misiones diarias completadas"}`}
                className={`flex min-h-16 w-full flex-col items-center justify-center gap-1 rounded-ui border transition-colors duration-150 ${
                  esHoy ? "border-accent" : "border-line"
                } ${sel === d ? "bg-surface-2" : "hover:bg-surface-2"}`}
              >
                <span className={`text-xs font-medium ${esHoy ? "text-accent" : "text-fg-2"}`}>{T.dias[diaSemana(d)]}</span>
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full ${hecho ? "bg-success text-bg" : "border border-dashed border-line"}`}
                  aria-hidden
                >
                  {hecho && <Icon name="check" className="h-3.5 w-3.5" />}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {elegido && (
        <div className="ui-card-inset mt-4" aria-live="polite">
          <p className="ui-label">{sel === hoy ? "Hoy" : sel ? `${Number(sel.slice(8))}/${Number(sel.slice(5, 7))}` : ""}</p>
          {elegido.length === 0 ? (
            <p className="mt-2 text-[15px] text-fg-2">{T.sinCompletadasDia}</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {elegido.map((m, i) => (
                <li key={`${m.titulo}-${i}`} className="flex items-center justify-between gap-3 text-[15px]">
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon name="check" className="h-4 w-4 shrink-0 text-success" />
                    <span className="truncate">{m.titulo}</span>
                  </span>
                  <span className="ui-num shrink-0 text-accent">+{fmt(m.xp)} XP</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/* ---------- Tu siguiente jugada ---------- */

function SiguienteJugadaCard({ jugada, onEnviar }: { jugada: ReturnType<typeof siguienteJugada>; onEnviar: (m: MisionHoy) => void }) {
  const m = jugada.mision;
  const tipo = m ? tipoDeMision(m) : null;
  const rangoTexto = jugada.llegaA ? (
    <>
      Con las misiones de hoy llegas a{" "}
      <span className="font-title text-lg font-bold tracking-[0.02em] text-fg uppercase">{jugada.llegaA.nombre}</span>
    </>
  ) : jugada.faltan > 0 ? (
    <>
      Te faltan <span className="ui-num text-fg">{fmt(jugada.faltan)} XP</span> para el siguiente rango
    </>
  ) : null;

  return (
    <section className="ui-card border-l-4 border-l-accent!" aria-labelledby="jugada-titulo">
      <h2 id="jugada-titulo" className="ui-label">{T.siguienteTitulo}</h2>
      {m ? (
        <>
          <p className="mt-2 font-title text-2xl leading-tight font-bold tracking-[0.02em] uppercase">{m.title}</p>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-fg-2">
            <XpChip xp={m.xp} />
            {tipo === "evidencia" ? "Envía tu evidencia" : tipo === "ventas" ? "Se completa con tus ventas" : "Se completa sola"}
          </p>
          {rangoTexto && <p className="mt-4 text-[15px] text-fg-2">{rangoTexto}</p>}
          {tipo === "evidencia" && m.canSend ? (
            <button type="button" className="ui-btn-primary mt-4 w-full" onClick={() => onEnviar(m)}>
              {T.empezar}
            </button>
          ) : (
            <Link href={tipo === "ventas" ? "/panel/ventas" : enlaceMision(m)} className="ui-btn-primary mt-4 w-full">
              {T.empezar}
            </Link>
          )}
        </>
      ) : (
        <>
          <p className="mt-2 text-[15px]">{T.todoListo}</p>
          {rangoTexto && <p className="mt-2 text-[15px] text-fg-2">{rangoTexto}</p>}
          <Link href="/panel/misiones" className="ui-btn-secondary mt-4 w-full">{T.verMisiones}</Link>
        </>
      )}
    </section>
  );
}
