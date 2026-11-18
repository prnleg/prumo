// Three.js meshes from the core's building model (ADR-053/054). Plan (x, y) in mm → scene metres with
// Y up: scene x = x, scene z = −y, scene y = height. Kept apart from the Vue view so it can be tested
// without a GPU.
//   - walls: the core's pieces (split around openings) drawn as one smooth wall: no per-piece outlines;
//     the outline comes from the whole wall (shell) + a frame around each opening
//   - each wall face (left / right) gets its own surface (colour + pattern from the finish)
//   - every wall also has a low "stub" version (15 cm) for the low-walls and see-inside modes
import type { BuildingModel, Solid, SolidKind, V, WallShell } from "@prumo/core";
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  EdgesGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  MeshStandardMaterial,
  Shape,
  Vector2,
  type Texture,
} from "three";
import { patternTexture, type Pattern } from "./patterns";

export interface Palette {
  wall: number;
  wallLow: number;
  glass: number;
  slab: number;
  floor: number;
  edge: number;
  selected: number;
  critical: number;
  warning: number;
  advisory: number;
  frame: number;
  leaf: number;
}

export const LIGHT: Palette = {
  wall: 0xeeeae2,
  wallLow: 0xd9d3c7,
  glass: 0x9cc8e8,
  slab: 0xb8b8b8,
  floor: 0xcfb995,
  edge: 0x4a4a4a,
  selected: 0x2f7de1,
  critical: 0xd64545,
  warning: 0xe08a1e,
  advisory: 0x4a90d9,
  frame: 0xf3f1ec,
  leaf: 0xa8784f,
};
export const DARK: Palette = { ...LIGHT, edge: 0x222222 };

export type Mark = "critical" | "warning" | "advisory" | "info";
/** What a wall face looks like (from its finish). */
export interface Surface {
  color: number;
  pattern: Pattern;
}
export type WallFaces = Readonly<Record<string, { left?: Surface; right?: Surface }>>;

/** How walls of the floor being edited are shown (ADR-054). */
export type WallMode = "low" | "cutaway" | "full";
/** Height of a lowered wall, mm (owner: "10–15 cm from the floor"). A drawing value. */
export const STUB = 150;

const M = 1 / 1000;

function color(kind: SolidKind, wallKind: Solid["wallKind"], c: Palette, selected: boolean, mark?: Mark) {
  if (selected) return c.selected;
  if (mark && mark !== "info") return c[mark];
  if (kind === "wall") return wallKind && wallKind !== "full" ? c.wallLow : c.wall;
  return kind === "glass"
    ? c.glass
    : kind === "slab"
      ? c.slab
      : kind === "frame"
        ? c.frame
        : kind === "leaf"
          ? c.leaf
          : c.floor;
}

function material(kind: SolidKind, col: number, map: Texture | null = null) {
  const transparent = kind === "glass" || kind === "slab";
  const m = new MeshStandardMaterial({
    color: col,
    map,
    roughness: kind === "glass" ? 0.1 : kind === "frame" ? 0.5 : 0.85,
    metalness: 0,
    transparent,
    opacity: kind === "glass" ? 0.35 : kind === "slab" ? 0.55 : 1,
    depthWrite: !transparent,
    side: DoubleSide,
  });
  m.userData = { opacity: m.opacity, transparent };
  return m;
}

/** One extruded prism (scene metres). */
export function prism(s: Pick<Solid, "outline" | "z0" | "z1">): BufferGeometry {
  const shape = new Shape(s.outline.map((q) => new Vector2(q.x * M, q.y * M)));
  const g = new ExtrudeGeometry(shape, { depth: (s.z1 - s.z0) * M, bevelEnabled: false });
  g.rotateX(-Math.PI / 2); // (x, y, z) → (x, z, −y): plan y goes to −z, extrusion goes up
  g.translate(0, s.z0 * M, 0);
  return g;
}

/**
 * Sort a wall prism's triangles into 3 groups — 0 = top, bottom, ends, jambs; 1 = left face; 2 = right
 * face — and give the faces UVs in metres (u along the wall, v = height) so patterns keep their size.
 */
