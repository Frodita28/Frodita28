import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBoard, rivalidad, xpToNextPlace } from "./leaderboard";

const row = (place: number, totalXp: number, isMe = false) => ({ place, alias: `T${place}`, totalXp, isMe });

describe("xpToNextPlace", () => {
  it("calcula los XP hasta la posición de arriba", () => {
    assert.deepEqual(xpToNextPlace([row(1, 900), row(2, 500), row(3, 450, true)]), { gap: 50, place: 2 });
  });
  it("con empate por arriba apunta a la tienda empatada", () => {
    assert.deepEqual(xpToNextPlace([row(1, 900), row(2, 500), row(2, 500), row(4, 100, true)]), { gap: 400, place: 2 });
  });
  it("sin dato cuando es primera o la lista está recortada", () => {
    assert.equal(xpToNextPlace([row(1, 900, true), row(2, 10)]), null);
    assert.equal(xpToNextPlace([row(1, 900), row(7, 10, true)]), null);
  });
  it("parseBoard convierte los valores de la base", () => {
    assert.deepEqual(parseBoard([{ place: "2", alias: "A", total_xp: "30", is_me: true }]), [{ place: 2, alias: "A", totalXp: 30, isMe: true }]);
    assert.deepEqual(parseBoard(null), []);
  });
});

describe("rivalidad", () => {
  it("apunta a la tienda de arriba y los XP para superarla", () => {
    assert.deepEqual(rivalidad([row(1, 900), row(2, 500), row(3, 450, true)]), { tipo: "rival", alias: "T2", gap: 51 });
  });
  it("con empate, la tienda empatada es el rival (hay que superarla por 1)", () => {
    assert.deepEqual(rivalidad([row(1, 500), row(1, 500, true)]), { tipo: "rival", alias: "T1", gap: 1 });
  });
  it("primera: ventaja sobre la segunda", () => {
    assert.deepEqual(rivalidad([row(1, 900, true), row(2, 780)]), { tipo: "lider", ventaja: 120 });
  });
  it("sola en la tabla o fuera de ella", () => {
    assert.deepEqual(rivalidad([row(1, 0, true)]), { tipo: "solo" });
    assert.equal(rivalidad([row(1, 10)]), null);
  });
});
