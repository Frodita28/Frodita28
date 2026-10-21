// Une todas las migraciones y los datos iniciales en un solo SQL para instalar en un proyecto NUEVO de Supabase.
// Uso: node scripts/sql-unico.mjs > instalar.sql
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const migrations = readdirSync(join(root, "supabase", "migrations")).filter((f) => f.endsWith(".sql")).sort();
const section = (rel) => `-- ===== ${rel} =====\n${readFileSync(join(root, rel), "utf8").trimEnd()}\n\n`;

let out = `-- Instalación completa de Gallo Negro Licencias en un proyecto NUEVO de Supabase.
-- Generado con \`node scripts/sql-unico.mjs\`. Ejecutar una sola vez: si algo falla, no se aplica nada.
begin;

-- Permisos base que Supabase concede por defecto (por si el proyecto se creó sin exponer
-- tablas nuevas automáticamente). RLS y los revoke de las migraciones siguen siendo la barrera real.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

`;
for (const f of migrations) out += section(`supabase/migrations/${f}`);
out += section("supabase/seed.sql");
out += `
-- Registra las migraciones como aplicadas para que \`supabase db push\` no las repita más adelante.
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
`;
for (const f of migrations) {
  const [version, ...name] = f.replace(/\.sql$/, "").split("_");
  out += `insert into supabase_migrations.schema_migrations (version, name) values ('${version}', '${name.join("_")}') on conflict do nothing;\n`;
}
out += "\ncommit;\n";
process.stdout.write(out);
