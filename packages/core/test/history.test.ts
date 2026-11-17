import { describe, expect, it } from "vitest";
import {
  History,
  HistoryError,
  batch,
  checkInvariants,
  deleteCommand,
  putCommand,
  removeElements,
  updateCommand,
  type Command,
  type HistoryEvent,
  type Opening,
  type Project,
} from "../src";
import { ELEC, blank, wall } from "./fixtures";

const L = (key: string) => ({ key });

function opening(id: string, host: string, offset: number, width = 1200, extra: Partial<Opening> = {}): Opening {
  return {
    id,
    type: "opening",
    levelId: "l-1",
    host: { elementId: host, offset },
    width,
    height: 1200,
    sillHeight: 1000,
    kind: "window",
    components: {},
    ...extra,
  };
}

/** wall w-1: 4000 mm along X, 2700 mm high; window o-1 at 1000…2200. */
function house(): Project {
  return putCommand(L("x"), [wall("w-1", 0, 0, 4000, 0), opening("o-1", "w-1", 1000)]).apply(blank());
}

describe("invariants (DATA_MODEL I-1…I-5) — Q-072: blocked", () => {
  const check = (els: Parameters<typeof putCommand>[1]) =>
    checkInvariants(putCommand(L("x"), els).apply(house())).map((p) => `${p.code}:${p.elementIds.join(",")}`);

  it("a valid house has no problems", () => {
    expect(checkInvariants(house())).toEqual([]);
  });
  it("opening past the wall end: 3000 + 1200 = 4200 > 4000", () => {
    expect(check([opening("o-1", "w-1", 3000)])).toEqual(["opening-outside-wall:o-1,w-1"]);
  });
  it("…but 2800 + 1200 = 4000.005 is inside the 0.01 mm tolerance", () => {
    expect(check([opening("o-1", "w-1", 2800.005)])).toEqual([]);
  });
  it("opening above the wall: sill 1000 + 1800 = 2800 > 2700", () => {
    expect(check([opening("o-1", "w-1", 1000, 1200, { height: 1800 })])).toEqual(["opening-above-wall:o-1,w-1"]);
  });
  it("overlap: o-1 ends at 2200, o-2 starts at 2100; touching at 2200 is fine", () => {
    expect(check([opening("o-2", "w-1", 2100, 800)])).toEqual(["openings-overlap:o-1,o-2"]);
    expect(check([opening("o-2", "w-1", 2200, 800)])).toEqual([]);
  });
  it("host missing / not a wall / other level; level missing; zero-length wall; non-positive sizes", () => {
    const p = house();
    const twoLevels: Project = {
      ...p,
      levels: [...p.levels, { id: "l-2", name: null, elevation: 2800, defaultWallHeight: 2700 }],
    };
    expect(checkInvariants(putCommand(L("x"), [opening("o-9", "nope", 0)]).apply(p)).map((x) => x.code)).toEqual([
      "host-missing",
    ]);
    expect(checkInvariants(putCommand(L("x"), [opening("o-9", "o-1", 0)]).apply(p)).map((x) => x.code)).toEqual([
      "host-not-wall",
    ]);
    expect(
      checkInvariants(putCommand(L("x"), [opening("o-1", "w-1", 1000, 1200, { levelId: "l-2" })]).apply(twoLevels)).map(
        (x) => x.code,
      ),
    ).toEqual(["host-other-level"]);
    expect(check([wall("w-2", 0, 0, 4000, 0, { levelId: "l-x" })])).toEqual(["level-missing:w-2"]);
    expect(check([wall("w-2", 5, 5, 5.5, 5)])).toEqual(["wall-too-short:w-2"]);
    expect(check([wall("w-2", 0, 500, 10, 500, { thickness: 0 })])).toEqual(["non-positive-size:w-2"]);
    expect(check([opening("o-1", "w-1", 1000, 0)])).toEqual(["non-positive-size:o-1"]);
  });
  it("shortening a wall re-checks the openings it hosts", () => {
    expect(check([wall("w-1", 0, 0, 2000, 0)])).toEqual(["opening-outside-wall:o-1,w-1"]);
  });
});

describe("delete cascade (EDITING_OPERATIONS: a wall takes its openings)", () => {
  it("removes hosted items transitively and says so in the label", () => {
    const outlet = {
      id: "e-1",
      type: `${ELEC}:outlet` as const,
      ownerModule: ELEC,
      levelId: "l-1",
      host: { elementId: "o-1", offset: 0 },
      components: {},
    };
    const p = putCommand(L("x"), [outlet]).apply(house());
    const cmd = deleteCommand(p, ["w-1"]);
    expect(cmd.label).toEqual({ key: "cmd.deleteWithHosted", params: { count: 1, hosted: 2 } });
    expect(Object.keys(cmd.apply(p).elements)).toEqual([]);
    expect(deleteCommand(p, ["e-1"]).label).toEqual({ key: "cmd.delete", params: { count: 1 } });
  });
  it("unknown ids are ignored; nothing to delete → same project object", () => {
    const p = house();
    expect(removeElements(p, ["nope"])).toBe(p);
  });
});

