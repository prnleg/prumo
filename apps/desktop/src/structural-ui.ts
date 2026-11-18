// Turn structural findings into words (ADR-021: params are typed and formatted at display time) and
// group them one card per rule (Q-135). Framework-free, unit-tested.
import { wallLength, type Project } from "@prumo/core";
import { isChase, kgPerM3, type AssumptionUse, type Finding, type Param, type RuleDef } from "@prumo/module-structural";
import type { ResolvedValue } from "@prumo/core";
import { formatLength, translate, type Locale } from "./i18n";

export function paramText(p: Param, project: Project, locale: Locale): string {
  const t = (k: string, params?: Record<string, string | number>) => translate(locale, k, params);
  switch (p.kind) {
    case "length":
      return formatLength(p.mm, locale);
    case "text":
      return t(p.key);
    case "name":
      return p.name || t("someone");
    case "element": {
      const e = project.elements[p.id];
      if (e?.type === "wall") return t("el.wall", { length: formatLength(wallLength(e), locale) });
      if (e?.type === "opening") return t("el.opening", { kind: e.kind, width: formatLength(e.width, locale) });
      if (isChase(e)) return t("el.chase");
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
  /** Worst severity among its findings (a rule may grade findings differently, e.g. new vs enlarged). */
  severity: Finding["severity"];
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
      const severity = fs.map((f) => f.severity).sort((a, b) => SEV[a] - SEV[b])[0] ?? rule.severity;
      return { rule, severity, findings: fs, assumptions };
    })
    .filter((c) => c.findings.length)
    .sort((a, b) => SEV[a.severity] - SEV[b.severity] || (a.rule.id < b.rule.id ? -1 : 1));
}

/**
 * A pack value for people (ADR-049): "13 kN/m³ (≈ 1,330 kg/m³)" + its review level and where it came from.
 * kg rounded to 10: the value itself is a rounded table figure, more digits would be false precision.
 */
export function unitWeightText(v: ResolvedValue, locale: Locale, packName: string) {
  const n = (x: number, d = 0) => new Intl.NumberFormat(locale, { maximumFractionDigits: d }).format(x);
  const value = Number(v.value);
  return {
    text: translate(locale, "material.weight", { kn: n(value, 1), kg: n(Math.round(kgPerM3(value) / 10) * 10) }),
    review: translate(locale, `value.review.${v.review.toLowerCase()}`),
    from: translate(locale, "pack.from", { pack: packName, source: v.source }),
  };
}
