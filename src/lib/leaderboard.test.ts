import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBoard, xpToNextPlace } from "./leaderboard";

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
