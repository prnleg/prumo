import { describe, expect, it } from "vitest";
import { Box3, Group, Mesh } from "three";
import type { BuildingModel, Solid, WallShell } from "@prumo/core";
import { applyView, buildGroup, LIGHT, prism, shellLines, wallFaceGroups } from "../src/mesh";

const wall: Solid = {
  id: "a",
  kind: "wall",
  levelId: "l",
  outline: [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 100 },
    { x: 0, y: 100 },
  ],
  z0: 1000,
  z1: 2700,
};

describe("3D meshes (ADR-053)", () => {
  it("a prism lands in metres, plan y → −z, height → y", () => {
    const b = new Box3().setFromBufferAttribute(prism(wall).getAttribute("position") as never);
    expect(b.min.x).toBeCloseTo(0);
    expect(b.max.x).toBeCloseTo(4);
    expect(b.min.y).toBeCloseTo(1);
    expect(b.max.y).toBeCloseTo(2.7);
    expect(b.min.z).toBeCloseTo(-0.1);
    expect(b.max.z).toBeCloseTo(0);
  });

  const shell = (id: string, outward: WallShell["outward"] = null): WallShell => ({
    id,
    levelId: "l",
    kind: "full",
    outline: wall.outline,
    z0: 0,
    z1: 2700,
    start: { x: 0, y: 50 },
    dir: { x: 1, y: 0 },
    left: 50,
    right: -50,
    outward,
    holes: [],
  });
  const model = (solids: Solid[], shells: WallShell[]): BuildingModel => ({ solids, shells });
  const meshesOf = (g: Group) => {
    const out: Mesh[] = [];
    g.traverse((o) => {
      if (o instanceof Mesh) out.push(o);
    });
    return out;
  };
  const col = (m: Mesh) =>
    (
      (Array.isArray(m.material) ? m.material[1] : m.material) as unknown as { color: { getHex(): number } }
    ).color.getHex();

  it("selected walls get the accent colour; findings colour their element (opening pieces follow it)", () => {
    const g = buildGroup(model([{ ...wall, z0: 0 }], [shell("a")]), LIGHT, { selected: new Set(["a"]) });
    expect(meshesOf(g).every((m) => col(m) === LIGHT.selected)).toBe(true);
    const h = buildGroup(model([{ ...wall, z0: 0, of: "o" }], [shell("a")]), LIGHT, { marks: { o: "warning" } });
    expect(col(meshesOf(h)[0] as Mesh)).toBe(LIGHT.warning);
  });

  it("a wall's side faces split into left / right groups with UVs in metres along the wall", () => {
    const g = wallFaceGroups(prism({ ...wall, z0: 0 }), { start: { x: 0, y: 50 }, dir: { x: 1, y: 0 } });
    expect(g.groups.map((x) => x.materialIndex)).toEqual([0, 1, 2]);
    const uv = g.getAttribute("uv");
    let maxU = 0;
    const g1 = g.groups[1];
    if (g1) for (let i = g1.start; i < g1.start + g1.count; i++) maxU = Math.max(maxU, uv.getX(i));
    expect(maxU).toBeCloseTo(4);
  });

  it("see-inside lowers only the outside walls that face the camera; low lowers all; above is a ghost", () => {
    const g = buildGroup(
      model(
        [
          { ...wall, z0: 0 },
          { ...wall, id: "b", z0: 0 },
        ],
        [shell("a", { x: 0, y: -1 }), shell("b")],
      ),
      LIGHT,
    );
    const walls = g.children.filter((o) => o.userData.wall);
    const low = () => walls.map((w) => w.children[1]?.visible);
    applyView(g, { mode: "cutaway", level: "l", above: new Set(), toCamera: { x: 0, y: -1 } });
    expect(low()).toEqual([true, false]);
    applyView(g, { mode: "cutaway", level: "l", above: new Set(), toCamera: { x: 0, y: 1 } });
    expect(low()).toEqual([false, false]);
    applyView(g, { mode: "low", level: "l", above: new Set(), toCamera: { x: 0, y: 1 } });
    expect(low()).toEqual([true, true]);
    applyView(g, { mode: "full", level: "x", above: new Set(["l"]), toCamera: { x: 0, y: 1 } });
    expect(low()).toEqual([false, false]);
    expect(meshesOf(g).every((m) => m.userData.ghost)).toBe(true);
  });

  it("shell lines: a door leaves no line across its gap at the floor", () => {
    const sh = { ...shell("a"), holes: [{ of: "d", s0: 1000, s1: 1800, z0: 0, z1: 2100 }] };
    const pts = shellLines(sh);
    // any floor-level segment (y = 0 at both ends) must not cross x = 1.4 m
    for (let i = 0; i < pts.length; i += 6) {
      const [x0, y0, , x1, y1] = pts.slice(i, i + 5) as number[];
      if (y0 === 0 && y1 === 0 && Math.abs((x0 ?? 0) - (x1 ?? 0)) > 0.01)
        expect(Math.min(x0 ?? 0, x1 ?? 0) >= 1.8 - 1e-9 || Math.max(x0 ?? 0, x1 ?? 0) <= 1.0 + 1e-9).toBe(true);
    }
  });
});
