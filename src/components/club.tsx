import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { panelFonts } from "@/app/panel/fonts";
import type { AppRole as Role } from "@/lib/auth";
import { estadoRango } from "@/lib/rangos";
import { ClubTabs, type ClubTab } from "./club-tabs";
import { Icon } from "./icons";
import { MaxRankInsignia, RankAvatar, initials } from "./rangos";
import { Badge } from "./ui";

/* Estructura del panel de licenciatarios. Los componentes visuales están en ./ui. */

export const ROLE_LABEL: Record<Role, string> = { applicant: "Solicitante", licensee: "Licenciatario oficial", admin: "Administrador" };

/** Pestañas del panel, en el orden en que se muestran. */
export function panelTabs(role: Role): ClubTab[] {
  return [
    { href: "/panel", label: "Tu Tienda", icon: "store" },
    { href: "/panel/clasificacion", label: "Clasificación", icon: "podium" },
    { href: "/panel/recompensas", label: "Recompensas", icon: "gift" },
    { href: "/panel/misiones", label: "Misiones", icon: "flag" },
    { href: "/panel/ventas", label: "Ventas", icon: "qr" },
    { href: "/panel/licencia", label: "Licencia", icon: "document" },
    ...(role === "admin" ? [{ href: "/admin", label: "Administración", icon: "gear" } as const] : []),
  ];
}

/**
 * Estructura del panel de las tiendas ("Club de licenciatarios"): cabecera con la
 * marca y la tienda, pestañas de secciones y el contenido (secciones separadas 48 px).
 * El avatar lleva el marco del rango de la tienda; el cambio de contraseña (/nueva-clave)
 * está junto a «Salir».
 */
export function StoreShell({
  tabs,
  storeName,
  roleLabel,
  totalXp,
  children,
}: {
  tabs: ClubTab[];
  storeName: string;
  roleLabel: string;
  totalXp: number;
  children: React.ReactNode;
}) {
  const { rango } = estadoRango(totalXp);
  return (
    <div className={`gn-panel ${panelFonts} flex min-h-full flex-1 flex-col`}>
      <header className="border-b border-line bg-bg print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/panel" className="flex min-w-0 items-center gap-3 rounded-ui">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-ui bg-accent font-title text-xl font-bold text-bg">GN</span>
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="font-title text-xl leading-none font-bold tracking-[0.02em] uppercase sm:text-2xl">Gallo Negro</span>
                <span className="hidden sm:inline-flex"><Badge>Licencias</Badge></span>
              </span>
              <span className="ui-label mt-1 block">Club de licenciatarios</span>
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right sm:block">
              <p className="ui-label">{roleLabel}</p>
              <p className="mt-1 flex items-center justify-end gap-2 text-[15px] font-medium">
                <Icon name="store" className="h-4 w-4 text-fg-2" />
                {storeName}
                {rango.nivel === 5 && <MaxRankInsignia />}
              </p>
            </div>
            <span title={`Rango ${rango.nombre}`}>
              <RankAvatar nivel={rango.nivel} label={initials(storeName)} />
            </span>
            <Link href="/nueva-clave" className="ui-btn-sm px-2.5 sm:px-3" aria-label="Cambiar contraseña">
              <Icon name="key" className="h-4 w-4" />
              <span className="hidden sm:inline">Cambiar contraseña</span>
            </Link>
            <form action={signOut}>
              <button className="ui-btn-sm">Salir</button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ClubTabs tabs={tabs} />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-4 py-8 sm:px-6 sm:py-12 [&>*]:min-w-0">{children}</main>
    </div>
  );
}
