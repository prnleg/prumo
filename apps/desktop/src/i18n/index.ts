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
