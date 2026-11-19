// Electrical items in 3D (drawing only, never stored): a plate on the wall face for outlets and switches,
// a flat disc under the ceiling for ceiling lights. Sizes are drawing values, not product sizes.
import { faceOffsets, wallLength, type Project, type Solid, type V } from "@prumo/core";
import { electricalData, kindOf } from "./data";

const PLATE_W = 80; // mm along the wall
const PLATE_H = 120; // mm tall
const PLATE_D = 12; // mm out of the face
const LIGHT_R = 150; // mm
const LIGHT_T = 50; // mm thick, hanging under the ceiling
const SIDES = 12;

const ccw = (pts: V[]) => {
  let a = 0;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length] ?? p;
    a += p.x * q.y - q.x * p.y;
  });
  return a >= 0 ? pts : [...pts].reverse();
};

/** Every electrical item of the project as a small solid. Sorted by id (deterministic). */
export function electricalSolids(p: Project): Solid[] {
  const levels = new Map(p.levels.map((l) => [l.id, l]));
  const out: Solid[] = [];
  for (const e of Object.values(p.elements).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const k = kindOf(e);
    const level = levels.get(e.levelId);
    if (!k || !level) continue;
    if (k === "light") {
      if (!("at" in e) || !e.at) continue;
      const top = level.elevation + level.defaultWallHeight;
      const c = e.at;
      const outline = Array.from({ length: SIDES }, (_, i) => {
        const a = (2 * Math.PI * i) / SIDES;
        return { x: c.x + LIGHT_R * Math.cos(a), y: c.y + LIGHT_R * Math.sin(a) };
      });
      out.push({ id: e.id, kind: "fixture", levelId: e.levelId, outline, z0: top - LIGHT_T, z1: top });
      continue;
    }
    if (!("host" in e) || !e.host) continue;
    const w = p.elements[e.host.elementId];
    if (w?.type !== "wall") continue;
    const d = electricalData(e);
    const L = wallLength(w) || 1;
    const u = { x: (w.end.x - w.start.x) / L, y: (w.end.y - w.start.y) / L };
    const n = { x: -u.y, y: u.x };
    const f = faceOffsets(w);
    const left = (d.face ?? "left") === "left";
    const at = (along: number, out: number) => {
      const s = left ? f.l + out : f.r - out;
      return { x: w.start.x + u.x * along + n.x * s, y: w.start.y + u.y * along + n.y * s };
    };
    const o = e.host.offset;
    const outline = ccw([
      at(o - PLATE_W / 2, 0),
      at(o + PLATE_W / 2, 0),
      at(o + PLATE_W / 2, PLATE_D),
      at(o - PLATE_W / 2, PLATE_D),
    ]);
    const mid = level.elevation + w.baseOffset + (d.height ?? 0);
    out.push({
      id: e.id,
      kind: "fixture",
      levelId: e.levelId,
      outline,
      z0: mid - PLATE_H / 2,
      z1: mid + PLATE_H / 2,
      host: w.id,
    });
  }
  return out;
}
