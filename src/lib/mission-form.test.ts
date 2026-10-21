import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { missionFromForm } from "./mission-form";

function form(values: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) for (const x of [v].flat()) f.append(k, x);
  return f;
}

const base = {
  code: "esp01",
  title: "Misión especial",
  description: "",
  category: "Ventas",
  frequency: "weekly",
  metric: "verified_units_category",
  metric_category: "hoodies",
  target_value: "10",
  target_unit: "hoodies",
  xp_reward: "700",
  difficulty: "alta",
  timezone: "America/Caracas",
  review_grace_days: "3",
  status: "active",
};

describe("formulario de misiones", () => {
  it("deriva método de validación, evidencia y parámetros", () => {
    const r = missionFromForm(form({ ...base, applicable_license_plans: ["p1"], plan_target_p1: "4", territory_rules: "Caracas, Valencia" }), ["p1", "p2"]);
    assert.ok(r.ok);
    assert.equal(r.row.code, "ESP01");
    assert.equal(r.row.validation_method, "auto");
    assert.equal(r.row.evidence_required, false);
    assert.deepEqual(r.row.metric_params, { category: "hoodies" });
    assert.deepEqual(r.row.plan_targets, { p1: 4 });
    assert.deepEqual(r.row.applicable_license_plans, ["p1"]);
    assert.deepEqual(r.row.territory_rules, ["Caracas", "Valencia"]);
  });
  it("las misiones manuales exigen evidencia", () => {
    const r = missionFromForm(form({ ...base, metric: "approved_evidence_count" }), []);
    assert.ok(r.ok);
    assert.equal(r.row.validation_method, "manual");
    assert.equal(r.row.evidence_required, true);
  });
  it("valida datos obligatorios", () => {
    assert.ok(!missionFromForm(form({ ...base, metric_category: "" }), []).ok);
    assert.ok(!missionFromForm(form({ ...base, xp_reward: "0" }), []).ok);
    assert.ok(!missionFromForm(form({ ...base, start_at: "2026-10-10T00:00", end_at: "2026-10-01T00:00" }), []).ok);
  });
});
