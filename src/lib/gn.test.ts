import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GN_CONFIG_INICIAL as CFG,
  acreditar,
  ayudaProducto,
  confirmar,
  consumirLotes,
  costoPct,
  devolver,
  estadoPremio,
  faltaPara,
  fechaLiberacion,
  formatGn,
  gnPorMision,
  gnPorVenta,
  nivelCalculado,
  nivelMostrado,
  porVencer,
  retener,
  revertir,
  seLibera,
  utilidadPorPrenda,
  ventasParaGn,
  type Saldo,
} from "./gn";

const vacio: Saldo = { disponible: 0, pendiente: 0, retenido: 0, porCubrir: 0 };

describe("formato", () => {
  it("usa punto de miles", () => {
    assert.equal(formatGn(2800), "2.800 GN");
    assert.equal(formatGn(22000), "22.000 GN");
    assert.equal(formatGn(44), "44 GN");
  });
});

describe("GN por venta", () => {
  it("por prenda: 12 GN por prenda y partir el ticket no cambia el total", () => {
    const junto = gnPorVenta(CFG, { unidades: 3, pvpUnidades: 105, pvpTicket: 105, usadasHoy: 0 }).gn;
    let partido = 0;
    for (let i = 0; i < 3; i++) partido += gnPorVenta(CFG, { unidades: 1, pvpUnidades: 35, pvpTicket: 35, usadasHoy: i }).gn;
    assert.equal(junto, 36);
    assert.equal(partido, 36);
  });
  it("respeta el tope diario", () => {
    assert.deepEqual(gnPorVenta(CFG, { unidades: 5, pvpUnidades: 175, pvpTicket: 175, usadasHoy: 18 }), { unidadesConGn: 2, gn: 24 });
    assert.deepEqual(gnPorVenta(CFG, { unidades: 1, pvpUnidades: 35, pvpTicket: 35, usadasHoy: 20 }), { unidadesConGn: 0, gn: 0 });
  });
  it("por venta y por dólar", () => {
    const porVenta = { ...CFG, gn_modo_venta: "por_venta" as const };
    assert.equal(gnPorVenta(porVenta, { unidades: 3, pvpUnidades: 105, pvpTicket: 105, usadasHoy: 0 }).gn, 12);
    assert.equal(gnPorVenta(porVenta, { unidades: 0, pvpUnidades: 0, pvpTicket: 10, usadasHoy: 0 }).gn, 0);
    const porDolar = { ...CFG, gn_modo_venta: "por_dolar" as const };
    assert.equal(gnPorVenta(porDolar, { unidades: 3, pvpUnidades: 105, pvpTicket: 105, usadasHoy: 0 }).gn, 36);
  });
  it("una venta típica equivale a 12 GN", () => {
    assert.equal(ventasParaGn(44, CFG), 4);
    assert.equal(ventasParaGn(2800, CFG), 234);
    assert.equal(ventasParaGn(0, CFG), 0);
  });
});

describe("GN por misión", () => {
  it("aplica el tope diario de 20", () => {
    assert.equal(gnPorMision(12, 0, 20), 12);
    assert.equal(gnPorMision(12, 12, 20), 8);
    assert.equal(gnPorMision(4, 20, 20), 0);
  });
});

describe("espera de 7 días", () => {
  it("se libera al día 7 y nunca si está en revisión", () => {
    const creada = new Date("2026-11-01T12:00:00Z");
    const libera = fechaLiberacion(creada, 7);
    assert.equal(libera.toISOString(), "2026-11-08T12:00:00.000Z");
    assert.equal(seLibera("en_espera", libera, new Date("2026-11-08T11:59:59Z")), false);
    assert.equal(seLibera("en_espera", libera, new Date("2026-11-08T12:00:00Z")), true);
    assert.equal(seLibera("en_revision", libera, new Date("2026-12-01T00:00:00Z")), false);
  });
});

describe("saldo, reversión y saldo por cubrir", () => {
  it("una reversión mayor que el disponible deja saldo por cubrir y los GN nuevos lo pagan primero", () => {
    let s = acreditar(vacio, 16);
    s = revertir(s, 36);
    assert.deepEqual(s, { disponible: 0, pendiente: 0, retenido: 0, porCubrir: 20 });
    s = acreditar({ ...s, pendiente: 24 }, 24, true);
    assert.deepEqual(s, { disponible: 4, pendiente: 0, retenido: 0, porCubrir: 0 });
  });
  it("con saldo 0 no se puede canjear", () => {
    assert.throws(() => retener(vacio, 44), /insuficiente/);
  });
  it("con saldo por cubrir no se puede canjear", () => {
    assert.throws(() => retener({ ...vacio, disponible: 100, porCubrir: 1 }, 44), /por cubrir/);
  });
  it("retención, devolución y confirmación", () => {
    const s = retener({ ...vacio, disponible: 100 }, 44);
    assert.deepEqual(s, { disponible: 56, pendiente: 0, retenido: 44, porCubrir: 0 });
    assert.deepEqual(devolver(s, 44), { ...vacio, disponible: 100 });
    assert.deepEqual(confirmar(s, 44), { ...vacio, disponible: 56 });
  });
  it("dos canjes del mismo saldo: el segundo ve el saldo ya descontado", () => {
    const s = retener({ ...vacio, disponible: 50 }, 44);
    assert.throws(() => retener(s, 44), /insuficiente/);
  });
});

