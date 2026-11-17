// Turn structural findings into words (ADR-021: params are typed and formatted at display time) and
// group them one card per rule (Q-135). Framework-free, unit-tested.
import { wallLength, type Project } from "@prumo/core";
import type { AssumptionUse, Finding, Param, RuleDef } from "@prumo/module-structural";
import { formatLength, translate, type Locale } from "./i18n";

export function paramText(p: Param, project: Project, locale: Locale): string {
  const t = (k: string, params?: Record<string, string | number>) => translate(locale, k, params);
  switch (p.kind) {
    case "length":
      return formatLength(p.mm, locale);
    case "text":
      return t(p.key);
    case "element": {
      const e = project.elements[p.id];
      if (e?.type === "wall") return t("el.wall", { length: formatLength(wallLength(e), locale) });
      if (e?.type === "opening") return t("el.opening", { kind: e.kind, width: formatLength(e.width, locale) });
      return t("el.unknown");
    }
  }
}

const texts = (params: Record<string, Param>, project: Project, locale: Locale) =>
  Object.fromEntries(Object.entries(params).map(([k, v]) => [k, paramText(v, project, locale)]));

export const findingText = (f: Finding, project: Project, locale: Locale) =>
  translate(locale, f.messageKey, texts(f.params, project, locale));

export const assumptionText = (a: AssumptionUse, project: Project, locale: Locale) =>
  translate(locale, a.key, texts(a.params, project, locale));

export interface RuleCard {
  rule: RuleDef;
  findings: Finding[];
  /** Distinct assumptions across the card (by text), in order. */
  assumptions: string[];
}

const SEV = { critical: 0, warning: 1, advisory: 2, info: 3 } as const;

/** One card per rule listing its findings (Q-135); worst severity first, then rule id. */
export function cards(
  rules: readonly RuleDef[],
  findings: readonly Finding[],
  project: Project,
  locale: Locale,
): RuleCard[] {
  return rules
    .map((rule) => {
      const fs = findings.filter((f) => f.ruleId === rule.id);
      // one line per assumption kind; several walls → the plural wording ("these walls …")
      const byId = new Map<string, AssumptionUse[]>();
      for (const a of fs.flatMap((f) => f.assumptions)) byId.set(a.id, [...(byId.get(a.id) ?? []), a]);
      const assumptions = [...byId.values()].map((as) => {
        const distinct = new Set(as.map((a) => JSON.stringify(a.params)));
        const first = as[0];
        if (!first) return "";
        return distinct.size > 1 ? translate(locale, `${first.key}.many`) : assumptionText(first, project, locale);
      });
      return { rule, findings: fs, assumptions };
    })
    .filter((c) => c.findings.length)
    .sort((a, b) => SEV[a.rule.severity] - SEV[b.rule.severity] || (a.rule.id < b.rule.id ? -1 : 1));
}
