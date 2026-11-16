// Plan geometry of one level: computed joins + clean outline (never stored — DATA_MODEL doubt 2).
import type { Id, Opening, Project, Wall } from "../model";
import { openingPlan, type OpeningPlan } from "./openings";
import { computeJoins, DEFAULTS, type JoinOptions, type JoinResult } from "./joins";
import { visibleOutline, type Seg } from "./outline";

export interface PlanGeometry extends JoinResult {
  outline: Seg[];
  openings: OpeningPlan[];
}

export function wallsOnLevel(p: Project, levelId: Id): Wall[] {
  return Object.values(p.elements).filter((e): e is Wall => e.type === "wall" && e.levelId === levelId);
}

/** Openings hosted on walls of this level, sorted by id. */
export function openingsOnLevel(p: Project, levelId: Id): Opening[] {
  return Object.values(p.elements)
    .filter((e): e is Opening => e.type === "opening" && e.levelId === levelId)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** @param expand see `openingPlan`. */
export function planGeometry(p: Project, levelId: Id, opts: JoinOptions = DEFAULTS, expand = 0): PlanGeometry {
  const walls = wallsOnLevel(p, levelId);
  const joins = computeJoins(walls, opts);
  const byId = new Map(walls.map((w) => [w.id, w]));
  const openings = openingsOnLevel(p, levelId).flatMap((o) => {
    const w = byId.get(o.host.elementId);
    return w ? [openingPlan(w, o, expand)] : [];
  });
  return { ...joins, outline: visibleOutline(joins.walls), openings };
}
