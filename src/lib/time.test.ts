import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { utcToZonedLocal, zonedLocalToUtc } from "./time";

describe("zonas horarias", () => {
  it("convierte hora de Caracas (UTC-4) a UTC y de vuelta", () => {
    const d = zonedLocalToUtc("2026-10-21T22:30", "America/Caracas")!;
    assert.equal(d.toISOString(), "2026-10-22T02:30:00.000Z");
    assert.equal(utcToZonedLocal(d, "America/Caracas"), "2026-10-21T22:30");
  });
  it("respeta el horario de verano", () => {
    assert.equal(zonedLocalToUtc("2026-07-01T12:00", "America/New_York")!.toISOString(), "2026-07-01T16:00:00.000Z");
    assert.equal(zonedLocalToUtc("2026-01-01T12:00", "America/New_York")!.toISOString(), "2026-01-01T17:00:00.000Z");
  });
  it("rechaza formatos inválidos", () => assert.equal(zonedLocalToUtc("21/10/2026"), null));
});
