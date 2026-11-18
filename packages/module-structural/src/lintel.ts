// Lintel check, Phase 3 step 5 (ADR-052): the weight on the lintel over one opening and, when the user
// knows the lintel's size and bars, how that compares with its bending strength. Information only (no
// finding), every value UNVERIFIED, numbers as a RANGE like the wall loads (ADR-051).
//   span L        = opening width + one bearing length each side (pack value; E-34)
//   load w (kN/m) = everything above the opening (Q-033 default: conservative, no arching):
//                   masonry between the lintel and the wall top + the lintel's own weight
//                   + the slab load this wall carries (from wallLoads)
//   M = w·L²/8, V = w·L/2 (simply supported beam; any mechanics textbook)
//   bending strength (reinforced concrete, NBR 6118:2014 17.2.2 simplified stress block):
//     fcd = fck/γc, fyd = fyk/γs, x = As·fyd / (α·λ·b·fcd), x ≤ (x/d)max·d (14.6.4.3)
//     MRd = α·λ·b·x·fcd·(d − λx/2),  d = h − cover − Ø/2,  b = wall thickness
//   compared with γf·M (NBR 6118 11.7.1). Shear, sag (deflection) and bearing at the ends: not checked.
import { type Id, type Opening, type PackSet, type Project, type ResolvedValue, type Wall } from "@prumo/core";
import { structuralData, withStructuralData } from "./data";
import type { LoadLine, Range, WallLoad } from "./loads";
import { STRUCTURAL } from "./manifest";
import { packRegion } from "./packs";

/** Bar diameters on sale in Brazil, mm (NBR 7480: CA-50 / CA-60 nominal sizes). A UI list, not a rule. */
export const BAR_DIAMETERS: readonly number[] = [5, 6.3, 8, 10, 12.5];
export const BAR_COUNTS: readonly number[] = [1, 2, 3, 4];

/** What the user knows about the lintel (ADR-052). Missing fields = don't know. */
export interface LintelSize {
  /** Total height of the lintel, mm. */
  height?: number | undefined;
  /** Bottom bars: how many and which diameter (mm). */
  bars?: { count: number; diameter: number } | undefined;
}

export function lintelSize(o: Opening): LintelSize {
  const d = structuralData(o);
  const h = typeof d.lintelHeight === "number" && d.lintelHeight > 0 ? d.lintelHeight : undefined;
  const b = d.lintelBars as { count?: unknown; diameter?: unknown } | undefined;
  const bars =
    b && typeof b.count === "number" && b.count > 0 && typeof b.diameter === "number" && b.diameter > 0
      ? { count: b.count, diameter: b.diameter }
      : undefined;
  return { height: h, bars };
}

export function setLintelSize(o: Opening, s: LintelSize): Opening {
  return withStructuralData(o, { ...structuralData(o), lintelHeight: s.height, lintelBars: s.bars });
}

export type LintelVerdict = "unknown" | "below" | "maybe" | "above";

export interface LintelCheck {
  openingId: Id;
  /** Span, m. */
  span: number;
  /** Load on the lintel, kN/m. */
  w: Range;
  /** Bending moment and end shear (unfactored), kN·m and kN. */
  M: Range;
  V: Range;
  /** γf·M, kN·m (what the strength is compared with). */
  Md: Range;
  /** Bending strength MRd, kN·m; null = size or bars not known (or values missing). */
  MRd: Range | null;
  verdict: LintelVerdict;
  lines: LoadLine[];
  /** i18n keys of what isn't checked. */
  notChecked: string[];
  values: ResolvedValue[];
}

/**
 * The lintel over `o`, using the host wall's load (`wallLoads(...).get(hostId)`). null = the host is not a
 * wall that carries (no load), or the pack lacks the span / unit weight values.
 */
