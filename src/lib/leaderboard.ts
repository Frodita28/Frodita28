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
