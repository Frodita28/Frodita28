import Link from "next/link";
import { RoosterMark } from "./brand";

export function AuthCard({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex flex-col items-center gap-3 text-center">
          <RoosterMark className="h-12 w-12 text-bronze" />
          <span className="font-display text-lg uppercase tracking-[0.2em]">Gallo Negro</span>
          <span className="eyebrow">Licencias</span>
        </Link>
        <div className="card">
          <h1 className="mb-4 font-display text-lg uppercase tracking-wide">{title}</h1>
          {children}
        </div>
        {footer && <div className="mt-4 text-center text-sm text-parchment">{footer}</div>}
      </div>
    </main>
  );
}
