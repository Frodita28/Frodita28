import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applicationFromForm, planPriceLabel } from "./applications";

function fd(entries: [string, string][]) {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
}

const base: [string, string][] = [
  ["full_name", "Carla Gómez"],
  ["phone", "+58 412 555 1234"],
  ["country", "Venezuela"],
  ["city", "Valencia"],
  ["experience", "Vendo ropa por Instagram desde hace dos años."],
];

describe("applicationFromForm", () => {
  it("recoge varios canales de venta", () => {
    const r = applicationFromForm(fd([...base, ["sales_channels", "instagram"], ["sales_channels", "whatsapp"]]));
    assert.ok(r.success);
    assert.deepEqual(r.data.sales_channels, ["instagram", "whatsapp"]);
    assert.equal(r.data.preferred_plan_id, "");
  });

  it("exige al menos un canal válido", () => {
    assert.equal(applicationFromForm(fd(base)).success, false);
    assert.equal(applicationFromForm(fd([...base, ["sales_channels", "piramide"]])).success, false);
  });

  it("rechaza teléfonos y planes con formato inválido", () => {
    const bad = fd([...base.filter(([k]) => k !== "phone"), ["phone", "llámame"], ["sales_channels", "otro"]]);
    assert.equal(applicationFromForm(bad).success, false);
    const plan = fd([...base, ["sales_channels", "otro"], ["preferred_plan_id", "no-uuid"]]);
    assert.equal(applicationFromForm(plan).success, false);
  });
});

describe("planPriceLabel", () => {
  it("no muestra precios de planes sin confirmar", () => {
    assert.equal(planPriceLabel({ price: 100, currency: "USD", status: "pending_confirmation" }), "Precio pendiente de confirmación");
    assert.equal(planPriceLabel({ price: null, currency: null, status: "active" }), "Precio pendiente de confirmación");
  });

  it("formatea el precio de un plan confirmado", () => {
    assert.match(planPriceLabel({ price: "250.00", currency: "USD", status: "active" }), /250/);
  });
});
