// R-LOAD-001 / R-LOAD-002 (ADR-055): walls and openings on top of the floor below.
import { emptyProject, putCommand, type Opening, type Project, type Wall } from "@prumo/core";
import { describe, expect, it } from "vitest";
import { runChecks, R_LOAD_001, R_LOAD_002 } from "../src";

const W = (id: string, lv: string, x1: number, y1: number, x2: number, y2: number): Wall => ({
  id,
  type: "wall",
  levelId: lv,
  start: { x: x1, y: y1 },
  end: { x: x2, y: y2 },
  alignment: "center",
  kind: "full",
  thickness: 140,
  height: 2700,
  baseOffset: 0,
  components: {},
});
const O = (id: string, lv: string, host: string, offset: number, width: number): Opening => ({
  id,
  type: "opening",
  levelId: lv,
  host: { elementId: host, offset },
  width,
  height: 1200,
  sillHeight: 1000,
  kind: "window",
  components: {},
});
function project(els: Parameters<typeof putCommand>[1]): Project {
  const base = emptyProject({
    id: "p",
    levelId: "l",
    name: "t",
    now: "2026-11-18T00:00:00Z",
    profileId: "br-nbr/structural-masonry",
  });
  const p = { ...base, levels: [...base.levels, { id: "l2", name: null, elevation: 2800, defaultWallHeight: 2700 }] };
  return putCommand({ key: "x" }, els).apply(p);
}
const run = (p: Project, rule: typeof R_LOAD_001) => runChecks(p, "l2", { rules: [rule] }).findings;

describe("R-LOAD-001: upstairs wall with nothing under it", () => {
  it("a wall on top of a wall: nothing", () => {
    expect(run(project([W("a", "l", 0, 0, 4000, 0), W("u", "l2", 0, 0, 4000, 0)]), R_LOAD_001)).toEqual([]);
  });
  it("nothing under it at all → critical, 'none' wording", () => {
    const f = run(project([W("a", "l", 0, 0, 4000, 0), W("u", "l2", 2000, -1500, 2000, 1500)]), R_LOAD_001);
    expect(f.map((x) => [x.severity, x.messageKey, x.elementIds])).toEqual([
      ["critical", "rule.R-LOAD-001.none", ["u"]],
    ]);
  });
  it("overhangs by 1 m → 'part', with the length of the stretch", () => {
    const f = run(project([W("a", "l", 0, 0, 4000, 0), W("u", "l2", 0, 0, 5000, 0)]), R_LOAD_001);
    expect(f[0]?.messageKey).toBe("rule.R-LOAD-001.part");
    expect(f[0]?.params.length).toEqual({ kind: "length", mm: 1000 });
  });
  it("the ground floor has no floor below: never runs", () => {
    expect(runChecks(project([W("a", "l", 0, 0, 4000, 0)]), "l", { rules: [R_LOAD_001] }).findings).toEqual([]);
  });
});

describe("R-LOAD-002: openings not lined up", () => {
  const walls = [W("a", "l", 0, 0, 4000, 0), W("u", "l2", 0, 0, 4000, 0)];
  it("same span or one inside the other: nothing", () => {
    expect(run(project([...walls, O("d", "l", "a", 1000, 1200), O("w", "l2", "u", 1000, 1200)]), R_LOAD_002)).toEqual(
      [],
    );
    expect(run(project([...walls, O("d", "l", "a", 1000, 1200), O("w", "l2", "u", 1200, 600)]), R_LOAD_002)).toEqual(
      [],
    );
    expect(run(project([...walls, O("d", "l", "a", 1200, 600), O("w", "l2", "u", 1000, 1200)]), R_LOAD_002)).toEqual(
      [],
    );
  });
  it("partly over (1.0–2.2 m above 1.6–2.8 m) → advice", () => {
    const f = run(project([...walls, O("d", "l", "a", 1600, 1200), O("w", "l2", "u", 1000, 1200)]), R_LOAD_002);
    expect(f.map((x) => [x.severity, x.elementIds])).toEqual([["advisory", ["w", "d"]]]);
  });
  it("a reversed wall below (drawn end → start) is mapped correctly", () => {
    const p = project([
      W("a", "l", 4000, 0, 0, 0),
      W("u", "l2", 0, 0, 4000, 0),
      O("d", "l", "a", 1200, 1200),
      O("w", "l2", "u", 1000, 1200),
    ]);
    // below: offset 1200 from x = 4000 → x 2.8 … 1.6 m: partly under 1.0–2.2 → advice
    expect(run(p, R_LOAD_002)).toHaveLength(1);
  });
});
