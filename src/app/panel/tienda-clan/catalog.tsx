"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/bottom-sheet";
import { Icon } from "@/components/icons";
import { Badge, ProgressBar } from "@/components/ui";
import { CATEGORIAS, TEXTOS_CLAN as T, type CategoriaSlug, type TierSlug } from "@/content/recompensas";
import { formatGn, formatNum, type EstadoTarjeta } from "@/lib/gn";
import { acceptTerms, redeemProduct, setGoal } from "./actions";

export type CatalogItem = {
  id: string;
  name: string;
  description: string;
  photo: string | null;
  tier: TierSlug;
  category: CategoriaSlug;
  minRank: number;
  minRankName: string;
  price: number;
  permanent: boolean;
  until: string | null;
  needsAddress: boolean;
  leadDays: number | null;
  estado: EstadoTarjeta;
};

type Props = {
  items: CatalogItem[];
  available: number;
  goalId: string | null;
  unidadVenta: string;
  paused: boolean;
  blocked: boolean;
  terms: { version: number; clauses: string[]; isDraft: boolean; accepted: boolean } | null;
  defaultName: string;
};

/** Catálogo de la Tienda Clan agrupado por categoría, con filtro, meta y panel de canje. */
export function ClanCatalog({ items, available, goalId, unidadVenta, paused, blocked, terms, defaultName }: Props) {
  const [categoria, setCategoria] = useState<CategoriaSlug | "todos">("todos");
  const [open, setOpen] = useState<CatalogItem | null>(null);
  const [goal, setGoalState] = useOptimistic(goalId);
  // Saldo optimista: baja al confirmar un canje y vuelve solo si el servidor lo rechaza.
  const [avail, setAvail] = useOptimistic(available);
  const [, startGoal] = useTransition();
  const goalItem = items.find((i) => i.id === goal) ?? null;

  const visibles = categoria === "todos" ? items : items.filter((i) => i.category === categoria);
  const grupos = CATEGORIAS.map((c) => ({ ...c, items: visibles.filter((i) => i.category === c.slug) })).filter((g) => g.items.length > 0);

  const toggleGoal = (id: string | null) =>
    startGoal(async () => {
      setGoalState(id);
      await setGoal(id);
    });

  return (
    <div className="flex flex-col gap-6">
      <section className="ui-card flex flex-col gap-3" aria-labelledby="mi-meta">
        <div className="flex items-center justify-between gap-3">
          <h2 id="mi-meta" className="ui-label flex items-center gap-2">
            <Icon name="target" className="h-4 w-4" /> {T.miMeta}
          </h2>
          {goalItem && (
            <button type="button" className="ui-link min-h-11 text-[13px]" onClick={() => toggleGoal(null)}>
              {T.quitarMeta}
            </button>
          )}
        </div>
        {goalItem ? (
          <>
            <p className="font-title text-lg font-bold">{goalItem.name}</p>
            <p className="ui-num text-[15px]">
              {formatNum(Math.min(avail, goalItem.price))} / {formatGn(goalItem.price)}
            </p>
            <ProgressBar value={avail} target={goalItem.price} label={`Progreso hacia ${goalItem.name}`} />
            {avail >= goalItem.price && <p className="text-[13px] font-medium text-success">{T.metaLista}</p>}
          </>
        ) : (
          <p className="text-[15px] text-fg-2">{T.metaVacia}</p>
        )}
      </section>

      <p className="ui-num -mb-3 text-[13px] text-fg-2" aria-live="polite">
        Saldo para canjear: <span className="text-fg">{formatGn(avail)}</span>
      </p>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Filtrar por categoría">
        <button type="button" className="ui-chip" aria-pressed={categoria === "todos"} onClick={() => setCategoria("todos")}>
          {T.todos}
        </button>
        {CATEGORIAS.map((c) => (
          <button key={c.slug} type="button" className="ui-chip shrink-0" aria-pressed={categoria === c.slug} onClick={() => setCategoria(c.slug)}>
            {c.nombre}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="ui-card text-fg-2">{T.sinPremios}</p>
      ) : grupos.length === 0 ? (
        <p className="ui-card text-fg-2">{T.sinPremiosNivel}</p>
      ) : (
        grupos.map((g) => (
          <section key={g.slug} aria-labelledby={`categoria-${g.slug}`} className="flex flex-col gap-3">
            <h3 id={`categoria-${g.slug}`} className="ui-title-section">{g.nombre}</h3>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {g.items.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  unidadVenta={unidadVenta}
                  isGoal={goal === item.id}
                  disabled={paused || blocked}
                  onRedeem={() => setOpen(item)}
                  onGoal={() => toggleGoal(item.id)}
                />
              ))}
            </div>
          </section>
        ))
      )}

      <RedeemSheet item={open} available={available} onOptimistic={setAvail} terms={terms} defaultName={defaultName} onClose={() => setOpen(null)} />
    </div>
  );
}

