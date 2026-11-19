// The app's thin adapter to Structural's wording (ADR-059): the functions live in the module
// (`@prumo/module-structural/ui`); these bind them to the app's translator and number formats. Still used
// by notes ("about the 3,00 m wall"), Settings → values and the tests. Goes away with the strings sweep.
import type { Project, ResolvedValue } from "@prumo/core";
import type { AssumptionUse, Finding, Param, RuleDef } from "@prumo/module-structural";
import {
  assumptionText as mAssumption,
  cards as mCards,
  findingText as mFinding,
  paramText as mParam,
  sig2 as mSig2,
  unitWeightText as mUnitWeight,
  type RuleCard,
} from "@prumo/module-structural/ui";
import { formatLength, translate, type Locale } from "./i18n";

const fmt = (locale: Locale) => ({
  t: (k: string, p?: Record<string, string | number>) => translate(locale, k, p),
  length: (mm: number) => formatLength(mm, locale),
});

export type { RuleCard };
export const paramText = (p: Param, project: Project, locale: Locale) => mParam(p, project, fmt(locale));
export const findingText = (f: Finding, project: Project, locale: Locale) => mFinding(f, project, fmt(locale));
export const assumptionText = (a: AssumptionUse, project: Project, locale: Locale) =>
  mAssumption(a, project, fmt(locale));
export const cards = (rules: readonly RuleDef[], findings: readonly Finding[], project: Project, locale: Locale) =>
  mCards(rules, findings, project, fmt(locale));
export const unitWeightText = (v: ResolvedValue, locale: Locale, packName: string) =>
  mUnitWeight(v, locale, fmt(locale).t, packName);
export const sig2 = (x: number, locale: Locale) => mSig2(x, locale);
