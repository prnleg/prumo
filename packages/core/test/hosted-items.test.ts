// Module items hosted on walls (ADR-024; first user: the structural chase, ADR-042 addition).
// They ride with their wall like doors/windows: move, stretch, mirror, copy, delete.
import { describe, expect, it } from "vitest";
import {
  checkInvariants,
  copyToClipboard,
  counterIds,
  deleteCommand,
  duplicateCommand,
  hitTest,
  mirrorCommand,
  moveCommand,
  planGeometry,
  putCommand,
  setWallLengthCommand,
  translate,
  type Host,
  type ModuleElement,
  type Project,
} from "../src";
import { blank, wall } from "./fixtures";

const MOD = "org.example.pipes";
const item = (id: string, host: string, offset: number, length?: number): ModuleElement => ({
  id,
  type: `${MOD}:chase`,
  ownerModule: MOD,
  levelId: "l-1",
  host: { elementId: host, offset, ...(length === undefined ? {} : { length }) },
  components: { [MOD]: { v: 1, data: { dir: "horizontal" } } },
});

/** w1 along x (0 → 4000), w2 joined at its start (vertical, 0,3000 → 0,0); chase c1 1000..2000 on w1. */
function base(): Project {
  return putCommand({ key: "x" }, [
    wall("w1", 0, 0, 4000, 0),
    wall("w2", 0, 3000, 0, 0),
    item("c1", "w1", 1000, 1000),
    item("v1", "w1", 3000),
  ]).apply(blank());
}
const I = (p: Project, id: string) => p.elements[id] as ModuleElement & { host: Host };

describe("hosted module items", () => {
  it("ride along when their wall moves", () => {
    const p = moveCommand(["w1"], { x: 0, y: 500 }).apply(base());
    expect(I(p, "c1").host).toEqual({ elementId: "w1", offset: 1000, length: 1000 });
  });

  it("slide along the wall when moved alone, clamped by their length", () => {
    // 1000 + 2500 = 3500, but 3500 + 1000 > 4000 → clamped to 3000
    expect(I(translate(base(), ["c1"], { x: 2500, y: 0 }), "c1").host.offset).toBe(3000);
    // a point item (vertical chase) may go to the very end: 3000 + 5000 → 4000
    expect(I(translate(base(), ["v1"], { x: 5000, y: 0 }), "v1").host.offset).toBe(4000);
  });

  it("keep their distance from the end that stayed when the wall's start moves", () => {
    // w2 moves left by 500; w1's start (joined) follows → w1 grows by 500 at its start
    const p = moveCommand(["w2"], { x: -500, y: 0 }).apply(base());
    expect(I(p, "c1").host.offset).toBe(1500);
    expect(I(p, "v1").host.offset).toBe(3500);
  });

  it("are deleted with their wall", () => {
    const p = deleteCommand(base(), ["w1"]).apply(base());
    expect(p.elements.c1).toBeUndefined();
    expect(p.elements.v1).toBeUndefined();
  });

  it("are copied with their wall (duplicate, mirror copy), keeping data and length", () => {
    const d = duplicateCommand(base(), ["w1"], { x: 0, y: 5000 }, counterIds("n"));
    const p = d.command.apply(base());
    const copies = Object.values(p.elements).filter((e) => e.type === `${MOD}:chase` && e.id.startsWith("n"));
    expect(copies.map((c) => (c as ModuleElement).host)).toEqual([
      { elementId: d.newIds[0], offset: 1000, length: 1000 },
      { elementId: d.newIds[0], offset: 3000 },
    ]);
    expect(copyToClipboard(base(), ["w1"]).hosted.map((h) => h.id)).toEqual(["c1", "v1"]);
    const m = mirrorCommand(base(), ["w1"], "horizontal", { x: 0, y: 1000 }, { copy: true, newId: counterIds("m") });
    const q = m.command.apply(base());
    const mc = Object.values(q.elements).filter((e) => e.id.startsWith("m") && e.type !== "wall");
    expect(mc).toHaveLength(2);
    expect((mc[0] as ModuleElement).components[MOD]).toEqual({ v: 1, data: { dir: "horizontal" } });
  });

  it("a wall shortened past an item is refused (item-outside-wall)", () => {
    const p = base();
    expect(checkInvariants(p)).toEqual([]);
    const shorter = setWallLengthCommand("w1", 2500, { stretch: false }).apply(p); // c1 ends at 2000: fits; v1 at 3000: doesn't
    expect(checkInvariants(shorter, ["w1"]).map((x) => x.code)).toEqual(["item-outside-wall"]);
  });

  it("show on the plan along the wall's body centre and win the pick over the wall", () => {
    const g = planGeometry(base(), "l-1");
    const c = g.items.find((i) => i.id === "c1");
    // w1 is centred (default fixture alignment), so the marker runs on the drawn line
    expect(c?.a).toEqual({ x: 1000, y: 0 });
    expect(c?.b).toEqual({ x: 2000, y: 0 });
    expect(hitTest(g, { x: 1500, y: 10 }, 5)).toBe("c1");
    expect(hitTest(g, { x: 500, y: 10 }, 5)).toBe("w1");
    expect(hitTest(g, { x: 3005, y: 0 }, 5)).toBe("v1"); // point item: still pickable
  });
});
