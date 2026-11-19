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
  facePoint,
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

describe("Electrical's screen part (ADR-059)", () => {
  it("brings its own strings, the same keys in every locale, for every key it uses", async () => {
    const { electricalUi } = await import("../src/ui");
    const en = Object.keys(electricalUi.messages.en ?? {}).sort();
    expect(Object.keys(electricalUi.messages["pt-BR"] ?? {}).sort()).toEqual(en);
    for (const tl of electricalUi.tools ?? []) {
      expect(en).toContain(tl.label);
      expect(en).toContain(tl.tip);
    }
    expect(en).toContain(electricalUi.name);
  });
});

describe("copying a switch (paste / duplicate / mirror copy)", () => {
  const host = new ModuleHost([architectManifest, electricalManifest]);
  const sw = setSwitchLight(
    setSwitchLight(newWallItem("sw", "switch", walls[0]!, 500, "left"), "L1", true),
    "L2",
    true,
  );
  const p = () => project([sw, newLight("L1", "l", { x: 1000, y: 1500 }), newLight("L2", "l", { x: 3000, y: 1500 })]);
  const ids = () => {
    let n = 0;
    return () => `c${++n}`;
  };

  it("with one of its lights: the copy turns on the copied light, and still the light left behind", async () => {
    const { duplicateCommand } = await import("@prumo/core");
    // copies in order: walls (none), the switch is hosted on "bot" (not copied → skipped), points…
    // so copy the wall too: bot → c1, sw → c2, L1 → c3
    const d = duplicateCommand(p(), ["bot", "L1"], { x: 0, y: -5000 }, ids(), host.remapComponent);
    const q = d.command.apply(p());
    expect(switchLights(q, q.elements["c2"]!)).toEqual(["L2", "c3"]);
    expect(switchLights(q, q.elements["sw"]!)).toEqual(["L1", "L2"]); // the original is untouched
  });

  it("without the hook (no Electrical installed) the data is copied as is", async () => {
    const { duplicateCommand } = await import("@prumo/core");
    const q = duplicateCommand(p(), ["bot", "L1"], { x: 0, y: -5000 }, ids()).command.apply(p());
    expect(electricalData(q.elements["c2"]!).lights).toEqual(["L1", "L2"]);
  });

  it("mirror copy remaps too", async () => {
    const { mirrorCommand } = await import("@prumo/core");
    const m = mirrorCommand(
      p(),
      ["bot", "L1", "L2"],
      "vertical",
      { x: 0, y: -100 },
      {
        copy: true,
        newId: ids(),
        remapComponent: host.remapComponent,
      },
    );
    const q = m.command.apply(p());
    expect(switchLights(q, q.elements["c2"]!)).toEqual(["c3", "c4"]);
  });
});

describe("items in 3D and on the wall face", () => {
  it("an outlet's plate sits on the wall's face, centred at its height; a light hangs under the ceiling", async () => {
    const { electricalSolids } = await import("../src");
    const out = newWallItem("o", "outlet", walls[0]!, 500, "left"); // bot: (0,0)→(4000,0), left = +y
    const q = project([out, newLight("L", "l", { x: 2000, y: 1500 })]);
    const s = electricalSolids(q);
    const plate = s.find((x) => x.id === "o")!;
    // centre wall 140 → left face at y = 70; plate 80 wide (460…540), 12 out (70…82), 120 tall around 300
    const ys = plate.outline.map((v) => v.y);
    const xs = plate.outline.map((v) => v.x);
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([460, 540, 70, 82]);
    expect([plate.z0, plate.z1, plate.host, plate.kind]).toEqual([240, 360, "bot", "fixture"]);
    const light = s.find((x) => x.id === "L")!;
    const H = q.levels[0]!.defaultWallHeight;
    expect([light.z0, light.z1]).toEqual([H - 50, H]);
  });

  it("a wall drawn by its outside face (body on the left): the left face is a whole thickness away", () => {
    const w = { ...walls[0]!, alignment: "left" as const };
    // the room the item looks into: 140 (face) + 100 past it
    expect(facePoint(w, 500, "left")).toEqual({ x: 500, y: 240 });
    expect(facePoint(w, 500, "right")).toEqual({ x: 500, y: -100 });
  });
});