export function wallFaceGroups(g: BufferGeometry, sh: Pick<WallShell, "start" | "dir">): BufferGeometry {
  const src = g.index ? g.toNonIndexed() : g;
  const pos = src.getAttribute("position") as BufferAttribute;
  const uvSrc = src.getAttribute("uv") as BufferAttribute | undefined;
  const n = { x: -sh.dir.y, y: sh.dir.x }; // plan left normal
  const nS = { x: n.x, z: -n.y }; // in the scene
  const tris: { g: number; i: number }[] = [];
  for (let i = 0; i < pos.count; i += 3) {
    const ax = pos.getX(i),
      ay = pos.getY(i),
      az = pos.getZ(i);
    const ux = pos.getX(i + 1) - ax,
      uy = pos.getY(i + 1) - ay,
      uz = pos.getZ(i + 1) - az;
    const vx = pos.getX(i + 2) - ax,
      vy = pos.getY(i + 2) - ay,
      vz = pos.getZ(i + 2) - az;
    const cx = uy * vz - uz * vy,
      cy = uz * vx - ux * vz,
      cz = ux * vy - uy * vx;
    const len = Math.hypot(cx, cy, cz) || 1;
    const d = (cx * nS.x + cz * nS.z) / len;
    tris.push({ g: Math.abs(cy / len) > 0.5 ? 0 : d > 0.9 ? 1 : d < -0.9 ? 2 : 0, i });
  }
  tris.sort((a, b) => a.g - b.g || a.i - b.i);
  const P = new Float32Array(pos.count * 3);
  const UV = new Float32Array(pos.count * 2);
  let k = 0;
  for (const t of tris)
    for (let j = 0; j < 3; j++, k++) {
      const x = pos.getX(t.i + j),
        y = pos.getY(t.i + j),
        z = pos.getZ(t.i + j);
      P.set([x, y, z], k * 3);
      if (t.g === 0) UV.set([uvSrc?.getX(t.i + j) ?? 0, uvSrc?.getY(t.i + j) ?? 0], k * 2);
      else {
        // plan point (mm) = (x, −z) × 1000; along the wall from its start, in metres
        const along = ((x * 1000 - sh.start.x) * sh.dir.x + (-z * 1000 - sh.start.y) * sh.dir.y) / 1000;
        UV.set([along, y], k * 2);
      }
    }
  const out = new BufferGeometry();
  out.setAttribute("position", new Float32BufferAttribute(P, 3));
  out.setAttribute("uv", new Float32BufferAttribute(UV, 2));
  out.computeVertexNormals();
  let start = 0;
  for (const gi of [0, 1, 2]) {
    const count = tris.filter((t) => t.g === gi).length * 3;
    if (count) out.addGroup(start, count, gi);
    start += count;
  }
  return out;
}

/** The whole wall's outline as line segments (scene metres): no seams between pieces, a frame per opening. */
export function shellLines(sh: WallShell): number[] {
  const out: number[] = [];
  const L = (a: V, za: number, b: V, zb: number) => out.push(a.x * M, za * M, -a.y * M, b.x * M, zb * M, -b.y * M);
  const at = (s: number, off: number): V => ({
    x: sh.start.x + sh.dir.x * s - sh.dir.y * off,
    y: sh.start.y + sh.dir.y * s + sh.dir.x * off,
  });
  const along = (q: V) => (q.x - sh.start.x) * sh.dir.x + (q.y - sh.start.y) * sh.dir.y;
  const doors = sh.holes.filter((h) => h.z0 <= sh.z0 + 1);
  const n = sh.outline.length;
  for (let i = 0; i < n; i++) {
    const a = sh.outline[i] as V;
    const b = sh.outline[(i + 1) % n] as V;
    L(a, sh.z1, b, sh.z1);
    L(a, sh.z0, a, sh.z1);
    // the bottom line, minus door gaps (a face edge runs along the wall)
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const parallel = len > 0 && Math.abs(dx * sh.dir.y - dy * sh.dir.x) / len < 1e-6;
    if (!parallel || !doors.length) {
      L(a, sh.z0, b, sh.z0);
      continue;
    }
    const sa = along(a),
      sb = along(b);
    const lo = Math.min(sa, sb),
      hi = Math.max(sa, sb);
    const off = (a.x - sh.start.x) * -sh.dir.y + (a.y - sh.start.y) * sh.dir.x;
    let from = lo;
    for (const d of doors) {
      if (d.s1 <= from || d.s0 >= hi) continue;
      if (d.s0 > from) L(at(from, off), sh.z0, at(d.s0, off), sh.z0);
      from = Math.max(from, d.s1);
    }
    if (from < hi) L(at(from, off), sh.z0, at(hi, off), sh.z0);
  }
  for (const h of sh.holes) {
    for (const off of [sh.left, sh.right]) {
      if (h.z0 > sh.z0 + 1) L(at(h.s0, off), h.z0, at(h.s1, off), h.z0); // a door has no sill line
      L(at(h.s0, off), h.z1, at(h.s1, off), h.z1);
      L(at(h.s0, off), h.z0, at(h.s0, off), h.z1);
      L(at(h.s1, off), h.z0, at(h.s1, off), h.z1);
    }
    for (const s of [h.s0, h.s1]) for (const z of [h.z0, h.z1]) L(at(s, sh.left), z, at(s, sh.right), z);
  }
  return out;
}

