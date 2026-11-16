// Spike B — run the rules: pure, deterministic (CLAUDE.md rule 10).
import type { Finding, RuleDef } from "./finding";
import type { Model, Profile } from "./model";

export interface CheckResult {
  /** Rules that actually ran for this profile (the N in "the N checks"). */
  checksRun: RuleDef[];
  findings: Finding[];
}

const SEV = { critical: 0, warning: 1, advisory: 2, info: 3 } as const;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function runChecks(model: Model, profile: Profile, rules: RuleDef[]): CheckResult {
  const checksRun = rules.filter((r) => r.appliesTo.includes(profile.system)).sort((a, b) => cmp(a.id, b.id));
  // Sort the inputs so iteration order never leaks into the output.
  const m: Model = {
    walls: [...model.walls].sort((a, b) => cmp(a.id, b.id)),
    openings: [...model.openings].sort((a, b) => cmp(a.id, b.id)),
  };
  const findings = checksRun
    .flatMap((r) => r.run(m, profile))
    .sort((a, b) => SEV[a.severity] - SEV[b.severity] || cmp(a.fingerprint, b.fingerprint));
  return { checksRun, findings };
}

export interface Diff {
  added: Finding[];
  resolved: Finding[];
  unchanged: Finding[];
}

/** "new / resolved / unchanged" vs the previous snapshot (STRUCTURAL_ANALYSIS §1), by fingerprint. */
export function diffFindings(prev: Finding[], next: Finding[]): Diff {
  const p = new Set(prev.map((f) => f.fingerprint));
  const n = new Set(next.map((f) => f.fingerprint));
  return {
    added: next.filter((f) => !p.has(f.fingerprint)),
    resolved: prev.filter((f) => !n.has(f.fingerprint)),
    unchanged: next.filter((f) => p.has(f.fingerprint)),
  };
}
