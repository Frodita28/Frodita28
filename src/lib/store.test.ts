import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { monthLabel, niceMax, parseStoreSummary, puntosDiarios } from "./store";

describe("parseStoreSummary", () => {
  it("deja en cero lo que falte, sin inventar datos", () => {
    const s = parseStoreSummary(null);
    assert.equal(s.revenue, 0);
    assert.equal(s.investment, 0);
    assert.equal(s.level, null);
    assert.deepEqual(s.monthly, []);
  });

  it("convierte numéricos de Postgres (texto) a números", () => {
    const s = parseStoreSummary({
      total_xp: 120,
      revenue: "105.50",
      stock_balance: -2,
      level: { name: "Aspirante", position: 1, minimum_xp: 0 },
      monthly: [{ month: "2026-10", revenue: "105.50", units: 4 }],
    });
    assert.equal(s.revenue, 105.5);
    assert.equal(s.stockBalance, -2);
    assert.equal(s.level?.name, "Aspirante");
    assert.deepEqual(s.monthly, [{ month: "2026-10", revenue: 105.5, units: 4 }]);
  });
});

describe("utilidades de la gráfica", () => {
  it("redondea el máximo del eje", () => {
    assert.equal(niceMax(0), 0);
    assert.equal(niceMax(105), 200);
    assert.equal(niceMax(240), 250);
    assert.equal(niceMax(7), 10);
  });

  it("nombra los meses en español", () => {
    assert.equal(monthLabel("2026-10"), "oct");
    assert.equal(monthLabel("2026-01", true), "enero de 2026");
  });
});

describe("puntosDiarios", () => {
  it("da un punto por día hasta hoy y deja en 0 los días sin ventas", () => {
    const p = puntosDiarios(new Map([["2026-10-28", { revenue: 50, units: 2 }]]), "2026-10-30", 30);
    assert.equal(p.length, 30);
    assert.equal(p[0].key, "2026-10-01");
    assert.equal(p[29].key, "2026-10-30");
    assert.deepEqual([p[27].revenue, p[27].units], [50, 2]);
    assert.equal(p[29].revenue, 0);
    assert.equal(p[27].largo, "28 de octubre");
  });

  it("cruza meses y años", () => {
    const p = puntosDiarios(new Map(), "2026-01-02", 3);
    assert.deepEqual(p.map((x) => x.key), ["2025-12-31", "2026-01-01", "2026-01-02"]);
  });
});
