import { emptyProject } from "@prumo/core";
import { describe, expect, it } from "vitest";
import { BUNDLED_PACKS, STRUCTURAL, packRegion, structuralPacks } from "../src";

describe("bundled data packs (ADR-049)", () => {
  it("Brazil ships with the module and parses", () => {
    expect(BUNDLED_PACKS.map((p) => [p.id, p.module])).toEqual([["br", STRUCTURAL]]);
    expect(
      structuralPacks()
        .chain(STRUCTURAL, "br/sp")
        .map((p) => p.id),
    ).toEqual(["br"]);
  });

  it("a project's region is the country of its profile", () => {
    const p = emptyProject({
      id: "p",
      levelId: "l",
      name: "x",
      now: "2026-11-18T00:00:00Z",
      profileId: "br-nbr/structural-masonry",
    });
    expect(packRegion(p)).toBe("br");
    expect(packRegion({ ...p, profileId: "" })).toBe("br");
  });
});
