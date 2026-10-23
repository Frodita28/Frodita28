import "server-only";
import { cache } from "react";
import { createClient } from "./supabase/server";

/**
 * XP total de la tienda actual: la suma de su historial de XP (vista user_xp_balances).
 * Es la misma cifra que muestran Tu tienda, Recompensas, Misiones y la clasificación.
 */
export const getMyTotalXp = cache(async (userId: string): Promise<number> => {
  const supabase = await createClient();
  const { data } = await supabase.from("user_xp_balances").select("total_xp").eq("user_id", userId).maybeSingle();
  const xp = Number(data?.total_xp ?? 0);
  return Number.isFinite(xp) ? xp : 0;
});
