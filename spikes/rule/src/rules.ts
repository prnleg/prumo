// Spike B — the one rule. Catalogue: STRUCTURAL_ANALYSIS §3 R-OPEN-001.
// No threshold: it only checks whether a lintel is drawn, so nothing numeric is invented (ADR-018).
import { UNSOURCED, type AssumptionUse, type Finding, type RuleDef } from "./finding";
import type { Wall } from "./model";

export const R_OPEN_001: RuleDef = {
  id: "R-OPEN-001",
  nameKey: "rule.R-OPEN-001.name",
  severity: "warning",
  confidence: "rule-of-thumb",
  // Likely NBR 16868 territory, but no clause has been checked → E-06. Never cite from memory.
  source: UNSOURCED,
  review: null,
  notConsidered: ["nc.lintelSize", "nc.bondBeam", "nc.sill", "nc.loads"],
  terms: ["term.bearing", "term.lintel"],
  appliesTo: ["structural-masonry"],
  run(model, profile) {
    const walls = new Map(model.walls.map((w) => [w.id, w]));
    const out: Finding[] = [];
    for (const o of model.openings) {
      const wall = walls.get(o.host);
      if (!wall || o.lintel) continue;
      const why = bearingAssumption(wall, profile.unmarkedWalls);
      if (!why) continue;
      out.push({
        ruleId: this.id,
        severity: this.severity,
        confidence: this.confidence,
        elementIds: [o.id, wall.id],
        messageKey: "rule.R-OPEN-001.message",
        params: { opening: { kind: "element", id: o.id }, wall: { kind: "element", id: wall.id }, width: { kind: "length", mm: o.width } },
        assumptions: [why],
        fingerprint: `${this.id}|${o.id}|${wall.id}`,
      });
    }
    return out;
  },
};

/** Why this wall counts as bearing, as a user-visible assumption, or null if it doesn't. */
function bearingAssumption(w: Wall, unmarked: "assume-bearing" | "skip"): AssumptionUse | null {
  const wall = { kind: "element", id: w.id } as const;
  if (w.bearing === "bearing") return { id: "A-ROLE-1", key: "as.roleMarked", params: { wall } };
  if (w.bearing === "unmarked" && unmarked === "assume-bearing")
    return { id: "A-ROLE-2", key: "as.roleDefault", params: { wall, profile: { kind: "profile" } } };
  return null;
}

export const RULES: RuleDef[] = [R_OPEN_001];
