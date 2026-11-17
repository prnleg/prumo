import { describe, expect, it } from "vitest";
import {
  History,
  copyToClipboard,
  counterIds,
  deleteCommand,
  offsetAlong,
  pasteCommand,
  pasteOpeningsCommand,
  putCommand,
  type Opening,
  type Project,
  type Wall,
} from "../src";
import { blank, wall } from "./fixtures";

const opening = (id: string, host: string, offset: number, width = 800): Opening => ({
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
const base = (): Project =>
  putCommand({ key: "x" }, [
    wall("w1", 0, 0, 4000, 0),
    wall("w2", 4000, 0, 4000, 3000),
    opening("o1", "w1", 500),
    opening("o2", "w1", 2000, 900),
    opening("o3", "w2", 1000),
  ]).apply(blank());
const W = (p: Project, id: string) => p.elements[id] as Wall;
const O = (p: Project, id: string) => p.elements[id] as Opening;

describe("copy / paste (EDITING_OPERATIONS 'Copy')", () => {
  it("copying walls takes their openings; anchor = bbox centre (2000, 1500)", () => {
    const c = copyToClipboard(base(), ["w1", "w2"]);
    expect(c.walls.map((w) => w.id)).toEqual(["w1", "w2"]);
    expect(c.hosted.map((o) => o.id)).toEqual(["o1", "o2", "o3"]);
    expect(c.loose).toEqual([]);
    expect(c.anchor).toEqual({ x: 2000, y: 1500 });
  });

  it("the clipboard is detached: cut (copy + delete) then paste brings everything back, moved", () => {
    const h = new History(base());
    const clip = copyToClipboard(h.current, ["w1"]);
    h.execute(deleteCommand(h.current, ["w1"]));
    expect(h.current.elements["w1"]).toBeUndefined();
    const r = pasteCommand(clip, { x: 0, y: 5000 }, "l-1", counterIds("c"));
    expect(h.execute(r.command).ok).toBe(true);
    expect(r.newIds).toEqual(["c-1"]);
    expect(W(h.current, "c-1")).toMatchObject({ start: { x: 0, y: 5000 }, end: { x: 4000, y: 5000 } });
    expect(O(h.current, "c-2").host).toEqual({ elementId: "c-1", offset: 500 });
    expect(O(h.current, "c-3").host).toEqual({ elementId: "c-1", offset: 2000 });
    expect(r.command.label).toEqual({ key: "cmd.paste", params: { count: 3 } });
  });

  it("pasting twice gives two independent copies (ids drawn per paste)", () => {
    const p = base();
    const clip = copyToClipboard(p, ["w2"]);
    const ids = counterIds("c");
    const q = pasteCommand(clip, { x: 1000, y: 0 }, "l-1", ids).command.apply(p);
    const r = pasteCommand(clip, { x: 2000, y: 0 }, "l-1", ids).command.apply(q);
    expect(Object.keys(r.elements).sort()).toEqual(["c-1", "c-2", "c-3", "c-4", "o1", "o2", "o3", "w1", "w2"]);
    expect(W(r, "c-3").start).toEqual({ x: 6000, y: 0 });
  });

  it("loose openings: same-wall spacing kept, next wall's group after a 200 mm gap", () => {
    const p = base();
    const clip = copyToClipboard(p, ["o3", "o2", "o1"]); // order of the selection doesn't matter
    expect(clip.loose.map((o) => o.id)).toEqual(["o1", "o2", "o3"]);
    expect(clip.anchor).toBeNull();
    const target = wall("t", 0, 6000, 8000, 6000);
    const q = putCommand({ key: "x" }, [target]).apply(p);
    const r = pasteOpeningsCommand(clip, target, 1000, counterIds("c"));
    const out = r.command.apply(q);
    // o1 at 1000 (width 800); o2 was 1500 after o1 → 2500 (width 900, ends 3400); o3 after 200 gap → 3600
    expect(r.newIds.map((id) => O(out, id).host)).toEqual([
      { elementId: "t", offset: 1000 },
      { elementId: "t", offset: 2500 },
      { elementId: "t", offset: 3600 },
    ]);
  });

  it("a loose paste that doesn't fit is refused by the invariants (nothing changes)", () => {
    const h = new History(base());
    const clip = copyToClipboard(h.current, ["o2"]);
    const r = pasteOpeningsCommand(clip, W(h.current, "w2"), 2500, counterIds("c")); // 2500 + 900 > 3000
    const res = h.execute(r.command);
    expect(res.ok).toBe(false);
    expect(h.current.elements["c-1"]).toBeUndefined();
  });

  it("offsetAlong: projection onto the wall, clamped to its ends", () => {
    const w = wall("a", 0, 0, 4000, 0);
    expect(offsetAlong(w, { x: 1234, y: 300 })).toBe(1234);
    expect(offsetAlong(w, { x: -50, y: 0 })).toBe(0);
    expect(offsetAlong(w, { x: 9000, y: 0 })).toBe(4000);
  });
});
