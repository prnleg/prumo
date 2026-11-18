// Example projects for the start screen (Q-119/Q-125). Built in code from plain elements, so they
// always match the current model; names are localized when the example is opened.
// "House with problems" waits for the first checks (Phase 2): today there's nothing to show.
import {
  emptyProject,
  putElements,
  type Id,
  type IdSource,
  type Opening,
  type Project,
  type RoomTag,
  type Wall,
} from "@prumo/core";
import { DEFAULT_OPENING_SIZES, setRoomType, type RoomType } from "@prumo/module-architect";
import { setBonded, setContraverga, setLintel, setTieBeam, setWallRole } from "@prumo/module-structural";

type Translate = (key: string) => string;

export interface ExampleArgs {
  ids: IdSource;
  t: Translate;
  now: string;
  profileId: string;
}

export interface Example {
  id: string;
  /** i18n keys */
  title: string;
  description: string;
  build(a: ExampleArgs): Project;
}

type Pt = [number, number];
/** `noLintel`: the "house with problems" example leaves the lintel out on purpose. */
type DoorSpec = {
  wall: string;
  offset: number;
  width?: number;
  handing?: "left" | "right";
  swing?: "in" | "out";
  noLintel?: boolean;
};
type WindowSpec = { wall: string; offset: number; width?: number; height?: number; sill?: number; noLintel?: boolean };

interface Plan {
  name: string;
  walls: Record<string, [Pt, Pt]>;
  doors: DoorSpec[];
  windows: WindowSpec[];
  rooms: { at: Pt; name: string; type: RoomType }[];
  /** Walls the owner marked as partitions on their own judgement (shows R-ROLE-001). */
  partitions?: string[];
}

const THICK = 140; // drawing default, same as the wall tool; not a structural value

function assemble(plan: Plan, a: ExampleArgs): Project {
  const levelId = a.ids();
  const made = emptyProject({ id: a.ids(), levelId, name: a.t(plan.name), now: a.now, profileId: a.profileId });
  // drawn by centre lines; keep it that way when the user edits them (ADR-038 setting off)
  const base: Project = { ...made, settings: { ...made.settings, outsideFaces: false } };
  const height = base.levels[0]?.defaultWallHeight ?? 2700;
  const wallId = new Map<string, Id>();
  const els: (Wall | Opening | RoomTag)[] = [];
  for (const [key, [s, e]] of Object.entries(plan.walls)) {
    const id = a.ids();
    wallId.set(key, id);
    els.push({
      id,
      type: "wall",
      levelId,
      start: { x: s[0], y: s[1] },
      end: { x: e[0], y: e[1] },
      alignment: "center",
      kind: "full",
      thickness: THICK,
      height,
      baseOffset: 0,
      components: {},
    });
  }
  const host = (w: string, offset: number) => {
    const elementId = wallId.get(w);
    if (!elementId) throw new Error(`example: no wall "${w}"`);
    return { elementId, offset };
  };
  const D = DEFAULT_OPENING_SIZES.door,
    W = DEFAULT_OPENING_SIZES.window;
  // examples are built "by the book": lintel, contraverga (windows), tie beams, bonded junctions —
  // except what the "house with problems" leaves out on purpose
  const lintel = <T extends Opening>(o: T, spec: { noLintel?: boolean }) =>
    setLintel(o.kind === "window" ? setContraverga(o, !spec.noLintel) : o, !spec.noLintel);
  for (const d of plan.doors)
    els.push(
      lintel(
        {
          id: a.ids(),
          type: "opening",
          levelId,
          host: host(d.wall, d.offset),
          width: d.width ?? D.width,
          height: D.height,
          sillHeight: D.sillHeight,
          kind: "door",
          handing: d.handing ?? "left",
          swing: d.swing ?? "in",
          components: {},
        },
        d,
      ),
    );
  for (const w of plan.windows)
    els.push(
      lintel(
        {
          id: a.ids(),
          type: "opening",
          levelId,
          host: host(w.wall, w.offset),
          width: w.width ?? W.width,
          height: w.height ?? W.height,
          sillHeight: w.sill ?? W.sillHeight,
          kind: "window",
          components: {},
        },
        w,
      ),
    );
  for (const r of plan.rooms)
    els.push(
      setRoomType(
        { id: a.ids(), type: "room", levelId, seed: { x: r.at[0], y: r.at[1] }, name: a.t(r.name), components: {} },
        r.type,
      ),
    );
  for (const [i, e] of els.entries())
    if (e.type === "wall") els[i] = setBonded(setBonded(setTieBeam(e, true), "start", true), "end", true);
  for (const key of plan.partitions ?? []) {
    const i = els.findIndex((e) => e.id === wallId.get(key));
    const w = els[i];
    if (w?.type === "wall") els[i] = setWallRole(w, "non-bearing", "own-judgement");
  }
  return putElements(base, els);
}

