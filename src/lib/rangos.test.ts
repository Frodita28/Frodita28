import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { estadoRango, rangosAlcanzados, rangosConUmbral } from "./rangos";

const RANGOS = rangosConUmbral();

describe("rangosConUmbral", () => {
  it("calcula los acumulados a partir de los XP de cada rango", () => {
    assert.deepEqual(
      RANGOS.map((r) => [r.xpInicio, r.xpFin]),
      [[0, 2000], [2000, 5000], [5000, 8500], [8500, 12500], [12500, 18500]],
    );
  });
});

describe("estadoRango", () => {
  it("0 XP: nivel 1 vacío", () => {
    const e = estadoRango(0);
    assert.equal(e.rango.nivel, 1);
    assert.equal(e.progreso, 0);
    assert.equal(e.xpRestantes, 2000);
    assert.equal(e.siguiente?.slug, "vigia");
  });
  it("a mitad de un rango mide el progreso dentro del rango", () => {
    const e = estadoRango(6750);
    assert.equal(e.rango.slug, "centurion");
    assert.equal(e.xpEnRango, 1750);
    assert.equal(e.progreso, 0.5);
    assert.equal(e.xpRestantes, 1750);
  });
  it("en el umbral exacto ya está en el rango siguiente", () => {
    const e = estadoRango(2000);
    assert.equal(e.rango.nivel, 2);
    assert.equal(e.xpEnRango, 0);
  });
  it("rango máximo: anillo lleno y sin nivel 6, aunque los XP sigan subiendo", () => {
    for (const xp of [18500, 40000]) {
      const e = estadoRango(xp);
      assert.equal(e.rango.nivel, 5);
      assert.equal(e.maximoCompletado, true);
      assert.equal(e.progreso, 1);
      assert.equal(e.xpRestantes, 0);
      assert.equal(e.siguiente, null);
      assert.equal(e.totalXp, xp);
    }
    assert.equal(estadoRango(18499).maximoCompletado, false);
  });
  it("valores no válidos cuentan como 0", () => {
    assert.equal(estadoRango(-50).totalXp, 0);
    assert.equal(estadoRango(Number.NaN).rango.nivel, 1);
  });
});

describe("rangosAlcanzados", () => {
  it("devuelve los rangos cruzados", () => {
    assert.deepEqual(rangosAlcanzados(1900, 2250).map((r) => r.nivel), [2]);
    assert.deepEqual(rangosAlcanzados(0, 9000).map((r) => r.nivel), [2, 3, 4]);
    assert.deepEqual(rangosAlcanzados(100, 450), []);
    assert.deepEqual(rangosAlcanzados(5000, 100), []);
  });
});
