import { describe, expect, it } from "vitest";
import { History, putCommand, setWallLengthCommand, wallLength, type Opening, type Wall } from "../src";
import { blank, wall } from "./fixtures";

const door = (id: string, host: string, offset: number, width = 800): Opening => ({
  id,
  type: "opening",
  levelId: "l-1",
  host: { elementId: host, offset },
  width,
  height: 2100,
  sillHeight: 0,
  kind: "door",
  handing: "left",
  swing: "in",
  components: {},
});

const setup = (els: (Wall | Opening)[]) => {
  const h = new History(blank());
  h.execute(putCommand({ key: "x" }, els));
  return h;
};
const W = (h: History, id: string) => h.current.elements[id] as Wall;

describe("type a wall's length (start stays, end moves)", () => {
  it("diagonal 3-4-5 wall: 5000 → 2500 halves both components", () => {
    const h = setup([wall("a", 1000, 1000, 4000, 5000)]); // Δ = (3000, 4000), L = 5000
    h.execute(setWallLengthCommand("a", 2500));
    expect(W(h, "a").start).toEqual({ x: 1000, y: 1000 });
    expect(W(h, "a").end.x).toBeCloseTo(2500, 9); // 1000 + 3000/2
    expect(W(h, "a").end.y).toBeCloseTo(3000, 9); // 1000 + 4000/2
  });

  it("an L corner follows the moved end; the neighbour's door keeps its distance from its far end", () => {
    // a: (0,0)→(4000,0); b: (4000,0)→(4000,3000) with a door whose near edge is 1000 from b's start
    const h = setup([wall("a", 0, 0, 4000, 0), wall("b", 4000, 0, 4000, 3000), door("d", "b", 1000)]);
    h.execute(setWallLengthCommand("a", 5000));
    expect(W(h, "a").end).toEqual({ x: 5000, y: 0 });
    expect(W(h, "b").start).toEqual({ x: 5000, y: 0 });
    // b: (5000,0)→(4000,3000), L = √(1000² + 3000²) = 3162.2777; door near edge was 2000 from b's end
    // (3000 − 1000), so offset = 3162.2777 − 2000 = 1162.2777
    expect(wallLength(W(h, "b"))).toBeCloseTo(3162.2777, 3);
    expect((h.current.elements.d as Opening).host.offset).toBeCloseTo(1162.2777, 3);
  });

  it("joined by its end (two walls ending at the same corner) also follows", () => {
    const h = setup([wall("a", 0, 0, 4000, 0), wall("b", 4000, 3000, 4000, 0)]);
    h.execute(setWallLengthCommand("a", 3000));
    expect(W(h, "b").end).toEqual({ x: 3000, y: 0 });
    expect(W(h, "b").start).toEqual({ x: 4000, y: 3000 });
  });

  it("a door that wouldn't fit any more: refused, nothing changes", () => {
    const h = setup([wall("a", 0, 0, 4000, 0), door("d", "a", 3000)]); // door spans 3000…3800
    const before = h.current;
    const r = h.execute(setWallLengthCommand("a", 3500));
    expect(r.ok).toBe(false);
    expect(h.current).toBe(before);
  });

  it("same length = no undo step; bad numbers throw", () => {
    const h = setup([wall("a", 0, 0, 4000, 0)]);
    h.execute(setWallLengthCommand("a", 4000));
    expect(h.undoLabel).toEqual({ key: "x" });
    expect(() => setWallLengthCommand("a", 0)).toThrow(RangeError);
    expect(() => setWallLengthCommand("a", NaN)).toThrow(RangeError);
  });
});
