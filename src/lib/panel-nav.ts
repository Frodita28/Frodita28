import "server-only";
import { cache } from "react";
import { todayIn } from "./missions";
import { createClient } from "./supabase/server";
import { DEFAULT_TZ } from "./time";

/**
 * ¿Quedan misiones diarias pendientes hoy? Enciende el punto amarillo de «Misiones» en la
 * barra inferior. Usa las participaciones de hoy; si aún no se abrieron (la tienda no ha
 * entrado hoy a Tu tienda ni a Misiones), basta con que existan diarias activas para ella.
 */
export const hayDiariasPendientes = cache(async (userId: string): Promise<boolean> => {
  const supabase = await createClient();
  const hoy = todayIn(DEFAULT_TZ);
  const [{ data: hoyRows }, { count }] = await Promise.all([
    supabase
      .from("mission_participations")
      .select("status, missions!inner(frequency)")
      .eq("user_id", userId)
      .eq("period_start", hoy)
      .eq("missions.frequency", "daily"),
    // La política de la tabla solo entrega las misiones activas que aplican a la tienda.
    supabase.from("missions").select("id", { count: "exact", head: true }).eq("status", "active").eq("frequency", "daily"),
  ]);
  const rows = (hoyRows ?? []) as { status: string }[];
  if (rows.length > 0) return rows.some((r) => r.status === "available" || r.status === "in_progress" || r.status === "rejected");
  return (count ?? 0) > 0;
});