export function lintelCheck(
  p: Project,
  o: Opening,
  wallLoad: WallLoad | undefined,
  packs: PackSet,
): LintelCheck | null {
  const w0 = p.elements[o.host.elementId];
  if (!wallLoad || w0?.type !== "wall") return null;
  const wall: Wall = w0;
  const region = packRegion(p);
  const used = new Map<string, ResolvedValue>();
  const val = (key: string): number | null => {
    const v = packs.get(STRUCTURAL, region, key);
    if (!v || typeof v.value !== "number") return null;
    used.set(key, v);
    return v.value;
  };
  const bearing = val("lintel.bearing");
  const concrete = val("material.concrete.unitWeight");
  if (bearing === null || concrete === null) return null;

  const size = lintelSize(o);
  const t = wall.thickness / 1000;
  const span = (o.width + 2 * bearing) / 1000;
  const lines: LoadLine[] = [];
  lines.push({
    key: "lintel.line.span",
    params: { width: o.width / 1000, bearing: bearing / 1000, L: span },
    lo: 0,
    hi: 0,
  });

  // masonry + lintel above the opening (the wall's own-weight line gives its unit-weight range)
  const self = wallLoad.lines.find((l) => l.key === "load.line.self" || l.key === "load.line.selfUnknown");
  const above = Math.max(0, wall.height - o.sillHeight - o.height) / 1000;
  if (self && above > 0) {
    const gLo = Number(self.params.gLo);
    const gHi = Number(self.params.gHi);
    const hL = size.height !== undefined ? Math.min(size.height / 1000, above) : null;
    const lo = hL !== null ? t * (above - hL) * gLo + t * hL * concrete : t * above * Math.min(gLo, concrete);
    const hi = hL !== null ? t * (above - hL) * gHi + t * hL * concrete : t * above * Math.max(gHi, concrete);
    lines.push({
      key: hL !== null ? "lintel.line.above" : "lintel.line.aboveUnknown",
      params: { h: above, t },
      lo,
      hi,
    });
  }
  // slabs resting on this wall (ADR-051 lines), all of it on the lintel (no arching, Q-033)
  for (const l of wallLoad.lines)
    if (l.key === "load.line.upper")
      lines.push({ key: "lintel.line.upper", params: { ...l.params }, lo: l.lo, hi: l.hi });
    else if (l.key.startsWith("load.line.slab"))
      lines.push({ key: "lintel.line.slab", params: { ...l.params }, lo: l.lo, hi: l.hi });

  const w: Range = { lo: sum(lines, "lo"), hi: sum(lines, "hi") };
  const M = { lo: (w.lo * span ** 2) / 8, hi: (w.hi * span ** 2) / 8 };
  const V = { lo: (w.lo * span) / 2, hi: (w.hi * span) / 2 };
  const gf = val("safety.gammaF");
  const Md = gf === null ? M : { lo: gf * M.lo, hi: gf * M.hi };

  const notChecked = [
    "lintel.nc.shear",
    "lintel.nc.sag",
    "lintel.nc.ends",
    "lintel.nc.arching",
    ...wallLoad.notCounted,
  ];
  const MRd = strength(t * 1000, size, val);
  let verdict: LintelVerdict = "unknown";
  if (MRd && gf !== null) verdict = Md.hi <= MRd.lo ? "below" : Md.lo > MRd.hi ? "above" : "maybe";
  return {
    openingId: o.id,
    span,
    w,
    M,
    V,
    Md,
    MRd: gf === null ? null : MRd,
    verdict: gf === null ? "unknown" : verdict,
    lines,
    notChecked,
    values: [...new Map([...wallLoad.values, ...used.values()].map((v) => [v.key, v])).values()].sort((a, b) =>
      a.key < b.key ? -1 : 1,
    ),
  };
}

/** Bending strength range (kN·m) over the concrete-strength range; null when something is unknown. */
export function strength(b: number, size: LintelSize, val: (k: string) => number | null): Range | null {
  if (size.height === undefined || !size.bars) return null;
  const v = {
    fckLo: val("lintel.concrete.fck.min"),
    fckHi: val("lintel.concrete.fck.max"),
    fyk: val("material.steel.fyk"),
    gc: val("safety.gammaC"),
    gs: val("safety.gammaS"),
    cover: val("lintel.cover"),
    alpha: val("concrete.block.alpha"),
    lambda: val("concrete.block.lambda"),
    xd: val("concrete.xd.max"),
  };
  if (Object.values(v).some((x) => x === null)) return null;
  const n = v as Record<keyof typeof v, number>;
  const { count, diameter } = size.bars;
  const d = size.height - n.cover - diameter / 2; // mm
  if (d <= 0) return { lo: 0, hi: 0 };
  const As = (count * Math.PI * diameter ** 2) / 4; // mm²
  const fyd = n.fyk / n.gs; // MPa = N/mm²
  const one = (fck: number) => {
    const fcd = fck / n.gc;
    const k = n.alpha * n.lambda * b * fcd; // N per mm of depth x
    const x = Math.min((As * fyd) / k, n.xd * d);
    return (k * x * (d - (n.lambda * x) / 2)) / 1e6; // N·mm → kN·m
  };
  return { lo: one(n.fckLo), hi: one(n.fckHi) };
}

const sum = (ls: LoadLine[], k: "lo" | "hi") => ls.reduce((s, l) => s + l[k], 0);
