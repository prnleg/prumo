// Turn structural findings into words (ADR-021: params are typed and formatted at display time) and
// group them one card per rule (Q-135). Framework-free, unit-tested.
import { wallLength, type Project } from "@prumo/core";
import {
  isChase,
  kgPerM3,
  type WallLoad,
  type LintelCheck,
  type AssumptionUse,
  type Finding,
  type Param,
  type RuleDef,
} from "@prumo/module-structural";
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

/** Two significant digits (owner: rounded + range — more digits would be false precision). */
export function sig2(x: number, locale: Locale): string {
  if (!x) return "0";
  const d = Math.max(0, 1 - Math.floor(Math.log10(Math.abs(x))));
  const r = Number(x.toPrecision(2));
  return new Intl.NumberFormat(locale, { maximumFractionDigits: d }).format(r);
}
const span = (lo: number, hi: number, locale: Locale) =>
  sig2(lo, locale) === sig2(hi, locale) ? sig2(lo, locale) : `${sig2(lo, locale)}–${sig2(hi, locale)}`;

/** A wall's load for the panel: headline + range + calculation lines + what isn't counted. */
export function wallLoadText(
  L: WallLoad,
  locale: Locale,
  nameOf: (ref: string) => string,
): { headline: string; range: string; lines: string[]; notCounted: string[] } {
  const t = (k: string, p?: Record<string, string | number>) => translate(locale, k, p);
  const mid = (L.lo + L.hi) / 2;
  const lines = L.lines.map((l) => {
    const p = l.params;
    if (l.key === "load.line.self")
      return t(l.key, {
        t: sig2(Number(p.t), locale),
        h: sig2(Number(p.h), locale),
        g: sig2(Number(p.gLo), locale),
        w: span(l.lo, l.hi, locale),
      });
    if (l.key === "load.line.selfUnknown")
      return t(l.key, {
        gLo: sig2(Number(p.gLo), locale),
        gHi: sig2(Number(p.gHi), locale),
        w: span(l.lo, l.hi, locale),
      });
    if (l.key === "load.line.upper")
      return t(l.key, { floor: nameOf(String(p.ref)), count: Number(p.count), w: span(l.lo, l.hi, locale) });
    return t(l.key, {
      name: nameOf(String(p.ref)),
      kind: t(`load.kind.${String(p.kind)}`),
      q: span(Number(p.qLo), Number(p.qHi), locale),
      w: span(l.lo, l.hi, locale),
    });
  });
  return {
    headline: t("load.headline", { kn: sig2(mid, locale), t: sig2(mid / 9.80665, locale) }),
    range: t("load.range", { range: span(L.lo, L.hi, locale) }),
    lines,
    notCounted: L.notCounted.map((k) => t(k)),
  };
}

/** The selected opening's lintel (ADR-052) for the panel: headline, bending vs strength, verdict, calculation. */
export function lintelText(
  c: LintelCheck,
  locale: Locale,
  nameOf: (ref: string) => string,
): {
  headline: string;
  bending: string;
  strength: string | null;
  verdict: string;
  lines: string[];
  notChecked: string[];
} {
  const t = (k: string, p?: Record<string, string | number>) => translate(locale, k, p);
  const s = (x: number) => sig2(x, locale);
  const mid = (c.w.lo + c.w.hi) / 2;
  const gf = c.values.find((v) => v.key === "safety.gammaF");
  const fck = [
    c.values.find((v) => v.key === "lintel.concrete.fck.min"),
    c.values.find((v) => v.key === "lintel.concrete.fck.max"),
  ];
  const lines = c.lines.map((l) => {
    const p = l.params;
    if (l.key === "lintel.line.span")
      return t(l.key, { width: s(Number(p.width)), bearing: s(Number(p.bearing)), L: s(Number(p.L)) });
    if (l.key === "lintel.line.upper") return t(l.key, { floor: nameOf(String(p.ref)), w: span(l.lo, l.hi, locale) });
    if (l.key === "lintel.line.slab")
      return t(l.key, {
        name: nameOf(String(p.ref)),
        kind: t(`load.kind.${String(p.kind)}`),
        w: span(l.lo, l.hi, locale),
      });
    return t(l.key, { h: s(Number(p.h)), w: span(l.lo, l.hi, locale) });
  });
  lines.push(t("lintel.line.moment", { m: span(c.M.lo, c.M.hi, locale), v: span(c.V.lo, c.V.hi, locale) }));
  if (c.MRd && fck[0] && fck[1])
    lines.push(t("lintel.line.strength", { fck: span(Number(fck[0].value), Number(fck[1].value), locale) }));
  return {
    headline: t("lintel.headline", { kn: s(mid), L: s(c.span), t: s(mid / 9.80665) }),
    bending: t("lintel.bending", { gf: gf ? s(Number(gf.value)) : "1", md: span(c.Md.lo, c.Md.hi, locale) }),
    strength: c.MRd ? t("lintel.strength", { mrd: span(c.MRd.lo, c.MRd.hi, locale) }) : null,
    verdict: t(`lintel.verdict.${c.verdict}`),
    lines,
    notChecked: c.notChecked.map((k) => t(k)),
  };
}
