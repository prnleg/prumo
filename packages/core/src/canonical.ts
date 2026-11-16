// Canonical JSON: same model → same bytes, whatever the key insertion order (CLAUDE.md rule 10).
// Object keys sorted (code-unit order); arrays keep their order; 2-space indent; trailing newline.

export class CanonicalJsonError extends Error {}

function check(v: unknown, path: string): void {
  if (v === undefined) throw new CanonicalJsonError(`undefined at ${path}`);
  if (typeof v === "number" && !Number.isFinite(v)) throw new CanonicalJsonError(`non-finite number at ${path}`);
  if (typeof v === "function" || typeof v === "symbol" || typeof v === "bigint")
    throw new CanonicalJsonError(`${typeof v} at ${path}`);
}

function sortValue(v: unknown, path: string): unknown {
  check(v, path);
  if (Array.isArray(v)) return v.map((x, i) => sortValue(x, `${path}[${i}]`));
  if (v !== null && typeof v === "object") {
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) throw new CanonicalJsonError(`non-plain object at ${path}`);
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v).sort()) out[k] = sortValue((v as Record<string, unknown>)[k], `${path}.${k}`);
    return out;
  }
  return Object.is(v, -0) ? 0 : v;
}

/** Throws on undefined, NaN/Infinity, functions, class instances: those are bugs, not data. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value, "$"), null, 2) + "\n";
}
