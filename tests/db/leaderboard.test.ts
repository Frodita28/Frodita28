import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createLicensee, createUser, freshDb, type Db } from "./helpers";

let db: Db;
let admin: string;

type Row = { place: string; alias: string; total_xp: string; is_me: boolean };

const board = (asUser: string, limit = 50) =>
  db.as<Row>(asUser, `select * from public.store_leaderboard($1)`, [limit]);

const adjust = (user: string, amount: number, key: string) =>
  db.as(admin, `select public.admin_adjust_xp($1, $2, 'Ajuste de prueba', $3, null)`, [user, amount, key]);

before(async () => {
  db = await freshDb();
  admin = await createUser(db, "admin@gallonegro.test", "admin");
});
after(() => db.close());

describe("Tabla de clasificación", () => {
  it("ordena tiendas con licencia activa por XP y muestra solo alias y XP", async () => {
    const ana = await createLicensee(db, "ana@test.com");
    const leo = await createLicensee(db, "leo@test.com");
    const sin = await createLicensee(db, "sin@test.com");
    await db.as(ana, `select public.update_my_store('Urbano Ana', 'Ana Pérez', 'AnaGN')`);
    await db.as(leo, `select public.update_my_store('Leo Store', null, 'LeoGN')`);
    await adjust(ana, 300, "lb-ana");
    await adjust(leo, 500, "lb-leo");
    await createUser(db, "aspirante@test.com"); // sin licencia: no aparece

    const rows = await board(ana);
    assert.deepEqual(Object.keys(rows[0]).sort(), ["alias", "is_me", "place", "total_xp"]);
    assert.deepEqual(
      rows.map((r) => [Number(r.place), r.alias, Number(r.total_xp), r.is_me]),
      [
        [1, "LeoGN", 500, false],
        [2, "AnaGN", 300, true],
        [3, "Tienda Gallo Negro", 0, false],
      ],
    );
    // El nombre de la tienda no se comparte si no es el alias visible.
    assert.ok(!rows.some((r) => r.alias === "Urbano Ana" || r.alias === "Leo Store"));
    assert.equal((await board(sin)).find((r) => r.is_me)?.alias, "Tienda Gallo Negro");
  });

  it("con límite incluye siempre la posición propia", async () => {
    const ultima = (await db.sql<{ id: string }>(`select id from public.profiles where public_alias is null and role = 'licensee'`))[0].id;
    const rows = await board(ultima, 1);
    assert.deepEqual(rows.map((r) => Number(r.place)), [1, 3]);
    assert.equal(rows[1].is_me, true);
  });

  it("los visitantes anónimos no pueden consultarla", async () => {
    await assert.rejects(db.anon(`select * from public.store_leaderboard(10)`), /permission denied/);
  });
});
