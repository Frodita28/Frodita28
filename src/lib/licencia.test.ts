import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { licencia } from "../content/licencia";
import { costoMercancia, formatPct, formatUsd, recuperacion, simular } from "./licencia";

const plan = (id: string) => licencia.planes.find((p) => p.id === id)!;

describe("recuperacion", () => {
  it("coincide con la tabla de la licencia (inversión / PVP)", () => {
    assert.deepEqual(plan("socio-fundador").escalones.map((e) => formatPct(recuperacion(e))), ["60%"]);
    assert.deepEqual(plan("emprendedor-comercial").escalones.map((e) => formatPct(recuperacion(e))), ["70%", "65%", "60%"]);
  });

  it("el costo PVP × (1 − margen) cuadra con la inversión de cada escalón", () => {
    for (const p of licencia.planes) {
      for (const e of p.escalones) assert.ok(Math.abs(costoMercancia(e) - e.inversionUsd) < 1, `${p.id} ${e.id}`);
    }
  });
});

describe("simular", () => {
  const socio = plan("socio-fundador").escalones[0];

  it("no ha recuperado antes del punto de recuperación", () => {
    const s = simular(socio, 30);
    assert.equal(s.ventasUsd, 750);
    assert.equal(s.margenUsd, 300);
    assert.equal(s.recuperado, false);
    assert.equal(s.faltaPct, 30);
    assert.equal(s.avance, 50);
  });

  it("llega al 100% en el punto de recuperación y no pasa de ahí", () => {
    assert.equal(simular(socio, 60).recuperado, true);
    assert.equal(simular(socio, 60).avance, 100);
    assert.equal(simular(socio, 100).recuperadoUsd, 1500);
  });

  it("limita el porcentaje entre 0 y 100", () => {
    assert.equal(simular(socio, -5).ventasUsd, 0);
    assert.equal(simular(socio, 150).ventasUsd, 2500);
  });
});

describe("formatUsd", () => {
  it("usa el formato del contrato", () => assert.equal(formatUsd(1500), "$1,500 USD"));
});
