// Tier 0 rules (STRUCTURAL_ANALYSIS §3). No numeric thresholds here: both rules are presence checks,
// so nothing is invented (ADR-018).
import { wallsOnLevel, type Opening, type Project, type Wall } from "@prumo/core";
import { structuralData } from "./data";
import { ENGINEER_UNSIGNED, UNSOURCED, type Finding, type RuleDef } from "./finding";
import { bearing, canCarry } from "./roles";

const MASONRY = ["structural-masonry"] as const;
const EPS = 1; // mm: "reaches the top of the wall" tolerance (drawing precision, not a structural value)

/** R-OPEN-001 — opening in a load-bearing wall without a lintel (E-06: general rule; clause → E-30). */
export const R_OPEN_001: RuleDef = {
  id: "R-OPEN-001",
  nameKey: "rule.R-OPEN-001.name",
  severity: "warning",
  confidence: "rule-of-thumb",
  source: UNSOURCED,
  review: { level: "verified-unsigned", by: ENGINEER_UNSIGNED, date: "2026-11-17", ref: "E-06" },
  notConsidered: ["nc.lintelSize", "nc.lintelBearing", "nc.loads", "nc.arching"],
  appliesTo: [...MASONRY],
  run({ project, levelId, system }) {
    const walls = new Map(wallsOnLevel(project, levelId).map((w) => [w.id, w]));
    const out: Finding[] = [];
    const openings = Object.values(project.elements)
      .filter((e): e is Opening => e.type === "opening" && e.levelId === levelId)
      .sort((a, b) => (a.id < b.id ? -1 : 1));
    for (const o of openings) {
      const w = walls.get(o.host.elementId);
      if (!w || structuralData(o).lintel) continue;
      const b = bearing(w, system);
      if (!b.bearing) continue;
      // An opening up to the top of the wall: the tie beam / slab above IS its lintel (E-06).
      const toTop = o.sillHeight + o.height >= w.height - EPS;
      out.push({
        ruleId: this.id,
        severity: this.severity,
        confidence: this.confidence,
        elementIds: [o.id, w.id],
        messageKey: toTop ? "rule.R-OPEN-001.messageToTop" : "rule.R-OPEN-001.message",
        params: {
          opening: { kind: "element", id: o.id },
          wall: { kind: "element", id: w.id },
          width: { kind: "length", mm: o.width },
        },
        assumptions: b.why,
        fingerprint: `${this.id}|${o.id}|${w.id}`,
      });
    }
    return out;
  },
};

/** R-ROLE-001 — a wall marked non-bearing in a structural-masonry project (E-07: its own warning). */
export const R_ROLE_001: RuleDef = {
  id: "R-ROLE-001",
  nameKey: "rule.R-ROLE-001.name",
  severity: "advisory",
  confidence: "rule-of-thumb",
  source: UNSOURCED,
  review: { level: "verified-unsigned", by: ENGINEER_UNSIGNED, date: "2026-11-17", ref: "E-07" },
  notConsidered: ["nc.realBuilding"],
  appliesTo: [...MASONRY],
  run({ project, levelId }) {
    return wallsOnLevel(project, levelId)
      .filter((w: Wall) => canCarry(w) && structuralData(w).role === "non-bearing")
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .map((w) => ({
        ruleId: this.id,
        severity: this.severity,
        confidence: this.confidence,
        elementIds: [w.id],
        messageKey: "rule.R-ROLE-001.message",
        params: {
          wall: { kind: "element", id: w.id },
          origin: { kind: "text", key: `origin.${structuralData(w).origin ?? "unspecified"}` },
        },
        assumptions: [],
        fingerprint: `${this.id}|${w.id}`,
      }));
  },
};

// --- renovation rules: compare with the existing building (ADR-043) -----------------------------

const SAME = 1; // mm: "didn't move" tolerance (drawing precision, not a structural value)
const moved = (a: Wall, b: Wall) =>
  Math.hypot(a.start.x - b.start.x, a.start.y - b.start.y) > SAME ||
  Math.hypot(a.end.x - b.end.x, a.end.y - b.end.y) > SAME;
