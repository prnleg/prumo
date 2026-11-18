import { describe, expect, it } from "vitest";
import { Box3, Mesh } from "three";
import type { Solid } from "@prumo/core";
import { buildGroup, LIGHT, prism } from "../src/mesh";

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

  it("every mesh knows its element; selected ones get the accent colour", () => {
    const g = buildGroup([wall, { ...wall, id: "b", z0: 0, z1: 1000 }], LIGHT, new Set(["b"]));
    const meshes = g.children.filter((o): o is Mesh => o instanceof Mesh);
    expect(meshes.map((m) => m.userData.id)).toEqual(["a", "b"]);
    const col = (m: Mesh) => (m.material as unknown as { color: { getHex(): number } }).color.getHex();
    expect(col(meshes[1] as Mesh)).toBe(LIGHT.selected);
    expect(col(meshes[0] as Mesh)).toBe(LIGHT.wall);
  });
});