describe("History (ADR-011)", () => {
  const moveWallEnd = (x: number): Command =>
    updateCommand(L("cmd.move"), ["w-1"], (e) => (e.type === "wall" ? { ...e, end: { x, y: 0 } } : e));

  it("execute → undo → redo restores the exact snapshots", () => {
    const h = new History(house(), { freeze: true });
    const p0 = h.current;
    expect(h.execute(moveWallEnd(5000)).ok).toBe(true);
    const p1 = h.current;
    expect(h.undoLabel).toEqual(L("cmd.move"));
    expect(h.undo()).toBe(true);
    expect(h.current).toBe(p0);
    expect(h.redo()).toBe(true);
    expect(h.current).toBe(p1);
    expect(h.undo() && h.undo()).toBe(false); // second undo: nothing left
  });

  it("an invalid command is blocked: no change, no undo step, problems returned", () => {
    const h = new History(house());
    const before = h.current;
    const r = h.execute(moveWallEnd(2000));
    expect(r).toEqual({ ok: false, problems: [{ code: "opening-outside-wall", elementIds: ["o-1", "w-1"] }] });
    expect(h.current).toBe(before);
    expect(h.canUndo).toBe(false);
  });

  it("a no-op command adds no undo step", () => {
    const h = new History(house());
    h.execute(updateCommand(L("x"), ["missing"], (e) => e));
    expect(h.canUndo).toBe(false);
  });

  it("a new command clears redo", () => {
    const h = new History(house());
    h.execute(moveWallEnd(5000));
    h.undo();
    h.execute(moveWallEnd(6000));
    expect(h.canRedo).toBe(false);
  });

  it("batch = one undo step", () => {
    const h = new History(blank());
    h.execute(
      batch(L("cmd.addRoom"), [
        putCommand(L("a"), [wall("w-1", 0, 0, 4000, 0)]),
        putCommand(L("b"), [wall("w-2", 4000, 0, 4000, 3000)]),
      ]),
    );
    expect(Object.keys(h.current.elements)).toEqual(["w-1", "w-2"]);
    h.undo();
    expect(Object.keys(h.current.elements)).toEqual([]);
  });

  it("frozen snapshots: a command that mutates its input throws", () => {
    const h = new History(house(), { freeze: true });
    const bad: Command = {
      label: L("bad"),
      apply: (p) => {
        (p.elements["w-1"] as { thickness: number }).thickness = 1;
        return p;
      },
    };
    expect(() => h.execute(bad)).toThrow(TypeError);
  });

  it("dirty tracks the saved snapshot, including undo back to it", () => {
    const h = new History(house());
    expect(h.dirty).toBe(false);
    h.execute(moveWallEnd(5000));
    expect(h.dirty).toBe(true);
    h.markSaved();
    h.undo();
    expect(h.dirty).toBe(true);
    h.redo();
    expect(h.dirty).toBe(false);
  });

  it("events: execute emits change then commit", () => {
    const h = new History(house());
    const ev: string[] = [];
    h.subscribe((e: HistoryEvent) => ev.push(`${e.type}${e.type === "change" ? ":" + e.reason : ""}`));
    h.execute(moveWallEnd(5000));
    h.undo();
    expect(ev).toEqual(["change:execute", "commit", "change:undo", "commit"]);
  });
});

describe("gestures (one drag = one undo step; ADR-025 events)", () => {
  const dragTo = (x: number) =>
    updateCommand(L("cmd.move"), ["w-1"], (e) => (e.type === "wall" ? { ...e, end: { x, y: 0 } } : e));

  it("previews are not cumulative, emit only `change`, and commit once", () => {
    const h = new History(house(), { freeze: true });
    const ev: string[] = [];
    h.subscribe((e) => ev.push(e.type === "change" ? `change:${e.reason}` : "commit"));
    const g = h.beginGesture(L("cmd.move"));
    for (const x of [4100, 4500, 5000]) expect(g.preview(dragTo(x)).ok).toBe(true);
    expect((h.current.elements["w-1"] as { end: { x: number } }).end.x).toBe(5000);
    expect(h.canUndo).toBe(false);
    g.commit();
    expect(ev).toEqual(["change:preview", "change:preview", "change:preview", "commit"]);
    h.undo();
    expect((h.current.elements["w-1"] as { end: { x: number } }).end.x).toBe(4000);
  });

  it("an invalid preview keeps the last valid one", () => {
    const h = new History(house());
    const g = h.beginGesture(L("cmd.move"));
    g.preview(dragTo(4500));
    expect(g.preview(dragTo(1500)).ok).toBe(false);
    expect((g.project.elements["w-1"] as { end: { x: number } }).end.x).toBe(4500);
    g.commit();
    expect((h.current.elements["w-1"] as { end: { x: number } }).end.x).toBe(4500);
  });

  it("cancel restores the base with no undo step; ops during a gesture throw", () => {
    const h = new History(house());
    const base = h.current;
    const g = h.beginGesture(L("cmd.move"));
    g.preview(dragTo(4500));
    expect(() => h.execute(dragTo(1))).toThrow(HistoryError);
    expect(() => h.undo()).toThrow(HistoryError);
    expect(() => h.beginGesture(L("x"))).toThrow(HistoryError);
    g.cancel();
    expect(h.current).toBe(base);
    expect(h.canUndo).toBe(false);
    expect(() => g.commit()).toThrow("gesture already ended");
  });

  it("a gesture that ends where it started adds no step", () => {
    const h = new History(house());
    h.beginGesture(L("cmd.move")).commit();
    expect(h.canUndo).toBe(false);
  });
});

