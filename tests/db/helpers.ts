import { randomUUID } from "node:crypto";
import { Client } from "pg";

export const ADMIN_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:54329/postgres";
export const TEMPLATE_DB = "gn_test_template";

export function urlFor(db: string) {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${db}`;
  return u.toString();
}

export type Db = {
  /** Consulta como superusuario (equivale a migraciones / service role). */
  sql<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Consulta como un usuario autenticado de Supabase: aplica RLS y privilegios reales. */
  as<T = Record<string, unknown>>(userId: string, text: string, params?: unknown[]): Promise<T[]>;
  /** Consulta como visitante anónimo. */
  anon<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Consulta con la service role (servidor de la app o scripts de administración). */
  service<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Llama funciones internas (sin permiso para la API) con la identidad de un usuario. */
  internalAs<T = Record<string, unknown>>(userId: string, text: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
};

/** Crea una base de datos nueva a partir de la plantilla, aislada para un archivo de pruebas. */
export async function freshDb(): Promise<Db> {
  const name = `gn_test_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`create database ${name} template ${TEMPLATE_DB}`);
  await admin.end();

  const client = new Client({ connectionString: urlFor(name) });
  await client.connect();

  async function scoped<T>(role: "authenticated" | "anon" | "service_role" | null, userId: string | null, text: string, params?: unknown[]) {
    await client.query("begin");
    try {
      if (role) await client.query(`set local role ${role}`);
      await client.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify(userId ? { sub: userId, role: role ?? "authenticated" } : { role }),
      ]);
      const res = await client.query(text, params);
      await client.query("commit");
      return res.rows as T[];
    } catch (err) {
      await client.query("rollback");
      throw err;
    }
  }

  return {
    sql: async (text, params) => (await client.query(text, params)).rows,
    as: (userId, text, params) => scoped("authenticated", userId, text, params),
    anon: (text, params) => scoped("anon", null, text, params),
    service: (text, params) => scoped("service_role", null, text, params),
    internalAs: (userId, text, params) => scoped(null, userId, text, params),
    close: async () => {
      await client.end();
      const a = new Client({ connectionString: ADMIN_URL });
      await a.connect();
      await a.query(`drop database if exists ${name} with (force)`);
      await a.end();
    },
  };
}

export async function createUser(db: Db, email: string, role: "applicant" | "licensee" | "admin" = "applicant") {
  const [u] = await db.sql<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [email, { full_name: email.split("@")[0] }],
  );
  if (role === "admin") await db.sql(`update public.profiles set role = 'admin' where id = $1`, [u.id]);
  return u.id;
}

/** Crea un usuario con licencia activa en el plan indicado (por código). */
export async function createLicensee(db: Db, email: string, planCode = "PLAN_1", territory: string | null = "Caracas") {
  const id = await createUser(db, email);
  await db.sql(
    `insert into public.licenses (user_id, plan_id, territory, status, starts_at)
     select $1, id, $3, 'active', current_date - 90 from public.license_plans where code = $2`,
    [id, planCode, territory],
  );
  return id;
}

export async function productId(db: Db, sku: string) {
  const [p] = await db.sql<{ id: string }>(`select id from public.products where sku = $1`, [sku]);
  return p.id;
}

export const HOODIE = "DEMO-HOO-01";
export const SHIRT = "DEMO-CAM-01";

type Item = { sku: string; quantity: number; unitPrice?: number };

/**
 * Registra una venta manual (anterior al punto de venta) como el licenciado y devuelve su id.
 * create_sale ya no está expuesta a la API; las pruebas la usan para ventas con fecha pasada.
 */
export async function registerSale(
  db: Db,
  userId: string,
  opts: { reference?: string; soldAt?: Date; customer?: string | null; items?: Item[] } = {},
) {
  const items = await Promise.all(
    (opts.items ?? [{ sku: SHIRT, quantity: 1 }]).map(async (i) => ({
      product_id: await productId(db, i.sku),
      quantity: i.quantity,
      unit_price: i.unitPrice ?? 20,
    })),
  );
  const [row] = await db.internalAs<{ id: string }>(
    userId,
    `select public.create_sale($1, $2, 'instagram', $3, null, $4::jsonb) as id`,
    [opts.reference ?? `REF-${randomUUID().slice(0, 8)}`, opts.soldAt ?? new Date(), opts.customer ?? null, JSON.stringify(items)],
  );
  return row.id;
}

export async function verifySale(db: Db, adminId: string, saleId: string) {
  await db.as(adminId, `select public.review_sale($1, true)`, [saleId]);
}

export async function sellAndVerify(db: Db, userId: string, adminId: string, opts: Parameters<typeof registerSale>[2] = {}) {
  const id = await registerSale(db, userId, opts);
  await verifySale(db, adminId, id);
  return id;
}

export async function participation(db: Db, userId: string, code: string) {
  const [p] = await db.sql<{
    id: string;
    status: string;
    current_progress: string | null;
    target_value: string;
    xp_reward: number;
    rejection_reason: string | null;
    period_start: Date;
  }>(
    `select p.* from public.mission_participations p join public.missions m on m.id = p.mission_id
     where p.user_id = $1 and m.code = $2 order by p.period_start desc limit 1`,
    [userId, code],
  );
  return p;
}

export async function xpTotal(db: Db, userId: string) {
  const [r] = await db.sql<{ total: string }>(
    `select coalesce(sum(amount), 0)::text as total from public.xp_ledger where user_id = $1`,
    [userId],
  );
  return Number(r.total);
}

export async function refresh(db: Db, userId: string) {
  await db.as(userId, `select public.refresh_my_missions()`);
}

/** Emite prendas con QR para una tienda (como administrador) y devuelve sus códigos. */
export async function issueUnits(
  db: Db,
  adminId: string,
  storeId: string,
  opts: { sku?: string; quantity?: number; price?: number; delivery?: boolean } = {},
) {
  const product = await productId(db, opts.sku ?? SHIRT);
  const [{ batch }] = await db.as<{ batch: string }>(
    adminId,
    `select public.issue_garment_units($1, $2, $3, $4, $5, null) as batch`,
    [storeId, product, opts.quantity ?? 1, opts.price ?? 25, opts.delivery ?? true],
  );
  const rows = await db.sql<{ code: string }>(`select code from public.garment_units where batch_id = $1 order by code`, [batch]);
  return rows.map((r) => r.code);
}

/** Cierra una venta en el punto de venta como el licenciado y devuelve su id. */
export async function posCheckout(db: Db, userId: string, codes: string[], customer: string | null = null) {
  const [row] = await db.as<{ id: string }>(userId, `select public.pos_checkout($1, 'presencial', $2, null) as id`, [codes, customer]);
  return row.id;
}
