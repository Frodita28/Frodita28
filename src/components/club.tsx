import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { panelFonts } from "@/app/panel/fonts";
import type { AppRole as Role } from "@/lib/auth";
import { estadoRango } from "@/lib/rangos";
import { BottomNav } from "./bottom-nav";
import { ClubTabs, type ClubTab } from "./club-tabs";
import { Icon } from "./icons";
import { MaxRankInsignia, RankAvatar, initials } from "./rangos";
import { Badge } from "./ui";

/* Estructura del panel de licenciatarios. Los componentes visuales están en ./ui. */

export const ROLE_LABEL: Record<Role, string> = { applicant: "Solicitante", licensee: "Licenciatario oficial", admin: "Administrador" };

/** Pestañas del panel, en el orden en que se muestran. */
export function panelTabs(role: Role): ClubTab[] {
  return [
    // Ventas (/panel/ventas) vive dentro de Perfil: no tiene pestaña propia y marca «Perfil».
    { href: "/panel", label: "Perfil", icon: "idCard" },
    { href: "/panel/recompensas", label: "Recompensas", icon: "gift" },
    { href: "/panel/misiones", label: "Misiones", icon: "flag" },
    { href: "/panel/tienda-clan", label: "Tienda Clan", icon: "bag" },
    { href: "/panel/rangos", label: "Ruta de rangos", icon: "podium" },
    ...(role === "admin" ? [{ href: "/admin", label: "Administración", icon: "gear" } as const] : []),
  ];
}

/**
 * Estructura del panel de las tiendas ("Club de licenciatarios"): cabecera con la
 * marca y la tienda, pestañas de secciones y el contenido (secciones separadas 48 px).
 * El avatar lleva el marco del rango de la tienda; el cambio de contraseña (/nueva-clave)
 * está junto a «Salir».
 * En el teléfono (< 768 px) la cabecera se compacta (logo, tienda y avatar) y las secciones
 * pasan a la barra inferior (BottomNav), que también lleva contraseña y «Salir» en «Más».
 */
export function StoreShell({
  tabs,
  storeName,
  roleLabel,
  totalXp,
  misionesPendientes = false,
  isAdmin = false,
  children,
}: {
  tabs: ClubTab[];
  storeName: string;
  roleLabel: string;
  totalXp: number;
  /** Punto amarillo sobre «Misiones» en la barra inferior. */
  misionesPendientes?: boolean;
  isAdmin?: boolean;
  children: React.ReactNode;
}) {
  const { rango } = estadoRango(totalXp);
  return (
    <div className={`gn-panel ${panelFonts} flex min-h-full flex-1 flex-col`}>
      <header className="border-b border-line bg-bg pt-[env(safe-area-inset-top)] print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 md:gap-4 md:px-6 md:py-4">
          <Link href="/panel" className="flex min-w-0 items-center gap-3 rounded-ui">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-ui bg-accent font-title text-lg font-black text-black">GN</span>
            {/* Teléfono: nombre de la tienda junto al logo. */}
            <span className="min-w-0 md:hidden">
              <span className="block font-title text-[15px] leading-tight font-extrabold uppercase">Gallo Negro</span>
              <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] leading-tight font-bold tracking-[0.08em] text-fg-2 uppercase">
                <span className="truncate">{storeName}</span>
                {rango.nivel === 5 && <MaxRankInsignia />}
              </span>
            </span>
            <span className="hidden min-w-0 md:block">
              <span className="flex items-center gap-2">
                <span className="font-title text-lg leading-none font-extrabold uppercase">Gallo Negro</span>
                <Badge>Licencias</Badge>
              </span>
              <span className="mt-1 block text-[11px] leading-tight font-bold tracking-[0.08em] text-fg-2 uppercase">Club de licenciatarios</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden min-w-0 text-right md:block">
              <p className="ui-label">{roleLabel}</p>
              <p className="mt-1 flex items-center justify-end gap-2 text-[15px] font-medium">
                <Icon name="store" className="h-4 w-4 shrink-0 text-fg-2" />
                <span className="max-w-64 truncate">{storeName}</span>
                {rango.nivel === 5 && <MaxRankInsignia />}
              </p>
            </div>
            <span>
              <RankAvatar nivel={rango.nivel} label={initials(storeName)} />
              <span className="sr-only">Rango {rango.nombre}</span>
            </span>
            <Link href="/nueva-clave" className="ui-btn-sm hidden px-3 md:inline-flex" aria-label="Cambiar contraseña">
              <Icon name="key" className="h-4 w-4" />
              <span>Cambiar contraseña</span>
            </Link>
            <form action={signOut} className="hidden md:block">
              <button className="ui-btn-sm">Salir</button>
            </form>
          </div>
        </div>
        <div className="mx-auto hidden max-w-6xl px-6 md:block">
          <ClubTabs tabs={tabs} />
        </div>
      </header>
      {/* En el teléfono deja sitio al final para que la barra inferior no tape el contenido. */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-4 pt-6 pb-[calc(112px+env(safe-area-inset-bottom))] md:px-6 md:py-12 [&>*]:min-w-0">
        {children}
      </main>
      <BottomNav misionesPendientes={misionesPendientes} isAdmin={isAdmin} />
    </div>
  );
}