/**
 * Small house, 10 × 7 m (centre lines). Y up: y = 0 is the front.
 *   living + kitchen (left) | bedroom 1 (front) · hall · bathroom + bedroom 2 (back)
 */
const house: Plan = {
  name: "example.house.name",
  walls: {
    front: [
      [0, 0],
      [10000, 0],
    ],
    right: [
      [10000, 0],
      [10000, 7000],
    ],
    back: [
      [10000, 7000],
      [0, 7000],
    ],
    left: [
      [0, 7000],
      [0, 0],
    ],
    living: [
      [5000, 0],
      [5000, 7000],
    ],
    hallFront: [
      [5000, 3300],
      [10000, 3300],
    ],
    hallBack: [
      [5000, 4500],
      [10000, 4500],
    ],
    bath: [
      [7000, 4500],
      [7000, 7000],
    ],
  },
  doors: [
    { wall: "front", offset: 1500, width: 900 },
    { wall: "living", offset: 3450 },
    { wall: "hallFront", offset: 3000, handing: "right" },
    { wall: "hallBack", offset: 900, width: 700 },
    { wall: "hallBack", offset: 2800 },
  ],
  windows: [
    { wall: "front", offset: 3000, width: 1500 },
    { wall: "front", offset: 6800, width: 1500 },
    { wall: "right", offset: 5100 },
    { wall: "back", offset: 6500, width: 2000 },
    { wall: "back", offset: 4000, width: 600, height: 600, sill: 1500 },
  ],
  rooms: [
    { at: [2500, 3500], name: "example.room.livingKitchen", type: "living" },
    { at: [7500, 1650], name: "example.room.bedroom1", type: "bedroom" },
    { at: [7500, 3900], name: "example.room.hall", type: "hallway" },
    { at: [6000, 5750], name: "example.room.bathroom", type: "bathroom" },
    { at: [8500, 5750], name: "example.room.bedroom2", type: "bedroom" },
  ],
};

/** Apartment, 8 × 6 m: living | kitchen at the front, bedroom | bathroom at the back. */
const apartment: Plan = {
  name: "example.apartment.name",
  walls: {
    front: [
      [0, 0],
      [8000, 0],
    ],
    right: [
      [8000, 0],
      [8000, 6000],
    ],
    back: [
      [8000, 6000],
      [0, 6000],
    ],
    left: [
      [0, 6000],
      [0, 0],
    ],
    middle: [
      [0, 3500],
      [8000, 3500],
    ],
    kitchen: [
      [5000, 0],
      [5000, 3500],
    ],
    bath: [
      [5500, 3500],
      [5500, 6000],
    ],
  },
  doors: [
    { wall: "right", offset: 1300, width: 900 },
    { wall: "kitchen", offset: 1300, width: 900 },
    { wall: "middle", offset: 2000 },
    { wall: "middle", offset: 6200, width: 700, handing: "right" },
  ],
  windows: [
    { wall: "front", offset: 1500, width: 2000 },
    { wall: "front", offset: 5900 },
    { wall: "back", offset: 3700, width: 1500 },
    { wall: "back", offset: 1000, width: 600, height: 600, sill: 1500 },
  ],
  rooms: [
    { at: [2500, 1750], name: "example.room.living", type: "living" },
    { at: [6500, 1750], name: "example.room.kitchen", type: "kitchen" },
    { at: [2750, 4750], name: "example.room.bedroom", type: "bedroom" },
    { at: [6750, 4750], name: "example.room.bathroom", type: "bathroom" },
  ],
};

/**
 * "House with problems" (ROADMAP Phase 1/2, Q-125): the small house after a typical DIY renovation —
 * the living-room window widened without a lintel, a new door cut without one, and the hall wall
 * marked "partition" on the owner's own judgement. Teaches the checks; not a design.
 */
const problems: Plan = {
  ...house,
  name: "example.problems.name",
  doors: house.doors.map((d) => (d.wall === "hallFront" ? { ...d, noLintel: true } : d)),
  windows: house.windows.map((w) => (w.wall === "front" && w.offset === 3000 ? { ...w, noLintel: true } : w)),
  partitions: ["hallBack"],
};

export const EXAMPLES: readonly Example[] = [
  {
    id: "house",
    title: "example.house.name",
    description: "example.house.desc",
    build: (a) => assemble(house, a),
  },
  {
    id: "apartment",
    title: "example.apartment.name",
    description: "example.apartment.desc",
    build: (a) => assemble(apartment, a),
  },
  {
    id: "problems",
    title: "example.problems.name",
    description: "example.problems.desc",
    build: (a) => assemble(problems, a),
  },
];
