import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canSubmitEvidence, formatDay, isPeriodOpen, metricMethod, progressPercent, todayIn } from "./missions";

describe("utilidades de misiones", () => {
  it("calcula el porcentaje acotado", () => {
    assert.equal(progressPercent(3, 5), 60);
    assert.equal(progressPercent(10, 5), 100);
    assert.equal(progressPercent(null, 5), 0);
    assert.equal(progressPercent(-1, 5), 0);
  });
  it("formatea fechas en español", () => assert.equal(formatDay("2026-10-21"), "21 oct 2026"));
  it("calcula el día local de la campaña", () => {
    assert.equal(todayIn("America/Caracas", new Date("2026-10-19T02:00:00Z")), "2026-10-18");
    assert.equal(isPeriodOpen("2026-10-18", "2026-10-18"), true);
    assert.equal(isPeriodOpen("2026-10-18", "2026-10-19"), false);
  });
  it("solo permite evidencias en misiones manuales con período abierto", () => {
    assert.equal(canSubmitEvidence("available", "manual", true), true);
    assert.equal(canSubmitEvidence("rejected", "manual", true), true);
    assert.equal(canSubmitEvidence("completed", "manual", true), false);
    assert.equal(canSubmitEvidence("available", "auto", true), false);
    assert.equal(canSubmitEvidence("available", "manual", false), false);
    assert.equal(metricMethod("manual_approval"), "manual");
    assert.equal(metricMethod("verified_units"), "auto");
  });
});
