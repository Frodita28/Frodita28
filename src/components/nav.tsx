import Link from "next/link";
import { Logo } from "./brand";
import { signOut } from "@/app/login/actions";

type Item = { href: string; label: string };

export function AppShell({
  items,
  userLabel,
  roleLabel,
  children,
}: {
  items: Item[];
  userLabel: string;
  roleLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b print:hidden border-ash bg-obsidian/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Logo href="/panel" />
          <div className="flex items-center gap-3 text-xs">
            <span className="hidden text-parchment sm:inline">
              {userLabel} · <span className="text-bronze">{roleLabel}</span>
            </span>
            <form action={signOut}>
              <button className="btn-ghost px-3 py-1.5 text-xs">Salir</button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 pb-2 text-sm" aria-label="Secciones">
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-linen hover:bg-ash hover:text-ivory"
            >
              {i.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}

export function PageTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6">
      {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
      <h1 className="font-display text-2xl uppercase tracking-wide sm:text-3xl">{title}</h1>
      {children && <div className="mt-2 max-w-3xl text-sm text-linen">{children}</div>}
    </div>
  );
}
