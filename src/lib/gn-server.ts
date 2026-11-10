import "server-only";
import { cache } from "react";
import { leerConfig, type GnConfig } from "./gn";
import { createClient } from "./supabase/server";

/** ¿Ve el usuario actual las nuevas Recompensas y Tienda Clan (interruptor o lista de prueba)? */
export const getRecompensasV3 = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("gn_v3_enabled");
  // Sin la migración aplicada (o ante un error) se muestran las pestañas actuales.
  return !error && data === true;
});

/** Configuración pública del programa (cifras de gn_config sin costos). */
export const getGnConfig = cache(async (): Promise<GnConfig> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("gn_public_config");
  return leerConfig(data as Record<string, unknown> | null);
});

export type GnResumen = {
  available: number;
  pending: number;
  held: number;
  debt: number;
  expiring_30: number;
  next_release_at: string | null;
  in_review: number;
};

/** Saldo del licenciatario (el servidor libera antes lo que ya cumplió la espera). */
export const getGnResumen = cache(async (): Promise<GnResumen> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_gn_summary");
  const d = (data ?? {}) as Partial<GnResumen>;
  return {
    available: Number(d.available ?? 0),
    pending: Number(d.pending ?? 0),
    held: Number(d.held ?? 0),
    debt: Number(d.debt ?? 0),
    expiring_30: Number(d.expiring_30 ?? 0),
    next_release_at: d.next_release_at ?? null,
    in_review: Number(d.in_review ?? 0),
  };
});
