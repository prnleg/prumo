// The Electrical module's bundled data packs (ADR-049). NBR 5410 minimums for homes, all UNVERIFIED.
import { PackSet, parsePack, type DataPack, type Project } from "@prumo/core";
import br from "../packs/br.json";
import { ELECTRICAL } from "./manifest";

export const BUNDLED_PACKS: readonly DataPack[] = [br].map((raw) => {
  const r = parsePack(raw);
  if (!r.ok) throw new Error(`bundled pack is invalid: ${r.errors.join("; ")}`);
  if (r.pack.module !== ELECTRICAL) throw new Error(`bundled pack ${r.pack.id} is for ${r.pack.module}`);
  return r.pack;
});

export const electricalPacks = (extra: readonly DataPack[] = []) => new PackSet([...BUNDLED_PACKS, ...extra]);

/** The country from the project's profile ("br-nbr/…" → "br"). */
export const packRegion = (p: Project): string => (p.profileId.split("/")[0] ?? "").split("-")[0] || "br";
