import Link from "next/link";
import { GnDisclaimer } from "@/components/gn";
import { Icon } from "@/components/icons";
import { RankEmblem } from "@/components/rangos";
import { Accordion, PageBanner, ProgressBar } from "@/components/ui";
import { TEXTOS_RECOMPENSAS as R } from "@/content/recompensas";
import { requireUser } from "@/lib/auth";
import { getCatalog, getMyRank, getTerms } from "@/lib/clan-server";
import { faltaPara, formatGn, formatNum, formatUsd, gnPorVentaTipica, ventasParaGn, type GnConfig } from "@/lib/gn";
import { getGnConfig, getRecompensasV3 } from "@/lib/gn-server";
import { estadoRango, todosLosRangos } from "@/lib/rangos";
import { formatDateTime } from "@/lib/time";
import { RecompensasLegacy } from "./legacy";
import { RankPath, type NodoRango } from "./rank-path";
import { TermsCard } from "./terms-card";

export const metadata = { title: "Recompensas" };

export default async function RecompensasPage() {
  await requireUser("/panel/recompensas");
  if (!(await getRecompensasV3())) return <RecompensasLegacy />;

  const [cfg, rank, products, terms] = await Promise.all([getGnConfig(), getMyRank(), getCatalog(), getTerms()]);
  const nivel = rank?.level ?? 1;
  const xp = rank?.xp ?? 0;
  const ventas = rank?.sales_usd ?? 0;
  const reqs = rank?.requirements ?? [];
  const rangos = todosLosRangos();
  const { rango } = estadoRango(xp, undefined, nivel);
  const siguiente = rangos.find((r) => r.nivel === nivel + 1) ?? null;
  const identidadOk = (n: number) => reqs.filter((q) => q.level === n).every((q) => q.met);
  const falta = siguiente ? faltaPara(siguiente.nivel, { xp, ventas, identidadCumplida: identidadOk, alcanzado: nivel }, cfg.rangos) : null;
  const unidad = cfg.gn_modo_venta === "por_prenda" ? "prendas" : "ventas";

  const nodos: NodoRango[] = rangos.map((r) => {
    const meta = cfg.rangos.find((x) => x.nivel === r.nivel);
    return {
      nivel: r.nivel,
      xp: meta?.xp ?? 0,
      ventas: meta?.ventas ?? 0,
      identidad: reqs.filter((q) => q.level === r.nivel).map((q) => ({ name: q.name, met: q.met })),
      beneficios: cfg.beneficios_rango[String(r.nivel)] ?? [],
      premios: products.filter((p) => p.min_rank === r.nivel).map((p) => ({ id: p.id, name: p.name, price: p.price_gn })),
    };
  });

  const proximo = products.filter((p) => p.min_rank > nivel).sort((a, b) => a.min_rank - b.min_rank || a.price_gn - b.price_gn)[0];
  const proximoRango = proximo ? rangos.find((r) => r.nivel === proximo.min_rank) : null;
  // Los beneficios se acumulan: el rango actual conserva los de los anteriores (salvo el marco del avatar, que cambia).
  const beneficios = [
    ...(cfg.beneficios_rango[String(nivel)] ?? []),
    ...rangos
      .filter((r) => r.nivel < nivel)
      .reverse()
      .flatMap((r) => (cfg.beneficios_rango[String(r.nivel)] ?? []).filter((b) => !b.startsWith("Marco "))),
  ].filter((b, i, todos) => todos.indexOf(b) === i);

  return (
    <>
      <PageBanner title={R.titulo}>{R.bajada}</PageBanner>
      <div className="-mt-6 flex flex-col gap-6 sm:-mt-8">
        <GnDisclaimer />
        {terms && (
          <TermsCard
            terms={{ version: terms.version, clauses: terms.clauses, isDraft: terms.is_draft, accepted: terms.accepted_at !== null }}
            acceptedAt={terms.accepted_at ? formatDateTime(terms.accepted_at) : null}
          />
        )}

        {/* Tarjeta de rango: doble candado (XP y ventas) más requisitos de identidad. */}
        <section className="ui-card flex flex-col gap-5" aria-labelledby="rango-actual">
          <div className="flex items-center gap-4">
            <RankEmblem rango={rango} className="h-16 w-16 shrink-0" />
            <div className="min-w-0">
              <p className="ui-label">{R.rangoActual}</p>
              <h2 id="rango-actual" className="font-title text-2xl leading-tight font-extrabold uppercase [overflow-wrap:anywhere]">{rango.nombre}</h2>
            </div>
          </div>

          {!siguiente || !falta ? (
            <p className="text-[15px] font-medium text-gold">{R.rangoMaximo}</p>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <p className="flex flex-wrap justify-between gap-2 text-[13px]">
                  <span className="ui-label">{R.experiencia}</span>
                  <span className="ui-num">{formatNum(Math.min(xp, falta.metaXp))} / {formatNum(falta.metaXp)} XP</span>
                </p>
                <ProgressBar value={Math.min(xp, falta.metaXp)} target={falta.metaXp} done={falta.xp === 0} label={`XP hacia ${siguiente.nombre}`} />
                <p className="text-[13px] text-fg-2">{falta.xp === 0 ? `${R.cumplido} ✓` : R.faltanXp(formatNum(falta.xp), siguiente.nombre)}</p>
              </div>
              <div className="flex flex-col gap-2">
                <p className="flex flex-wrap justify-between gap-2 text-[13px]">
                  <span className="ui-label">{R.ventas}</span>
                  <span className="ui-num">{formatUsd(Math.min(ventas, falta.metaVentas))} / {formatUsd(falta.metaVentas)}</span>
                </p>
                <ProgressBar value={Math.min(ventas, falta.metaVentas)} target={falta.metaVentas} done={falta.ventas === 0} label={`Ventas hacia ${siguiente.nombre}`} />
                <p className="text-[13px] text-fg-2">{falta.ventas === 0 ? `${R.cumplido} ✓` : R.faltanVentas(formatUsd(falta.ventas), siguiente.nombre)}</p>
              </div>
              <div>
                <p className="ui-label mb-2">{R.identidad} · {siguiente.nombre}</p>
                {reqs.filter((q) => q.level === siguiente.nivel).length === 0 ? (
                  <p className="text-[13px] text-fg-2">Sin requisitos de identidad.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {reqs.filter((q) => q.level <= siguiente.nivel).map((q) => (
                      <li key={q.code} className="flex items-start gap-2 text-[15px]">
                        <Icon name={q.met ? "check" : "lock"} className={`mt-0.5 h-5 w-5 shrink-0 ${q.met ? "text-success" : "text-fg-3"}`} />
                        <span className="min-w-0">
                          {q.name}
                          <span className="block text-[13px] text-fg-2">{q.met ? R.cumplido : q.description || R.pendiente}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="text-[13px] text-fg-2">El rango sube cuando se cumplen los tres requisitos, y nunca baja.</p>
            </>
          )}
        </section>

        <RankPath nodos={nodos} nivelActual={nivel} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
          <section className="ui-card flex flex-col gap-3" aria-labelledby="beneficios">
            <h2 id="beneficios" className="ui-title-section">{R.beneficios}</h2>
            {beneficios.length === 0 ? (
              <p className="text-fg-2">Pronto anunciaremos los beneficios de este rango.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-[15px]">
                {beneficios.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <Icon name="check" className="mt-0.5 h-5 w-5 shrink-0 text-gold" /> {b}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="ui-card flex flex-col gap-3" aria-labelledby="proximo">
            <h2 id="proximo" className="ui-title-section">{R.proximo}</h2>
            {proximo && proximoRango ? (
              <>
                <div className="flex items-center gap-3">
                  <RankEmblem rango={proximoRango} className="h-12 w-12 shrink-0 opacity-70 grayscale" />
                  <div className="min-w-0">
                    <p className="font-bold [overflow-wrap:anywhere]">{proximo.name}</p>
                    <p className="ui-num text-[15px] text-gold">{formatGn(proximo.price_gn)}</p>
                  </div>
                </div>
                <p className="text-[13px] text-fg-2">Se desbloquea en {proximoRango.nombre}.</p>
              </>
            ) : (
              <p className="text-fg-2">{R.proximoNinguno}</p>
            )}
            <Link href="/panel/tienda-clan" className="ui-btn-sm self-start">{R.irTienda}</Link>
          </section>
        </div>

        <ComoFunciona cfg={cfg} unidad={unidad} />
      </div>
    </>
  );
}

/** Explicación del programa con ejemplos calculados desde la configuración (nada escrito a mano). */
function ComoFunciona({ cfg, unidad }: { cfg: GnConfig; unidad: string }) {
  const porUnidad = gnPorVentaTipica(cfg);
  const ejemploPremio = 2800;
  const ejemplos: string[] =
    cfg.gn_modo_venta === "por_prenda"
      ? [
          `Cada prenda vendida con PVP de ${formatUsd(cfg.gn_venta_minima_usd)} o más te da ${formatGn(cfg.gn_por_unidad)}.`,
          `Ejemplo: un ticket con 3 prendas suma ${formatGn(3 * cfg.gn_por_unidad)}.`,
          `Cuentan hasta ${formatNum(cfg.gn_max_diario)} prendas por día (${formatGn(cfg.gn_max_diario * cfg.gn_por_unidad)} como máximo por ventas).`,
        ]
      : cfg.gn_modo_venta === "por_venta"
        ? [
            `Cada venta de ${formatUsd(cfg.gn_venta_minima_usd)} o más te da ${formatGn(cfg.gn_por_unidad)}.`,
            `Cuentan hasta ${formatNum(cfg.gn_max_diario)} ventas por día.`,
          ]
        : [
            `Cada venta de ${formatUsd(cfg.gn_venta_minima_usd)} o más te da GN según su PVP: una prenda de ${formatUsd(cfg.pvp_defecto_usd)} da ${formatGn(porUnidad)}.`,
            `Cuentan hasta ${formatNum(cfg.gn_max_diario)} ventas por día.`,
          ];
  ejemplos.push(
    `Las misiones también dan GN, hasta ${formatGn(cfg.gn_misiones_tope_diario)} por día.`,
    `Un premio de ${formatGn(ejemploPremio)} equivale a ≈ ${formatNum(ventasParaGn(ejemploPremio, cfg))} ${unidad} a ${formatUsd(cfg.pvp_defecto_usd)}.`,
  );

  const faq: { q: string; a: string }[] = [
    { q: "¿Cuándo puedo usar mis GN?", a: `Quedan en espera ${formatNum(cfg.gn_dias_espera)} días desde la venta. Después pasan a tu saldo disponible para canjear en Tienda Clan.` },
    { q: "¿Qué pasa si me devuelven una venta?", a: `Si es dentro de la espera, sus GN se anulan solos. Después, el administrador registra la devolución y se descuentan; si ya los usaste, queda un saldo por cubrir que se paga con tus próximos GN y que impide canjear mientras exista.` },
    { q: "¿Los GN vencen?", a: `Sí, ${formatNum(cfg.gn_meses_vencimiento)} meses después de quedar disponibles. Al canjear se usan primero los más antiguos y te avisamos ${cfg.gn_avisos_vencimiento.map((d) => formatNum(d)).join(" y ")} días antes.` },
    { q: "¿Cuántos canjes puedo hacer?", a: `Hasta ${formatNum(cfg.canjes_por_dia)} por día. Al pedir un canje tus GN quedan retenidos; si se rechaza o se cancela, vuelven a tu saldo.` },
    { q: "¿Mi rango puede bajar?", a: "No. Subes al cumplir XP, ventas verificadas y requisitos de identidad, y lo alcanzado se queda." },
    { q: "¿Los GN se pueden cambiar o transferir?", a: "No. Son puntos del club para canjear premios en Tienda Clan; no se cambian ni se transfieren." },
  ];

  return (
    <section id="como-funciona" className="ui-card flex scroll-mt-24 flex-col gap-4" aria-labelledby="como-funciona-titulo">
      <h2 id="como-funciona-titulo" className="ui-title-section">{R.comoFunciona}</h2>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-[15px]">
        {ejemplos.map((e) => <li key={e}>{e}</li>)}
      </ol>
      <h3 className="ui-label mt-2">{R.faq}</h3>
      <div className="flex flex-col gap-2">
        {faq.map((f) => (
          <Accordion key={f.q} title={f.q}>
            <p className="text-fg-2">{f.a}</p>
          </Accordion>
        ))}
      </div>
      <p className="flex items-start gap-2 text-[13px] text-fg-2">
        <Icon name="document" className="mt-0.5 h-4 w-4 shrink-0" /> {R.contrato}
      </p>
    </section>
  );
}
