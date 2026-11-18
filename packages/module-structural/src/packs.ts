// The Structural module's bundled data packs (ADR-030 / ADR-049). The core ships none; Brazil comes
// with this module. Values are filled by Phase 3 (materials, loads); every one carries its source.
import { PackSet, parsePack, type DataPack, type Project } from "@prumo/core";
import br from "../packs/br.json";
import { STRUCTURAL } from "./manifest";

/** Packs bundled with the module. A broken bundled pack is a build error, not a user's problem. */
export const BUNDLED_PACKS: readonly DataPack[] = [br].map((raw) => {
  const r = parsePack(raw);
  if (!r.ok) throw new Error(`bundled pack is invalid: ${r.errors.join("; ")}`);
  if (r.pack.module !== STRUCTURAL) throw new Error(`bundled pack ${r.pack.id} is for ${r.pack.module}`);
  return r.pack;
});

export const structuralPacks = (extra: readonly DataPack[] = []) => new PackSet([...BUNDLED_PACKS, ...extra]);

/**
 * Where the project is, for pack lookups: the country from its profile ("br-nbr/…" → "br"). States and
 * cities come when a project can say where it is (later; Q-101).
 */
export function packRegion(p: Project): string {
  return (p.profileId.split("/")[0] ?? "").split("-")[0] || "br";
}