export interface BuildOptions {
  selected?: ReadonlySet<string>;
  /** Findings: element id → worst severity. Wall pieces around an opening follow the opening. */
  marks?: Readonly<Record<string, Mark>>;
  /** Wall faces by wall id (from the finishes). */
  faces?: WallFaces;
}

/**
 * The building as a Group. Meshes carry `userData.id` (element id, or "room:…" for floors) so a click can
 * select them, and `userData.levelId`. A wall is a Group `{ wall: true, id, levelId, outward }` with two
 * children: "full" (the wall) and "stub" (its lowest 15 cm); `applyView` picks one.
 */
export function buildGroup(model: BuildingModel, c: Palette, o: BuildOptions = {}): Group {
  const selected = o.selected ?? new Set<string>();
  const marks = o.marks ?? {};
  const group = new Group();
  const edgeMat = new LineBasicMaterial({ color: c.edge, transparent: true, opacity: 0.55 });
  edgeMat.userData = { opacity: 0.55, transparent: true };
  const shells = new Map(model.shells.map((s) => [s.id, s]));
  const walls = new Map<string, { full: Group; stub: Group }>();
  for (const sh of model.shells) {
    const g = new Group();
    g.userData = { wall: true, id: sh.id, levelId: sh.levelId, outward: sh.outward };
    const full = new Group();
    full.name = "full";
    const stub = new Group();
    stub.name = "stub";
    stub.visible = false;
    const lines = new BufferGeometry();
    lines.setAttribute("position", new Float32BufferAttribute(shellLines(sh), 3));
    const ls = new LineSegments(lines, edgeMat);
    ls.raycast = () => undefined; // decoration, never picked
    full.add(ls);
    g.add(full, stub);
    group.add(g);
    walls.set(sh.id, { full, stub });
  }
  for (const s of model.solids) {
    if (s.outline.length < 3) continue;
    const sel = selected.has(s.id) || (s.of !== undefined && selected.has(s.of));
    const mark = (s.of !== undefined ? marks[s.of] : undefined) ?? marks[s.id];
    const col = color(s.kind, s.wallKind, c, sel, mark);
    const sh = s.kind === "wall" ? shells.get(s.id) : undefined;
    const holder = sh ? walls.get(sh.id) : undefined;
    if (sh && holder) {
      const faces = o.faces?.[sh.id] ?? {};
      const mats = (): Material[] => [
        endMaterial(col),
        faceMaterial(col, faces.left, sel || !!mark),
        faceMaterial(col, faces.right, sel || !!mark),
      ];
      const mesh = new Mesh(wallFaceGroups(prism(s), sh), mats());
      mesh.userData = { id: s.id, kind: s.kind, levelId: s.levelId };
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      holder.full.add(mesh);
      if (s.z0 < sh.z0 + STUB) {
        const low = { ...s, z1: Math.min(s.z1, sh.z0 + STUB) };
        const geo = wallFaceGroups(prism(low), sh);
        const m2 = new Mesh(geo, mats());
        m2.userData = { id: s.id, kind: s.kind, levelId: s.levelId };
        m2.castShadow = true;
        m2.receiveShadow = true;
        const e = new LineSegments(new EdgesGeometry(geo, 30), edgeMat);
        e.raycast = () => undefined;
        holder.stub.add(m2, e);
      }
      continue;
    }
    const mesh = new Mesh(prism(s), material(s.kind, col));
    mesh.userData = { id: s.id, kind: s.kind, levelId: s.levelId, host: s.host };
    mesh.castShadow = s.kind !== "glass";
    mesh.receiveShadow = true;
    if (s.kind === "glass" || s.kind === "slab") mesh.renderOrder = 1;
    group.add(mesh);
    if (s.kind === "slab") {
      const edges = new LineSegments(new EdgesGeometry(mesh.geometry, 30), edgeMat);
      edges.userData = { id: s.id, levelId: s.levelId, edge: true, kind: "slab" };
      edges.raycast = () => undefined;
      group.add(edges);
    }
  }
  return group;
}

