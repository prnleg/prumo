// Circuits and loads (ADR-061, UNVERIFIED — EL-02). Hand calculations (CLAUDE.md rule 6), same 4 × 3 m
// room as electrical.test.ts: inner floor 3.86 × 2.86 m = 11.0396 m².
//   lighting:  11.04 m² > 6 → 100 + 60 × floor((11.04 − 6) / 4) = 100 + 60 × 1 = 160 VA for the room;
//              two light points share it → 80 VA each
//   kitchen outlets (wet room): 4 outlets ≤ 6 → first 3 at 600 VA, the 4th at 100 VA → 1,900 VA
//              7 outlets > 6 → first 2 at 600, the other 5 at 100 → 1,700 VA
//   bedroom outlets: 100 VA each
import { emptyProject, putCommand, type Project, type RoomTag, type Wall } from "@prumo/core";
import { setRoomType } from "@prumo/module-architect";
import { describe, expect, it } from "vitest";
import {
  circuits,
  electricalPacks,
  itemLoads,
  newLight,
  newWallItem,
  roomLightingVA,
  validCircuit,
  withElectricalData,
  electricalData,
  type ElectricalData,
} from "../src";

const W = (id: string, x1: number, y1: number, x2: number, y2: number): Wall => ({
  id,
  type: "wall",
  levelId: "l",
  start: { x: x1, y: y1 },
  end: { x: x2, y: y2 },
  alignment: "center",
  kind: "full",
  thickness: 140,
  height: 2700,
  baseOffset: 0,
  components: {},
});
const walls = [
  W("bot", 0, 0, 4000, 0),
  W("right", 4000, 0, 4000, 3000),
  W("top", 4000, 3000, 0, 3000),
  W("left", 0, 3000, 0, 0),
];
const tag = (type: string): RoomTag =>
  setRoomType({ id: "tag", type: "room", levelId: "l", seed: { x: 2000, y: 1500 }, name: "", components: {} }, type);
const project = (extra: Parameters<typeof putCommand>[1]): Project =>
  putCommand({ key: "x" }, [...walls, ...extra]).apply(
    emptyProject({
      id: "p",
      levelId: "l",
      name: "t",
      now: "2026-11-18T00:00:00Z",
      profileId: "br-nbr/structural-masonry",
    }),
  );
const packs = electricalPacks();
const set = <T extends Parameters<typeof withElectricalData>[0]>(e: T, d: Partial<ElectricalData>) =>
  withElectricalData(e, { ...electricalData(e), ...d });
// outlets on the bottom wall facing into the room (left face of a wall running +x = +y side)
const outlet = (id: string, at: number, d: Partial<ElectricalData> = {}) =>
  set(newWallItem(id, "outlet", walls[0]!, at, "left"), d);

describe("loads per item (ADR-061, UNVERIFIED)", () => {
  it("lighting per room: ≤ 6 m² → 100 VA; then +60 VA per whole 4 m²", () => {
    const f = { area: 6, va: 100 };
    const s = { area: 4, va: 60 };
    expect([5, 6, 9.99, 10, 11.04, 14, 22].map((a) => roomLightingVA(a, f, s))).toEqual([
      100, 100, 100, 160, 160, 220, 340,
    ]);
  });

  it("two light points in the 11 m² room share its 160 VA", () => {
    const p = project([
      tag("bedroom"),
      newLight("a", "l", { x: 1000, y: 1500 }),
      newLight("b", "l", { x: 3000, y: 1500 }),
    ]);
    const L = itemLoads(p, packs);
    expect([L.get("a")?.va, L.get("b")?.va]).toEqual([80, 80]);
  });

  it("kitchen: 4 outlets → 600, 600, 600, 100; 7 outlets → 600, 600 then 100 × 5", () => {
    const four = project([tag("kitchen"), ...[1, 2, 3, 4].map((i) => outlet(`o${i}`, i * 700))]);
    const L4 = itemLoads(four, packs);
    expect([1, 2, 3, 4].map((i) => L4.get(`o${i}`)?.va)).toEqual([600, 600, 600, 100]);
    const seven = project([tag("kitchen"), ...[1, 2, 3, 4, 5, 6, 7].map((i) => outlet(`o${i}`, i * 450))]);
    const L7 = [...itemLoads(seven, packs).values()].reduce((s, x) => s + (x.va ?? 0), 0);
    expect(L7).toBe(1700);
  });

  it("bedroom outlets 100 VA; a one-appliance outlet is its typed power, or unknown", () => {
    const p = project([
      tag("bedroom"),
      outlet("g", 1000),
      outlet("d1", 2000, { purpose: "dedicated", power: 4400 }),
      outlet("d2", 3000, { purpose: "dedicated" }),
    ]);
    const L = itemLoads(p, packs);
    expect([L.get("g")?.va, L.get("d1")?.va, L.get("d2")?.va]).toEqual([100, 4400, null]);
  });
});

describe("circuits (ADR-061)", () => {
  it("adds up per circuit; notes lights + outlets together and a shared one-appliance outlet", () => {
    const p = project([
      tag("bedroom"),
      set(newLight("a", "l", { x: 2000, y: 1500 }), { circuit: 1 }),
      outlet("g1", 1000, { circuit: 1 }),
      outlet("g2", 2000, { circuit: 2 }),
      outlet("d", 3000, { circuit: 2, purpose: "dedicated", power: 2000 }),
      outlet("free", 3500),
    ]);
    const c = circuits(p, packs);
    expect(c.unassigned).toBe(1);
    // circuit 1: light 160 VA (alone in the room) + outlet 100 → 260; circuit 2: 100 + 2000 = 2100
    expect(c.list.map((x) => [x.n, x.lights, x.outlets, x.dedicated, x.va, x.unknown, x.notes])).toEqual([
      [1, 1, 1, 0, 260, 0, ["mixed"]],
      [2, 0, 1, 1, 2100, 0, ["dedicatedShared"]],
    ]);
  });

  it("circuit numbers are whole numbers 1…99", () => {
    expect([0, 1, 99, 100, 1.5, "2", undefined].map(validCircuit)).toEqual([
      false,
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
  });
});
