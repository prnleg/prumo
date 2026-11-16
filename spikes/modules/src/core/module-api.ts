// Spike E — the internal module API (ADR-020: internal, apiVersion 0.x).
import type { Element, ModuleId, ProjectModel } from "./model";

export const CORE_API_VERSION = "0.1";

export type Severity = "info" | "warning" | "critical";

export interface Finding {
  ruleId: string;
  severity: Severity;
  elementIds: string[];
  /** i18n key + params, never a concatenated sentence (ADR-021). */
  messageKey: string;
  params: Record<string, string | number>;
  /** Rule source (CLAUDE.md rule 6). */
  source: string;
  verified: boolean;
}

export interface Rule {
  id: string;
  /** Rule 5: rules declare which modules' data they read. "core" is implicit. */
  reads: ModuleId[];
  evaluate(model: ProjectModel, ctx: RuleContext): Finding[];
}

export interface RuleContext {
  /** Read any declared module's component; reading undeclared data throws. */
  component<T>(el: Element, moduleId: ModuleId): T | undefined;
}

export interface ComponentDecl {
  /** Current schema version written by this module. */
  version: number;
  /** Rule 6: each module owns its migrations. Key = from-version. */
  migrations: Record<number, (data: unknown) => unknown>;
}

export interface ModuleManifest {
  id: ModuleId;
  version: string;
  apiVersion: string;
  /** Other modules this one needs (the core is always implied). */
  dependsOn: ModuleId[];
  component?: ComponentDecl;
  /** Element types this module owns, e.g. "org.prumo.electrical/outlet". */
  elementTypes: string[];
  rules: Rule[];
  /** Can the user strip this module's data from an exported copy? (MODULES §8) */
  required?: boolean;
}
