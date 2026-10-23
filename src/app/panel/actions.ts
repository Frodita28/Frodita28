"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TEXTOS_CLASIFICACION } from "@/content/rangos";
import { requireUser } from "@/lib/auth";
import { back, dbMessage } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

const PATH = "/panel/clasificacion";

/**
 * Cambia el nombre visible en rankings (lo único que ven otras tiendas). Usa la misma
 * función de guardado de siempre (update_my_store) y le pasa sin cambios el nombre de
 * la tienda y el responsable, que ya no se editan desde el panel.
 */
export async function updatePublicAlias(formData: FormData) {
  const user = await requireUser(PATH);
  const { nombreMin: min, nombreMax: max } = TEXTOS_CLASIFICACION;
  const parsed = z
    .union([z.literal(""), z.string().trim().min(min, `El nombre visible debe tener al menos ${min} caracteres`).max(max, `El nombre visible admite hasta ${max} caracteres`)])
    .safeParse(String(formData.get("public_alias") ?? "").trim());
  if (!parsed.success) back(PATH, "error", parsed.error.issues[0].message);
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_store", {
    p_store_name: user.storeName ?? "",
    p_full_name: user.fullName ?? "",
    p_public_alias: parsed.data,
  });
  if (error) back(PATH, "error", dbMessage(error));
  revalidatePath("/panel", "layout");
  back(PATH, "ok", parsed.data ? "Nombre visible actualizado" : `Ahora apareces como «${TEXTOS_CLASIFICACION.nombrePorDefecto}»`);
}
