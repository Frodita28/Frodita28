"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin/recompensas", label: "Resumen" },
  { href: "/admin/recompensas/catalogo", label: "Catálogo" },
  { href: "/admin/recompensas/canjes", label: "Canjes" },
  { href: "/admin/recompensas/ventas", label: "Ventas en revisión" },
  { href: "/admin/recompensas/validaciones", label: "Validaciones" },
  { href: "/admin/recompensas/misiones", label: "Misiones GN" },
  { href: "/admin/recompensas/licenciatarios", label: "Licenciatarios" },
  { href: "/admin/recompensas/configuracion", label: "Configuración" },
];

/** Subsecciones del panel de GN. */
export function RecompensasNav() {
  const path = usePathname();
  return (
    <nav aria-label="Secciones de Recompensas" className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
      {ITEMS.map((i) => {
        const active = i.href === "/admin/recompensas" ? path === i.href : path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-lg border px-3 text-sm ${active ? "border-bronze bg-bronze/15 text-ivory" : "border-smoke text-parchment hover:text-ivory"}`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
