// App preferences remembered across launches (ADR-037): `settings.json` in Prumo's app-data folder
// (browser dev build: localStorage). Framework-free so it is unit-tested.
//   - reading never fails: a missing, damaged or partly invalid file gives the defaults for what's bad
//   - unknown keys (from a newer Prumo) are kept on write, so going back and forth between versions
//     doesn't lose them (same spirit as CLAUDE.md rule 13)
import { LOCALES, type Locale } from "./i18n/messages";

export const PREFS_FILE = "settings.json";
export const PREFS_VERSION = 1;

export interface Prefs {
  locale?: Locale;
  angleStepDeg?: number;
  /** Grid for new blank projects (mm); each project keeps its own grid in its file. */
  gridSize?: number;
}

export interface LoadedPrefs {
  prefs: Prefs;
  /** Everything else that was in the file, written back untouched. */
  rest: Record<string, unknown>;
  /** File version; a newer one is kept on write (an older Prumo doesn't downgrade the number). */
  v: number;
}

const isPositive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

export function parsePrefs(text: string | null): LoadedPrefs {
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    raw = {};
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) raw = {};
  const { v, locale, angleStepDeg, gridSize, ...rest } = raw as Record<string, unknown>;
  const prefs: Prefs = {};
  if (typeof locale === "string" && (LOCALES as string[]).includes(locale)) prefs.locale = locale as Locale;
  if (isPositive(angleStepDeg) && angleStepDeg <= 90) prefs.angleStepDeg = angleStepDeg;
  if (isPositive(gridSize)) prefs.gridSize = gridSize;
  return { prefs, rest, v: isPositive(v) && v > PREFS_VERSION ? v : PREFS_VERSION };
}

export function serializePrefs(p: LoadedPrefs): string {
  return JSON.stringify({ ...p.rest, v: p.v, ...p.prefs }, null, 2) + "\n";
}
