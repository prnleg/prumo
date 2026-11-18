import { emptyProject } from "@prumo/core";
import { describe, expect, it } from "vitest";
import { kgPerM3, materialTable, structuralPacks, unitWeight } from "../src";

const p = emptyProject({
  id: "p",
  levelId: "l",
  name: "x",
  now: "2026-11-18T00:00:00Z",
  profileId: "br-nbr/structural-masonry",
});

describe("material values from the Brazil pack (Phase 3 step 2)", () => {
  it("unit weights come with their source and stay UNVERIFIED", () => {
    const set = structuralPacks();
    expect(unitWeight(set, p, "ceramic-block")).toMatchObject({ value: 13, pack: "br", review: "UNVERIFIED" });
    expect(unitWeight(set, p, "concrete")?.source).toBe("NBR 6118:2014, 8.2.2 (concreto armado)");
  });

  it("materials without a sourced value say so (no guess)", () => {
    const rows = materialTable(structuralPacks(), p);
    expect(rows.map((r) => [r.material, r.unitWeight?.value ?? null])).toEqual([
      ["ceramic-block", 13],
      ["concrete-block", null],
      ["solid-brick", 18],
      ["drywall", null],
      ["concrete", 25],
    ]);
  });

  it("kN/m³ → kg/m³: 13 × 1000 / 9.80665 = 1325.6", () => {
    expect(kgPerM3(13)).toBeCloseTo(1325.63, 2);
  });
});
