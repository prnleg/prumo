// NBR 5410 minimums per room (ADR-058), information only: how many ceiling light points and general
// outlets a room has vs the minimum for its type. Values from the Electrical data pack (UNVERIFIED,
// EL-01). "or part of it" = round up. Only general outlets count (one-appliance outlets are extra).
import {
  detectRooms,
  inside,
  matchRoomTags,
  roomTags,
  wallLength,
  type Id,
  type PackSet,
  type Project,
  type ResolvedValue,
  type V,
  type Wall,
} from "@prumo/core";
import { architectData } from "@prumo/module-architect";
import { electricalData, kindOf } from "./data";
import { ELECTRICAL } from "./manifest";
import { packRegion } from "./packs";

export type RoomRule = "living" | "kitchen" | "bathroom" | "balcony" | "other";
/** Architect room type → which minimum applies. Unknown / no type → "other". */
export const RULE_OF_TYPE: Readonly<Record<string, RoomRule>> = {
  bedroom: "living",
  suite: "living",
  living: "living",
  dining: "living",
  office: "living",
  kitchen: "kitchen",
  laundry: "kitchen",
  bathroom: "bathroom",
  toilet: "bathroom",
  balcony: "balcony",
};

export interface RoomElectrical {
  key: string;
  rule: RoomRule;
  /** false = the room has no type: the "other rooms" minimum is used (and the UI says so). */
  typed: boolean;
  /** Inner perimeter (m) and floor area (m²). */
  perimeter: number;
  area: number;
  lights: number;
  lightsMin: number | null;
  outlets: number;
  outletsMin: number | null;
  /** Pack values used (for "where does this come from"). */
  values: ResolvedValue[];
}

const OFF_FACE = 100; // mm past the wall face: which room an outlet looks into (drawing precision)

export function roomElectrical(p: Project, levelId: Id, packs: PackSet): Map<string, RoomElectrical> {
  const region = packRegion(p);
  const used = new Map<string, ResolvedValue>();
  const val = (key: string): number | null => {
    const v = packs.get(ELECTRICAL, region, key);
    if (!v || typeof v.value !== "number") return null;
    used.set(key, v);
    return v.value;
  };
  const items = Object.values(p.elements).filter((e) => e.levelId === levelId && kindOf(e));
  const lightsAt = items.flatMap((e) => (kindOf(e) === "light" && "at" in e && e.at ? [e.at] : []));
  const outletsAt = items.flatMap((e): V[] => {
    if (kindOf(e) !== "outlet" || !("host" in e) || !e.host) return [];
    const d = electricalData(e);
    if (d.purpose === "dedicated") return [];
    const w = p.elements[e.host.elementId];
    if (w?.type !== "wall") return [];
    return [facePoint(w, e.host.offset, d.face ?? "left")];
  });
  const rooms = detectRooms(p, levelId);
  const tags = matchRoomTags(rooms, roomTags(p, levelId));
  const out = new Map<string, RoomElectrical>();
  for (const r of rooms) {
    const tag = tags.get(r.key);
    const type = tag ? architectData(tag).roomType : undefined;
    const rule: RoomRule = (type && RULE_OF_TYPE[type]) || "other";
    const perimeter = r.floor.reduce((s, q, i) => s + dist2(q, r.floor[(i + 1) % r.floor.length] as V), 0) / 1000;
    const area = r.floorArea / 1e6;
    const per = (k: string) => {
      const x = val(k);
      return x ? Math.ceil(perimeter / x - 1e-9) : null;
    };
    let outletsMin: number | null;
    if (rule === "living") outletsMin = per("outlets.living.perimeterPer");
    else if (rule === "kitchen") outletsMin = per("outlets.kitchen.perimeterPer");
    else if (rule === "bathroom") outletsMin = val("outlets.bathroom.min");
    else if (rule === "balcony") outletsMin = val("outlets.balcony.min");
    else {
      const small = val("outlets.other.smallArea");
      outletsMin = small === null ? null : area <= small ? 1 : per("outlets.living.perimeterPer");
    }
    out.set(r.key, {
      key: r.key,
      rule,
      typed: !!type && !!RULE_OF_TYPE[type],
      perimeter,
      area,
      lights: lightsAt.filter((q) => inside(q, r.floor)).length,
      lightsMin: val("lights.minPerRoom"),
      outlets: outletsAt.filter((q) => inside(q, r.floor)).length,
      outletsMin,
      values: [],
    });
  }
  const values = [...used.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
  for (const x of out.values()) x.values = values;
  return out;
}

const dist2 = (a: V, b: V) => Math.hypot(b.x - a.x, b.y - a.y);

/** A point just past the wall's `face`, at `offset` along it: the room the item looks into. */
export function facePoint(w: Wall, offset: number, face: "left" | "right"): V {
  const L = wallLength(w) || 1;
  const u = { x: (w.end.x - w.start.x) / L, y: (w.end.y - w.start.y) / L };
  const n = { x: -u.y, y: u.x };
  const d = (w.thickness / 2 + OFF_FACE) * (face === "left" ? 1 : -1);
  return { x: w.start.x + u.x * offset + n.x * d, y: w.start.y + u.y * offset + n.y * d };
}
