// Run the checks: pure and deterministic (CLAUDE.md rule 10). Findings sorted by severity, then fingerprint.
import type { Id, Project } from "@prumo/core";
import { constructionSystem, rulesSystem, type ConstructionSystem } from "./data";
import type { Finding, RuleDef } from "./finding";
import { RULES } from "./rules";

export interface CheckResult {
  system: ConstructionSystem;
  /** Rules that ran (the "Checked" list — SAFETY: show what was checked AND what wasn't). */
  checksRun: RuleDef[];
  /** Rules for this system that couldn't run because no existing building is marked (ADR-043). */
  needBaseline: RuleDef[];
  findings: Finding[];
}

const SEV = { critical: 0, warning: 1, advisory: 2, info: 3 } as const;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function runChecks(
  project: Project,
  levelId: Id,
  opts: { rules?: readonly RuleDef[]; baseline?: Project | null } = {},
): CheckResult {
  const system = constructionSystem(project);
  const run = rulesSystem(system);
  const baseline = opts.baseline ?? null;
  const forSystem = (opts.rules ?? RULES).filter((r) => r.appliesTo.includes(run)).sort((a, b) => cmp(a.id, b.id));
  const checksRun = forSystem.filter((r) => !r.needsBaseline || baseline);
  const needBaseline = forSystem.filter((r) => r.needsBaseline && !baseline);
  const findings = checksRun
    .flatMap((r) => r.run({ project, levelId, system, baseline }))
    .sort((a, b) => SEV[a.severity] - SEV[b.severity] || cmp(a.fingerprint, b.fingerprint));
  return { system, checksRun, needBaseline, findings };
}

export interface FindingsDiff {
  added: Finding[];
  resolved: Finding[];
  unchanged: Finding[];
}

/** New / resolved / unchanged vs the previous result, by fingerprint (STRUCTURAL_ANALYSIS §1). */
export function diffFindings(prev: readonly Finding[], next: readonly Finding[]): FindingsDiff {
  const p = new Set(prev.map((f) => f.fingerprint));
  const n = new Set(next.map((f) => f.fingerprint));
  return {
    added: next.filter((f) => !p.has(f.fingerprint)),
    resolved: prev.filter((f) => !n.has(f.fingerprint)),
    unchanged: next.filter((f) => p.has(f.fingerprint)),
  };
}

/** What no check here covers (STRUCTURAL_ANALYSIS §7) — i18n keys for the "Not checked" list. */
export const NOT_CHECKED = [
  "notChecked.foundations",
  "notChecked.wind",
  "notChecked.safetyFactors",
  "notChecked.connections",
  "notChecked.materials",
  "notChecked.realBuilding",
  "notChecked.damage",
  "notChecked.newLoads",
  "notChecked.roofThrust",
  "notChecked.pointLoads",
  "notChecked.shoring",
  "notChecked.floors",
] as const;
