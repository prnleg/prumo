// Spike B — the explanation format: Finding → a card with the 8 items SAFETY_AND_LIABILITY requires.
// Pure (model + locale in, plain data out) so the same card feeds the UI, exports and tests.
import type { CheckResult } from "./engine";
import { UNSOURCED, isVerified, type Finding, type Param, type RuleDef } from "./finding";
import { formatLength, t, type Locale } from "./i18n";
import type { Model, Profile } from "./model";

export interface Card {
  fingerprint: string;
  /** 1. rule ID + name */
  ruleId: string;
  name: string;
  /** 2. severity */
  severity: Finding["severity"];
  severityLabel: string;
  /** 3. plain-language explanation (≤ 3 sentences) */
  message: string;
  /** 4. elements involved (clickable in the UI) */
  elements: { id: string; label: string }[];
  /** 5. assumptions used */
  assumptions: { id: string; text: string }[];
  /** 6. confidence */
  confidence: string;
  /** 7. source or UNVERIFIED */
  source: string;
  verified: boolean;
  /** 8. what this check does not consider */
  notConsidered: string[];
  terms: string[];
}

export interface Ctx {
  model: Model;
  profile: Profile;
  locale: Locale;
}

export function elementLabel(id: string, { model, locale }: Ctx): string {
  const w = model.walls.find((x) => x.id === id);
  if (w) return t(locale, "elem.wall", { n: w.n });
  const o = model.openings.find((x) => x.id === id);
  if (o) return t(locale, `elem.${o.kind}`, { n: o.n });
  return id; // deleted element: show the raw id rather than lie
}

function renderParams(params: Record<string, Param>, ctx: Ctx): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, p] of Object.entries(params)) {
    if (p.kind === "length") out[k] = formatLength(p.mm, ctx.locale);
    else if (p.kind === "element") out[k] = elementLabel(p.id, ctx);
    else out[k] = t(ctx.locale, `profile.${ctx.profile.id}.${ctx.profile.system}`, { version: ctx.profile.version });
  }
  return out;
}

export function sourceText(rule: RuleDef, locale: Locale): string {
  if (rule.source === UNSOURCED) return t(locale, "src.unverified");
  if (!rule.review) return t(locale, "src.unreviewed", { source: rule.source });
  return t(locale, "src.reviewed", { source: rule.source, by: rule.review.by, date: rule.review.date });
}

export function explain(f: Finding, rule: RuleDef, ctx: Ctx): Card {
  const L = ctx.locale;
  return {
    fingerprint: f.fingerprint,
    ruleId: f.ruleId,
    name: t(L, rule.nameKey),
    severity: f.severity,
    severityLabel: t(L, `sev.${f.severity}`),
    message: t(L, f.messageKey, renderParams(f.params, ctx)),
    elements: f.elementIds.map((id) => ({ id, label: elementLabel(id, ctx) })),
    assumptions: f.assumptions.map((a) => ({ id: a.id, text: t(L, a.key, renderParams(a.params, ctx)) })),
    confidence: t(L, `conf.${f.confidence}`),
    source: sourceText(rule, L),
    verified: isVerified(rule),
    notConsidered: rule.notConsidered.map((k) => t(L, k)),
    terms: rule.terms.map((k) => t(L, k)),
  };
}

/** Headline for the panel. No green "pass" state exists: zero findings is neutral text (SAFETY). */
export function summary(r: CheckResult, locale: Locale): string {
  const n = r.checksRun.length;
  if (!r.findings.length) return t(locale, "summary.none", { n, list: t(locale, "summary.notCovered") });
  return t(locale, "summary.some", { k: r.findings.length, n });
}

/** Plain-text card: what an export/copy would carry. Also the snapshot used in tests. */
export function cardText(c: Card, locale: Locale): string {
  const L = (k: string) => t(locale, k);
  return [
    `[${c.severityLabel}] ${c.ruleId} — ${c.name}`,
    c.message,
    `${L("card.elements")}: ${c.elements.map((e) => e.label).join(", ")}`,
    `${L("card.assumptions")}:`,
    ...c.assumptions.map((a) => `  ${a.id}: ${a.text}`),
    `${L("card.confidence")}: ${c.confidence}`,
    `${L("card.source")}: ${c.source}`,
    `${L("card.notConsidered")}:`,
    ...c.notConsidered.map((x) => `  - ${x}`),
    `${L("card.terms")}:`,
    ...c.terms.map((x) => `  - ${x}`),
    L("footer"),
  ].join("\n");
}
