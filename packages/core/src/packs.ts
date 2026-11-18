// Data packs (ADR-030, format ADR-049): plain JSON files that hold values — materials, default loads,
// rule settings — so no country's numbers live in code. Packs nest by id: "br" → "br/sp" →
// "br/sp/sao-paulo"; a child overrides its parent's values. Every value carries where it came from
// (source), how sure we are (confidence) and whether an engineer reviewed it (ADR-041). Pure: no I/O.
import type { ModuleId } from "./model";

export const PACK_FORMAT = "prumo-pack";
export const PACK_FORMAT_VERSION = 1;

/** ADR-041 review levels. */
export type Review = "UNVERIFIED" | "VERIFIED-UNSIGNED" | "VERIFIED";
export const REVIEWS: readonly Review[] = ["UNVERIFIED", "VERIFIED-UNSIGNED", "VERIFIED"];
export type ValueConfidence = "low" | "medium" | "high";
export const VALUE_CONFIDENCES: readonly ValueConfidence[] = ["low", "medium", "high"];
/** CLAUDE.md rule 6 marker; such a value can only be UNVERIFIED. */
export const PACK_UNSOURCED = "UNSOURCED – placeholder";

export interface PackValue {
  value: number | string | boolean;
  /** "kN/m3", "kPa", "mm"… (ADR-006: internal units are mm, N, MPa; packs say what they store). */
  unit?: string;
  /** Clause reference or book + page — never the standard's text (ADR-014). */
  source: string;
  confidence: ValueConfidence;
  review: Review;
  /** Short note for the engineer / reader (why this value, what it assumes). */
  note?: string;
}

export interface DataPack {
  format: typeof PACK_FORMAT;
  formatVersion: number;
  /** "br", "br/sp", "br/sp/sao-paulo": lower case, "/"-separated; a child's id = parent id + "/" + one part. */
  id: string;
  parent: string | null;
  /** The module whose values these are (namespaces the keys). */
  module: ModuleId;
  version: string;
  /** Display name per locale. */
  name: Record<string, string>;
  /** Dotted keys ("material.ceramic-block.unitWeight"). */
  values: Record<string, PackValue>;
}

export interface ResolvedValue extends PackValue {
  key: string;
  /** Id of the pack the value came from (shown as "from: Brazil pack"). */
  pack: string;
}

const ID = /^[a-z]{2}(\/[a-z0-9-]+)*$/;
const KEY = /^[a-z][a-zA-Z0-9-]*(\.[a-zA-Z0-9-]+)+$/;

/** Check a parsed JSON value; returns the pack or the list of problems (in English: for pack authors). */
export function parsePack(raw: unknown): { ok: true; pack: DataPack } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const o = raw as Partial<DataPack> | null;
  if (!o || typeof o !== "object") return { ok: false, errors: ["not an object"] };
  if (o.format !== PACK_FORMAT) errors.push(`format must be "${PACK_FORMAT}"`);
  if (o.formatVersion !== PACK_FORMAT_VERSION)
    errors.push(`formatVersion ${String(o.formatVersion)} not supported (this app reads ${PACK_FORMAT_VERSION})`);
  if (typeof o.id !== "string" || !ID.test(o.id)) errors.push("id must look like br, br/sp or br/sp/sao-paulo");
  const parentOk =
    o.parent === null
      ? typeof o.id === "string" && !o.id.includes("/")
      : typeof o.parent === "string" &&
        typeof o.id === "string" &&
        o.id.startsWith(o.parent + "/") &&
        !o.id.slice(o.parent.length + 1).includes("/");
  if (!parentOk) errors.push("parent must be null for a country, or the id without its last part");
  if (typeof o.module !== "string" || !o.module) errors.push("module is missing");
  if (typeof o.version !== "string" || !o.version) errors.push("version is missing");
  if (!o.name || typeof o.name !== "object" || !Object.values(o.name).every((n) => typeof n === "string"))
    errors.push("name must map locales to text");
  if (!o.values || typeof o.values !== "object") errors.push("values is missing");
  else
    for (const [k, v] of Object.entries(o.values)) {
      const at = `values["${k}"]`;
      if (!KEY.test(k)) errors.push(`${at}: key must be dotted words`);
      if (!v || typeof v !== "object") {
        errors.push(`${at}: not an object`);
        continue;
      }
      if (!["number", "string", "boolean"].includes(typeof v.value))
        errors.push(`${at}: value must be a number, text or yes/no`);
      if (typeof v.value === "number" && !Number.isFinite(v.value)) errors.push(`${at}: value must be finite`);
      if (v.unit !== undefined && typeof v.unit !== "string") errors.push(`${at}: unit must be text`);
      if (typeof v.source !== "string" || !v.source.trim())
        errors.push(`${at}: source is required (or "${PACK_UNSOURCED}")`);
      if (!VALUE_CONFIDENCES.includes(v.confidence)) errors.push(`${at}: confidence must be low, medium or high`);
      if (!REVIEWS.includes(v.review)) errors.push(`${at}: review must be ${REVIEWS.join(", ")}`);
      if (v.source === PACK_UNSOURCED && v.review !== "UNVERIFIED")
        errors.push(`${at}: an unsourced value can only be UNVERIFIED`);
      if (v.note !== undefined && typeof v.note !== "string") errors.push(`${at}: note must be text`);
    }
  return errors.length ? { ok: false, errors } : { ok: true, pack: o as DataPack };
}

/**
 * The packs installed for one app run. Lookups walk from the most local pack up to the country:
 * region "br/sp/sao-paulo" → "br/sp/sao-paulo", "br/sp", "br" (missing levels are skipped).
 */
export class PackSet {
  private readonly byId = new Map<string, DataPack>();

  constructor(packs: readonly DataPack[]) {
    // later packs with the same module + id replace earlier ones (deterministic: input order)
    for (const p of packs) this.byId.set(`${p.module}|${p.id}`, p);
  }

  /** Packs that apply to `region` for `module`, most local first. */
  chain(module: ModuleId, region: string): DataPack[] {
    const parts = region.split("/");
    const out: DataPack[] = [];
    for (let n = parts.length; n > 0; n--) {
      const p = this.byId.get(`${module}|${parts.slice(0, n).join("/")}`);
      if (p) out.push(p);
    }
    return out;
  }

  get(module: ModuleId, region: string, key: string): ResolvedValue | null {
    for (const p of this.chain(module, region)) {
      const v = p.values[key];
      if (v) return { ...v, key, pack: p.id };
    }
    return null;
  }

  /** Every key visible from `region` (with its winning value), sorted by key. */
  all(module: ModuleId, region: string): ResolvedValue[] {
    const seen = new Map<string, ResolvedValue>();
    for (const p of this.chain(module, region))
      for (const [key, v] of Object.entries(p.values)) if (!seen.has(key)) seen.set(key, { ...v, key, pack: p.id });
    return [...seen.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
  }

  /** Display name of a pack (locale, then English, then its id). */
  name(module: ModuleId, id: string, locale: string): string {
    const p = this.byId.get(`${module}|${id}`);
    return p?.name[locale] ?? p?.name.en ?? id;
  }
}
