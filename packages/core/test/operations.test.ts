import { describe, expect, it } from "vitest";
import {
  History,
  boxSelect,
  counterIds,
  duplicateCommand,
  hitTest,
  moveCommand,
  planGeometry,
  putCommand,
  translate,
  type Opening,
  type Project,
  type Wall,
} from "../src";
import { blank, wall } from "./fixtures";

const op = (id: string, host: string, offset: number, width = 800): Opening => ({
  id,
  type: "opening",
  levelId: "l-1",
  host: { elementId: host, offset },
  width,
  height: 2100,
  sillHeight: 0,
  kind: "door",
  components: {},
});

/** 4 × 3 m room, walls drawn counter-clockwise; door on the bottom wall, window-ish opening on the top wall. */
function room(): Project {
  return putCommand({ key: "x" }, [
    wall("w1", 0, 0, 4000, 0),
    wall("w2", 4000, 0, 4000, 3000),
    wall("w3", 4000, 3000, 0, 3000),
    wall("w4", 0, 3000, 0, 0),
    op("o1", "w1", 1000),
    op("o3", "w3", 1000),
  ]).apply(blank());
}
const W = (p: Project, id: string) => p.elements[id] as Wall;
const O = (p: Project, id: string) => p.elements[id] as Opening;
/** World x of an opening's near edge on a horizontal wall. */
const worldX = (p: Project, oid: string) => {
  const o = O(p, oid);
  const w = W(p, o.host.elementId);
  const dir = Math.sign(w.end.x - w.start.x);
  return w.start.x + dir * o.host.offset;
};

describe("move (EDITING_OPERATIONS 'Move', Q-022 stretch)", () => {
  it("moving the right wall 1 m right stretches the top and bottom walls; the room stays closed", () => {
    const p = translate(room(), ["w2"], { x: 1000, y: 0 });
    expect(W(p, "w2")).toMatchObject({ start: { x: 5000, y: 0 }, end: { x: 5000, y: 3000 } });
    expect(W(p, "w1").end).toEqual({ x: 5000, y: 0 }); // end moved
    expect(W(p, "w3").start).toEqual({ x: 5000, y: 3000 }); // start moved
    expect(W(p, "w4")).toMatchObject({ start: { x: 0, y: 3000 }, end: { x: 0, y: 0 } }); // not joined to w2
    expect(planGeometry(p, "l-1").nodes).toHaveLength(4);
  });

  it("openings on stretched walls stay where they were in the world", () => {
    const before = room();
    const p = translate(before, ["w2"], { x: 1000, y: 0 });
    // o1 on w1 (end moved): offset unchanged, world x 1000. o3 on w3 (start moved): offset 1000 → 2000,
    // world x = 5000 − 2000 = 3000 = before (4000 − 1000).
    expect(O(p, "o1").host.offset).toBe(1000);
    expect(O(p, "o3").host.offset).toBe(2000);
    expect([worldX(p, "o1"), worldX(p, "o3")]).toEqual([worldX(before, "o1"), worldX(before, "o3")]);
  });

  it("stretch off (modifier) = detach: neighbours untouched", () => {
    const p = translate(room(), ["w2"], { x: 1000, y: 0 }, { stretch: false });
    expect(W(p, "w1").end).toEqual({ x: 4000, y: 0 });
    expect(W(p, "w3").start).toEqual({ x: 4000, y: 3000 });
  });

  it("an opening selected alone slides along its wall by the delta's projection, clamped to fit", () => {
    expect(O(translate(room(), ["o1"], { x: 700, y: 300 }), "o1").host.offset).toBe(1700);
    expect(O(translate(room(), ["o1"], { x: 9999, y: 0 }), "o1").host.offset).toBe(3200); // 4000 − 800
    // on w3 (drawn right → left), moving +x slides it back towards the start: 1000 − 300 = 700
    expect(O(translate(room(), ["o3"], { x: 300, y: 0 }), "o3").host.offset).toBe(700);
  });

  it("wall + its own opening selected: the opening is not moved twice (classic bug)", () => {
    const p = translate(room(), ["w1", "o1"], { x: 0, y: -500 });
    expect(O(p, "o1").host.offset).toBe(1000);
    expect(W(p, "w1").start).toEqual({ x: 0, y: -500 });
  });

  it("a T stem keeps its direction and re-meets the moved wall", () => {
    const p0 = putCommand({ key: "x" }, [wall("h", 0, 0, 4000, 0), wall("s", 2000, 3000, 2000, 0)]).apply(blank());
    expect(W(translate(p0, ["h"], { x: 0, y: -500 }), "s").end).toEqual({ x: 2000, y: -500 });
    expect(W(translate(p0, ["h"], { x: 300, y: 0 }), "s").end).toEqual({ x: 2000, y: 0 }); // sliding along: stays
  });

  it("a move that would squeeze an opening out of a stretched wall is blocked (History)", () => {
    const h = new History(room());
    const r = h.execute(moveCommand(["w2"], { x: -3500, y: 0 })); // w1 → 500 mm long, o1 needs 1000…1800
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems.map((x) => x.code)).toContain("opening-outside-wall");
    expect(h.canUndo).toBe(false);
  });

  it("zero delta → same project object (no undo step)", () => {
    const p = room();
    expect(translate(p, ["w1"], { x: 0, y: 0 })).toBe(p);
  });
});

describe("duplicate", () => {
  it("copies walls with their openings (new ids, hosts remapped, moved by delta); a lone opening is skipped", () => {
    const p = room();
    const d = duplicateCommand(p, ["w1", "o3"], { x: 0, y: -2000 }, counterIds("c"));
    expect(d.newIds).toEqual(["c-1"]);
    const q = d.command.apply(p);
    expect(W(q, "c-1")).toMatchObject({ start: { x: 0, y: -2000 }, end: { x: 4000, y: -2000 } });
    expect(O(q, "c-2")).toMatchObject({ host: { elementId: "c-1", offset: 1000 } });
    expect(Object.keys(q.elements)).toHaveLength(8);
    // redo reproduces the same copies (ids drawn up front)
    expect(d.command.apply(p)).toEqual(q);
    expect(d.command.label).toEqual({ key: "cmd.duplicate", params: { count: 2 } });
  });
});

describe("picking on the drawn plan", () => {
  const g = planGeometry(room(), "l-1");

  it("an opening wins over its wall; wall body; near an edge within tolerance; empty space", () => {
    expect(hitTest(g, { x: 1400, y: 0 }, 10)).toBe("o1");
    expect(hitTest(g, { x: 3000, y: 20 }, 10)).toBe("w1");
    expect(hitTest(g, { x: 3000, y: 75 }, 10)).toBe("w1"); // face at 70, 5 mm away
    expect(hitTest(g, { x: 2000, y: 1500 }, 10)).toBeNull();
  });

  it("box: left→right = fully inside; right→left = touching", () => {
    const box = { minX: -200, minY: -200, maxX: 4200, maxY: 300 };
    expect(boxSelect(g, box, "inside")).toEqual(["o1", "w1"]);
    expect(boxSelect(g, box, "touching")).toEqual(["o1", "w1", "w2", "w4"]);
  });
});
