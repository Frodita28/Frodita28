"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { back, dbMessage } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(formData: FormData) {
  await requireUser();
  const parsed = z
    .object({
      full_name: z.string().trim().max(120),
      public_alias: z.union([z.literal(""), z.string().trim().min(2, "El alias debe tener al menos 2 caracteres").max(40)]),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("/panel", "error", parsed.error.issues[0].message);
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_profile", {
    p_full_name: parsed.data.full_name,
    p_public_alias: parsed.data.public_alias,
  });
  if (error) back("/panel", "error", dbMessage(error));
  revalidatePath("/panel", "layout");
  back("/panel", "ok", "Perfil actualizado");
}