export function ProductCard({
  item,
  unidadVenta,
  isGoal,
  disabled,
  onRedeem,
  onGoal,
}: {
  item: CatalogItem;
  unidadVenta: string;
  isGoal: boolean;
  disabled: boolean;
  onRedeem: () => void;
  onGoal: () => void;
}) {
  const e = item.estado;
  const locked = e.tipo === "bloqueado";
  return (
    <article className={`ui-card flex min-w-0 flex-col gap-3 p-3 sm:p-4 ${locked ? "opacity-80" : ""}`}>
      <div className="relative aspect-square overflow-hidden rounded-ui border border-line bg-inset">
        {item.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.photo} alt="" className={`h-full w-full object-cover ${locked ? "grayscale" : ""}`} loading="lazy" />
        ) : (
          <div className="grid h-full w-full place-items-center text-fg-3">
            <Icon name="gift" className="h-10 w-10" />
          </div>
        )}
        {locked && (
          <span className="absolute inset-0 grid place-items-center bg-bg/60">
            <Icon name="lock" className="h-8 w-8 text-fg" />
            <span className="sr-only">{T.vistaPrevia}</span>
          </span>
        )}
        {item.permanent && (
          <span className="absolute top-2 left-2">
            <Badge tone="accent">{T.destacado}</Badge>
          </span>
        )}
      </div>
      <div className="min-w-0">
        <h4 className="text-[15px] leading-snug font-bold [overflow-wrap:anywhere]">{item.name}</h4>
        <p className="ui-num mt-1 text-[15px] text-gold">{formatGn(item.price)}</p>
        {item.until && <p className="mt-1 text-[13px] text-fg-2">{T.disponibleHasta(item.until)}</p>}
      </div>
      <div className="mt-auto flex flex-col gap-2">
        {e.tipo === "canjear" && (
          <button type="button" className="ui-btn-primary w-full" onClick={onRedeem} disabled={disabled}>
            {T.canjear}
          </button>
        )}
        {e.tipo === "faltan" && <p className="text-[13px] text-fg-2">{T.faltan(formatGn(e.gn), e.ventas, unidadVenta)}</p>}
        {e.tipo === "bloqueado" && (
          <p className="flex items-center gap-1 text-[13px] text-fg-2">
            <Icon name="lock" className="h-4 w-4 shrink-0" /> {T.seDesbloquea(item.minRankName)}
          </p>
        )}
        {e.tipo === "agotado" && <Badge>{T.agotado}</Badge>}
        {e.tipo === "limite" && <Badge>{T.limite}</Badge>}
        {!locked && e.tipo !== "canjear" && !isGoal && (
          <button type="button" className="ui-btn-sm w-full" onClick={onGoal}>
            {T.fijarMeta}
          </button>
        )}
        {isGoal && (
          <span className="flex min-h-11 items-center gap-1 text-[13px] font-medium text-gold sm:min-h-9">
            <Icon name="target" className="h-4 w-4" /> {T.miMeta}
          </span>
        )}
      </div>
    </article>
  );
}

