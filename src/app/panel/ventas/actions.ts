"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { normalizeGarmentCode, SALE_CHANNELS, type PosItem } from "@/lib/pos";
import { back, dbMessage } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export type LookupResult = { ok: true; item: PosItem } | { ok: false; error: string };

/** Busca una prenda de la propia tienda por su QR (la base de datos valida tienda y estado). */
export async function lookupGarment(raw: string): Promise<LookupResult> {
  await requireUser("/panel/ventas");
  const code = normalizeGarmentCode(raw);
  if (!code) return { ok: false, error: "Ese código no es un QR de Gallo Negro" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pos_lookup", { p_code: code });
  if (error || !data) return { ok: false, error: dbMessage(error, "No se pudo leer la prenda") };
  const r = data as { code: string; name: string; sku: string; category: string; unit_price: number | string };
  return { ok: true, item: { code: r.code, name: r.name, sku: r.sku, category: r.category, unitPrice: Number(r.unit_price) } };
}

export type CheckoutState = { ok: boolean; message: string; at: number } | null;

const checkoutSchema = z.object({
  codes: z.array(z.string()).min(1, "Escanea al menos una prenda").max(50, "Máximo 50 prendas por venta"),
  channel: z.enum(SALE_CHANNELS.map(([v]) => v) as [string, ...string[]], { message: "Canal no válido" }),
  customer_ref: z.string().trim().max(120),
  notes: z.string().trim().max(1000),
});

/** Cierra la venta del punto de venta: las prendas salen del stock y la venta queda registrada. */
export async function checkoutSale(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  await requireUser("/panel/ventas");
  let codes: unknown;
  try {
    codes = JSON.parse(String(formData.get("codes") ?? "[]"));
  } catch {
    codes = [];
  }
  const parsed = checkoutSchema.safeParse({
    codes,
    channel: formData.get("channel"),
    customer_ref: formData.get("customer_ref") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message, at: Date.now() };

  const supabase = await createClient();
  const { error } = await supabase.rpc("pos_checkout", {
    p_codes: parsed.data.codes,
    p_channel: parsed.data.channel,
    p_customer_ref: parsed.data.customer_ref,
    p_notes: parsed.data.notes,
  });
  if (error) return { ok: false, message: dbMessage(error), at: Date.now() };
  revalidatePath("/panel/ventas");
  revalidatePath("/panel");
  const n = parsed.data.codes.length;
  return { ok: true, message: `Venta registrada: ${n} ${n === 1 ? "prenda salió" : "prendas salieron"} de tu stock.`, at: Date.now() };
}

export async function cancelOwnSale(formData: FormData) {
  await requireUser("/panel/ventas");
  const id = z.string().uuid().safeParse(formData.get("sale_id"));
  if (!id.success) back("/panel/ventas", "error", "Venta no válida");
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_sale", { p_sale_id: id.data, p_reason: "Anulada por el licenciado (error de caja)" });
  if (error) back("/panel/ventas", "error", dbMessage(error));
  revalidatePath("/panel/ventas");
  revalidatePath("/panel");
  back("/panel/ventas", "ok", "Venta anulada. Las prendas volvieron a tu stock.");
}
