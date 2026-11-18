// Finding shape (STRUCTURAL_ANALYSIS §1, Spike B; ADR-021: message = i18n key + typed params, formatted
// per locale at display time). Every finding carries what SAFETY_AND_LIABILITY requires.
import type { Id, Project } from "@prumo/core";
import type { ConstructionSystem } from "./data";

export type Severity = "critical" | "warning" | "advisory" | "info";
export type Confidence = "rule-of-thumb" | "simplified-calc" | "analysis";

export type Param =
  | { kind: "length"; mm: number }
  | { kind: "element"; id: Id }
  | { kind: "text"; key: string }
  /** A person's display name as typed (never translated); empty = unknown. */
  | { kind: "name"; name: string };

export interface AssumptionUse {
  /** Stable id shown to the user ("Assumptions used"). */
  id: string;
  key: string;
  params: Record<string, Param>;
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  confidence: Confidence;
  /** First = the element the finding is about (badge goes there). */
  elementIds: Id[];
  messageKey: string;
  params: Record<string, Param>;
  /** Separate from severity (E-07): an assumption never lowers it. */
  assumptions: AssumptionUse[];
  /** ruleId + elementIds: resizing or moving keeps it the "same" finding (diff). */
  fingerprint: string;
}

/** CLAUDE.md rule 6 marker for a rule with no cited clause yet. */
export const UNSOURCED = "UNSOURCED – placeholder";

/** ADR-041 review levels. */
export type ReviewLevel = "unverified" | "verified-unsigned" | "verified";
export interface Review {
  level: ReviewLevel;
  /** e.g. "owner's engineer contact (anonymous, unsigned)". */
  by?: string;
  date?: string;
  /** ENGINEER_QUESTIONS id(s). */
  ref?: string;
}

export interface CheckContext {
  project: Project;
  levelId: Id;
  /** The project's stated system. */
  system: ConstructionSystem;
  /** "The existing building" (ADR-043), or null when none is marked. */
  baseline: Project | null;
}

export interface RuleDef {
  id: string;
  nameKey: string;
  severity: Severity;
  confidence: Confidence;
  /** Code clause / textbook + page, or UNSOURCED. */
  source: string;
  review: Review;
  /** i18n keys: what this check does not consider. */
  notConsidered: string[];
  /** Systems whose rules include this one (after "unknown" → masonry). */
  appliesTo: ConstructionSystem[];
  /** Compares with the existing building: doesn't run (listed as not checked) until one is marked. */
  needsBaseline?: boolean;
  run(ctx: CheckContext): Finding[];
}

export const ENGINEER_UNSIGNED = "owner's engineer contact (anonymous, unsigned)";
