import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  diaSemana,
  diasDeRacha,
  estadoVisible,
  nuevasCompletadas,
  ordenarMisiones,
  resumenMisiones,
  siguienteJugada,
  tipoDeMision,
  ultimos7Dias,
  type MisionHoy,
} from "./misiones-hoy";
import { estadoRango } from "./rangos";

const mision = (over: Partial<MisionHoy>): MisionHoy => ({
  id: over.code ?? "x",
  code: "D01",
  title: "Misión",
  frequency: "daily",
  xp: 50,
  status: "available",
  progress: 0,
  target: 1,
  unit: "ventas",
  validation: "auto",
  metric: "verified_sales_count",
  instructions: "",
  canSend: false,
  ...over,
});

describe("misiones de Tu tienda", () => {
  it("traduce los estados de la base a los estados visibles", () => {
    assert.equal(estadoVisible({ status: "available" }), "pendiente");
    assert.equal(estadoVisible({ status: "in_progress" }), "pendiente");
    assert.equal(estadoVisible({ status: "rejected" }), "pendiente");
    assert.equal(estadoVisible({ status: "pending_review" }), "revision");
    assert.equal(estadoVisible({ status: "completed" }), "completada");
    assert.equal(estadoVisible({ status: "expired" }), "no_disponible");
    assert.equal(estadoVisible({ status: null }), "no_disponible");
  });

  it("distingue misiones de ventas, de evidencia y compuestas", () => {
    assert.equal(tipoDeMision({ validation: "manual", metric: "manual_approval" }), "evidencia");
    assert.equal(tipoDeMision({ validation: "auto", metric: "verified_units" }), "ventas");
    assert.equal(tipoDeMision({ validation: "auto", metric: "daily_missions_completed" }), "automatica");
  });

  it("ordena pendientes por XP, luego en revisión y al final completadas", () => {
    const ms = [
      mision({ code: "A", xp: 30, status: "completed" }),
      mision({ code: "B", xp: 20, status: "available" }),
      mision({ code: "C", xp: 90, status: "pending_review" }),
      mision({ code: "D", xp: 80, status: "in_progress" }),
    ];
    assert.deepEqual(ordenarMisiones(ms).map((m) => m.code), ["D", "B", "C", "A"]);
  });

  it("resume completadas y XP del período", () => {
    const r = resumenMisiones([
      mision({ code: "A", xp: 30, status: "completed" }),
      mision({ code: "B", xp: 20, status: "available" }),
      mision({ code: "C", xp: 90, status: "pending_review" }),
      mision({ code: "E", xp: 500, status: "expired" }),
    ]);
    assert.deepEqual(r, { completadas: 1, total: 3, xpGanado: 30, xpPosible: 110 });
  });

  it("calcula la racha sin romperla si hoy aún no hay misiones", () => {
    assert.equal(diasDeRacha(["2026-10-22", "2026-10-23", "2026-10-24"], "2026-10-24"), 3);
    assert.equal(diasDeRacha(["2026-10-22", "2026-10-23"], "2026-10-24"), 2);
    assert.equal(diasDeRacha(["2026-10-20", "2026-10-23"], "2026-10-24"), 1);
    assert.equal(diasDeRacha([], "2026-10-24"), 0);
    // Cruza meses.
    assert.equal(diasDeRacha(["2026-09-30", "2026-10-01"], "2026-10-01"), 2);
  });

  it("da los últimos 7 días y su día de la semana", () => {
    const dias = ultimos7Dias("2026-10-24");
    assert.equal(dias.length, 7);
    assert.equal(dias[0], "2026-10-18");
    assert.equal(dias[6], "2026-10-24");
    assert.equal(diaSemana("2026-10-24"), 6); // sábado
  });

  it("sugiere la diaria pendiente de más XP y dice si alcanza para subir de rango", () => {
    const ms = [
      mision({ code: "D1", xp: 50 }),
      mision({ code: "D2", xp: 120 }),
      mision({ code: "D3", xp: 300, status: "completed" }),
      mision({ code: "M1", xp: 5000, frequency: "monthly" }),
    ];
    const cerca = siguienteJugada(ms, estadoRango(1900));
    assert.equal(cerca.mision?.code, "D2");
    assert.equal(cerca.xpHoy, 170);
    assert.equal(cerca.llegaA?.nombre, "Vigía");
    const lejos = siguienteJugada(ms, estadoRango(0));
    assert.equal(lejos.llegaA, null);
    assert.equal(lejos.faltan, 2000);
    // Sin diarias pendientes, pasa a semanales/mensuales.
    assert.equal(siguienteJugada([ms[2], ms[3]], estadoRango(0)).mision?.code, "M1");
    assert.equal(siguienteJugada([], estadoRango(99999)).llegaA, null);
  });

  it("solo celebra misiones completadas desde la última visita", () => {
    const ms = [mision({ id: "p1", status: "completed" }), mision({ id: "p2", status: "completed" }), mision({ id: "p3" })];
    assert.deepEqual(nuevasCompletadas(null, ms), []);
    assert.deepEqual(nuevasCompletadas(["p1"], ms).map((m) => m.id), ["p2"]);
  });
});
