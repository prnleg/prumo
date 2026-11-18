import { emptyProject, putElements, type Element, type Project, type Wall } from "@prumo/core";
import { describe, expect, it } from "vitest";
import { CHASE, R_WALL_004, chaseDir, isChase, newChase, runChecks, setSystemCommand, setWallRole } from "../src";

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
const project = (els: Element[]): Project =>
  putElements(emptyProject({ id: "p", levelId: "l", name: "t", now: "", profileId: "br-nbr/structural-masonry" }), els);
const run = (p: Project) =>
  runChecks(p, "l", { rules: [R_WALL_004] }).findings.map(
    (f) => `${f.severity}:${f.messageKey}:${f.elementIds.join("+")}`,
  );

describe("chase element (ADR-042 addition)", () => {
  it("horizontal chases have a run along the wall; vertical ones are a point", () => {
    const w = wall("w");
    const h = newChase("c", w, 500, "horizontal", 1200);
    expect(h).toMatchObject({ type: CHASE, host: { elementId: "w", offset: 500, length: 1200 } });
    expect(chaseDir(h)).toBe("horizontal");
    const v = newChase("v", w, 900, "vertical", 1200);
    expect(v.host).toEqual({ elementId: "w", offset: 900 }); // length ignored for vertical
    expect(chaseDir(v)).toBe("vertical");
    expect(isChase(v)).toBe(true);
    expect(isChase(w)).toBe(false);
  });

  it("unreadable direction data counts as horizontal (the more serious case)", () => {
    const c = { ...newChase("c", wall("w"), 0, "vertical"), components: {} };
    expect(chaseDir(c)).toBe("horizontal");
  });
});

describe("R-WALL-004: chase cut in a load-bearing wall", () => {
  const w = wall("w");
  it("horizontal → warning, vertical → advice (E-02: esp. horizontal)", () => {
    const p = project([w, newChase("c", w, 500, "horizontal", 1200), newChase("v", w, 3000, "vertical")]);
    expect(run(p)).toEqual(["warning:rule.R-WALL-004.horizontal:c+w", "advisory:rule.R-WALL-004.vertical:v+w"]);
    const f = runChecks(p, "l", { rules: [R_WALL_004] }).findings[0];
    expect(f?.params.length).toEqual({ kind: "length", mm: 1200 });
  });

  it("nothing on a wall marked non-bearing; a half wall can carry → still flagged", () => {
    const nb = setWallRole(w, "non-bearing", "professional");
    expect(run(project([nb, newChase("c", nb, 500, "horizontal", 1200)]))).toEqual([]);
    const half = wall("w", { kind: "half" });
    expect(run(project([half, newChase("c", half, 500, "horizontal", 1200)]))).toHaveLength(1);
  });

  it("not run for a reinforced-concrete frame (masonry rule)", () => {
    const p = setSystemCommand("rc-frame").apply(project([w, newChase("c", w, 500, "horizontal", 1200)]));
    expect(runChecks(p, "l").checksRun.map((r) => r.id)).not.toContain("R-WALL-004");
  });

  it("assumption A-ROLE-2 (masonry default) shown when the wall's role wasn't stated", () => {
    const f = runChecks(project([w, newChase("c", w, 500, "horizontal", 1200)]), "l", { rules: [R_WALL_004] })
      .findings[0];
    expect(f?.assumptions.map((a) => a.id)).toEqual(["A-ROLE-2"]);
  });
});
