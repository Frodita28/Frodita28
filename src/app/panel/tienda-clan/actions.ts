"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { dbMessage } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true; message?: string; availableAfter?: number } | { ok: false; error: string };

const redeemSchema = z.object({
  productId: z.uuid(),
  key: z.string().min(8).max(80),
  delivery: z.object({
    nombre: z.string().trim().max(120),
    telefono: z.string().trim().max(40),
    ciudad: z.string().trim().max(80),
    direccion: z.string().trim().max(300),
    notas: z.string().trim().max(500),
  }),
});

/** Canjear un premio. El servidor valida todo y retiene los GN en una sola transacción. */
export async function redeemProduct(input: z.input<typeof redeemSchema>): Promise<ActionResult> {
  await requireUser("/panel/tienda-clan");
  const parsed = redeemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisa los datos de entrega" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("clan_redeem", {
    p_product: parsed.data.productId,
    p_delivery: parsed.data.delivery,
    p_idempotency_key: parsed.data.key,
  });
  if (error) return { ok: false, error: dbMessage(error, "No se pudo completar el canje") };
  revalidatePath("/panel/tienda-clan");
  revalidatePath("/panel/recompensas");
  const r = data as { available_after?: number };
  return { ok: true, availableAfter: r.available_after };
}

export async function acceptTerms(version: number): Promise<ActionResult> {
  await requireUser("/panel/tienda-clan");
  const supabase = await createClient();
  const { error } = await supabase.rpc("gn_accept_terms", { p_version: version });
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath("/panel/tienda-clan");
  revalidatePath("/panel/recompensas");
  return { ok: true };
}

export async function setGoal(productId: string | null): Promise<ActionResult> {
  await requireUser("/panel/tienda-clan");
  if (productId !== null && !z.uuid().safeParse(productId).success) return { ok: false, error: "Premio no válido" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("clan_set_goal", { p_product: productId });
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath("/panel/tienda-clan");
  return { ok: true };
}

export async function cancelRedemption(id: string): Promise<ActionResult> {
  await requireUser("/panel/tienda-clan");
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Canje no válido" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("clan_cancel_my_redemption", { p_redemption: id });
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath("/panel/tienda-clan");
  return { ok: true, message: "Canje cancelado: tus GN volvieron a tu saldo." };
}

export async function confirmReceived(id: string): Promise<ActionResult> {
  await requireUser("/panel/tienda-clan");
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Canje no válido" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("clan_confirm_received", { p_redemption: id });
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath("/panel/tienda-clan");
  return { ok: true, message: "¡Gracias! Marcamos tu premio como entregado." };
}

export async function markNoticesRead(): Promise<ActionResult> {
  await requireUser("/panel");
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_my_notifications_read", { p_ids: null });
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath("/panel/tienda-clan");
  revalidatePath("/panel/recompensas");
  return { ok: true };
}
