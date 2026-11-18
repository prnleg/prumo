// Plan geometry of one level: computed joins + clean outline (never stored — DATA_MODEL doubt 2).
import {
  hostedExtent,
  isDivider,
  isHosted,
  isModuleElement,
  type Host,
  type Id,
  type ModuleElement,
  type Opening,
  type Project,
  type Wall,
} from "../model";
import { add, mul, norm, perp, sub, type V } from "./vec";
import { openingPlan, type OpeningPlan } from "./openings";
import { computeJoins, DEFAULTS, faceOffsets, type JoinOptions, type JoinResult } from "./joins";
import { visibleOutline, type Seg } from "./outline";

export interface PlanGeometry extends JoinResult {
  outline: Seg[];
  openings: OpeningPlan[];
  /** Room dividers (ADR-040): just their line; `polygon` is a hair-thin strip for picking. */
  dividers: { id: Id; a: V; b: V; polygon: V[] }[];
  /**
   * Module items hosted on walls (chases…), as a marker along the wall's centre of body: `a`→`b`
   * (a == b for a point item). `polygon` spans the wall body, for picking. Sorted by id.
   */
  items: HostedItemPlan[];
}

export interface HostedItemPlan {
  id: Id;
  type: string;
  a: V;
  b: V;
  polygon: V[];
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
  const all = wallsOnLevel(p, levelId);
  const walls = all.filter((w) => !isDivider(w)); // dividers have no body: no joins, no outline
  const joins = computeJoins(walls, opts);
  const byId = new Map(walls.map((w) => [w.id, w]));
  const dividers = all
    .filter(isDivider)
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((w) => {
      const n = perp(norm(sub(w.end, w.start))); // 1 mm each side
      return {
        id: w.id,
        a: w.start,
        b: w.end,
        polygon: [add(w.start, n), add(w.end, n), sub(w.end, n), sub(w.start, n)],
      };
    });
  const openings = openingsOnLevel(p, levelId).flatMap((o) => {
    const w = byId.get(o.host.elementId);
    return w ? [openingPlan(w, o, expand)] : [];
  });
  const items = Object.values(p.elements)
    .filter((e): e is ModuleElement & { host: Host } => isModuleElement(e) && isHosted(e) && e.levelId === levelId)
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .flatMap((e): HostedItemPlan[] => {
      const w = byId.get(e.host.elementId);
      if (!w) return [];
      const u = norm(sub(w.end, w.start));
      const n = perp(u);
      const { l, r } = faceOffsets(w);
      const m = (l + r) / 2;
      const P = (s: number, off: number) => add(add(w.start, mul(u, s)), mul(n, off));
      const s0 = e.host.offset;
      const s1 = s0 + hostedExtent(e);
      const pad = s1 > s0 ? 0 : Math.max(20, (l - r) / 2); // a point item still gets a pickable square
      return [
        {
          id: e.id,
          type: e.type,
          a: P(s0, m),
          b: P(s1, m),
          polygon: [P(s0 - pad, r), P(s1 + pad, r), P(s1 + pad, l), P(s0 - pad, l)],
        },
      ];
    });
  return { ...joins, outline: visibleOutline(joins.walls), openings, dividers, items };
}