describe("vencimiento", () => {
  const lotes = [
    { id: 2, restante: 30, vence: new Date("2027-06-01") },
    { id: 1, restante: 10, vence: new Date("2027-01-01") },
  ];
  it("consume primero lo más antiguo", () => {
    const r = consumirLotes(lotes, 15);
    assert.deepEqual(r.usados, [{ id: 1, gn: 10 }, { id: 2, gn: 5 }]);
  });
  it("suma lo que vence hasta una fecha", () => {
    assert.equal(porVencer(lotes, new Date("2027-02-01")), 10);
  });
  it("no consume más de lo que hay", () => {
    assert.throws(() => consumirLotes(lotes, 41), /insuficiente/);
  });
});

describe("tarjeta de premio", () => {
  it("bloqueo por rango, agotado, faltan y canjear", () => {
    const p = { precio: 2800, rangoMinimo: 3, stock: 5, canjeados: 0, limite: 1 };
    assert.deepEqual(estadoPremio(p, { nivel: 2, disponible: 9999 }, CFG), { tipo: "bloqueado", rango: 3 });
    assert.deepEqual(estadoPremio({ ...p, stock: 0 }, { nivel: 3, disponible: 9999 }, CFG), { tipo: "agotado" });
    assert.deepEqual(estadoPremio(p, { nivel: 3, disponible: 2800 - 24 }, CFG), { tipo: "faltan", gn: 24, ventas: 2 });
    assert.deepEqual(estadoPremio(p, { nivel: 4, disponible: 2800 }, CFG), { tipo: "canjear" });
    assert.deepEqual(estadoPremio({ ...p, canjeados: 1 }, { nivel: 4, disponible: 2800 }, CFG), { tipo: "limite" });
  });
  it("un licenciatario sin ventas ve cuánto le falta", () => {
    assert.deepEqual(estadoPremio({ precio: 44, rangoMinimo: 1, stock: null, canjeados: 0, limite: null }, { nivel: 1, disponible: 0 }, CFG), {
      tipo: "faltan",
      gn: 44,
      ventas: 4,
    });
  });
});

describe("control de costo", () => {
  it("calcula el % de costo y la utilidad por prenda", () => {
    assert.equal(costoPct(60, 1000), 6);
    assert.equal(costoPct(60, 0), 0);
    assert.deepEqual(utilidadPorPrenda(25, 15, 40, 20), { antes: 10, premiosPorPrenda: 2, despues: 8 });
  });
  it("ayuda del formulario de producto", () => {
    const a = ayudaProducto(2800, 500, CFG, 0.18);
    assert.equal(a.ventas, 234);
    assert.equal(a.gnPorVenta, 12);
    assert.equal(Math.round((a.devuelvePct ?? 0) * 10) / 10, 6.1);
    assert.equal(Math.round(a.valorGnUsd), 504);
  });
});

describe("rango con doble candado", () => {
  const conIdentidad = (niveles: number[]) => (n: number) => niveles.includes(n);
  it("necesita XP, ventas e identidad", () => {
    assert.equal(nivelCalculado({ xp: 2500, ventas: 0, identidadCumplida: conIdentidad([2]), alcanzado: 1 }, CFG.rangos), 1);
    assert.equal(nivelCalculado({ xp: 2500, ventas: 1600, identidadCumplida: conIdentidad([]), alcanzado: 1 }, CFG.rangos), 1);
    assert.equal(nivelCalculado({ xp: 2500, ventas: 1600, identidadCumplida: conIdentidad([2]), alcanzado: 1 }, CFG.rangos), 2);
  });
  it("no se salta rangos", () => {
    assert.equal(nivelCalculado({ xp: 20000, ventas: 50000, identidadCumplida: conIdentidad([2, 4, 5]), alcanzado: 1 }, CFG.rangos), 2);
  });
  it("el rango nunca baja", () => {
    assert.equal(nivelMostrado({ xp: 0, ventas: 0, identidadCumplida: () => false, alcanzado: 3 }, CFG.rangos), 3);
  });
  it("dice lo que falta", () => {
    const f = faltaPara(2, { xp: 2000, ventas: 700, identidadCumplida: () => false, alcanzado: 1 }, CFG.rangos);
    assert.deepEqual(f, { xp: 0, ventas: 800, identidad: true, metaXp: 2000, metaVentas: 1500 });
  });
});
