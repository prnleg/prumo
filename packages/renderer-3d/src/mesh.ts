// Three.js meshes from the core's building solids (ADR-053). Plan (x, y) in mm → scene metres with
// Y up: scene x = x, scene z = −y, scene y = height. Kept apart from the Vue view so it can be tested
// without a GPU.
import type { Solid, SolidKind } from "@prumo/core";
import {
  BufferGeometry,
  DoubleSide,
  EdgesGeometry,
  ExtrudeGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Shape,
  Vector2,
} from "three";

export interface Palette {
  wall: number;
  wallLow: number;
  glass: number;
  slab: number;
  floor: number;
  edge: number;
  selected: number;
}

export const LIGHT: Palette = {
  wall: 0xeeeae2,
  wallLow: 0xd9d3c7,
  glass: 0x9cc8e8,
  slab: 0xb8b8b8,
  floor: 0xcfb995,
  edge: 0x4a4a4a,
  selected: 0x2f7de1,
};
export const DARK: Palette = { ...LIGHT, edge: 0x222222 };

const M = 1 / 1000;

function material(kind: SolidKind, wallKind: Solid["wallKind"], c: Palette, selected: boolean) {
  const color = selected
    ? c.selected
    : kind === "wall"
      ? wallKind && wallKind !== "full"
        ? c.wallLow
        : c.wall
      : kind === "glass"
        ? c.glass
        : kind === "slab"
          ? c.slab
          : c.floor;
  const transparent = kind === "glass" || kind === "slab";
  return new MeshStandardMaterial({
    color,
    roughness: kind === "glass" ? 0.1 : 0.85,
    metalness: 0,
    transparent,
    opacity: kind === "glass" ? 0.35 : kind === "slab" ? 0.55 : 1,
    depthWrite: !transparent,
    side: DoubleSide,
  });
}

/** One extruded prism (scene metres). */
export function prism(s: Solid): BufferGeometry {
  const shape = new Shape(s.outline.map((q) => new Vector2(q.x * M, q.y * M)));
  const g = new ExtrudeGeometry(shape, { depth: (s.z1 - s.z0) * M, bevelEnabled: false });
  g.rotateX(-Math.PI / 2); // (x, y, z) → (x, z, −y): plan y goes to −z, extrusion goes up
  g.translate(0, s.z0 * M, 0);
  return g;
}

/**
 * The building as a Group. Every mesh carries `userData.id` (element id, or "room:…" for floors) so a
 * click can select it. `selected` ids are drawn in the accent colour.
 */
export function buildGroup(solids: readonly Solid[], c: Palette, selected: ReadonlySet<string>): Group {
  const group = new Group();
  const edgeMat = new LineBasicMaterial({ color: c.edge, transparent: true, opacity: 0.6 });
  for (const s of solids) {
    if (s.outline.length < 3) continue;
    const geo = prism(s);
    const mesh = new Mesh(geo, material(s.kind, s.wallKind, c, selected.has(s.id)));
    mesh.userData = { id: s.id, kind: s.kind };
    mesh.castShadow = s.kind !== "glass";
    mesh.receiveShadow = true;
    if (s.kind === "glass" || s.kind === "slab") mesh.renderOrder = 1;
    group.add(mesh);
    if (s.kind === "wall" || s.kind === "slab") {
      const edges = new LineSegments(new EdgesGeometry(geo, 30), edgeMat);
      edges.userData = { id: s.id, edge: true };
      edges.raycast = () => undefined; // lines are decoration, never picked
      group.add(edges);
    }
  }
  return group;
}

/** Free GPU memory of a group made by buildGroup. */
export function disposeGroup(g: Group) {
  g.traverse((o) => {
    if (o instanceof Mesh || o instanceof LineSegments) {
      o.geometry.dispose();
      const m = o.material as { dispose(): void } | { dispose(): void }[];
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m.dispose();
    }
  });
}
