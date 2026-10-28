/** Iconos lineales del panel de las tiendas (SVG en línea, sin dependencias; trazo de 1.75 px). */
const PATHS = {
  store: "M3 9l1.5-5h15L21 9M3 9h18M3 9v1a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0V9M5 13v7h14v-7M10 20v-4h4v4",
  podium: "M9 21V9h6v12M3 21v-7h6M15 21v-9h6v9M2 21h20M12 3l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z",
  gift: "M4 11h16v10H4zM3 7h18v4H3zM12 7v14M12 7S10.5 3 8 3a2 2 0 000 4h4zm0 0s1.5-4 4-4a2 2 0 010 4h-4z",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2zM16 16h2v2h-2z",
  key: "M15 7a4 4 0 11-3.9 4.9L4 19v2h3v-2h2v-2h2l1.1-1.1A4 4 0 0115 7zM16 8h.01",
  shield: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z",
  trophy: "M8 4h8v5a4 4 0 01-8 0zM8 6H4v1a4 4 0 004 4M16 6h4v1a4 4 0 01-4 4M12 13v4M8 21h8M10 17h4v4h-4z",
  flame: "M12 3s5 4.5 5 10a5 5 0 01-10 0c0-2.5 1.5-4 1.5-4S9 12 11 12c0-4 1-9 1-9z",
  users: "M9 11a3 3 0 100-6 3 3 0 000 6zM3 20a6 6 0 0112 0M16 11a3 3 0 100-6M18 20a6 6 0 00-3-5.2",
  gear: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z",
  check: "M5 12l5 5L20 7",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",
  document: "M14 3H6v18h12V7zM14 3v4h4M9 12h6M9 16h6M9 8h2",
  swap: "M4 8h13l-3-3M20 16H7l3 3",
  recycle: "M4 12a8 8 0 0113.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 01-13.7 5.7L4 15.5M4 20v-4.5h4.5",
  percent: "M19 5L5 19M7 9a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z",
  bolt: "M13 3L5 14h6l-1 7 8-11h-6z",
  bag: "M5 8h14l-1 13H6zM9 8V6a3 3 0 016 0v2",
  box: "M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10",
  arrowUp: "M12 20V5M6 11l6-6 6 6",
  chevronDown: "M6 9l6 6 6-6",
  alert: "M12 3l10 18H2zM12 10v4M12 17.5h.01",
  lock: "M6 11h12v10H6zM8 11V8a4 4 0 018 0v3M12 15v2",
  map: "M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14",
  calendar: "M4 6h16v15H4zM4 10h16M8 3v4M16 3v4",
  crown: "M4 18h16M5 18L3 7l5 4 4-7 4 7 5-4-2 11",
  arrowDown: "M12 4v15M6 13l6 6 6-6",
  target: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 12h.01",
  close: "M6 6l12 12M18 6L6 18",
  more: "M4 6h16M4 12h16M4 18h16",
  logout: "M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10",
  chevronRight: "M9 6l6 6-6 6",
  upload: "M12 16V4M7 9l5-5 5 5M4 16v4h16v-4",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
