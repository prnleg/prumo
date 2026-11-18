// Electrical module (ADR-058). Minimums hand-calculated (CLAUDE.md rule 6): a 4 × 3 m room on centre
// lines with 14 cm walls has an inner floor of 3.86 × 2.86 m → perimeter 2 × (3.86 + 2.86) = 13.44 m,
// area 11.0396 m².
//   bedroom:  1 outlet per 5 m or part   → ceil(13.44 / 5)   = 3
//   kitchen:  1 per 3.5 m or part         → ceil(13.44 / 3.5) = ceil(3.84) = 4
//   bathroom: at least 1;  no type ("other"): 11.04 m² > 6 m² → per 5 m → 3
import {
  emptyProject,
  ModuleHost,
  openWithModules,
  putCommand,
  saveProjectFile,
  type Project,
  type RoomTag,
  type Wall,
} from "@prumo/core";
import { architectManifest, setRoomType } from "@prumo/module-architect";
import { describe, expect, it } from "vitest";
import {
  electricalManifest,
  electricalPacks,
  newLight,
  newWallItem,
  roomElectrical,
  setSwitchLight,
  sideOf,
  switchLights,
  withElectricalData,
  electricalData,
} from "../src";

const W = (id: string, x1: number, y1: number, x2: number, y2: number): Wall => ({
  id,
  type: "wall",
  levelId: "l",
  start: { x: x1, y: y1 },
  end: { x: x2, y: y2 },
  alignment: "center",
  kind: "full",
  thickness: 140,
  height: 2700,
  baseOffset: 0,
  components: {},
});
const walls = [
  W("bot", 0, 0, 4000, 0),
  W("right", 4000, 0, 4000, 3000),
  W("top", 4000, 3000, 0, 3000),
  W("left", 0, 3000, 0, 0),
];
const tag = (type?: string): RoomTag => {
  const t: RoomTag = { id: "tag", type: "room", levelId: "l", seed: { x: 2000, y: 1500 }, name: "", components: {} };
  return type ? setRoomType(t, type) : t;
};
function project(extra: Parameters<typeof putCommand>[1] = []): Project {
  return putCommand({ key: "x" }, [...walls, ...extra]).apply(
    emptyProject({
      id: "p",
      levelId: "l",
      name: "t",
      now: "2026-11-18T00:00:00Z",
      profileId: "br-nbr/structural-masonry",
    }),
  );
}
const packs = electricalPacks();
const only = (p: Project) => [...roomElectrical(p, "l", packs).values()][0];

describe("NBR 5410 minimums per room (ADR-058, UNVERIFIED)", () => {
  it("perimeter and area of the inner floor", () => {
    const r = only(project([tag("bedroom")]));
    expect(r?.perimeter).toBeCloseTo(13.44, 6);
    expect(r?.area).toBeCloseTo(11.0396, 6);
  });
  it("bedroom 3, kitchen 4, bathroom 1, no type 3; one ceiling light each", () => {
    expect(only(project([tag("bedroom")]))?.outletsMin).toBe(3);
    expect(only(project([tag("kitchen")]))?.outletsMin).toBe(4);
    expect(only(project([tag("bathroom")]))?.outletsMin).toBe(1);
    const other = only(project());
    expect([other?.rule, other?.typed, other?.outletsMin, other?.lightsMin]).toEqual(["other", false, 3, 1]);
  });
  it("a small room without a type (≤ 6 m²) needs 1", () => {
    const small = [
      W("a", 0, 0, 2000, 0),
      W("b", 2000, 0, 2000, 2000),
      W("c", 2000, 2000, 0, 2000),
      W("d", 0, 2000, 0, 0),
    ];
    const p = putCommand({ key: "x" }, small).apply(
      emptyProject({ id: "p", levelId: "l", name: "t", now: "2026-11-18T00:00:00Z", profileId: "br-nbr/x" }),
    );
    expect(only(p)?.outletsMin).toBe(1); // 1.86 × 1.86 = 3.46 m²
  });
  it("counts general outlets facing into the room, and lights inside it", () => {
    const bot = walls[0] as Wall;
    const inward = newWallItem("o1", "outlet", bot, 1000, "left"); // the room is on bot's left (+y)
    const outward = newWallItem("o2", "outlet", bot, 2000, "right");
    const dedicated = withElectricalData(newWallItem("o3", "outlet", bot, 3000, "left"), {
      ...electricalData(newWallItem("o3", "outlet", bot, 3000, "left")),
      purpose: "dedicated",
    });
    const r = only(project([tag("bedroom"), inward, outward, dedicated, newLight("L", "l", { x: 2000, y: 1500 })]));
    expect([r?.outlets, r?.lights]).toEqual([1, 1]);
  });
});

describe("items and links", () => {
  it("the clicked side decides the face", () => {
    const bot = walls[0] as Wall;
    expect(sideOf(bot, { x: 1000, y: 50 })).toBe("left");
    expect(sideOf(bot, { x: 1000, y: -50 })).toBe("right");
  });
  it("a switch links lights (sorted, no duplicates); deleted lights drop out of the list shown", () => {
    let s = newWallItem("s", "switch", walls[0] as Wall, 500, "left");
    s = setSwitchLight(setSwitchLight(setSwitchLight(s, "L2", true), "L1", true), "L2", true);
    expect(electricalData(s).lights).toEqual(["L1", "L2"]);
    const p = project([s, newLight("L1", "l", { x: 1000, y: 1000 })]);
    expect(switchLights(p, s)).toEqual(["L1"]);
    expect(electricalData(setSwitchLight(s, "L1", false)).lights).toEqual(["L2"]);
  });
  it("mirroring flips the face", () => {
    const m = electricalManifest.component?.mirror;
    expect(m?.({ face: "left", height: 300 })).toEqual({ face: "right", height: 300 });
  });
});

describe("a file with electrical items, opened without Electrical (ADR-032)", () => {
  it("stops with 'missing module' and keeps every item intact", () => {
    const p = project([
      newWallItem("o1", "outlet", walls[0] as Wall, 1000, "left"),
      newLight("L", "l", { x: 2000, y: 1500 }),
    ]);
    const withIt = new ModuleHost([architectManifest, electricalManifest]);
    const bytes = saveProjectFile({ project: p, snapshots: [], extra: {} }, withIt);
    const without = new ModuleHost([architectManifest]);
    const r = openWithModules(bytes, without);
    expect(r.status).toBe("missing-modules");
    if (r.status !== "missing-modules") return;
    expect(r.modules).toEqual(["org.prumo.electrical"]);
    expect(r.file.project.elements.o1).toEqual(p.elements.o1);
    expect(r.file.project.elements.L).toEqual(p.elements.L);
  });
});
