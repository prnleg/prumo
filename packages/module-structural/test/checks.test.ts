import {
  ModuleHost,
  emptyProject,
  openWithModules,
  putElements,
  saveProjectFile,
  type Element,
  type Opening,
  type Project,
  type Wall,
} from "@prumo/core";
import { architectManifest } from "@prumo/module-architect";
import { describe, expect, it } from "vitest";
import {
  NOT_CHECKED,
  STRUCTURAL,
  constructionSystem,
  diffFindings,
  profileIdFor,
  runChecks,
  setLintel,
  setWallRole,
  structuralManifest,
  type ConstructionSystem,
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
const win = (id: string, host: string, o: Partial<Opening> = {}): Opening => ({
  id,
  type: "opening",
  levelId: "l",
  host: { elementId: host, offset: 1000 },
  width: 1200,
  height: 1200,
  sillHeight: 1000,
  kind: "window",
  components: {},
  ...o,
});
const project = (els: Element[], system: ConstructionSystem = "structural-masonry"): Project =>
  putElements(
    emptyProject({
      id: "p",
      levelId: "l",
      name: "t",
      now: "2026-11-17T00:00:00.000Z",
      profileId: profileIdFor(system),
    }),
    els,
  );
const ids = (p: Project) => runChecks(p, "l").findings.map((f) => `${f.ruleId}:${f.elementIds[0]}`);

describe("construction system (ADR-042)", () => {
  it("reads the system from profileId; anything else = unknown", () => {
    expect(constructionSystem(project([], "rc-frame"))).toBe("rc-frame");
    expect(constructionSystem({ ...project([]), profileId: "br-nbr/adobe" })).toBe("unknown");
  });

  it("unknown → masonry rules run, and every finding says that's an assumption (E-01)", () => {
    const r = runChecks(project([wall("w"), win("o", "w")], "unknown"), "l");
    expect(r.checksRun.map((c) => c.id)).toEqual(["R-OPEN-001", "R-ROLE-001"]);
    expect(r.findings[0]!.assumptions.map((a) => a.id)).toEqual(["A-ROLE-2", "A-SYS-1"]);
  });

  it("RC frame: no rules yet (that pack comes later) → nothing checked, nothing found", () => {
    const r = runChecks(project([wall("w"), win("o", "w")], "rc-frame"), "l");
    expect([r.checksRun, r.findings]).toEqual([[], []]);
  });
});

describe("R-OPEN-001: opening in a load-bearing wall without a lintel", () => {
  it("masonry: an unmarked wall counts as load-bearing (ADR-017) → warning, assumption shown", () => {
    const r = runChecks(project([wall("w"), win("o", "w")]), "l");
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toMatchObject({
      ruleId: "R-OPEN-001",
      severity: "warning",
      elementIds: ["o", "w"],
      messageKey: "rule.R-OPEN-001.message",
      fingerprint: "R-OPEN-001|o|w",
    });
    expect(r.findings[0]!.assumptions[0]!.id).toBe("A-ROLE-2");
  });

  it("same severity when the wall is marked load-bearing (E-07); the assumption changes, not the severity", () => {
    const marked = runChecks(project([setWallRole(wall("w"), "bearing", "drawing"), win("o", "w")]), "l").findings[0]!;
    expect(marked.severity).toBe("warning");
    expect(marked.assumptions[0]).toMatchObject({ id: "A-ROLE-1", params: { origin: { key: "origin.drawing" } } });
  });

  it("a lintel marked → no finding; marked non-bearing → no lintel finding (R-ROLE-001 instead)", () => {
    expect(ids(project([wall("w"), setLintel(win("o", "w"), true)]))).toEqual([]);
    expect(ids(project([setWallRole(wall("w"), "non-bearing", "professional"), win("o", "w")]))).toEqual([
      "R-ROLE-001:w",
    ]);
  });

  it("an opening up to the top of the wall: the element above is its lintel (E-06 wording)", () => {
    const door = win("d", "w", { kind: "door", sillHeight: 0, height: 2700, handing: "left", swing: "in" });
    expect(runChecks(project([wall("w"), door]), "l").findings[0]!.messageKey).toBe("rule.R-OPEN-001.messageToTop");
  });

  it("fences, railings and room dividers never carry load", () => {
    for (const kind of ["fence", "railing", "separator"] as const)
      expect(ids(project([wall("w", { kind }), win("o", "w")]))).toEqual([]);
  });

  it("deterministic: element insertion order doesn't matter", () => {
    const els = [
      wall("w1"),
      wall("w2", { start: { x: 0, y: 3000 }, end: { x: 4000, y: 3000 } }),
      win("a", "w2"),
      win("b", "w1"),
    ];
    expect(runChecks(project(els), "l")).toEqual(runChecks(project([...els].reverse()), "l"));
    expect(ids(project(els))).toEqual(["R-OPEN-001:a", "R-OPEN-001:b"]);
  });
});

describe("findings diff (change impact)", () => {
  it("adding a lintel resolves the finding; nothing new appears", () => {
    const before = runChecks(project([wall("w"), win("o", "w")]), "l").findings;
    const after = runChecks(project([wall("w"), setLintel(win("o", "w"), true)]), "l").findings;
    const d = diffFindings(before, after);
    expect([d.added.length, d.resolved.map((f) => f.fingerprint), d.unchanged.length]).toEqual([
      0,
      ["R-OPEN-001|o|w"],
      0,
    ]);
  });

  it("the 'not checked' list is never empty (SAFETY: show what wasn't checked)", () => {
    expect(NOT_CHECKED.length).toBeGreaterThanOrEqual(10);
  });
});

describe("module (ADR-019/042)", () => {
  const host = (disabled: string[] = []) => new ModuleHost([architectManifest, structuralManifest], { disabled });

  it("data helpers keep files clean: back to 'not specified' removes the component", () => {
    const w = setWallRole(wall("w"), "non-bearing", "drawing");
    expect(w.components[STRUCTURAL]).toEqual({ v: 1, data: { role: "non-bearing", origin: "drawing" } });
    expect(setWallRole(w, undefined).components).toEqual({});
    expect(setLintel(setLintel(win("o", "w"), true), false).components).toEqual({});
  });

  it("saved and opened back unchanged; a disabled Structural module keeps the data (MODULES rule 7)", () => {
    const p = project([setWallRole(wall("w"), "bearing", "professional"), setLintel(win("o", "w"), true)]);
    for (const h of [host(), host([STRUCTURAL])]) {
      const back = openWithModules(saveProjectFile({ project: p, snapshots: [], extra: {} }, h), h);
      expect(back.status).toBe("ok");
      if (back.status === "ok") expect(back.file.project.elements).toEqual(p.elements);
    }
  });
});
