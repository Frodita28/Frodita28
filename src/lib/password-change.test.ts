import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

// Las contraseñas solo las asigna el administrador (Administración → Usuarios).
describe("sin cambio de contraseña para los usuarios", () => {
  it("el menú del panel no enlaza a Contraseña", () => {
    const layout = readFileSync(new URL("../app/panel/layout.tsx", import.meta.url), "utf8");
    assert.doesNotMatch(layout, /Contraseña|nueva-clave/);
  });

  it("no existe la página ni la acción de cambio de contraseña", () => {
    assert.equal(existsSync(new URL("../app/nueva-clave", import.meta.url)), false);
    const actions = readFileSync(new URL("../app/login/actions.ts", import.meta.url), "utf8");
    assert.doesNotMatch(actions, /updateUser|updatePassword/);
  });
});
