"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { back, dbMessage } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

const PATH = "/admin/tiendas";

export async function recordStockMovement(formData: FormData) {
  await requireAdmin();
  const parsed = z
    .object({
      licensee_id: z.string().uuid("Elige una tienda"),
      product_id: z.string().uuid("Elige un producto"),
      kind: z.enum(["delivery", "return", "adjustment"]),
      quantity: z.coerce.number().int("La cantidad debe ser un número entero").refine((n) => n !== 0, "La cantidad no puede ser 0"),
      note: z.string().trim().max(500).optional().default(""),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(PATH, "error", parsed.error.issues[0].message);
  const { kind, quantity } = parsed.data;
  // Las entregas suman y las devoluciones restan; el ajuste conserva el signo indicado.
  const signed = kind === "delivery" ? Math.abs(quantity) : kind === "return" ? -Math.abs(quantity) : quantity;
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_stock_movement", {
    p_licensee: parsed.data.licensee_id,
    p_product: parsed.data.product_id,
    p_kind: kind,
    p_quantity: signed,
    p_note: parsed.data.note || null,
  });
  if (error) back(PATH, "error", dbMessage(error));
  revalidatePath(PATH);
  back(PATH, "ok", "Movimiento de inventario registrado");
}

export async function recordInvestment(formData: FormData) {
  await requireAdmin();
  const parsed = z
    .object({
      licensee_id: z.string().uuid("Elige una tienda"),
      concept: z.enum(["license", "merchandise", "other", "correction"]),
      amount: z.coerce.number().refine((n) => Number.isFinite(n) && n !== 0, "Indica un monto distinto de 0"),
      invested_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Indica la fecha"),
      note: z.string().trim().max(500).optional().default(""),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(PATH, "error", parsed.error.issues[0].message);
  const { concept, amount } = parsed.data;
  // Solo las correcciones pueden restar.
  const signed = concept === "correction" ? amount : Math.abs(amount);
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_store_investment", {
    p_licensee: parsed.data.licensee_id,
    p_concept: concept,
    p_amount: signed,
    p_invested_at: parsed.data.invested_at,
    p_note: parsed.data.note || null,
  });
  if (error) back(PATH, "error", dbMessage(error));
  revalidatePath(PATH);
  back(PATH, "ok", "Inversión registrada");
}
