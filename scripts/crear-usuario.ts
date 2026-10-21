// Crea una cuenta asignada (no hay registro público). Uso manual, desde tu computadora:
//
//   NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<clave> \
//   npm run crear-usuario -- --usuario tiendita --rol licensee --tienda "Tiendita"
//
// La contraseña se pide por teclado (o se lee de la variable CLAVE): nunca se escribe en el código.
// Opciones: --rol licensee|applicant|admin (por defecto licensee), --nombre, --tienda, --plan PLAN_1.
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { accountRoles, assignedPasswordSchema, usernameSchema, usernameToEmail, type AccountRole } from "../src/lib/accounts";
import { provisionAccount } from "../src/lib/provision";

async function main() {
  const { values } = parseArgs({
    options: {
      usuario: { type: "string" },
      rol: { type: "string", default: "licensee" },
      nombre: { type: "string" },
      tienda: { type: "string" },
      plan: { type: "string" },
    },
  });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Define NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno.");
  const username = usernameSchema.parse(values.usuario ?? "");
  if (!accountRoles.includes(values.rol as AccountRole)) throw new Error(`--rol debe ser uno de: ${accountRoles.join(", ")}`);

  let password = process.env.CLAVE;
  if (!password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    password = await rl.question(`Contraseña para ${username}: `);
    rl.close();
  }
  password = assignedPasswordSchema.parse(password);

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  let planId: string | null = null;
  if (values.plan) {
    const { data, error } = await admin.from("license_plans").select("id").eq("code", values.plan).single();
    if (error || !data) throw new Error(`No existe el plan ${values.plan}`);
    planId = data.id;
  }

  const result = await provisionAccount(admin, {
    username,
    password,
    role: values.rol as AccountRole,
    fullName: values.nombre ?? null,
    storeName: values.tienda ?? null,
    planId,
  });
  if ("error" in result) throw new Error(result.error);
  console.log(`Cuenta creada: usuario "${username}" (${usernameToEmail(username)}), rol ${values.rol}.`);
  if (password.length < 10) console.log("Aviso: la contraseña es corta y solo debe usarse de forma temporal. Cámbiala antes del uso real.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
