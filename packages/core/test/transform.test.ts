import { describe, expect, it } from "vitest";
import {
  counterIds,
  faceOffsets,
  mirrorCommand,
  openingPlan,
  planGeometry,
  putCommand,
  reflector,
  rotateCommand,
  selectionCentre,
  type Opening,
  type Project,
  type V,
  type Wall,
} from "../src";
import { blank, wall } from "./fixtures";

const door = (id: string, host: string, offset: number, extra: Partial<Opening> = {}): Opening => ({
  id,
  type: "opening",
  levelId: "l-1",
  host: { elementId: host, offset },
  width: 800,
  height: 2100,
  sillHeight: 0,
  kind: "door",
  handing: "left",
  swing: "in",
  components: {},
  ...extra,
});
const room = (): Project =>
  putCommand({ key: "x" }, [
    wall("w1", 0, 0, 4000, 0),
    wall("w2", 4000, 0, 4000, 3000),
    wall("w3", 4000, 3000, 0, 3000),
    wall("w4", 0, 3000, 0, 0, { alignment: "left" }),
    door("d1", "w1", 1000),
  ]).apply(blank());
const W = (p: Project, id: string) => p.elements[id] as Wall;
const ALL = ["w1", "w2", "w3", "w4"];

describe("rotate (EDITING_OPERATIONS 'Rotate')", () => {
  it("hand case: wall (0,0)→(4000,0) by 90° about (2000,0) → (2000,−2000)→(2000,2000)", () => {
    const p = putCommand({ key: "x" }, [wall("a", 0, 0, 4000, 0)]).apply(blank());
    const q = rotateCommand(["a"], { x: 2000, y: 0 }, 90).apply(p);
    expect(W(q, "a")).toMatchObject({ start: { x: 2000, y: -2000 }, end: { x: 2000, y: 2000 } });
  });

  it("4 × 90° = the original EXACTLY (spec asks for within EPS)", () => {
    const p0 = room();
    let p = p0;
    for (let i = 0; i < 4; i++) p = rotateCommand(ALL, { x: 2000, y: 1500 }, 90).apply(p);
    expect(p).toEqual(p0);
  });

  it("rotating one wall stretches the walls joined to it; the room stays closed", () => {
    // rotate w2 by 90° about its start (4000,0): end (4000,3000) → (1000,0)… (degenerate) so use −30°
    const q = rotateCommand(["w2"], { x: 4000, y: 0 }, -30).apply(room());
    const w2 = W(q, "w2");
    expect(w2.start).toEqual({ x: 4000, y: 0 });
    // end = (4000 + 3000·sin30°, 3000·cos30°) = (5500, 2598.076211)
    expect(w2.end).toEqual({ x: 5500, y: 2598.076211 });
    expect(W(q, "w3").start).toEqual(w2.end);
    expect(planGeometry(q, "l-1").nodes).toHaveLength(4);
  });

  it("15° steps are deterministic (quantized to 1 nm)", () => {
    const a = rotateCommand(ALL, { x: 0, y: 0 }, 15).apply(room());
    const b = rotateCommand([...ALL].reverse(), { x: 0, y: 0 }, 15).apply(room());
    expect(a).toEqual(b);
    expect(Number.isInteger(W(a, "w1").end.x * 1e6)).toBe(true);
  });
});

describe("mirror (EDITING_OPERATIONS 'Mirror')", () => {
  const axisX = { x: 6000, y: 0 }; // vertical axis x = 6000

  it("selection centre is the walls' bbox centre on the grid", () => {
    expect(selectionCentre(room(), ALL, 100)).toEqual({ x: 2000, y: 1500 });
    expect(selectionCentre(room(), ["d1"], 100)).toBeNull();
  });

  it("copy (default): originals untouched, copies mirrored with new ids, doors copied onto the copies", () => {
    const p = room();
    const r = mirrorCommand(p, ALL, "vertical", axisX, { copy: true, newId: counterIds("m") });
    const q = r.command.apply(p);
    expect(q.elements["w1"]).toBe(p.elements["w1"]);
    expect(r.newIds).toEqual(["m-1", "m-3", "m-4", "m-5"]); // m-2 = the copied door
    expect(W(q, "m-1")).toMatchObject({ start: { x: 12000, y: 0 }, end: { x: 8000, y: 0 } });
    expect(q.elements["m-2"]).toMatchObject({
      host: { elementId: "m-1", offset: 1000 },
      handing: "left",
      swing: "out",
    });
    expect(r.command.label).toEqual({ key: "cmd.mirrorCopy", params: { count: 4 } });
  });

  it("alignment flips so the body stays on the mirrored side (the classic bug)", () => {
    // w4 (0,3000)→(0,0), left-aligned: body on its left = +x side (x 0…140).
    const p = room();
    const q = mirrorCommand(p, ["w4"], "vertical", axisX, { copy: true, newId: counterIds("m") }).command.apply(p);
    const m = W(q, "m-1"); // (12000,3000)→(12000,0)
    expect(m.alignment).toBe("right");
    // mirrored body must be on the −x side: x 11860…12000. Right face offset −140 from a line going −y
    // (left normal = +x) → right side = −x. ✔
    const { l, r } = faceOffsets(m);
    expect([l, r]).toEqual([0, -140]);
  });

  it("property: the mirrored door's symbol is exactly the mirror of the original symbol", () => {
    const f = reflector("vertical", axisX);
    for (const swing of ["in", "out"] as const)
      for (const handing of ["left", "right"] as const) {
        const p = putCommand({ key: "x" }, [door("d1", "w1", 1000, { swing, handing })]).apply(room());
        const q = mirrorCommand(p, ["w1"], "vertical", axisX, { copy: true, newId: counterIds("m") }).command.apply(p);
        const a = openingPlan(W(p, "w1"), p.elements["d1"] as Opening);
        const b = openingPlan(W(q, "m-1"), q.elements["m-2"] as Opening);
        const key = (v: V) => `${v.x.toFixed(6)},${v.y.toFixed(6)}`;
        const set = (vs: V[]) => vs.map(key).sort();
        expect(set(b.leaf!)).toEqual(set(a.leaf!.map(f)));
        expect(set([b.arc[0]!, b.arc.at(-1)!])).toEqual(set([a.arc[0]!, a.arc.at(-1)!].map(f)));
        expect(set(b.cover)).toEqual(set(a.cover.map(f)));
      }
  });

  it("in place: walls mirror where they are, joined walls stretch to follow", () => {
    const p = room();
    // mirror w2 about x = 5000 in place → w2 at x = 6000; w1 and w3 stretch to it
    const r = mirrorCommand(p, ["w2"], "vertical", { x: 5000, y: 0 }, { copy: false, newId: counterIds("m") });
    const q = r.command.apply(p);
    expect(r.newIds).toEqual(["w2"]);
    expect(W(q, "w2")).toMatchObject({ start: { x: 6000, y: 0 }, end: { x: 6000, y: 3000 } });
    expect(W(q, "w1").end).toEqual({ x: 6000, y: 0 });
    expect(W(q, "w3").start).toEqual({ x: 6000, y: 3000 });
  });

  it("a wall lying on the axis is skipped in a mirror copy (it would sit on itself)", () => {
    const p = room();
    const r = mirrorCommand(p, ["w1", "w2"], "horizontal", { x: 0, y: 0 }, { copy: true, newId: counterIds("m") });
    expect(r.skipped).toEqual(["w1"]);
    expect(r.newIds).toEqual(["m-1"]);
  });
});
