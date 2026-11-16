import type { Id } from "./model";

/** Where new ids come from. Injected so tests (and analysis) stay deterministic. */
export type IdSource = () => Id;

/** Production: random UUID v4 (Web Crypto; available in browsers, WebViews, and Node ≥ 19). */
export const randomIds: IdSource = () => crypto.randomUUID();

/** Tests: "p-1", "p-2", … */
export function counterIds(prefix = "id"): IdSource {
  let n = 0;
  return () => `${prefix}-${++n}`;
}
