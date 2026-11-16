// Plan geometry of one level: computed joins + clean outline (never stored — DATA_MODEL doubt 2).
import type { Id, Project, Wall } from "../model";
import { computeJoins, DEFAULTS, type JoinOptions, type JoinResult } from "./joins";
import { visibleOutline, type Seg } from "./outline";

export interface PlanGeometry extends JoinResult {
  outline: Seg[];
}

export function wallsOnLevel(p: Project, levelId: Id): Wall[] {
  return Object.values(p.elements).filter((e): e is Wall => e.type === "wall" && e.levelId === levelId);
}

export function planGeometry(p: Project, levelId: Id, opts: JoinOptions = DEFAULTS): PlanGeometry {
  const joins = computeJoins(wallsOnLevel(p, levelId), opts);
  return { ...joins, outline: visibleOutline(joins.walls) };
}