describe("property: N random operations, undo N times → original (EDITING_OPERATIONS)", () => {
  // Deterministic PRNG (mulberry32) so failures reproduce.
  function rng(seed: number) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  for (const seed of [1, 2, 3, 42]) {
    it(`seed ${seed}`, () => {
      const r = rng(seed);
      const h = new History(house(), { freeze: true });
      const original = h.current;
      let n = 0;
      let next = 0;
      for (let i = 0; i < 60; i++) {
        const ids = Object.keys(h.current.elements);
        const k = Math.floor(r() * 4);
        let cmd: Command;
        if (k === 0 || !ids.length) {
          const id = `w-r${next++}`;
          cmd = putCommand(L("add"), [wall(id, r() * 9000, r() * 9000, r() * 9000 + 2000, r() * 9000)]);
        } else if (k === 1) {
          cmd = deleteCommand(h.current, [ids[Math.floor(r() * ids.length)]!]);
        } else if (k === 2) {
          const walls = ids.filter((id) => h.current.elements[id]!.type === "wall");
          if (!walls.length) continue;
          const host = walls[Math.floor(r() * walls.length)]!;
          cmd = putCommand(L("open"), [opening(`o-r${next++}`, host, r() * 3000, 200 + r() * 1500)]);
        } else {
          cmd = updateCommand(L("move"), [ids[Math.floor(r() * ids.length)]!], (e) =>
            e.type === "wall" ? { ...e, end: { x: e.end.x + r() * 400 - 200, y: e.end.y } } : e,
          );
        }
        const res = h.execute(cmd);
        if (res.ok && h.canUndo && h.current !== original) n = countSteps(h);
      }
      expect(n).toBeGreaterThan(20); // not vacuous
      const final = h.current;
      for (let i = 0; i < n; i++) expect(h.undo()).toBe(true);
      expect(h.canUndo).toBe(false);
      expect(h.current).toBe(original);
      for (let i = 0; i < n; i++) h.redo();
      expect(h.current).toBe(final);
      expect(checkInvariants(final)).toEqual([]); // blocked edits never leaked in
    });
  }

  function countSteps(h: History): number {
    return (h as unknown as { past: unknown[] }).past.length;
  }
});

describe("Gesture.commit(label)", () => {
  it("a drag that turned into something else commits under the new label (re-host)", () => {
    const h = new History(blank());
    const g = h.beginGesture({ key: "cmd.move" });
    g.preview(putCommand({ key: "x" }, [wall("a", 0, 0, 1000, 0)]));
    g.commit({ key: "cmd.rehost", params: { kind: "door" } });
    expect(h.undoLabel).toEqual({ key: "cmd.rehost", params: { kind: "door" } });
  });
});

describe("History.load (New / Open)", () => {
  it("replaces the document, clears undo/redo, is not dirty, emits change + commit", () => {
    const h = new History(house());
    h.execute(updateCommand(L("x"), ["w-1"], (e) => (e.type === "wall" ? { ...e, thickness: 200 } : e)));
    const ev: string[] = [];
    h.subscribe((e) => ev.push(e.type));
    const other = blank();
    h.load(other);
    expect(h.current).toBe(other);
    expect([h.canUndo, h.canRedo, h.dirty]).toEqual([false, false, false]);
    expect(ev).toEqual(["change", "commit"]);
    expect(() => {
      h.beginGesture(L("g"));
      h.load(blank());
    }).toThrow(HistoryError);
  });
});

describe("markUnsaved (recovered work)", () => {
  it("is dirty right away, clean again after markSaved", () => {
    const h = new History(blank());
    expect(h.dirty).toBe(false);
    h.markUnsaved();
    expect(h.dirty).toBe(true);
    h.markSaved();
    expect(h.dirty).toBe(false);
  });
});
