import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assignedPasswordSchema, loginEmail, usernameFromEmail, usernameSchema, usernameToEmail } from "./accounts";

describe("cuentas asignadas", () => {
  it("convierte el usuario en su correo interno, sin distinguir mayúsculas", () => {
    assert.equal(usernameToEmail("tiendita"), "tiendita@usuarios.gallonegro.local");
    assert.equal(loginEmail("  Tiendita "), "tiendita@usuarios.gallonegro.local");
  });

  it("acepta un correo completo tal cual", () => {
    assert.equal(loginEmail("Admin@GalloNegro.com"), "admin@gallonegro.com");
    assert.equal(loginEmail("no@valido"), null);
  });

  it("rechaza usuarios con caracteres o largo no permitidos", () => {
    for (const bad of ["", "ab", "-tienda", "tienda negra", "tienda@x", "a".repeat(31)]) {
      assert.equal(usernameSchema.safeParse(bad).success, false, bad);
    }
    assert.equal(loginEmail("tienda negra"), null);
    assert.equal(usernameSchema.parse("Tienda.Centro_1"), "tienda.centro_1");
  });

  it("recupera el usuario solo de correos internos", () => {
    assert.equal(usernameFromEmail("tiendita@usuarios.gallonegro.local"), "tiendita");
    assert.equal(usernameFromEmail("admin@gallonegro.com"), null);
    assert.equal(usernameFromEmail(null), null);
  });

  it("la contraseña asignada sigue el mínimo de Supabase (6)", () => {
    assert.equal(assignedPasswordSchema.safeParse("12345").success, false);
    assert.equal(assignedPasswordSchema.safeParse("123456").success, true);
  });
});
