import {
  History,
  deleteCommand,
  emptyProject,
  moveCommand,
  putElements,
  updateCommand,
  type Project,
  type Wall,
} from "@prumo/core";
import { describe, expect, it } from "vitest";
import {
  R_PROT_001,
  isProtection,
  protectCommand,
  protectionData,
  protectionOf,
  runChecks,
  setSystemCommand,
  unprotectCommand,
} from "../src";

const wall = (id: string, o: Partial<Wall> = {}): Wall => ({
  id,
  type: "wall",
  levelId: "l",
  start: { x: 0, y: 0 },
  end: { x: 4000, y: 0 },
  alignment: "center",
  kind: "full",
  thickness: 140,
  height: 2700,
  baseOffset: 0,
  components: {},
  ...o,
});
const NOW = "2026-11-17T12:00:00.000Z";
const base = (): Project =>
  putElements(emptyProject({ id: "p", levelId: "l", name: "t", now: "", profileId: "br-nbr/structural-masonry" }), [
    wall("w"),
    wall("x", { start: { x: 0, y: 3000 }, end: { x: 4000, y: 3000 } }),
  ]);
const protectedP = () => protectCommand(base().elements.w as Wall, "Ana", NOW, "pr-1").apply(base());
const run = (p: Project) =>
  runChecks(p, "l", { rules: [R_PROT_001] }).findings.map((f) => `${f.messageKey}:${f.elementIds.join("+")}`);

describe("protection markers (ADR-044 slice 2)", () => {
  it("protecting records the wall as it is, the author and the date; nothing to report while untouched", () => {
    const p = protectedP();
    const pr = protectionOf(p, "w");
    expect(pr && isProtection(pr)).toBe(true);
    expect(pr && protectionData(pr)).toEqual({
      wallId: "w",
      wall: { start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, kind: "full" },
      author: "Ana",
      createdAt: NOW,
    });
    expect(run(p)).toEqual([]);
    expect(protectionOf(p, "x")).toBeNull();
  });

  it("R-PROT-001: removed / moved / turned into a fence → critical; never blocks the edit", () => {
    const p = protectedP();
    const h = new History(p);
    expect(h.execute(deleteCommand(p, ["w"])).ok).toBe(true);
    expect(run(h.current)).toEqual(["rule.R-PROT-001.removed:pr-1"]);
    expect(run(moveCommand(["w"], { x: 0, y: 500 }).apply(p))).toEqual(["rule.R-PROT-001.moved:w+pr-1"]);
    const fence = updateCommand({ key: "x" }, ["w"], (e) => ({ ...(e as Wall), kind: "fence" })).apply(p);
    expect(run(fence)).toEqual(["rule.R-PROT-001.kind:w+pr-1"]);
    const f = runChecks(h.current, "l", { rules: [R_PROT_001] }).findings[0];
    expect(f?.severity).toBe("critical");
    expect(f?.params.author).toEqual({ kind: "name", name: "Ana" });
  });

  it("a 0.5 mm nudge isn't a move (drawing precision)", () => {
    expect(run(moveCommand(["w"], { x: 0.5, y: 0 }).apply(protectedP()))).toEqual([]);
  });

  it("the protection outlives its wall: deleting the wall keeps the marker (so the warning stays)", () => {
    const p = deleteCommand(protectedP(), ["w"]).apply(protectedP());
    expect(isProtection(p.elements["pr-1"])).toBe(true);
  });

  it("'protect it where it is now' renews the same marker and clears the finding; remove drops it", () => {
    const moved = moveCommand(["w"], { x: 0, y: 500 }).apply(protectedP());
    const renewed = protectCommand(moved.elements.w as Wall, "Bruno", NOW, "pr-NEW").apply(moved);
    expect(
      Object.values(renewed.elements)
        .filter(isProtection)
        .map((e) => e.id),
    ).toEqual(["pr-1"]);
    expect(run(renewed)).toEqual([]);
    const pr = protectionOf(renewed, "w");
    expect(pr && protectionData(pr)?.author).toBe("Bruno");
    const gone = unprotectCommand("pr-1").apply(deleteCommand(moved, ["w"]).apply(moved));
    expect(run(gone)).toEqual([]);
    expect(gone.elements["pr-1"]).toBeUndefined();
  });

  it("runs for a concrete frame too (it's the user's own marker, not a masonry rule)", () => {
    const p = setSystemCommand("rc-frame").apply(deleteCommand(protectedP(), ["w"]).apply(protectedP()));
    expect(runChecks(p, "l").findings.map((f) => f.ruleId)).toEqual(["R-PROT-001"]);
  });
});
