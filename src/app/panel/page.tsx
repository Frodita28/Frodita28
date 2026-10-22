import Link from "next/link";
import { Badge, PageBanner, ProgressBar, SectionHeader, StatCard } from "@/components/ui";
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
      <div className="flex flex-col gap-4">
        <Flash ok={sp.ok} error={sp.error} variant="panel" />
        <PageBanner title={storeName}>
          {user.storeName ? (
            "Así va tu tienda Gallo Negro. Las cifras salen de las ventas registradas con QR en tu punto de venta."
          ) : (
            <>Ponle nombre a tu tienda en <a href="#datos-tienda" className="ui-link">Datos de tu tienda</a>.</>
          )}
        </PageBanner>
      </div>

      <section className="flex flex-col gap-4" aria-label="Resumen">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Ranking actual"
            icon="trophy"
            size="lg"
            value={me ? `#${me.place}` : "—"}
            hint={
              !me
                ? "Entras en la clasificación con una licencia activa."
                : next
                  ? `A ${formatXp(next.gap)} de subir al puesto #${next.place}`
                  : me.place === 1
                    ? `Primer puesto de ${board.length} ${board.length === 1 ? "tienda" : "tiendas"}`
                    : <Link href="/panel/clasificacion" className="ui-link">Ver clasificación</Link>
            }
          />

          <StatCard
            label="Puntos de XP"
            icon="flame"
            size="lg"
            value={
              <span className="flex items-baseline gap-2">
                {new Intl.NumberFormat("es-VE").format(s.totalXp)}
                <span className="ui-label">XP</span>
              </span>
            }
            hint={<>Obtenidos con <Link href="/panel/misiones" className="ui-link">misiones</Link></>}
          />

          <div className="ui-card flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <p className="ui-label">Rango de licencia</p>
              <Icon name="shield" className="h-5 w-5 shrink-0 text-fg-2" />
            </div>
            {s.level ? (
              <>
                <p className="mt-2 font-title text-[32px] leading-none font-bold tracking-[0.02em] uppercase">{s.level.name}</p>
                <div className="mt-4">
                  {s.nextLevel ? (
                    <ProgressBar value={s.totalXp - s.level.minimum_xp} target={s.nextLevel.minimum_xp - s.level.minimum_xp} label={`Progreso hacia ${s.nextLevel.name}`} />
                  ) : (
                    <ProgressBar value={1} target={1} />
                  )}
                </div>
                <p className="mt-2 flex justify-between gap-2 text-[13px] text-fg-2">
                  <span>Nivel {s.level.position}</span>
                  <span>{s.nextLevel ? `Siguiente: ${s.nextLevel.name}` : "Rango máximo"}</span>
                </p>
              </>
            ) : (
              <>
                <p className="ui-num mt-2 text-[40px] leading-none sm:text-5xl">—</p>
                <p className="mt-3 text-[13px] text-fg-2">
                  {s.levelsConfigured
                    ? `Sin rango todavía${s.nextLevel ? `: ${formatXp(s.nextLevel.minimum_xp)} para ${s.nextLevel.name}` : ""}`
                    : "Los rangos aún no están configurados"}
                </p>
              </>
            )}
          </div>

          <div className="ui-card flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <p className="ui-label">Tu squad / equipo</p>
              <Icon name="users" className="h-5 w-5 shrink-0 text-fg-2" />
            </div>
            <div className="mt-3"><Badge>Próximamente</Badge></div>
            <p className="mt-3 text-[13px] text-fg-2">Los equipos entre tiendas aún no están definidos por Gallo Negro.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total generado" value={money(s.revenue)} hint="Ventas registradas" />
          <StatCard label="Inversión acumulada" value={money(s.investment)} hint={s.investment === 0 ? "Sin inversiones registradas" : "Registrada por Gallo Negro"} />
          <StatCard label="Prendas vendidas" value={new Intl.NumberFormat("es-VE").format(s.unitsSold)} hint={units(s.unitsSold)} />
          <StatCard
            label="Prendas en stock"
            value={new Intl.NumberFormat("es-VE").format(Math.max(s.stockBalance, 0))}
            hint={
              s.stockBalance < 0 ? (
                <span className="flex items-start gap-2 text-fg">
                  <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-brand-red" />
                  Hay {units(-s.stockBalance)} vendidas sin entrega registrada.
                </span>
              ) : s.unitsDelivered === 0 ? (
                "Sin entregas registradas"
              ) : (
                `${units(s.unitsDelivered)} recibidas en total`
              )
            }
          />
        </div>

        <Link href="/panel/ventas" className="ui-btn-primary w-full sm:w-auto sm:self-start">
          <Icon name="qr" /> Abrir punto de venta
        </Link>
      </section>

      <section className="ui-card">
        <SectionHeader title="Gráfica de ventas" aside={<p className="text-[13px] text-fg-2">Últimos 6 meses · ventas registradas</p>} />
        <SalesChart months={s.monthly} />
      </section>

      <div className="grid gap-12 md:grid-cols-2 md:gap-6">
        <section className="ui-card">
          <SectionHeader title="Licencia de tu tienda" />
          {license ? (
            <dl className="grid grid-cols-2 gap-4">
              <div><dt className="ui-label mb-1">Plan</dt><dd>{plan?.name}{plan?.is_demo && <span className="ml-2"><Badge>provisional</Badge></span>}</dd></div>
              <div><dt className="ui-label mb-1">Estado</dt><dd>{LICENSE_STATUS[license.status] ?? license.status}</dd></div>
              <div><dt className="ui-label mb-1">Territorio</dt><dd>{license.territory ?? "—"}</dd></div>
              <div><dt className="ui-label mb-1">Vigencia</dt><dd>{license.starts_at ? formatDay(license.starts_at) : "—"} – {license.ends_at ? formatDay(license.ends_at) : "sin fecha"}</dd></div>
              <div className="col-span-2"><dt className="ui-label mb-1">Contrato</dt><dd>{license.contract_ref ?? "Pendiente de registrar"}</dd></div>
            </dl>
          ) : (
            <p className="text-fg-2">
              Tu tienda todavía no tiene una licencia activa. Gallo Negro revisa cada solicitud y activa la licencia
              después de formalizar el contrato y el pago.
            </p>
          )}
        </section>

        <section className="ui-card scroll-mt-8" id="datos-tienda">
          <SectionHeader title="Datos de tu tienda" />
          <form action={updateStore} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="ui-field-label" htmlFor="store_name">Nombre de tu tienda</label>
              <input className="ui-input" id="store_name" name="store_name" defaultValue={user.storeName ?? ""} minLength={2} maxLength={60} placeholder="Ej.: Gallo Negro Valencia Centro" />
            </div>
            <div>
              <label className="ui-field-label" htmlFor="full_name">Responsable de la tienda</label>
              <input className="ui-input" id="full_name" name="full_name" defaultValue={user.fullName ?? ""} maxLength={120} />
            </div>
            <div>
              <label className="ui-field-label" htmlFor="public_alias">Nombre visible en rankings</label>
              <input className="ui-input" id="public_alias" name="public_alias" defaultValue={user.publicAlias ?? ""} minLength={2} maxLength={40} />
            </div>
            <p className="text-[13px] text-fg-2 sm:col-span-2">El nombre visible es lo único que verán otras tiendas en rankings y comunidad.</p>
            <button className="ui-btn-secondary sm:col-span-2 sm:justify-self-start">Guardar datos de la tienda</button>
          </form>
        </section>
      </div>
    </>
  );
}
