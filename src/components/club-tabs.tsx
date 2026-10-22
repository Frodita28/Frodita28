"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";

export type ClubTab = { href: string; label: string; icon: IconName };

/** Pestañas del panel; marca la sección actual (la más específica que coincide). En móvil se desplazan en horizontal. */
export function ClubTabs({ tabs }: { tabs: ClubTab[] }) {
  const pathname = usePathname();
  const active = tabs
    .filter((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const activeRef = useRef<HTMLAnchorElement>(null);

  // En móvil, deja visible la pestaña activa aunque esté al final de la fila.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  return (
    <nav aria-label="Secciones" className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
      <ul className="flex gap-1 py-2">
        {tabs.map((t) => (
          <li key={t.href}>
            <Link
              ref={active === t.href ? activeRef : undefined}
              href={t.href}
              className="ui-tab"
              aria-current={active === t.href ? "page" : undefined}
            >
              <Icon name={t.icon} className="h-4 w-4" />
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
