import Link from "next/link";
import { TEXTOS_TIENDA as T } from "@/content/rangos";
import { Icon, type IconName } from "./icons";

/** «Acciones rápidas» de Tu tienda: cuadrícula 2×2 de botones grandes; el punto de venta es el principal. */
export function AccionesRapidas({ puesto, tiendas }: { puesto: number | null; tiendas: number }) {
  const fmt = (n: number) => new Intl.NumberFormat("es-VE").format(n);
  const items: { href: string; label: string; icon: IconName; detalle?: string; principal?: boolean }[] = [
    { href: "/panel/ventas", label: T.accionPos, icon: "qr", principal: true },
    { href: "/panel/misiones", label: T.accionMisiones, icon: "flag" },
    {
      href: "/panel/clasificacion",
      label: T.accionClasificacion,
      icon: "podium",
      detalle: puesto ? `#${fmt(puesto)} de ${fmt(tiendas)}` : T.sinPosicion,
    },
    { href: "/panel/recompensas", label: T.accionRecompensas, icon: "gift" },
  ];
  return (
    <section aria-labelledby="acciones-titulo">
      <h2 id="acciones-titulo" className="ui-label mb-2">{T.accionesTitulo}</h2>
      <ul className="grid grid-cols-2 gap-2">
        {items.map((a) => (
          <li key={a.href}>
            <Link
              href={a.href}
              className={`flex min-h-24 h-full flex-col justify-between gap-2 rounded-ui border p-4 transition-colors duration-150 ${
                a.principal ? "border-accent bg-accent text-bg hover:bg-accent/90" : "border-line bg-surface hover:bg-surface-2"
              }`}
            >
              <Icon name={a.icon} className={`h-6 w-6 ${a.principal ? "" : "text-fg-2"}`} />
              <span>
                <span className="block font-title text-lg leading-tight font-bold tracking-[0.02em] uppercase">{a.label}</span>
                {a.detalle && <span className="ui-num mt-1 block text-[13px] font-medium text-fg-2">{a.detalle}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
