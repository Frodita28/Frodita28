import Link from "next/link";

/** Emblema simplificado del gallo Ayam Cemani. */
export function RoosterMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M11 22c0-5 2.5-8 6-9.5-.8-1.2-.6-2.6.4-3.5l.6 1.6 1-2 .8 2.2c1.6.6 2.4 1.8 2.2 3.2l1.8 1-2 .6c-.4 3.8-3 6.4-7 6.4h-3.8z"
        fill="currentColor"
      />
      <path d="M12 23.5h8" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 text-ivory">
      <RoosterMark className="h-7 w-7 text-bronze" />
      <span className="font-display text-sm tracking-[0.18em] uppercase">Gallo Negro</span>
    </Link>
  );
}
