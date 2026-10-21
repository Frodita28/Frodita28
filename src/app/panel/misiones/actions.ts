"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { back, dbMessage } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

const MAX_FILE = 5 * 1024 * 1024;
const MIME_EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export async function submitEvidence(formData: FormData) {
  const user = await requireUser("/panel/misiones");
  const returnTo = typeof formData.get("return_to") === "string" ? String(formData.get("return_to")) : "/panel/misiones";
  const safeReturn = returnTo.startsWith("/panel/misiones") ? returnTo : "/panel/misiones";

  const parsed = z
    .object({
      participation_id: z.string().uuid(),
      url: z.string().trim().max(500).optional().default(""),
      note: z.string().trim().max(1000).optional().default(""),
    })
    .safeParse({
      participation_id: formData.get("participation_id"),
      url: formData.get("url") ?? "",
      note: formData.get("note") ?? "",
    });
  if (!parsed.success) back(safeReturn, "error", "Datos de la evidencia no válidos");

  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;
  if (!hasFile && !parsed.data.url) back(safeReturn, "error", "Adjunta un enlace o una captura como evidencia");

  const supabase = await createClient();
  let storagePath: string | null = null;
  let sha256: string | null = null;

  if (hasFile) {
    const ext = MIME_EXT[file.type];
    if (!ext) back(safeReturn, "error", "La captura debe ser PNG, JPG o WEBP");
    if (file.size > MAX_FILE) back(safeReturn, "error", "La captura no puede superar 5 MB");
    const bytes = Buffer.from(await file.arrayBuffer());
    sha256 = createHash("sha256").update(bytes).digest("hex");
    storagePath = `${user.id}/${randomUUID()}.${ext}`;
    // La subida usa la sesión del usuario: la política de Storage solo permite su carpeta.
    const { error: upErr } = await supabase.storage.from("evidences").upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });
    if (upErr) back(safeReturn, "error", "No se pudo subir la captura. Intenta de nuevo.");
  }

  const { data, error } = await supabase.rpc("submit_mission_evidence", {
    p_participation_id: parsed.data.participation_id,
    p_url: storagePath ? null : parsed.data.url,
    p_storage_path: storagePath,
    p_file_sha256: sha256,
    p_note: parsed.data.note || null,
  });
  if (error) back(safeReturn, "error", dbMessage(error));
  const res = data as { ok: boolean; error?: string };
  if (!res.ok) back(safeReturn, "error", res.error ?? "No se pudo enviar la evidencia");

  revalidatePath("/panel/misiones");
  back(safeReturn, "ok", "Evidencia enviada. Gallo Negro la revisará pronto.");
}
