import { emptyProject, putElements, type Element, type Opening, type Project, type Wall } from "@prumo/core";
import { describe, expect, it } from "vitest";
import {
  R_JOINT_001,
  R_OPEN_006,
  R_RING_001,
  runChecks,
  setBonded,
  setContraverga,
  setTieBeam,
  setWallRole,
  type RuleDef,
} from "../src";

const wall = (id: string, x1: number, y1: number, x2: number, y2: number, o: Partial<Wall> = {}): Wall => ({
  id,
  type: "wall",
  levelId: "l",
  start: { x: x1, y: y1 },
  end: { x: x2, y: y2 },
  alignment: "center",
  kind: "full",
  thickness: 140,
  height: 2700,
  baseOffset: 0,
  components: {},
  ...o,
});
const opening = (id: string, host: string, kind: "window" | "door"): Opening => ({
  id,
  type: "opening",
  levelId: "l",
  host: { elementId: host, offset: 1000 },
  width: 1000,
  height: kind === "door" ? 2100 : 1200,
  sillHeight: kind === "door" ? 0 : 1000,
  kind,
  ...(kind === "door" ? { handing: "left" as const, swing: "in" as const } : {}),
  components: {},
});
const project = (els: Element[]): Project =>
  putElements(emptyProject({ id: "p", levelId: "l", name: "t", now: "", profileId: "br-nbr/structural-masonry" }), els);
const only = (rule: RuleDef, els: Element[]) =>
  runChecks(project(els), "l", { rules: [rule] }).findings.map((f) => `${f.severity}:${f.elementIds.join("+")}`);

describe("R-OPEN-006: window without a sill reinforcement (contraverga)", () => {
  it("window in a load-bearing wall → advice; door, contraverga, or partition wall → nothing", () => {
    const w = wall("w", 0, 0, 4000, 0);
    expect(only(R_OPEN_006, [w, opening("o", "w", "window")])).toEqual(["advisory:o+w"]);
    expect(only(R_OPEN_006, [w, opening("o", "w", "door")])).toEqual([]);
    expect(only(R_OPEN_006, [w, setContraverga(opening("o", "w", "window"), true)])).toEqual([]);
    expect(only(R_OPEN_006, [setWallRole(w, "non-bearing", "drawing"), opening("o", "w", "window")])).toEqual([]);
  });
});

describe("R-RING-001: load-bearing wall without a tie beam on top", () => {
  it("full wall → warning; tie beam, half wall (parapet), fence or partition → nothing", () => {
    expect(only(R_RING_001, [wall("w", 0, 0, 4000, 0)])).toEqual(["warning:w"]);
    expect(only(R_RING_001, [setTieBeam(wall("w", 0, 0, 4000, 0), true)])).toEqual([]);
    for (const kind of ["half", "fence"] as const)
      expect(only(R_RING_001, [wall("w", 0, 0, 4000, 0, { kind })])).toEqual([]);
    expect(only(R_RING_001, [setWallRole(wall("w", 0, 0, 4000, 0), "non-bearing", "own-judgement")])).toEqual([]);
  });
});

describe("R-JOINT-001: load-bearing walls meeting without being bonded", () => {
  const a = wall("a", 0, 0, 4000, 0);
  const b = wall("b", 4000, 0, 4000, 3000); // L corner at (4000, 0): a's end, b's start
  it("an L corner → one finding for the pair, whichever wall it's seen from", () => {
    expect(only(R_JOINT_001, [a, b])).toEqual(["warning:a+b"]);
  });
  it("either wall's end marked bonded at the corner → bonded", () => {
    expect(only(R_JOINT_001, [setBonded(a, "end", true), b])).toEqual([]);
    expect(only(R_JOINT_001, [a, setBonded(b, "start", true)])).toEqual([]);
    expect(only(R_JOINT_001, [setBonded(a, "start", true), b])).toEqual(["warning:a+b"]); // wrong end
  });
  it("a T: the stem's end decides (the through-wall has no end there)", () => {
    const stem = wall("s", 2000, 0, 2000, 3000); // starts on a's body
    expect(only(R_JOINT_001, [a, stem])).toEqual(["warning:a+s"]);
    expect(only(R_JOINT_001, [setBonded(a, "start", true), setBonded(a, "end", true), stem])).toEqual(["warning:a+s"]);
    expect(only(R_JOINT_001, [a, setBonded(stem, "start", true)])).toEqual([]);
  });
  it("free-standing walls and partitions don't make junctions", () => {
    expect(only(R_JOINT_001, [a])).toEqual([]);
    expect(only(R_JOINT_001, [a, setWallRole(b, "non-bearing", "drawing")])).toEqual([]);
  });
  it("three walls at one point → one junction", () => {
    const c = wall("c", 4000, 0, 8000, 0);
    expect(only(R_JOINT_001, [a, b, c])).toEqual(["warning:a+b+c"]);
  });
  it("setBonded cleans up: unmarking the last end removes the field", () => {
    expect(setBonded(setBonded(a, "end", true), "end", false).components).toEqual({});
  });
});
