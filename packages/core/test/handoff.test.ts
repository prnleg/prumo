// Hand-off "baton" (ADR-044 slice 3): one holder edits; others look and leave notes.
import { describe, expect, it } from "vitest";
import {
  History,
  deleteCommand,
  handOffCommand,
  handoffGuard,
  isHolder,
  putCommand,
  setGridCommand,
  takeOverCommand,
  validateProject,
  type Note,
  type Project,
} from "../src";
import { blank, wall } from "./fixtures";

const AT = "2026-11-17T12:00:00.000Z";
const note = (id: string): Note => ({
  id,
  type: "note",
  levelId: "l-1",
  text: "hi",
  author: "Bruno",
  createdAt: AT,
  at: { x: 0, y: 0 },
  targets: [],
  components: {},
});

function setup(me: string | null) {
  let who = me;
  const p0 = putCommand({ key: "x" }, [wall("w1", 0, 0, 4000, 0)]).apply(blank());
  const h = new History(p0, { guard: handoffGuard(() => who) });
  return { h, as: (n: string | null) => (who = n) };
}

describe("hand-off", () => {
  it("solo use (never handed off): everyone may edit", () => {
    const { h } = setup(null);
    expect(isHolder(h.current, null)).toBe(true);
    expect(h.execute(deleteCommand(h.current, ["w1"])).ok).toBe(true);
  });

  it("handing off records who, to whom, when, the message and the snapshot; the file stays valid", () => {
    const { h } = setup("Ana");
    expect(
      h.execute(handOffCommand({ from: "Ana", to: "Bruno", at: AT, message: "Your turn", snapshotId: "s-1" })).ok,
    ).toBe(true);
    expect(h.current.handoff).toEqual({
      holder: "Bruno",
      log: [{ kind: "hand", from: "Ana", to: "Bruno", at: AT, message: "Your turn", snapshotId: "s-1" }],
    });
    expect(validateProject(h.current)).toEqual([]);
    expect(validateProject({ ...h.current, handoff: { holder: 3 } } as unknown as Project)).toEqual([
      "project.handoff must be { holder, log[] }",
    ]);
  });

  it("not the holder: edits refused (not-your-turn), notes allowed", () => {
    const { h } = setup("Ana");
    h.execute(handOffCommand({ from: "Ana", to: "Bruno", at: AT }));
    // still Ana at this computer → she gave the baton away
    const r = h.execute(deleteCommand(h.current, ["w1"]));
    expect(r.ok ? [] : r.problems.map((p) => p.code)).toEqual(["not-your-turn"]);
    expect(h.execute(setGridCommand(50)).ok).toBe(false); // settings too
    expect(h.execute(putCommand({ key: "cmd.addNote" }, [note("n1")])).ok).toBe(true);
    expect(h.execute(deleteCommand(h.current, ["n1"])).ok).toBe(true);
  });

  it("the holder edits normally; taking over is logged and gives the baton", () => {
    const { h, as } = setup("Ana");
    h.execute(handOffCommand({ from: "Ana", to: "Bruno", at: AT }));
    as("Bruno");
    expect(h.execute(deleteCommand(h.current, ["w1"])).ok).toBe(true);
    h.undo();
    as("Carla");
    expect(h.execute(takeOverCommand("Carla", AT)).ok).toBe(true);
    expect(h.current.handoff?.holder).toBe("Carla");
    expect(h.current.handoff?.log.at(-1)).toEqual({ kind: "take", from: "Bruno", to: "Carla", at: AT });
    expect(h.execute(deleteCommand(h.current, ["w1"])).ok).toBe(true);
  });

  it("a non-holder can't sneak a hand-off to themselves through a different command", () => {
    const { h } = setup("Ana");
    h.execute(handOffCommand({ from: "Ana", to: "Bruno", at: AT }));
    const sneaky = {
      label: { key: "x" },
      apply: (p: Project) => takeOverCommand("Ana", AT).apply(deleteCommand(p, ["w1"]).apply(p)),
    };
    expect(h.execute(sneaky).ok).toBe(false);
  });
});
