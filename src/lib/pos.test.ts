import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canUndoPosSale, cartTotal, garmentQrPayload, normalizeGarmentCode } from "./pos";

describe("normalizeGarmentCode", () => {
  it("acepta el código con o sin guion y en minúsculas", () => {
    assert.equal(normalizeGarmentCode("GN-7K2M9P4Q"), "GN-7K2M9P4Q");
    assert.equal(normalizeGarmentCode(" gn7k2m9p4q "), "GN-7K2M9P4Q");
  });

  it("extrae el código de la URL de la etiqueta", () => {
    assert.equal(normalizeGarmentCode("https://gallonegro.app/panel/ventas?codigo=GN-7K2M9P4Q"), "GN-7K2M9P4Q");
  });

  it("rechaza lo que no es un QR de Gallo Negro", () => {
    for (const bad of ["", null, "hola", "GN-7K2M9P4", "GN-7K2M9P4QX", "GN-7K2M9P4I", "https://x.app/?c=XGN-7K2M9P4Q"]) {
      assert.equal(normalizeGarmentCode(bad), null, String(bad));
    }
  });
});

describe("punto de venta", () => {
  it("la etiqueta lleva la URL del punto de venta cuando se conoce el dominio", () => {
    assert.equal(garmentQrPayload("https://gallonegro.app/", "GN-7K2M9P4Q"), "https://gallonegro.app/panel/ventas?codigo=GN-7K2M9P4Q");
    assert.equal(garmentQrPayload(null, "GN-7K2M9P4Q"), "GN-7K2M9P4Q");
  });

  it("suma el precio de cada prenda escaneada", () => {
    const item = { code: "GN-1", name: "x", sku: "x", category: "x" };
    assert.equal(cartTotal([{ ...item, unitPrice: 25 }, { ...item, unitPrice: 17.5 }]), 42.5);
  });

  it("permite deshacer una venta solo en los primeros 15 minutos", () => {
    const now = new Date("2026-10-22T12:00:00Z");
    assert.ok(canUndoPosSale("2026-10-22T11:50:00Z", now));
    assert.ok(!canUndoPosSale("2026-10-22T11:44:00Z", now));
  });
});
