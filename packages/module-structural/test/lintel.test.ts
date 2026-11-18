// Lintel check (ADR-052). Hand calculations in each test (CLAUDE.md rule 6) and STRUCTURAL_ANALYSIS §4.y.
// Room 4 × 3 m (centre lines), walls 14 cm × 2.70 m ceramic block (13 kN/m³), joist slab spanning the
// short way → the 4 m walls carry 5.25…9.0 kN/m from the slab (ADR-051 test). Window in the bottom wall:
// 1.20 m wide, sill 1.00 m, 1.20 m tall → top at 2.20 m, 0.50 m of wall above it.
// Pack: bearing 0.20 m each side → span L = 1.20 + 2 × 0.20 = 1.60 m; L²/8 = 0.32 m².
import { emptyProject, putCommand, type Opening, type Project, type Wall } from "@prumo/core";
import { describe, expect, it } from "vitest";
import { lintelCheck, newSlab, setLintelSize, setSlabInfo, setWallMaterial, structuralPacks, wallLoads } from "../src";

const W = (id: string, x1: number, y1: number, x2: number, y2: number): Wall =>
  setWallMaterial(
    {
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
    },
    "ceramic-block",
  );
const WIN: Opening = {
  id: "o",
  type: "opening",
  levelId: "l",
  host: { elementId: "bot", offset: 1400 },
  width: 1200,
  height: 1200,
  sillHeight: 1000,
  kind: "window",
  components: {},
};
const RECT = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 3000 },
  { x: 0, y: 3000 },
];
function project(o: Opening): Project {
  return putCommand({ key: "x" }, [
    W("bot", 0, 0, 4000, 0),
    W("right", 4000, 0, 4000, 3000),
    W("top", 4000, 3000, 0, 3000),
    W("left", 0, 3000, 0, 0),
    setSlabInfo(newSlab("s1", "l", RECT), { kind: "joist", joists: "short" }),
    o,
  ]).apply(
    emptyProject({
      id: "p",
      levelId: "l",
      name: "t",
      now: "2026-11-18T00:00:00Z",
      profileId: "br-nbr/structural-masonry",
    }),
  );
}
const packs = structuralPacks();
const check = (o: Opening) => {
  const p = project(o);
  return lintelCheck(p, o, wallLoads(p, "l", packs).get("bot"), packs);
};
const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe("lintel check (ADR-052)", () => {
  it("size unknown: load + moments only, the strip above counted as 13…25 kN/m³", () => {
    const c = check(WIN);
    if (!c) throw new Error("no check");
    close(c.span, 1.6);
    // above: 0.14 × 0.50 × 13 = 0.91 … 0.14 × 0.50 × 25 = 1.75; slab 5.25 … 9.0
    close(c.w.lo, 6.16);
    close(c.w.hi, 10.75);
    // M = w × 0.32: 1.9712 … 3.44; V = w × 0.80: 4.928 … 8.6; γf M = 1.4 M: 2.75968 … 4.816
    close(c.M.lo, 1.9712);
    close(c.M.hi, 3.44);
    close(c.V.lo, 4.928);
    close(c.V.hi, 8.6);
    close(c.Md.hi, 4.816);
    expect(c.MRd).toBeNull();
    expect(c.verdict).toBe("unknown");
    expect(c.notChecked).toContain("lintel.nc.shear");
  });

  it("15 cm lintel with 2 Ø10: strength above the need → 'below'", () => {
    const c = check(setLintelSize(WIN, { height: 150, bars: { count: 2, diameter: 10 } }));
    if (!c?.MRd) throw new Error("no strength");
    // above: masonry 0.14 × 0.35 × 13 = 0.637 + lintel 0.14 × 0.15 × 25 = 0.525 → 1.162
    close(c.w.lo, 5.25 + 1.162);
    close(c.w.hi, 9.0 + 1.162);
    // γf M = 1.4 × 0.32 × w = 0.448 w → hi 0.448 × 10.162 = 4.552576
    close(c.Md.hi, 4.552576);
    // d = 150 − 25 − 10/2 = 120 mm; As = 2 × π × 10²/4 = 157.0796 mm²; fyd = 500/1.15 = 434.7826 MPa
    // As·fyd = 68 295.5 N. fck 15: fcd = 10.7143, 0.85 × 0.8 × 140 × fcd = 1020.0 N/mm → x = 66.96 mm
    //   > 0.45 d = 54 → x = 54: MRd = 1020 × 54 × (120 − 0.4 × 54) = 5 419 872 N·mm = 5.419872 kN·m
    // fck 25: fcd = 17.857, k = 1700.0 → x = 40.174 mm (< 54): MRd = 68 295.5 × (120 − 16.0696) = 7.0980 kN·m
    close(c.MRd.lo, 5.419872);
    expect(c.MRd.hi).toBeCloseTo(7.098, 3);
    expect(c.verdict).toBe("below");
  });

  it("10 cm lintel with 2 Ø8: the need is more than the strength → 'above'", () => {
    const c = check(setLintelSize(WIN, { height: 100, bars: { count: 2, diameter: 8 } }));
    if (!c?.MRd) throw new Error("no strength");
    // above: 0.14 × 0.40 × 13 = 0.728 + 0.14 × 0.10 × 25 = 0.35 → 1.078; γf M lo = 0.448 × 6.328 = 2.834944
    close(c.Md.lo, 2.834944);
    // d = 100 − 25 − 4 = 71; As = 100.531 mm²; As·fyd = 43 709.2 N
    // fck 25: k = 1700.0 → x = 25.711 (< 31.95): MRd = 43 709.2 × (71 − 10.2845) = 2.65383 kN·m
    expect(c.MRd.hi).toBeCloseTo(2.65383, 4);
    expect(c.verdict).toBe("above");
  });

  it("not a carrying wall → no check; opening up to the wall top → no strip above", () => {
    const p = project(WIN);
    expect(lintelCheck(p, WIN, undefined, packs)).toBeNull();
    const tall = { ...WIN, sillHeight: 0, height: 2700 };
    const c = check(tall);
    expect(c?.lines.some((l) => l.key.startsWith("lintel.line.above"))).toBe(false);
    close(c?.w.lo ?? 0, 5.25);
  });
});
