import "server-only";
import { cache } from "react";
import { getRecompensasV3 } from "./gn-server";
import { createClient } from "./supabase/server";

export type ClanProduct = {
  id: string;
  name: string;
  description: string;
  photos: string[];
  tier: "calle" | "medio" | "alto" | "premium" | "elite";
  category: "accesorios" | "vestimenta" | "herramientas" | "exclusivos";
  min_rank: number;
  price_gn: number;
  stock: number | null;
  limit_per_user: number | null;
  is_permanent: boolean;
  available_until: string | null;
  kind: "fisico" | "experiencia" | "digital";
  needs_address: boolean;
  lead_days: number | null;
  edition_id: string | null;
  is_demo: boolean;
};

export type Redemption = {
  id: string;
  product_id: string;
  product_name: string;
  price_gn: number;
  status: string;
  substitute_note: string | null;
  admin_note: string | null;
  created_at: string;
  delivered_at: string | null;
};

export type LedgerEntry = {
  id: number;
  kind: string;
  d_pending: number;
  d_available: number;
  d_held: number;
  d_debt: number;
  description: string;
  created_at: string;
};

export type Notice = { id: number; kind: string; title: string; body: string; link: string | null; read_at: string | null; created_at: string };

export type RankState = {
  level: number;
  computed_level: number;
  xp: number;
  sales_usd: number;
  requirements: { code: string; level: number; name: string; description: string; auto: boolean; met: boolean }[];
};

export type Terms = { version: number; clauses: string[]; is_draft: boolean; accepted_at: string | null };

const PRODUCT_COLUMNS =
  "id, name, description, photos, tier, category, min_rank, price_gn, stock, limit_per_user, is_permanent, available_until, kind, needs_address, lead_days, edition_id, is_demo";

/** Premios visibles para el usuario (la política de la tabla decide qué ve). */
export const getCatalog = cache(async (): Promise<ClanProduct[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("clan_products").select(PRODUCT_COLUMNS).order("min_rank").order("price_gn");
  return (data ?? []) as ClanProduct[];
});

/** Edición del mes en curso (si está publicada). */
export const getCurrentEdition = cache(async (): Promise<{ id: string; month: string; title: string } | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("clan_editions").select("id, month, title").order("month", { ascending: false }).limit(1).maybeSingle();
  return data ?? null;
});

export const getMyRedemptions = cache(async (userId: string): Promise<Redemption[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clan_redemptions")
    .select("id, product_id, product_name, price_gn, status, substitute_note, admin_note, created_at, delivered_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as Redemption[];
});

export const getMyLedger = cache(async (userId: string): Promise<LedgerEntry[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gn_ledger")
    .select("id, kind, d_pending, d_available, d_held, d_debt, description, created_at")
    .eq("user_id", userId)
    .order("id", { ascending: true })
    .limit(1000);
  return (data ?? []) as LedgerEntry[];
});

export const getMyNotices = cache(async (userId: string): Promise<Notice[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, link, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  return (data ?? []) as Notice[];
});

export const getMyGoal = cache(async (userId: string): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("clan_goals").select("product_id").eq("user_id", userId).maybeSingle();
  return data?.product_id ?? null;
});

export const getTerms = cache(async (): Promise<Terms | null> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("gn_terms_status");
  return (data as Terms | null) ?? null;
});

export const getClanPaused = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("clan_paused");
  return data === true;
});

/** Estado del rango con doble candado (una sola función en el servidor: rank_state). */
/**
 * Rango compartido (XP + ventas + identidad) para cabecera, Perfil, Ruta de rangos y «siguiente jugada».
 * null mientras el programa nuevo no esté activo para este usuario: entonces se usa el rango por XP.
 */
export const getSharedRankLevel = cache(async (): Promise<number | null> => {
  if (!(await getRecompensasV3())) return null;
  return (await getMyRank())?.level ?? null;
});

export const getMyRank = cache(async (): Promise<RankState | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_rank_state");
  if (error || !data) return null;
  const d = data as RankState;
  return { ...d, xp: Number(d.xp), sales_usd: Number(d.sales_usd) };
});
