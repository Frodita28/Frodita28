import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/redirect";

/** Verificación de correo y recuperación de contraseña (enlaces de Supabase Auth). */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const supabase = await createClient();

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  let ok = false;
  if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  } else if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }

  // Origen público configurado: detrás de un proxy, request.url puede traer el host interno.
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? `${request.headers.get("x-forwarded-proto") ?? "http"}://${request.headers.get("host")}`;
  const target = new URL(ok ? next : "/login", base);
  if (!ok) target.searchParams.set("error", "El enlace no es válido o expiró");
  return NextResponse.redirect(target);
}
