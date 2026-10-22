import Link from "next/link";
import { Bar, Banner, HeroCard, StatSlab } from "@/components/club";
import { Flash } from "@/components/flash";
import { Icon } from "@/components/icons";
import { SalesChart } from "@/components/sales-chart";
import { requireUser } from "@/lib/auth";
import { parseBoard, xpToNextPlace } from "@/lib/leaderboard";
import { formatDay, formatXp } from "@/lib/missions";
import { money, parseStoreSummary, units } from "@/lib/store";
import { createClient } from "@/lib/supabase/server";
import { updateStore } from "./actions";

export const metadata = { title: "Tu Tienda" };

const LICENSE_STATUS: Record<string, string> = {
  pending: "Pendiente",
  active: "Activa",
  suspended: "Suspendida",
  expired: "Vencida",
  cancelled: "Cancelada",
};

export default async function StoreHome({ searchParams }: PageProps<"/panel">) {
  const sp = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: license }, { data: rawSummary }, { data: rawBoard }] = await Promise.all([
    supabase
      .from("licenses")
      .select("status, territory, starts_at, ends_at, contract_ref, license_plans(name, status, is_demo)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc("store_summary", { p_user: user.id, p_months: 6 }),
    supabase.rpc("store_leaderboard", { p_limit: 200 }),
  ]);
  const plan = license?.license_plans as unknown as { name: string; status: string; is_demo: boolean } | null;
  const s = parseStoreSummary(rawSummary);
  const board = parseBoard(rawBoard);
  const me = board.find((r) => r.isMe);
  const next = xpToNextPlace(board);
  const storeName = user.storeName ?? "Tu Tienda";

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <Banner title={storeName}>
        {user.storeName ? (
          "Así va tu tienda Gallo Negro. Las cifras salen de las ventas registradas con QR en tu punto de venta."
        ) : (
          <>Ponle nombre a tu tienda en <a href="#datos-tienda" className="text-gold underline">Datos de tu tienda</a>.</>
        )}
      </Banner>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HeroCard label="Ranking actual" icon="trophy" watermark={me ? `#${String(me.place).padStart(2, "0")}` : undefined}>
          <p className="font-display text-4xl leading-none sm:text-5xl">{me ? `#${me.place}` : "—"}</p>
          <p className="mt-3 text-xs text-parchment">
            {!me
              ? "Entras en la clasificación con una licencia activa."
              : next
                ? `A ${formatXp(next.gap)} de subir al puesto #${next.place}`
                : me.place === 1
                  ? `Primer puesto de ${board.length} ${board.length === 1 ? "tienda" : "tiendas"}`
                  : <Link href="/panel/clasificacion" className="text-gold">Ver clasificación</Link>}
          </p>
        </HeroCard>

        <HeroCard label="Puntos de XP" icon="flame" accent="blood" watermark="XP">
          <p className="flex items-baseline gap-2">
            <span className="font-display text-4xl leading-none sm:text-5xl">{new Intl.NumberFormat("es-VE").format(s.totalXp)}</span>
            <span className="text-xs font-bold text-blood">XP</span>
          </p>
          <p className="mt-3 text-xs text-parchment">
            Obtenidos con <Link href="/panel/misiones" className="text-gold">misiones</Link>
          </p>
        </HeroCard>

        <HeroCard label="Rango de licencia" icon="shield">
          {s.level ? (
            <>
              <p className="font-display text-2xl uppercase leading-tight text-gold">{s.level.name}</p>
              <div className="mt-3">
                {s.nextLevel ? (
                  <Bar value={s.totalXp - s.level.minimum_xp} target={s.nextLevel.minimum_xp - s.level.minimum_xp} label={`Progreso hacia ${s.nextLevel.name}`} />
                ) : (
                  <Bar value={1} target={1} />
                )}
              </div>
              <p className="mt-2 flex justify-between gap-2 text-[11px] text-parchment">
                <span>Nivel {s.level.position}</span>
                <span>{s.nextLevel ? `Siguiente: ${s.nextLevel.name}` : "Rango máximo"}</span>
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-2xl uppercase text-gold">—</p>
              <p className="mt-3 text-xs text-parchment">
                {s.levelsConfigured
                  ? `Sin rango todavía${s.nextLevel ? `: ${formatXp(s.nextLevel.minimum_xp)} para ${s.nextLevel.name}` : ""}`
                  : "Los rangos aún no están configurados"}
              </p>
            </>
          )}
        </HeroCard>

        <HeroCard label="Tu squad / equipo" icon="users" accent="violet">
          <p className="font-display text-2xl uppercase leading-tight">Próximamente</p>
          <p className="mt-3 text-xs text-parchment">Los equipos entre tiendas aún no están definidos por Gallo Negro.</p>
        </HeroCard>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatSlab label="Total generado" value={money(s.revenue)} hint="Ventas registradas" />
        <StatSlab label="Inversión acumulada" value={money(s.investment)} hint={s.investment === 0 ? "Sin inversiones registradas" : "Registrada por Gallo Negro"} />
        <StatSlab label="Prendas vendidas" value={s.unitsSold} hint={units(s.unitsSold)} />
        <StatSlab
          label="Prendas en stock"
          value={Math.max(s.stockBalance, 0)}
          hint={
            s.stockBalance < 0 ? (
              <span className="text-warn">Hay {units(-s.stockBalance)} vendidas sin entrega registrada.</span>
            ) : s.unitsDelivered === 0 ? (
              "Sin entregas registradas"
            ) : (
              `${units(s.unitsDelivered)} recibidas en total`
            )
          }
        />
      </div>

      <Link href="/panel/ventas" className="btn-gold mt-4 w-full py-3 sm:w-auto">
        <Icon name="qr" /> Abrir punto de venta
      </Link>

      <section className="slab mt-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="slab-title">Gráfica de ventas</h2>
          <p className="text-xs text-parchment">Últimos 6 meses · ventas registradas</p>
        </div>
        <SalesChart months={s.monthly} />
      </section>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <section className="slab border-l-4 border-l-gold">
          <h2 className="slab-title mb-3">Licencia de tu tienda</h2>
          {license ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="label">Plan</dt><dd>{plan?.name}{plan?.is_demo && <span className="ml-2 text-xs text-warn">(provisional)</span>}</dd></div>
              <div><dt className="label">Estado</dt><dd>{LICENSE_STATUS[license.status] ?? license.status}</dd></div>
              <div><dt className="label">Territorio</dt><dd>{license.territory ?? "—"}</dd></div>
              <div><dt className="label">Vigencia</dt><dd>{license.starts_at ? formatDay(license.starts_at) : "—"} – {license.ends_at ? formatDay(license.ends_at) : "sin fecha"}</dd></div>
              <div className="col-span-2"><dt className="label">Contrato</dt><dd>{license.contract_ref ?? "Pendiente de registrar"}</dd></div>
            </dl>
          ) : (
            <p className="text-sm text-linen">
              Tu tienda todavía no tiene una licencia activa. Gallo Negro revisa cada solicitud y activa la licencia
              después de formalizar el contrato y el pago.
            </p>
          )}
        </section>

        <section className="slab" id="datos-tienda">
          <h2 className="slab-title mb-3">Datos de tu tienda</h2>
          <form action={updateStore} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="store_name">Nombre de tu tienda</label>
              <input className="input" id="store_name" name="store_name" defaultValue={user.storeName ?? ""} minLength={2} maxLength={60} placeholder="Ej.: Gallo Negro Valencia Centro" />
            </div>
            <div>
              <label className="label" htmlFor="full_name">Responsable de la tienda</label>
              <input className="input" id="full_name" name="full_name" defaultValue={user.fullName ?? ""} maxLength={120} />
            </div>
            <div>
              <label className="label" htmlFor="public_alias">Nombre visible en rankings</label>
              <input className="input" id="public_alias" name="public_alias" defaultValue={user.publicAlias ?? ""} minLength={2} maxLength={40} />
            </div>
            <p className="text-xs text-parchment sm:col-span-2">El nombre visible es lo único que verán otras tiendas en rankings y comunidad.</p>
            <button className="btn-slab sm:col-span-2 sm:justify-self-start">Guardar datos de la tienda</button>
          </form>
        </section>
      </div>
    </>
  );
}