/**
 * Tops, ends and jambs of wall pieces: pushed slightly back in depth so where a piece's end meets the
 * next piece's face, the face wins (no light hairlines on a patterned wall).
 */
function endMaterial(col: number) {
  const m = material("wall", col);
  m.polygonOffset = true;
  m.polygonOffsetFactor = 1;
  m.polygonOffsetUnits = 1;
  return m;
}

/** A wall face: the finish's colour and pattern; selection / findings tint it but keep the pattern. */
function faceMaterial(base: number, f: Surface | undefined, tinted: boolean) {
  const map = f ? patternTexture(f.pattern) : null;
  return material("wall", tinted || !f ? base : f.color, map);
}

export interface ViewState {
  mode: WallMode;
  /** The floor being edited. */
  level: string;
  /** Floors above it: drawn as a faint ghost, not pickable. */
  above: ReadonlySet<string>;
  /** Horizontal direction from the building towards the camera (plan coordinates). */
  toCamera: V;
}

const GHOST = 0.08;

/** Show the right version of every wall and fade the floors above (no geometry is rebuilt). */
export function applyView(group: Group, v: ViewState) {
  const lowered = new Set<string>();
  for (const o of group.children) {
    const d = o.userData as { wall?: boolean; id?: string; levelId?: string; outward?: V | null; kind?: string };
    const ghost = !!d.levelId && v.above.has(d.levelId);
    if (d.wall) {
      const here = d.levelId === v.level;
      const low =
        here &&
        (v.mode === "low" ||
          (v.mode === "cutaway" && !!d.outward && d.outward.x * v.toCamera.x + d.outward.y * v.toCamera.y > 0.25));
      if (low && d.id) lowered.add(d.id);
      const [full, stub] = o.children;
      if (full) full.visible = !low;
      if (stub) stub.visible = low;
      setGhost(o, ghost);
      continue;
    }
    if (d.kind === "slab") o.visible = !(d.levelId === v.level && v.mode !== "full");
    setGhost(o, ghost);
  }
  // panes, frames and door leaves go with the upper part of their wall
  for (const o of group.children) {
    const d = o.userData as { kind?: string; host?: string };
    if (d.host) o.visible = !lowered.has(d.host);
  }
}

function setGhost(o: { traverse(f: (x: unknown) => void): void; userData: Record<string, unknown> }, on: boolean) {
  o.userData.ghost = on;
  o.traverse((x) => {
    if (!(x instanceof Mesh || x instanceof LineSegments)) return;
    x.userData.ghost = on;
    const ms = (Array.isArray(x.material) ? x.material : [x.material]) as Material[];
    for (const m of ms) {
      const u = m.userData as { opacity?: number; transparent?: boolean };
      m.transparent = on || !!u.transparent;
      m.opacity = on ? Math.min(GHOST, u.opacity ?? 1) : (u.opacity ?? 1);
      m.depthWrite = !m.transparent;
    }
    x.castShadow = !on && !(x instanceof LineSegments);
  });
}

/** Free GPU memory of a group made by buildGroup (shared pattern textures are kept). */
export function disposeGroup(g: Group) {
  g.traverse((o) => {
    if (o instanceof Mesh || o instanceof LineSegments) {
      o.geometry.dispose();
      const m = o.material as Material | Material[];
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m.dispose();
    }
  });
}
