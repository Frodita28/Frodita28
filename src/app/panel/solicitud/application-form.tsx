import { SALES_CHANNELS } from "@/lib/applications";

export type ApplicationDefaults = {
  id?: string;
  full_name?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  business_name?: string | null;
  experience?: string | null;
  sales_channels?: string[];
  social_links?: string | null;
  motivation?: string | null;
  preferred_plan_id?: string | null;
};

type Plan = { id: string; name: string; status: string };

/** Formulario de solicitud: sirve para enviar una nueva y para corregir una existente. */
export function ApplicationForm({
  action,
  plans,
  defaults = {},
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  plans: Plan[];
  defaults?: ApplicationDefaults;
  submitLabel: string;
}) {
  const channels = new Set(defaults.sales_channels ?? []);
  const isNew = !defaults.id;
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      <div className="sm:col-span-2">
        <label className="ui-field-label" htmlFor="full_name">Nombre completo</label>
        <input className="ui-input" id="full_name" name="full_name" required minLength={2} maxLength={120} autoComplete="name" defaultValue={defaults.full_name ?? ""} />
      </div>
      <div>
        <label className="ui-field-label" htmlFor="phone">Teléfono / WhatsApp</label>
        <input className="ui-input" id="phone" name="phone" type="tel" required pattern="\+?[0-9 ()\-]{6,25}" placeholder="+58 412 000 0000" autoComplete="tel" defaultValue={defaults.phone ?? ""} />
      </div>
      <div>
        <label className="ui-field-label" htmlFor="business_name">Nombre comercial (opcional)</label>
        <input className="ui-input" id="business_name" name="business_name" maxLength={120} defaultValue={defaults.business_name ?? ""} />
      </div>
      <div>
        <label className="ui-field-label" htmlFor="country">País</label>
        <input className="ui-input" id="country" name="country" required minLength={2} maxLength={60} autoComplete="country-name" defaultValue={defaults.country ?? "Venezuela"} />
      </div>
      <div>
        <label className="ui-field-label" htmlFor="city">Ciudad</label>
        <input className="ui-input" id="city" name="city" required minLength={2} maxLength={80} autoComplete="address-level2" defaultValue={defaults.city ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <label className="ui-field-label" htmlFor="experience">Tu experiencia comercial</label>
        <textarea className="ui-input min-h-28" id="experience" name="experience" required minLength={10} maxLength={2000} placeholder="¿Has vendido ropa u otros productos? ¿Dónde y desde cuándo?" defaultValue={defaults.experience ?? ""} />
      </div>
      <fieldset className="sm:col-span-2">
        <legend className="ui-field-label">Canales por los que venderías</legend>
        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SALES_CHANNELS.map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 min-h-11 rounded-ui border border-line px-3 py-2 has-[:checked]:border-accent">
              <input type="checkbox" name="sales_channels" value={value} defaultChecked={channels.has(value)} className="accent-accent" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="sm:col-span-2">
        <label className="ui-field-label" htmlFor="social_links">Redes o enlaces de venta (opcional)</label>
        <input className="ui-input" id="social_links" name="social_links" maxLength={500} placeholder="instagram.com/tu_cuenta" defaultValue={defaults.social_links ?? ""} />
      </div>
      <div>
        <label className="ui-field-label" htmlFor="preferred_plan_id">Plan de interés (opcional)</label>
        <select className="ui-input" id="preferred_plan_id" name="preferred_plan_id" defaultValue={defaults.preferred_plan_id ?? ""}>
          <option value="">Aún no lo sé</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>{p.name}{p.status !== "active" ? " (condiciones pendientes)" : ""}</option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="ui-field-label" htmlFor="motivation">¿Por qué Gallo Negro? (opcional)</label>
        <textarea className="ui-input min-h-20" id="motivation" name="motivation" maxLength={2000} defaultValue={defaults.motivation ?? ""} />
      </div>
      {isNew && (
        <label className="flex items-start gap-3 text-fg-2 sm:col-span-2">
          <input type="checkbox" name="acknowledged" value="true" required className="mt-1 accent-accent" />
          <span>
            Entiendo que enviar una solicitud no equivale a obtener una licencia, que una licencia no garantiza ganancias
            y que sus condiciones se definen por contrato.
          </span>
        </label>
      )}
      <button className="ui-btn-primary sm:col-span-2 sm:justify-self-start">{submitLabel}</button>
    </form>
  );
}
