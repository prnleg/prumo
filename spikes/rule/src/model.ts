// Spike B — the smallest model one structural rule needs. Units: mm.
// Shape follows Spike E (namespaced module components), flattened for readability.

/** How the wall's load-bearing status is known. ADR-017 is OPEN: this spike shows both paths, decides nothing. */
export type BearingMark = "bearing" | "non-bearing" | "unmarked";

export interface Wall {
  id: string;
  /** Display number ("wall 2"). Labels are i18n, never stored text. */
  n: number;
  length: number;
  height: number;
  thickness: number;
  /** components["org.prumo.structural"].role in the real model. */
  bearing: BearingMark;
}

export type OpeningKind = "window" | "door";

export interface Lintel {
  /** How far the lintel extends past the opening on each side. Drawing value only: no check reads it (R-OPEN-002 needs E-10). */
  extendsEachSide: number;
}

export interface Opening {
  id: string;
  n: number;
  kind: OpeningKind;
  host: string; // wall id
  /** Distance from the wall start to the opening's left edge. */
  offset: number;
  width: number;
  sill: number;
  height: number;
  /** components["org.prumo.structural"].lintel; null = none drawn. */
  lintel: Lintel | null;
}

export interface Model {
  walls: Wall[];
  openings: Opening[];
}

/**
 * Profile = country + construction system (ADR-004/009).
 * `unmarkedWalls` is a SPIKE TOGGLE for ADR-017 (OPEN): option D treats unmarked walls in structural
 * masonry as bearing; "skip" leaves them out. Neither is accepted.
 */
export interface Profile {
  id: "br-nbr";
  system: "structural-masonry";
  version: string;
  unmarkedWalls: "assume-bearing" | "skip";
}

export const SPIKE_PROFILE: Profile = { id: "br-nbr", system: "structural-masonry", version: "0.0-spike", unmarkedWalls: "assume-bearing" };

/** The hard-coded house from ROADMAP Phase 0 #4: one bearing wall with a window, one wall with a door. */
export function sampleModel(): Model {
  return {
    walls: [
      { id: "w-a", n: 1, length: 4000, height: 2700, thickness: 140, bearing: "bearing" },
      { id: "w-b", n: 2, length: 3000, height: 2700, thickness: 140, bearing: "unmarked" },
    ],
    openings: [
      { id: "o-a", n: 1, kind: "window", host: "w-a", offset: 1400, width: 1200, sill: 1000, height: 1200, lintel: null },
      { id: "o-b", n: 1, kind: "door", host: "w-b", offset: 600, width: 800, sill: 0, height: 2100, lintel: null },
    ],
  };
}
