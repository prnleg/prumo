import { describe, expect, it } from "vitest";
import { normalNorth, setNorthCommand, validateProject, type Project } from "../src";
import { blank } from "./fixtures";

describe("north on the plan (ADR-060)", () => {
  it("wraps to whole degrees 0…359", () => {
    expect([0, 45, 359.6, 360, -45, 725].map(normalNorth)).toEqual([0, 45, 0, 0, 315, 5]);
  });

  it("set is one undoable edit; setting the same value changes nothing; older files read as 0", () => {
    const p = blank();
    expect(p.settings.north).toBeUndefined();
    expect(setNorthCommand(0).apply(p)).toBe(p);
    const q = setNorthCommand(-90).apply(p);
    expect(q.settings.north).toBe(270);
    expect(validateProject(q)).toEqual([]);
  });

  it("a bad value in a file is reported", () => {
    const bad = (north: number): Project => ({ ...blank(), settings: { ...blank().settings, north } });
    expect(validateProject(bad(12.5))).toContain("project.settings.north must be a whole number of degrees, 0…359");
    expect(validateProject(bad(360))).toHaveLength(1);
  });
});
