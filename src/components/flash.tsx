/** Mensaje de resultado de una acción, recibido por la URL (?ok= / ?error=). */
export function Flash({ ok, error }: { ok?: string | string[]; error?: string | string[] }) {
  const okText = Array.isArray(ok) ? ok[0] : ok;
  const errorText = Array.isArray(error) ? error[0] : error;
  if (!okText && !errorText) return null;
  return (
    <div
      role={errorText ? "alert" : "status"}
      className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
        errorText ? "border-bad/50 bg-bad/10 text-bad" : "border-ok/40 bg-ok/10 text-ok"
      }`}
    >
      {errorText ?? okText}
    </div>
  );
}
