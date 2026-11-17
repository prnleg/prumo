import {
  emptyProject,
  putElements,
  removeElements,
  type Element,
  type Opening,
  type Project,
  type Wall,
} from "@prumo/core";
import { describe, expect, it } from "vitest";
import { runChecks, setLintel, setWallRole } from "../src";

const wall = (id: string, y: number, o: Partial<Wall> = {}): Wall => ({
  id,
  type: "wall",
  levelId: "l",
  start: { x: 0, y },
  end: { x: 4000, y },
  alignment: "center",
  kind: "full",
  thickness: 140,
  height: 2700,
  baseOffset: 0,
  components: {},
  ...o,
});
const door = (id: string, host: string, offset: number, o: Partial<Opening> = {}): Opening =>
  setLintel(
    {
      id,
      type: "opening",
      levelId: "l",
      host: { elementId: host, offset },
      width: 800,
      height: 2100,
      sillHeight: 0,
      kind: "door",
      handing: "left",
      swing: "in",
      components: {},
      ...o,
    },
    true, // lintels everywhere: only the renovation rules speak in these tests
  );
const base = (els: Element[]): Project =>
  putElements(emptyProject({ id: "p", levelId: "l", name: "t", now: "", profileId: "br-nbr/structural-masonry" }), els);
const original = base([wall("a", 0), wall("b", 3000), door("d", "a", 1000)]);
const check = (now: Project, baseline: Project | null = original) =>
  runChecks(now, "l", { baseline }).findings.map((f) => `${f.ruleId}.${f.messageKey.split(".").pop()}:${f.severity}`);

describe("renovation checks need the existing building (ADR-043)", () => {
  it("without one they don't run and are listed as needing it", () => {
    const r = runChecks(original, "l");
    expect(r.checksRun.map((x) => x.id)).toEqual(["R-OPEN-001", "R-ROLE-001"]);
    expect(r.needBaseline.map((x) => x.id)).toEqual(["R-OPEN-NEW", "R-WALL-002"]);
  });
  it("unchanged plan → nothing", () => {
    expect(check(original)).toEqual([]);
  });
});

describe("R-WALL-002: a load-bearing wall removed, moved or changed", () => {
  it("removed → critical, nothing to point at on the plan", () => {
    const r = runChecks(removeElements(original, ["b"]), "l", { baseline: original });
    expect(r.findings).toMatchObject([
      { ruleId: "R-WALL-002", severity: "critical", elementIds: [], messageKey: "rule.R-WALL-002.removed" },
    ]);
    expect(r.findings[0]!.params.length).toEqual({ kind: "length", mm: 4000 });
  });
  it("moved 1 m, or turned into a fence → critical; a 0.5 mm nudge isn't a move", () => {
    expect(check(putElements(original, [wall("b", 4000)]))).toEqual(["R-WALL-002.moved:critical"]);
    expect(check(putElements(original, [wall("b", 3000, { kind: "fence" })]))).toEqual(["R-WALL-002.kind:critical"]);
    expect(check(putElements(original, [wall("b", 3000.5)]))).toEqual([]);
  });
  it("a wall that was marked as a partition in the existing building may go", () => {
    const orig = putElements(original, [setWallRole(wall("b", 3000), "non-bearing", "drawing")]);
    expect(check(removeElements(orig, ["b"]), orig)).toEqual([]);
  });
});

describe("R-OPEN-NEW: an opening added or enlarged in a load-bearing wall", () => {
  it("new door → critical; widened → warning; slid along the wall → nothing", () => {
    expect(check(putElements(original, [door("n", "b", 1000)]))).toEqual(["R-OPEN-NEW.new:critical"]);
    expect(check(putElements(original, [door("d", "a", 1000, { width: 1200 })]))).toEqual([
      "R-OPEN-NEW.enlarged:warning",
    ]);
    expect(check(putElements(original, [door("d", "a", 2500)]))).toEqual([]);
  });
  it("taller (reaches higher) or a lower sill is also enlarging", () => {
    expect(check(putElements(original, [door("d", "a", 1000, { height: 2400 })]))).toEqual([
      "R-OPEN-NEW.enlarged:warning",
    ]);
  });
  it("moved to another wall = a new hole in that wall", () => {
    expect(check(putElements(original, [door("d", "b", 1000)]))).toEqual(["R-OPEN-NEW.new:critical"]);
  });
  it("in a wall marked as a partition → not this rule", () => {
    const now = putElements(original, [setWallRole(wall("b", 3000), "non-bearing", "drawing"), door("n", "b", 1000)]);
    expect(check(now).filter((x) => x.startsWith("R-OPEN-NEW"))).toEqual([]);
  });
});
