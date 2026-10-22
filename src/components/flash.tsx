import { Icon } from "./icons";

/** Mensaje de resultado de una acción, recibido por la URL (?ok= / ?error=). */
export function Flash({ ok, error, variant = "default" }: { ok?: string | string[]; error?: string | string[]; variant?: "default" | "panel" }) {
  const okText = Array.isArray(ok) ? ok[0] : ok;
  const errorText = Array.isArray(error) ? error[0] : error;
  if (!okText && !errorText) return null;
  if (variant === "panel") {
    // Panel de licenciatarios: el rojo solo marca errores; la confirmación va en neutro.
    return (
      <div
        role={errorText ? "alert" : "status"}
        className={`flex items-start gap-3 rounded-ui border border-line bg-surface p-4 text-[15px] ${errorText ? "border-l-4 border-l-brand-red" : ""}`}
      >
        <Icon name={errorText ? "alert" : "check"} className={`mt-0.5 h-5 w-5 shrink-0 ${errorText ? "text-brand-red" : "text-fg-2"}`} />
        <span>{errorText ?? okText}</span>
      </div>
    );
  }
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
