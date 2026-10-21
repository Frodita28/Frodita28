"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { back, dbMessage } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TZ, zonedLocalToUtc } from "@/lib/time";

const CHANNELS = ["instagram", "whatsapp", "tiktok", "presencial", "evento", "otro"] as const;
const MAX_ROWS = 5;

export async function createSale(formData: FormData) {
  await requireUser("/panel/ventas");
  const base = z
    .object({
      reference: z.string().trim().min(1, "Indica la referencia de la venta").max(80),
      sold_at: z.string(),
      channel: z.enum(CHANNELS, { message: "Canal no válido" }),
      customer_ref: z.string().trim().max(120).optional().default(""),
      notes: z.string().trim().max(1000).optional().default(""),
    })
    .safeParse(Object.fromEntries(formData));
  if (!base.success) back("/panel/ventas", "error", base.error.issues[0].message);

  const soldAt = zonedLocalToUtc(base.data.sold_at, DEFAULT_TZ);
  if (!soldAt) back("/panel/ventas", "error", "Fecha de venta no válida");

  const item = z.object({
    product_id: z.string().uuid(),
    quantity: z.coerce.number().int().min(1).max(1000),
    unit_price: z.coerce.number().min(0).max(100000),
  });
  const items = [];
  for (let i = 0; i < MAX_ROWS; i++) {
    const productId = formData.get(`product_${i}`);
    if (!productId) continue;
    const parsed = item.safeParse({ product_id: productId, quantity: formData.get(`quantity_${i}`), unit_price: formData.get(`price_${i}`) });
    if (!parsed.success) back("/panel/ventas", "error", `Revisa la línea ${i + 1}: cantidad o precio no válidos`);
    items.push(parsed.data);
  }
  if (items.length === 0) back("/panel/ventas", "error", "Agrega al menos un producto");

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_sale", {
    p_reference: base.data.reference,
    p_sold_at: soldAt.toISOString(),
    p_channel: base.data.channel,
    p_customer_ref: base.data.customer_ref,
    p_notes: base.data.notes,
    p_items: items,
  });
  if (error) back("/panel/ventas", "error", dbMessage(error));
  revalidatePath("/panel/ventas");
  back("/panel/ventas", "ok", "Venta registrada. Contará para tus misiones cuando Gallo Negro la verifique.");
}

export async function cancelOwnSale(formData: FormData) {
  await requireUser("/panel/ventas");
  const id = z.string().uuid().safeParse(formData.get("sale_id"));
  if (!id.success) back("/panel/ventas", "error", "Venta no válida");
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_sale", { p_sale_id: id.data, p_reason: "Anulada por el licenciado" });
  if (error) back("/panel/ventas", "error", dbMessage(error));
  revalidatePath("/panel/ventas");
  back("/panel/ventas", "ok", "Venta anulada");
}
