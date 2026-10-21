// Crea la base de datos plantilla con el stub de Supabase, las migraciones y los datos iniciales.
// Uso: npm run test:db (requiere un Postgres accesible en TEST_DATABASE_URL).
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { ADMIN_URL, TEMPLATE_DB, urlFor } from "./helpers";

async function main() {
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(
    `select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()`,
    [TEMPLATE_DB],
  );
  await admin.query(`drop database if exists ${TEMPLATE_DB}`);
  await admin.query(`create database ${TEMPLATE_DB}`);
  await admin.end();

  const db = new Client({ connectionString: urlFor(TEMPLATE_DB) });
  await db.connect();
  const root = join(__dirname, "..", "..");
  const files = [
    join(__dirname, "supabase-stub.sql"),
    ...readdirSync(join(root, "supabase", "migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => join(root, "supabase", "migrations", f)),
    join(root, "supabase", "seed.sql"),
  ];
  for (const file of files) {
    try {
      await db.query(readFileSync(file, "utf8"));
    } catch (err) {
      console.error(`Error aplicando ${file}`);
      throw err;
    }
  }
  await db.end();
  console.log(`Plantilla ${TEMPLATE_DB} lista (${files.length} archivos aplicados).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
