// Tabla de clasificación tal como la devuelve public.store_leaderboard.

export type BoardRow = { place: number; alias: string; totalXp: number; isMe: boolean };

export function parseBoard(raw: unknown): BoardRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r: Record<string, unknown>) => ({
    place: Number(r.place) || 0,
    alias: String(r.alias ?? ""),
    totalXp: Number(r.total_xp) || 0,
    isMe: r.is_me === true,
  }));
}

/** XP que faltan para alcanzar la posición de arriba (null si ya es la primera). */
export function xpToNextPlace(board: BoardRow[]): { gap: number; place: number } | null {
  const me = board.find((r) => r.isMe);
  if (!me || me.place <= 1) return null;
  // Con rank(), las tiendas por delante son place - 1; si faltan, la lista está recortada.
  if (board.filter((r) => r.place < me.place).length !== me.place - 1) return null;
  const above = board.filter((r) => r.totalXp > me.totalXp).sort((a, b) => a.totalXp - b.totalXp)[0];
  return above ? { gap: above.totalXp - me.totalXp, place: above.place } : null;
}

export type Rivalidad =
  | { tipo: "rival"; alias: string; gap: number }
  | { tipo: "lider"; ventaja: number }
  | { tipo: "solo" }
  | null;

/**
 * Tienda inmediatamente por encima y XP para superarla, o ventaja sobre el segundo si la
 * tienda va primera. Superar exige un XP más que la tienda de arriba.
 */
export function rivalidad(board: BoardRow[]): Rivalidad {
  const me = board.find((r) => r.isMe);
  if (!me) return null;
  const others = board.filter((r) => !r.isMe);
  if (others.length === 0) return { tipo: "solo" };
  // Lista recortada (Top N + la tienda): falta la de justo arriba.
  if (board.filter((r) => r.place < me.place).length !== me.place - 1) return null;
  const above = others.filter((r) => r.totalXp >= me.totalXp && r.place <= me.place).sort((a, b) => a.totalXp - b.totalXp || b.place - a.place)[0];
  if (above && (above.place < me.place || above.totalXp === me.totalXp)) {
    return { tipo: "rival", alias: above.alias, gap: above.totalXp - me.totalXp + 1 };
  }
  const second = others.sort((a, b) => b.totalXp - a.totalXp)[0];
  return { tipo: "lider", ventaja: me.totalXp - second.totalXp };
}
