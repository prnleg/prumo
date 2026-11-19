// Circuits (ADR-061, Electrical slice 2), information only. Each light / outlet may carry a circuit
// number (the breaker on the panel, "quadro"). We estimate each item's load the NBR 5410 way (values in
// the Electrical pack, from memory → UNVERIFIED, EL-02) and add them up per circuit, with two notes a
// beginner should see: lights and outlets on the same circuit, and a one-appliance outlet sharing its
// circuit. Never "OK": a circuit with no note is only "nothing noticed by these simple checks".
//
// Loads (VA):
//   light   — per room: up to 6 m² → 100 VA; above, +60 VA for each whole 4 m² more; shared equally by
//             the room's ceiling light points. A light outside any room: unknown.
//   outlet  — kitchens, laundry areas, bathrooms ("wet" rooms): the first 3 at 600 VA, the rest 100 VA;
//             with more than 6 outlets in the room, only the first 2 at 600 VA. Other rooms: 100 VA.
//             Order inside a room: by id (deterministic).
//   one-appliance outlet — the power the user typed (VA); unknown if empty.
import { detectRooms, inside, matchRoomTags, roomTags, type Id, type PackSet, type Project, type V } from "@prumo/core";
import { architectData } from "@prumo/module-architect";
import { electricalData, kindOf } from "./data";
import { ELECTRICAL } from "./manifest";
import { facePoint, RULE_OF_TYPE } from "./minimums";
import { packRegion } from "./packs";

export interface ItemLoad {
  id: Id;
  kind: "light" | "outlet" | "dedicated";
  /** VA, or null when it can't be estimated (light outside a room, appliance power not given). */
  va: number | null;
}

/** Circuit numbers are whole numbers 1…99 (as written on a panel). */
export const MAX_CIRCUIT = 99;
export const validCircuit = (n: unknown): n is number =>
  Number.isInteger(n) && (n as number) >= 1 && (n as number) <= MAX_CIRCUIT;

/** Lighting load of a room of `area` m² (VA). */
export function roomLightingVA(area: number, first: { area: number; va: number }, step: { area: number; va: number }) {
  if (area <= first.area) return first.va;
  return first.va + step.va * Math.floor((area - first.area) / step.area + 1e-9);
}

/** Every light / outlet's estimated load, whole project. */
export function itemLoads(p: Project, packs: PackSet): Map<Id, ItemLoad> {
  const region = packRegion(p);
  const num = (k: string): number | null => {
    const v = packs.get(ELECTRICAL, region, k);
    return v && typeof v.value === "number" ? v.value : null;
  };
  const first = { area: num("lighting.firstArea"), va: num("lighting.firstVA") };
  const step = { area: num("lighting.stepArea"), va: num("lighting.stepVA") };
  const outletVA = num("outlets.va");
  const wetVA = num("outlets.wet.va");
  const wetFirst = num("outlets.wet.first");
  const wetMany = num("outlets.wet.many");
  const wetFirstIfMany = num("outlets.wet.firstIfMany");
  const out = new Map<Id, ItemLoad>();
  for (const l of p.levels) {
    const rooms = detectRooms(p, l.id);
    const tags = matchRoomTags(rooms, roomTags(p, l.id));
    const items = Object.values(p.elements)
      .filter((e) => e.levelId === l.id && kindOf(e) && kindOf(e) !== "switch")
      .sort((a, b) => (a.id < b.id ? -1 : 1));
    const where = (e: (typeof items)[number]): V | null => {
      if ("at" in e && e.at) return e.at;
      if (!("host" in e) || !e.host) return null;
      const w = p.elements[e.host.elementId];
      return w?.type === "wall" ? facePoint(w, e.host.offset, electricalData(e).face ?? "left") : null;
    };
    const roomOf = new Map(
      items.map((e) => {
        const at = where(e);
        return [e.id, at ? rooms.find((r) => inside(at, r.floor)) : undefined] as const;
      }),
    );
    for (const r of rooms) {
      const mine = items.filter((e) => roomOf.get(e.id) === r);
      const lights = mine.filter((e) => kindOf(e) === "light");
      const area = r.floorArea / 1e6;
      const roomVA =
        first.area !== null && first.va !== null && step.area !== null && step.va !== null
          ? roomLightingVA(area, { area: first.area, va: first.va }, { area: step.area, va: step.va })
          : null;
      for (const e of lights)
        out.set(e.id, { id: e.id, kind: "light", va: roomVA === null ? null : roomVA / lights.length });
      const tag = tags.get(r.key);
      const type = tag ? architectData(tag).roomType : undefined;
      const rule = type ? RULE_OF_TYPE[type] : undefined;
      const wet = rule === "kitchen" || rule === "bathroom";
      const general = mine.filter((e) => kindOf(e) === "outlet" && electricalData(e).purpose !== "dedicated");
      const atSix =
        wet && wetFirst !== null && wetMany !== null && wetFirstIfMany !== null
          ? general.length > wetMany
            ? wetFirstIfMany
            : wetFirst
          : 0;
      general.forEach((e, i) => out.set(e.id, { id: e.id, kind: "outlet", va: i < atSix ? wetVA : outletVA }));
    }
    for (const e of items) {
      if (out.has(e.id)) continue;
      const k = kindOf(e);
      const d = electricalData(e);
      if (k === "outlet" && d.purpose === "dedicated")
        out.set(e.id, { id: e.id, kind: "dedicated", va: typeof d.power === "number" && d.power > 0 ? d.power : null });
      else if (k === "outlet")
        out.set(e.id, { id: e.id, kind: "outlet", va: outletVA }); // not in a room
      else out.set(e.id, { id: e.id, kind: "light", va: null }); // a light outside every room
    }
  }
  return out;
}

export type CircuitNote = "mixed" | "dedicatedShared";

export interface Circuit {
  n: number;
  items: Id[];
  lights: number;
  outlets: number;
  dedicated: number;
  /** Sum of the known loads, VA. */
  va: number;
  /** Items whose load is unknown (not in `va`). */
  unknown: number;
  notes: CircuitNote[];
}

/** The circuits in use (by number), and how many lights / outlets have none yet. */
export function circuits(p: Project, packs: PackSet): { list: Circuit[]; unassigned: number } {
  const loads = itemLoads(p, packs);
  const by = new Map<number, Circuit>();
  let unassigned = 0;
  for (const L of [...loads.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const e = p.elements[L.id];
    const n = e ? electricalData(e).circuit : undefined;
    if (!validCircuit(n)) {
      unassigned++;
      continue;
    }
    const c = by.get(n) ?? { n, items: [], lights: 0, outlets: 0, dedicated: 0, va: 0, unknown: 0, notes: [] };
    c.items.push(L.id);
    if (L.kind === "light") c.lights++;
    else if (L.kind === "outlet") c.outlets++;
    else c.dedicated++;
    if (L.va === null) c.unknown++;
    else c.va += L.va;
    by.set(n, c);
  }
  const list = [...by.values()].sort((a, b) => a.n - b.n);
  for (const c of list) {
    if (c.lights && (c.outlets || c.dedicated)) c.notes.push("mixed");
    if (c.dedicated && c.items.length > 1) c.notes.push("dedicatedShared");
  }
  return { list, unassigned };
}
