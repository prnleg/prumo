// Tier 0 rules (STRUCTURAL_ANALYSIS §3). No numeric thresholds here: both rules are presence checks,
// so nothing is invented (ADR-018).
import { wallsOnLevel, type Opening, type Project, type Wall } from "@prumo/core";
import { structuralData, type WallEnd } from "./data";
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

// --- presence rules on new data (ADR-042 additions, 2026-11-17) ----------------------------------

/** R-OPEN-006 — window in a load-bearing wall without a sill reinforcement (contraverga). Advice. */
export const R_OPEN_006: RuleDef = {
  id: "R-OPEN-006",
  nameKey: "rule.R-OPEN-006.name",
  severity: "advisory",
  confidence: "rule-of-thumb",
  source: UNSOURCED,
  review: { level: "verified-unsigned", by: ENGINEER_UNSIGNED, date: "2026-11-17", ref: "E-02" },
  notConsidered: ["nc.contravergaSize", "nc.realBuilding"],
  appliesTo: [...MASONRY],
  run({ project, levelId, system }) {
    const walls = new Map(wallsOnLevel(project, levelId).map((w) => [w.id, w]));
    const out: Finding[] = [];
    for (const o of openingsOn(project, levelId)) {
      if (o.kind !== "window" || structuralData(o).contraverga) continue;
      const w = walls.get(o.host.elementId);
      if (!w) continue;
      const b = bearing(w, system);
      if (!b.bearing) continue;
      out.push({
        ruleId: this.id,
        severity: this.severity,
        confidence: this.confidence,
        elementIds: [o.id, w.id],
        messageKey: "rule.R-OPEN-006.message",
        params: { opening: { kind: "element", id: o.id }, wall: { kind: "element", id: w.id } },
        assumptions: b.why,
        fingerprint: `${this.id}|${o.id}|${w.id}`,
      });
    }
    return out;
  },
};

/** R-RING-001 — load-bearing full wall without a tie beam (cinta) on top. */
export const R_RING_001: RuleDef = {
  id: "R-RING-001",
  nameKey: "rule.R-RING-001.name",
  severity: "warning",
  confidence: "rule-of-thumb",
  source: UNSOURCED,
  review: { level: "verified-unsigned", by: ENGINEER_UNSIGNED, date: "2026-11-17", ref: "E-02" },
  notConsidered: ["nc.tieBeamSize", "nc.realBuilding"],
  appliesTo: [...MASONRY],
  run({ project, levelId, system }) {
    // half walls (parapets) carry no slab or roof: the tie beam rule is about full walls
    return wallsOnLevel(project, levelId)
      .filter((w) => w.kind === "full" && !structuralData(w).tieBeam)
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .flatMap((w) => {
        const b = bearing(w, system);
        if (!b.bearing) return [];
        return [
          {
            ruleId: this.id,
            severity: this.severity,
            confidence: this.confidence,
            elementIds: [w.id],
            messageKey: "rule.R-RING-001.message",
            params: { wall: { kind: "element", id: w.id } },
            assumptions: b.why,
            fingerprint: `${this.id}|${w.id}`,
          },
        ];
      });
  },
};

const JOIN_TOL = 5; // mm: same as the drawing's join tolerance (joins.ts DEFAULTS), not a structural value
const ENDS: readonly WallEnd[] = ["start", "end"];
const at = (w: Wall, e: WallEnd) => (e === "start" ? w.start : w.end);
/** Does point q touch wall o: at one of its ends, or on its body (a T)? */
function touches(q: { x: number; y: number }, o: Wall): WallEnd | "body" | null {
  for (const e of ENDS) if (Math.hypot(q.x - at(o, e).x, q.y - at(o, e).y) <= JOIN_TOL) return e;
  const dx = o.end.x - o.start.x,
    dy = o.end.y - o.start.y;
  const L = Math.hypot(dx, dy);
  if (!L) return null;
  const along = ((q.x - o.start.x) * dx + (q.y - o.start.y) * dy) / L;
  const lateral = Math.abs((q.x - o.start.x) * dy - (q.y - o.start.y) * dx) / L;
  return along > JOIN_TOL && along < L - JOIN_TOL && lateral <= JOIN_TOL ? "body" : null;
}

/** The ends of `w` that meet other walls that can carry (for the panel's "bonded" boxes). */
export function junctionsOf(project: Project, w: Wall): { end: WallEnd; others: Wall[] }[] {
  const others = wallsOnLevel(project, w.levelId)
    .filter((o) => o.id !== w.id && canCarry(o))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  return ENDS.map((end) => ({ end, others: others.filter((o) => touches(at(w, end), o) !== null) })).filter(
    (j) => j.others.length > 0,
  );
}

/**
 * R-JOINT-001 — load-bearing walls meeting without being bonded (no interlocking, ties or grout).
 * One finding per junction (a wall end meeting other load-bearing walls). The junction counts as
 * bonded when any wall END there is marked bonded (a T's through-wall has no end there, so the stem's
 * mark decides).
 */
export const R_JOINT_001: RuleDef = {
  id: "R-JOINT-001",
  nameKey: "rule.R-JOINT-001.name",
  severity: "warning",
  confidence: "rule-of-thumb",
  source: UNSOURCED,
  review: { level: "verified-unsigned", by: ENGINEER_UNSIGNED, date: "2026-11-17", ref: "E-02" },
  notConsidered: ["nc.bondDetail", "nc.realBuilding"],
  appliesTo: [...MASONRY],
  run({ project, levelId, system }) {
    const walls = wallsOnLevel(project, levelId)
      .filter((w) => bearing(w, system).bearing)
      .sort((a, b) => (a.id < b.id ? -1 : 1));
    const seen = new Set<string>();
    const out: Finding[] = [];
    for (const w of walls)
      for (const e of ENDS) {
        const q = at(w, e);
        const meet = walls
          .filter((o) => o.id !== w.id)
          .map((o) => ({ o, how: touches(q, o) }))
          .filter((m) => m.how !== null);
        if (!meet.length) continue;
        const ids = [w.id, ...meet.map((m) => m.o.id)].sort();
        const key = ids.join(",");
        if (seen.has(key)) continue;
        seen.add(key);
        const bondedHere =
          !!structuralData(w).bonded?.[e] ||
          meet.some((m) => m.how !== "body" && !!structuralData(m.o).bonded?.[m.how as WallEnd]);
        if (bondedHere) continue;
        const first = ids[0] ?? w.id;
        const others = ids.filter((id) => id !== first);
        out.push({
          ruleId: this.id,
          severity: this.severity,
          confidence: this.confidence,
          elementIds: ids,
          messageKey: "rule.R-JOINT-001.message",
          params: {
            wall: { kind: "element", id: first },
            other: { kind: "element", id: others[0] ?? first },
          },
          assumptions: bearing(w, system).why,
          fingerprint: `${this.id}|${key}`,
        });
      }
    return out;
  },
};

export const RULES: readonly RuleDef[] = [
  R_OPEN_001,
  R_ROLE_001,
  R_WALL_002,
  R_OPEN_NEW,
  R_OPEN_006,
  R_RING_001,
  R_JOINT_001,
];
