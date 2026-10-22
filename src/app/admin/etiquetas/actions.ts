"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { back, dbMessage } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

const PATH = "/admin/etiquetas";

/** Emite prendas con QR para una tienda y abre sus etiquetas para imprimir. */
export async function issueGarments(formData: FormData) {
  await requireAdmin();
  const parsed = z
    .object({
      licensee_id: z.string().uuid("Elige una tienda"),
      product_id: z.string().uuid("Elige un producto"),
      quantity: z.coerce.number().int("La cantidad debe ser un número entero").min(1, "Emite al menos 1 prenda").max(500, "Máximo 500 prendas por lote"),
      unit_price: z.coerce.number({ message: "Indica el precio de venta" }).min(0, "El precio no puede ser negativo").max(100000),
      mode: z.enum(["delivery", "existing"]),
      note: z.string().trim().max(500).optional().default(""),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(PATH, "error", parsed.error.issues[0].message);
  if (String(formData.get("unit_price") ?? "").trim() === "") back(PATH, "error", "Indica el precio de venta");

  const supabase = await createClient();
  const { data: batch, error } = await supabase.rpc("issue_garment_units", {
    p_licensee: parsed.data.licensee_id,
    p_product: parsed.data.product_id,
    p_quantity: parsed.data.quantity,
    p_unit_price: parsed.data.unit_price,
    p_register_delivery: parsed.data.mode === "delivery",
    p_note: parsed.data.note || null,
  });
  if (error || !batch) back(PATH, "error", dbMessage(error));
  revalidatePath(PATH);
  revalidatePath("/admin/tiendas");
  redirect(`${PATH}?lote=${batch}&ok=${encodeURIComponent(`${parsed.data.quantity} etiquetas listas para imprimir`)}`);
}

/** Registra la devolución a Gallo Negro de una prenda con QR que sigue en la tienda. */
export async function returnGarment(formData: FormData) {
  await requireAdmin();
  const parsed = z
    .object({ code: z.string().trim().min(1, "Indica el código QR"), note: z.string().trim().max(500).optional().default("") })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(PATH, "error", parsed.error.issues[0].message);
  const supabase = await createClient();
  const { error } = await supabase.rpc("return_garment_unit", { p_code: parsed.data.code, p_note: parsed.data.note || null });
  if (error) back(PATH, "error", dbMessage(error));
  revalidatePath(PATH);
  revalidatePath("/admin/tiendas");
  back(PATH, "ok", "Prenda devuelta: salió del stock de la tienda y su QR ya no se puede vender");
}
