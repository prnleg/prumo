// Spike B — Finding shape (STRUCTURAL_ANALYSIS §1, adapted for ADR-021: message = i18n key + params).
import type { Model, Profile } from "./model";

export type Severity = "critical" | "warning" | "advisory" | "info";
export type Confidence = "rule-of-thumb" | "simplified-calc" | "analysis";

/** Typed params, formatted per locale at display time (never pre-formatted strings in a finding). */
export type Param =
  | { kind: "length"; mm: number }
  | { kind: "element"; id: string }
  | { kind: "profile" };

export interface AssumptionUse {
  /** Stable id shown to the user (SAFETY "Assumptions used"). */
  id: string;
  key: string;
  params: Record<string, Param>;
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  confidence: Confidence;
  /** Sorted. First = the element the finding is "about" (badge goes there). */
  elementIds: string[];
  messageKey: string;
  params: Record<string, Param>;
  assumptions: AssumptionUse[];
  /** ruleId + elementIds only: resizing/moving the opening keeps it the "same" finding. */
  fingerprint: string;
}

/** Literal CLAUDE.md rule 6 marker for a rule without a cited source. */
export const UNSOURCED = "UNSOURCED – placeholder";

export interface RuleDef {
  id: string;
  nameKey: string;
  severity: Severity;
  confidence: Confidence;
  /** Code clause / textbook + page, or UNSOURCED. */
  source: string;
  /** Who reviewed it and when (CLAUDE.md rule 17). null → UNVERIFIED in the UI. */
  review: { by: string; date: string } | null;
  /** i18n keys: what this check does not consider. */
  notConsidered: string[];
  /** i18n keys of glossary terms the message uses (beginner tooltips, CLAUDE.md rule 20). */
  terms: string[];
  appliesTo: Profile["system"][];
  run(model: Model, profile: Profile): Finding[];
}

/** UI shows UNVERIFIED unless there is a source AND an engineer review (rules 6 + 17). */
export const isVerified = (r: RuleDef) => r.source !== UNSOURCED && r.review !== null;
