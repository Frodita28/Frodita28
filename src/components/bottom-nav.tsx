"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { TEXTOS_NAV as T } from "@/content/rangos";
import { BottomSheet } from "./bottom-sheet";
import { Icon, type IconName } from "./icons";

type Item = { href: string; label: string; icon: IconName };

// Ventas (/panel/ventas) vive dentro de Perfil: al estar en ella se marca «Perfil».
const PRINCIPALES: Item[] = [
  { href: "/panel", label: T.perfil, icon: "idCard" },
  { href: "/panel/recompensas", label: T.recompensas, icon: "gift" },
  { href: "/panel/tienda-clan", label: T.tiendaClan, icon: "bag" },
  { href: "/panel/misiones", label: T.misiones, icon: "flag" },
];

/** Sección activa: la ruta más específica que coincide. */
function activa(pathname: string, hrefs: string[]) {
  return hrefs.filter((h) => pathname === h || pathname.startsWith(`${h}/`)).sort((a, b) => b.length - a.length)[0];
}

/**
 * Barra inferior fija del teléfono (< 768 px): Perfil · Recompensas · Tienda Clan ·
 * Misiones · Más. En «Más»: Ruta de rangos, contraseña, administración, Salir y, al final, Licencia. «Más» abre un panel inferior con el resto de secciones y la sesión.
 */
export function BottomNav({ misionesPendientes, isAdmin }: { misionesPendientes: boolean; isAdmin: boolean }) {
  const pathname = usePathname();
  const [mas, setMas] = useState(false);
  const extras: Item[] = [
    { href: "/panel/rangos", label: T.rutaRangos, icon: "podium" },
    { href: "/nueva-clave", label: T.contrasena, icon: "key" },
    ...(isAdmin ? [{ href: "/admin", label: T.administracion, icon: "gear" } as const] : []),
  ];
  // Licencia va al final del panel «Más», debajo de «Salir».
  const licencia: Item = { href: "/panel/licencia", label: T.licencia, icon: "document" };
  const current = activa(pathname, [...PRINCIPALES, ...extras, licencia].map((i) => i.href));
  const enMas = [...extras, licencia].some((i) => i.href === current);

  return (
    <>
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {PRINCIPALES.map((i) => (
            <NavItem key={i.href} item={i} active={current === i.href} dot={i.href === "/panel/misiones" && misionesPendientes} />
          ))}
          <li>
            <button
              type="button"
              onClick={() => setMas(true)}
              aria-haspopup="dialog"
              aria-expanded={mas}
              className={`flex min-h-16 w-full flex-col items-center justify-center gap-1.5 ${enMas ? "text-fg" : "text-fg-2"}`}
            >
              <Icon name="more" className="h-5 w-5" />
              <span className="text-[11px] leading-none font-bold tracking-[0.04em] uppercase">{T.mas}</span>
            </button>
          </li>
        </ul>
      </nav>

      <BottomSheet open={mas} onClose={() => setMas(false)} title={T.masTitulo}>
        <ul className="-mx-2 flex flex-col">
          {extras.map((i) => (
            <li key={i.href}>
              <Link
                href={i.href}
                onClick={() => setMas(false)}
                aria-current={current === i.href ? "page" : undefined}
                className="flex min-h-12 items-center gap-3 rounded-ui px-2 text-[16px] hover:bg-surface-2 aria-[current=page]:font-bold"
              >
                <Icon name={i.icon} className="h-5 w-5 shrink-0" />
                <span className="flex-1">{i.label}</span>
                <Icon name="chevronRight" className="h-4 w-4 text-fg-3" />
              </Link>
            </li>
          ))}
          <li className="mt-2 border-t border-line pt-2">
            <form action={signOut}>
              <button className="flex min-h-12 w-full items-center gap-3 rounded-ui px-2 text-left text-[16px] hover:bg-surface-2">
                <Icon name="logout" className="h-5 w-5 shrink-0" />
                {T.salir}
              </button>
            </form>
          </li>
          <li className="mt-2 border-t border-line pt-2">
            <Link
              href={licencia.href}
              onClick={() => setMas(false)}
              aria-current={current === licencia.href ? "page" : undefined}
              className="flex min-h-12 items-center gap-3 rounded-ui px-2 text-[16px] hover:bg-surface-2 aria-[current=page]:font-bold"
            >
              <Icon name={licencia.icon} className="h-5 w-5 shrink-0 text-gold" />
              <span className="flex-1">{licencia.label}</span>
              <Icon name="chevronRight" className="h-4 w-4 text-fg-3" />
            </Link>
          </li>
        </ul>
      </BottomSheet>
    </>
  );
}

function NavItem({ item, active, dot }: { item: Item; active: boolean; dot?: boolean }) {
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-16 flex-col items-center justify-center gap-1.5 ${active ? "text-gold" : "text-fg-2"}`}
      >
        <span className="relative">
          <Icon name={item.icon} className="h-5 w-5" />
          {dot && <span className="absolute -top-0.5 -right-1 h-2 w-2 rounded-full bg-accent" aria-hidden />}
        </span>
        {/* Si no cabe en una línea (p. ej. «Tienda Clan» a 360 px) pasa a dos, sin cortar el texto. */}
        <span className="max-w-full px-0.5 text-center text-[11px] leading-[1.1] font-bold tracking-[0.04em] uppercase">{item.label}</span>
        {dot && <span className="sr-only">{T.misionesPendientes}</span>}
      </Link>
    </li>
  );
}
