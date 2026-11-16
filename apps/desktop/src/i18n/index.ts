// Thin glue over intl-messageformat (ADR-034). Framework-free: usable from core-facing code and tests.
import { IntlMessageFormat } from "intl-messageformat";
import { CATALOGUES, type Locale, type MessageKey } from "./messages";

export type { Locale, MessageKey };
export type Params = Record<string, string | number>;

const cache = new Map<string, IntlMessageFormat>();

export function translate(locale: Locale, key: string, params: Params = {}): string {
  const src = CATALOGUES[locale][key as MessageKey];
  if (src === undefined) return key; // visible, never crashes the UI; a test guards completeness
  const id = `${locale}\u0000${key}`;
  let f = cache.get(id);
  if (!f) {
    f = new IntlMessageFormat(src, locale);
    cache.set(id, f);
  }
  return String(f.format(params));
}

/** OS language → supported locale (ADR-021: follows the UI language, customizable later). */
export function detectLocale(langs: readonly string[]): Locale {
  for (const l of langs) {
    if (l.toLowerCase().startsWith("pt")) return "pt-BR";
    if (l.toLowerCase().startsWith("en")) return "en";
  }
  return "en";
}

/** mm → "4.00 m" / "4,00 m". */
export const formatLength = (mm: number, locale: Locale) =>
  `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(mm / 1000)} m`;

/** mm → "10 cm" for small settings like the grid. */
export const formatSmall = (mm: number, locale: Locale) =>
  mm < 1000 ? `${new Intl.NumberFormat(locale).format(mm / 10)} cm` : formatLength(mm, locale);

function separators(locale: Locale) {
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  return {
    group: parts.find((p) => p.type === "group")?.value ?? "",
    decimal: parts.find((p) => p.type === "decimal")?.value ?? ".",
  };
}

/**
 * Parse a number typed in the UI language (ADR-021: no mixed parsing). pt-BR: "14,5" = 14.5 and
 * "1.200" = 1200; en: "14.5" = 14.5 and "1,200" = 1200. Returns null for anything else.
 */
export function parseNumber(text: string, locale: Locale): number | null {
  const { group, decimal } = separators(locale);
  const s = text.trim().replace(/[\s\u00a0\u202f]/g, "");
  const esc = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const G = esc(group || "\u0000");
  const D = esc(decimal);
  // Group separators only in real groups of three ("1.200", never "14.5" in pt-BR → refused, not 145).
  const ok = new RegExp(`^-?(\\d+|\\d{1,3}(${G}\\d{3})+)(${D}\\d+)?$`);
  if (!ok.test(s)) return null;
  return Number(
    s
      .split(group || "\u0000")
      .join("")
      .replace(decimal, "."),
  );
}

/** mm → "14" / "14,5" (centimetres, up to one decimal) for edit fields. */
export const formatCm = (mm: number, locale: Locale) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 1, useGrouping: false }).format(mm / 10);
