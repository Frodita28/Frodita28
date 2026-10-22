"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";

export type ClubTab = { href: string; label: string; icon: IconName };

/** Pestañas del panel; marca la sección actual (la más específica que coincide). */
export function ClubTabs({ tabs }: { tabs: ClubTab[] }) {
  const pathname = usePathname();
  const active = tabs
    .filter((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav aria-label="Secciones" className="-mx-4 overflow-x-auto px-4 pb-1">
      <ul className="flex gap-2 border-b border-ash pb-4">
        {tabs.map((t) => (
          <li key={t.href}>
            <Link href={t.href} className="tab" aria-current={active === t.href ? "page" : undefined}>
              <Icon name={t.icon} className="h-4 w-4 sm:h-5 sm:w-5" />
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