const openingsOn = (p: Project, levelId: string) =>
  Object.values(p.elements)
    .filter((e): e is Opening => e.type === "opening" && e.levelId === levelId)
    .sort((a, b) => (a.id < b.id ? -1 : 1));

/** R-WALL-002 — a wall that was load-bearing in the existing building is gone, moved, resized or no longer a wall. */
export const R_WALL_002: RuleDef = {
  id: "R-WALL-002",
  nameKey: "rule.R-WALL-002.name",
  severity: "critical",
  confidence: "rule-of-thumb",
  source: UNSOURCED,
  review: { level: "verified-unsigned", by: ENGINEER_UNSIGNED, date: "2026-11-17", ref: "E-02" },
  notConsidered: ["nc.newSupport", "nc.loads", "nc.realBuilding"],
  appliesTo: [...MASONRY],
  needsBaseline: true,
  run({ project, levelId, system, baseline }) {
    if (!baseline) return [];
    const out: Finding[] = [];
    for (const before of wallsOnLevel(baseline, levelId).sort((a, b) => (a.id < b.id ? -1 : 1))) {
      const was = bearing(before, system);
      if (!was.bearing) continue;
      const now = project.elements[before.id];
      const nowWall = now?.type === "wall" ? now : null;
      const how = !nowWall ? "removed" : !canCarry(nowWall) ? "kind" : moved(before, nowWall) ? "moved" : null;
      if (!how) continue;
      out.push({
        ruleId: this.id,
        severity: this.severity,
        confidence: this.confidence,
        elementIds: nowWall ? [before.id] : [],
        messageKey: `rule.R-WALL-002.${how}`,
        params: {
          length: { kind: "length", mm: Math.hypot(before.end.x - before.start.x, before.end.y - before.start.y) },
        },
        assumptions: was.why,
        fingerprint: `${this.id}|${before.id}`,
      });
    }
    return out;
  },
};

/** R-OPEN-NEW — an opening added or enlarged in a load-bearing wall, vs the existing building (E-02 #2). */
export const R_OPEN_NEW: RuleDef = {
  id: "R-OPEN-NEW",
  nameKey: "rule.R-OPEN-NEW.name",
  severity: "critical",
  confidence: "rule-of-thumb",
  source: UNSOURCED,
  review: { level: "verified-unsigned", by: ENGINEER_UNSIGNED, date: "2026-11-17", ref: "E-02" },
  notConsidered: ["nc.lintelSize", "nc.loads", "nc.shoring", "nc.realBuilding"],
  appliesTo: [...MASONRY],
  needsBaseline: true,
  run({ project, levelId, system, baseline }) {
    if (!baseline) return [];
    const walls = new Map(wallsOnLevel(project, levelId).map((w) => [w.id, w]));
    const out: Finding[] = [];
    for (const o of openingsOn(project, levelId)) {
      const w = walls.get(o.host.elementId);
      if (!w) continue;
      const b = bearing(w, system);
      if (!b.bearing) continue;
      const old = baseline.elements[o.id];
      const was = old?.type === "opening" && old.host.elementId === o.host.elementId ? old : null;
      // enlarged = wider, or the hole reaches lower or higher than before (not merely slid along)
      const bigger =
        was &&
        (o.width > was.width + SAME ||
          o.sillHeight < was.sillHeight - SAME ||
          o.sillHeight + o.height > was.sillHeight + was.height + SAME);
      if (was && !bigger) continue;
      out.push({
        ruleId: this.id,
        // a new hole is the bigger change; widening an existing one is a warning (E-02 "critical / warning")
        severity: was ? "warning" : "critical",
        confidence: this.confidence,
        elementIds: [o.id, w.id],
        messageKey: was ? "rule.R-OPEN-NEW.enlarged" : "rule.R-OPEN-NEW.new",
        params: {
          opening: { kind: "element", id: o.id },
          wall: { kind: "element", id: w.id },
          ...(was ? { before: { kind: "length", mm: was.width } as const } : {}),
        },
        assumptions: b.why,
        fingerprint: `${this.id}|${o.id}|${w.id}`,
      });
    }
    return out;
  },
};

export const RULES: readonly RuleDef[] = [R_OPEN_001, R_ROLE_001, R_WALL_002, R_OPEN_NEW];
