import { describe, expect, it } from "vitest";
import { History, collinearOverlap, moveCommand, putCommand, rotateCommand } from "../src";
import { blank, wall } from "./fixtures";

const K = { key: "x" };
const base = () => {
  const h = new History(blank());
  h.execute(putCommand(K, [wall("a", 0, 0, 4000, 0)]));
  return h;
};
const codes = (r: ReturnType<History["execute"]>) => (r.ok ? [] : r.problems.map((p) => p.code));

describe("I-8: a wall can't lie on top of another (EDITING_OPERATIONS default: refuse)", () => {
  it("collinearOverlap by hand", () => {
    const a = wall("a", 0, 0, 4000, 0);
    expect(collinearOverlap(a, wall("b", 3000, 0, 6000, 0))).toBe(1000);
    expect(collinearOverlap(a, wall("b", 6000, 0, 3000, 0))).toBe(1000); // reversed
    expect(collinearOverlap(a, wall("b", 4000, 0, 6000, 0))).toBe(0); // end to end = a join
    expect(collinearOverlap(a, wall("b", 0, 140, 4000, 140))).toBe(0); // parallel, not the same line
    expect(collinearOverlap(a, wall("b", 2000, 0, 2000, 3000))).toBe(0); // a T
  });

  it("drawing over part of an existing wall is refused; continuing it end to end isn't", () => {
    const h = base();
    expect(codes(h.execute(putCommand(K, [wall("b", 3000, 0, 6000, 0)])))).toEqual(["walls-overlap"]);
    expect(h.execute(putCommand(K, [wall("c", 4000, 0, 6000, 0)])).ok).toBe(true);
    expect(h.execute(putCommand(K, [wall("d", 2000, 0, 2000, 3000)])).ok).toBe(true); // T
  });

  it("moving a wall onto another is refused (the drag keeps its last valid place)", () => {
    const h = base();
    h.execute(putCommand(K, [wall("b", 0, 1000, 4000, 1000)]));
    expect(codes(h.execute(moveCommand(["b"], { x: 1000, y: -1000 }, { stretch: false })))).toEqual(["walls-overlap"]);
    const g = h.beginGesture(K);
    g.preview(moveCommand(["b"], { x: 0, y: -500 }, { stretch: false }));
    g.preview(moveCommand(["b"], { x: 0, y: -1000 }, { stretch: false })); // refused frame
    expect(g.project.elements.b).toMatchObject({ start: { x: 0, y: 500 } });
    g.cancel();
  });

  it("rotation noise (~1e-9 mm) still counts as the same line", () => {
    const h = base();
    h.execute(putCommand(K, [wall("b", 2000, -2000, 2000, 2000)]));
    // b rotated 90° about (2000, 0) lands on a's line, from 0 to 4000 (floating-point noise included)
    expect(codes(h.execute(rotateCommand(["b"], { x: 2000, y: 0 }, 90, { stretch: false })))).toEqual([
      "walls-overlap",
    ]);
  });
});