function RedeemSheet({
  item,
  available,
  onOptimistic,
  terms,
  defaultName,
  onClose,
}: {
  item: CatalogItem | null;
  available: number;
  onOptimistic: (v: number) => void;
  terms: Props["terms"];
  defaultName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(terms?.accepted ?? true);
  // Clave del canje: una por apertura del panel; reintentar o tocar dos veces no duplica.
  const [key, setKey] = useState<string>("");
  const [openedFor, setOpenedFor] = useState<string | null>(null);

  if (item && openedFor !== item.id) {
    setOpenedFor(item.id);
    setKey(crypto.randomUUID());
    setError(null);
    setDone(null);
  }
  if (!item && openedFor !== null) setOpenedFor(null);

  const after = item ? available - item.price : available;

  const submit = (form: HTMLFormElement) => {
    if (!item) return;
    const fd = new FormData(form);
    const get = (k: string) => String(fd.get(k) ?? "");
    setError(null);
    start(async () => {
      if (!accepted && terms) {
        const t = await acceptTerms(terms.version);
        if (!t.ok) {
          setError(t.error);
          return;
        }
        setAccepted(true);
      }
      onOptimistic(available - item.price);
      const r = await redeemProduct({
        productId: item.id,
        key,
        delivery: { nombre: get("nombre"), telefono: get("telefono"), ciudad: get("ciudad"), direccion: get("direccion"), notas: get("notas") },
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setDone(T.canjeOk);
      router.refresh();
    });
  };

  return (
    <BottomSheet open={item !== null} onClose={onClose} title={T.confirmarTitulo}>
      {item && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-ui border border-line bg-inset">
              {item.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.photo} alt="" className="h-full w-full object-cover" />
              ) : (
                <Icon name="gift" className="h-7 w-7 text-fg-3" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-bold [overflow-wrap:anywhere]">{item.name}</p>
              <p className="ui-num text-gold">{formatGn(item.price)}</p>
            </div>
          </div>

          {done ? (
            <div className="flex flex-col gap-4">
              <p className="ui-card-inset flex items-start gap-2 text-[15px]">
                <Icon name="check" className="mt-0.5 h-5 w-5 shrink-0 text-success" /> {done}
              </p>
              <Link href="/panel/tienda-clan?seccion=canjes" className="ui-btn-primary w-full" onClick={onClose}>
                {T.secciones.canjes}
              </Link>
            </div>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                submit(e.currentTarget);
              }}
            >
              <dl className="grid grid-cols-2 gap-3">
                <div className="ui-card-inset">
                  <dt className="ui-label">{T.saldoAntes}</dt>
                  <dd className="ui-num mt-1 text-lg">{formatGn(available)}</dd>
                </div>
                <div className="ui-card-inset">
                  <dt className="ui-label">{T.saldoDespues}</dt>
                  <dd className="ui-num mt-1 text-lg">{formatGn(Math.max(after, 0))}</dd>
                </div>
              </dl>

              <fieldset className="flex flex-col gap-3">
                <legend className="ui-label mb-2">{T.datosEntrega}</legend>
                <Field name="nombre" label={T.nombre} autoComplete="name" required defaultValue={defaultName} />
                <Field name="telefono" label={T.telefono} type="tel" autoComplete="tel" inputMode="tel" required />
                <Field name="ciudad" label={T.ciudad} autoComplete="address-level2" required={item.needsAddress} />
                <Field name="direccion" label={T.direccion} autoComplete="street-address" required={item.needsAddress} />
                <div>
                  <label className="ui-field-label" htmlFor="canje-notas">{T.notas}</label>
                  <textarea id="canje-notas" name="notas" className="ui-input min-h-20" maxLength={500} />
                </div>
              </fieldset>

              <p className="text-[13px] text-fg-2">{T.sustitucion}</p>
              <p className="text-[13px] text-fg-2">{T.retencion}</p>

              {terms && !accepted && (
                <details className="ui-card-inset" open>
                  <summary className="min-h-11 cursor-pointer py-2 font-bold">
                    {T.terminosTitulo} · v{terms.version}
                    {terms.isDraft && <span className="ml-2 text-[13px] font-normal text-fg-2">(borrador)</span>}
                  </summary>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] text-fg-2">
                    {terms.clauses.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ol>
                  <label className="mt-3 flex min-h-11 items-center gap-3 text-[15px]">
                    <input type="checkbox" name="acepto" required className="h-5 w-5 accent-[var(--accent)]" />
                    {T.aceptar}
                  </label>
                  <p className="text-[13px] text-fg-2">{T.aceptarAyuda}</p>
                </details>
              )}

              {error && (
                <p role="alert" className="rounded-ui border border-brand-red p-3 text-[15px]">
                  {error}
                </p>
              )}
              <button className="ui-btn-primary w-full" disabled={busy} aria-busy={busy}>
                {busy ? T.confirmando : T.confirmar}
              </button>
            </form>
          )}
        </div>
      )}
    </BottomSheet>
  );
}

function Field({
  name,
  label,
  required,
  ...rest
}: { name: string; label: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `canje-${name}`;
  return (
    <div>
      <label className="ui-field-label" htmlFor={id}>
        {label}
      </label>
      <input id={id} name={name} className="ui-input" required={required} maxLength={300} {...rest} />
    </div>
  );
}
