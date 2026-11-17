// EDITING_OPERATIONS "Tests matrix (minimum)": each operation × {single wall, wall with 2 openings,
// L junction, T junction, multi-select (closed room + door + room name)}: do, undo, redo, save/load
// round trip after the op, invariants clean. (No slabs in the model yet: the multi-select case uses
// what exists.) Hand values live in each operation's own tests; this grid checks the plumbing holds.
import { describe, expect, it } from "vitest";
import {
  History,
  checkInvariants,
  copyToClipboard,
  counterIds,
  deleteCommand,
  duplicateCommand,
  mirrorCommand,
  moveCommand,
  openProjectFile,
  pasteCommand,
  putCommand,
  rotateCommand,
  saveProjectFile,
  setWallLengthCommand,
  wallLength,
  type Command,
  type Element,
  type Id,
  type Opening,
  type Project,
  type RoomTag,
  type Wall,
} from "../src";
import { ARCH, SENDER, blank, wall } from "./fixtures";

const opening = (id: string, host: string, offset: number, kind: "door" | "window" = "door"): Opening => ({
  id,
  type: "opening",
  levelId: "l-1",
  host: { elementId: host, offset },
  width: 800,
  height: kind === "door" ? 2100 : 1200,
  sillHeight: kind === "door" ? 0 : 1000,
  kind,
  ...(kind === "door" ? { handing: "left" as const, swing: "in" as const } : {}),
  components: {},
});
const tag: RoomTag = {
  id: "t",
  type: "room",
  levelId: "l-1",
  seed: { x: 2000, y: 1500 },
  name: "Sala",
  components: {},
};

const CASES: Record<string, { els: Element[]; sel: Id[] }> = {
  "single wall": { els: [wall("a", 0, 0, 4000, 0)], sel: ["a"] },
  "wall with 2 openings": {
    els: [wall("a", 0, 0, 4000, 0), opening("o1", "a", 500), opening("o2", "a", 2500, "window")],
    sel: ["a"],
  },
  "L junction": { els: [wall("a", 0, 0, 4000, 0), wall("b", 4000, 0, 4000, 3000)], sel: ["a"] },
  "T junction": { els: [wall("a", 0, 0, 4000, 0), wall("b", 2000, 0, 2000, 3000)], sel: ["b"] },
  "multi-select (room + door + name)": {
    els: [
      wall("a", 0, 0, 4000, 0),
      wall("b", 4000, 0, 4000, 3000),
      wall("c", 4000, 3000, 0, 3000),
      wall("d", 0, 3000, 0, 0),
      opening("o1", "a", 1600),
      tag,
    ],
    sel: ["a", "b", "c", "d", "o1"],
  },
};

const bboxOf = (p: Project, ids: Id[]) => {
  const ws = ids.map((id) => p.elements[id]).filter((e): e is Wall => e?.type === "wall");
  const xs = ws.flatMap((w) => [w.start.x, w.end.x]);
  const ys = ws.flatMap((w) => [w.start.y, w.end.y]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};

const OPS: Record<string, (p: Project, sel: Id[]) => Command> = {
  move: (_, sel) => moveCommand(sel, { x: 1000, y: 500 }),
  "move (detach)": (_, sel) => moveCommand(sel, { x: 1000, y: 500 }, { stretch: false }),
  duplicate: (p, sel) => duplicateCommand(p, sel, { x: 500, y: -5000 }, counterIds("dup")).command,
  "copy + paste": (p, sel) =>
    pasteCommand(copyToClipboard(p, sel), { x: 0, y: 8000 }, undefined, counterIds("pst")).command,
  "mirror in place": (p, sel) => {
    const b = bboxOf(p, sel);
    return mirrorCommand(p, sel, "vertical", { x: (b.x0 + b.x1) / 2, y: 0 }, { copy: false, newId: counterIds("m") })
      .command;
  },
  "mirror copy": (p, sel) => {
    const b = bboxOf(p, sel);
    return mirrorCommand(p, sel, "horizontal", { x: 0, y: b.y1 + 1000 }, { copy: true, newId: counterIds("mc") })
      .command;
  },
  "rotate 90°": (p, sel) => {
    const b = bboxOf(p, sel);
    return rotateCommand(sel, { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }, 90);
  },
  delete: (p, sel) => deleteCommand(p, sel),
  "type a length (+1 m)": (p, sel) => {
    const w = sel.map((id) => p.elements[id]).find((e): e is Wall => e?.type === "wall");
    if (!w) throw new Error("no wall");
    return setWallLengthCommand(w.id, wallLength(w) + 1000);
  },
};

const roundTrip = (p: Project) => {
  const r = openProjectFile(saveProjectFile({ project: p, snapshots: [], extra: {} }, SENDER), {
    installedModules: [ARCH],
  });
  if (r.status !== "ok") throw new Error(`open: ${r.status}`);
  return { ...r.file.project, modules: p.modules };
};

describe.each(Object.entries(CASES))("%s", (_, c) => {
  it.each(Object.keys(OPS))("%s: do → undo → redo → save/load", (op) => {
    const h = new History(putCommand({ key: "x" }, c.els).apply(blank()), { freeze: true });
    const before = h.current;
    const r = h.execute(OPS[op]!(before, c.sel));
    expect(r.ok ? [] : r.problems).toEqual([]);
    const after = h.current;
    expect(after).not.toBe(before); // every op changes something in every case
    expect(checkInvariants(after)).toEqual([]);
    h.undo();
    expect(h.current).toBe(before);
    h.redo();
    expect(h.current).toBe(after);
    expect(roundTrip(after)).toEqual(after);
  });
});
