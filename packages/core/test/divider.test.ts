import { describe, expect, it } from "vitest";
import {
  History,
  anchorOutsideWalls,
  detectRooms,
  hitTest,
  planGeometry,
  putCommand,
  type Opening,
  type Project,
  type Wall,
} from "../src";
import { blank, wall } from "./fixtures";

const K = { key: "x" };
const rect = (x0: number, y0: number, x1: number, y1: number): Wall[] => [
  wall("r1", x0, y0, x1, y0),
  wall("r2", x1, y0, x1, y1),
  wall("r3", x1, y1, x0, y1),
  wall("r4", x0, y1, x0, y0),
];
const divider = (id: string, x1: number, y1: number, x2: number, y2: number) =>
  wall(id, x1, y1, x2, y2, { kind: "separator" });
const off = (p: Project): Project => ({ ...p, settings: { gridSize: p.settings.gridSize } });
const build = (els: Wall[]) => putCommand(K, els).apply(off(blank()));

describe("room divider (ADR-040: wall kind 'separator', no body)", () => {
  it("splits an 8 × 4 m open area at x = 5 m; floors measured to the divider LINE", () => {
    const p = build([...rect(0, 0, 8000, 4000), divider("d", 5000, 0, 5000, 4000)]);
    const areas = detectRooms(p, "l-1")
      .map((r) => r.floorArea)
      .sort((a, b) => a - b);
    // inner faces 70 mm in from the walls' centre lines; divider = 0 mm:
    // left (5000 − 70)·(4000 − 140) = 4930·3860 = 19,029,800; right (3000 − 70)·3860 = 2930·3860 = 11,309,800
    expect(areas[0]).toBeCloseTo(11_309_800, 3);
    expect(areas[1]).toBeCloseTo(19_029_800, 3);
    // together = the undivided room (8000 − 140)·3860 = 30,339,600: a divider takes no floor
    expect(areas[0]! + areas[1]!).toBeCloseTo(30_339_600, 3);
  });

  it("has no body: not in joins or the outline, but listed and pickable as a line", () => {
    const plain = planGeometry(build(rect(0, 0, 8000, 4000)), "l-1");
    const g = planGeometry(build([...rect(0, 0, 8000, 4000), divider("d", 5000, 0, 5000, 4000)]), "l-1");
    expect(g.walls.map((w) => w.id)).toEqual(plain.walls.map((w) => w.id));
    expect(g.outline).toEqual(plain.outline);
    expect(g.dividers.map((d) => d.id)).toEqual(["d"]);
    expect(hitTest(g, { x: 5040, y: 2000 }, 60)).toBe("d");
    expect(hitTest(g, { x: 5200, y: 2000 }, 60)).toBeNull();
  });

  it("a divider alone, or poking into a room, makes no room", () => {
    expect(detectRooms(build([divider("d", 0, 0, 4000, 0)]), "l-1")).toEqual([]);
    expect(detectRooms(build([...rect(0, 0, 8000, 4000), divider("d", 5000, 0, 5000, 2000)]), "l-1")).toHaveLength(1);
  });

  it("no doors or windows in a divider", () => {
    const h = new History(build([divider("d", 0, 0, 4000, 0)]));
    const door: Opening = {
      id: "o",
      type: "opening",
      levelId: "l-1",
      host: { elementId: "d", offset: 1000 },
      width: 800,
      height: 2100,
      sillHeight: 0,
      kind: "door",
      handing: "left",
      swing: "in",
      components: {},
    };
    const r = h.execute(putCommand(K, [door]));
    expect(r.ok ? [] : r.problems.map((x) => x.code)).toEqual(["host-not-wall"]);
  });

  it("outside walls by face (ADR-038) ignore dividers", () => {
    const h = new History(blank(), { normalize: anchorOutsideWalls });
    h.execute(
      putCommand(K, [wall("a", 0, 0, 4000, 0), wall("b", 4000, 0, 4000, 3000), wall("c", 4000, 3000, 0, 3000)]),
    );
    h.execute(putCommand(K, [divider("d", 0, 3000, 0, 0)])); // the divider closes the block
    expect((h.current.elements.d as Wall).alignment).toBe("center");
    expect((h.current.elements.a as Wall).alignment).toBe("left");
  });
});
