"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { back, dbMessage } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

const MAX_FILE = 5 * 1024 * 1024;
const MIME_EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

type Result = { ok: true } | { ok: false; error: string };

/** Valida, sube la captura (si hay) y registra la evidencia con submit_mission_evidence. */
async function sendEvidence(userId: string, formData: FormData): Promise<Result> {
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
  if (!parsed.success) return { ok: false, error: "Datos de la evidencia no válidos" };

  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;
  if (!hasFile && !parsed.data.url) return { ok: false, error: "Adjunta un enlace o una captura como evidencia" };

  const supabase = await createClient();
  let storagePath: string | null = null;
  let sha256: string | null = null;

  if (hasFile) {
    const ext = MIME_EXT[file.type];
    if (!ext) return { ok: false, error: "La captura debe ser PNG, JPG o WEBP" };
    if (file.size > MAX_FILE) return { ok: false, error: "La captura no puede superar 5 MB" };
    const bytes = Buffer.from(await file.arrayBuffer());
    sha256 = createHash("sha256").update(bytes).digest("hex");
    storagePath = `${userId}/${randomUUID()}.${ext}`;
    // La subida usa la sesión del usuario: la política de Storage solo permite su carpeta.
    const { error: upErr } = await supabase.storage.from("evidences").upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });
    if (upErr) return { ok: false, error: "No se pudo subir la captura. Intenta de nuevo." };
  }

  const { data, error } = await supabase.rpc("submit_mission_evidence", {
    p_participation_id: parsed.data.participation_id,
    p_url: storagePath ? null : parsed.data.url,
    p_storage_path: storagePath,
    p_file_sha256: sha256,
    p_note: parsed.data.note || null,
  });
  if (error) return { ok: false, error: dbMessage(error) };
  const res = data as { ok: boolean; error?: string };
  if (!res.ok) return { ok: false, error: res.error ?? "No se pudo enviar la evidencia" };

  revalidatePath("/panel/misiones");
  revalidatePath("/panel");
  return { ok: true };
}

/** Formulario de /panel/misiones: vuelve a la página con el resultado en la URL. */
export async function submitEvidence(formData: FormData) {
  const user = await requireUser("/panel/misiones");
  const returnTo = typeof formData.get("return_to") === "string" ? String(formData.get("return_to")) : "/panel/misiones";
  const safeReturn = returnTo.startsWith("/panel/misiones") ? returnTo : "/panel/misiones";
  const r = await sendEvidence(user.id, formData);
  if (!r.ok) back(safeReturn, "error", r.error);
  back(safeReturn, "ok", "Evidencia enviada. Gallo Negro la revisará pronto.");
}

/** Mismo envío desde Tu tienda (panel inferior): devuelve el resultado para mostrarlo sin recargar. */
export async function submitEvidenceInline(formData: FormData): Promise<Result> {
  const user = await requireUser("/panel");
  return sendEvidence(user.id, formData);
}
