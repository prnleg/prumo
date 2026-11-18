<script setup lang="ts">
// Read-only 3D view of the building (ADR-053). Orbit (left drag), pan (right drag / Shift), zoom (wheel).
// A click without dragging picks the element under the pointer. Renders on demand (no idle loop).
import type { BuildingModel } from "@prumo/core";
import {
  Box3,
  DirectionalLight,
  GridHelper,
  Group,
  HemisphereLight,
  Mesh,
  Object3D,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  ShadowMaterial,
  Color,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { applyView, buildGroup, DARK, disposeGroup, LIGHT, type Mark, type WallFaces, type WallMode } from "./mesh";

const props = defineProps<{
  model: BuildingModel;
  selection: readonly string[];
  /** How the walls of the floor being edited show (ADR-054). */
  mode?: WallMode;
  /** The floor being edited, and the floors above it (faint, not pickable). */
  level?: string;
  above?: readonly string[];
  /** Wall faces from the finishes. */
  faces?: WallFaces;
  /** Findings: element id → worst severity. */
  marks?: Readonly<Record<string, Mark>>;
  dark?: boolean;
  /** Change it to frame the whole building again. */
  fitKey?: number;
}>();
const emit = defineEmits<{ pick: [id: string | null] }>();

const host = ref<HTMLDivElement>();
const failed = ref(false);
let renderer: WebGLRenderer | null = null;
let controls: OrbitControls | null = null;
let building: Group | null = null;
let ground: Mesh | null = null;
let grid: GridHelper | null = null;
let ro: ResizeObserver | null = null;
let userMoved = false;
const scene = new Scene();
const camera = new PerspectiveCamera(45, 1, 0.05, 2000);
camera.position.set(12, 10, 14);
const sun = new DirectionalLight(0xffffff, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.03; // no stripes (shadow acne) on the walls
scene.add(new HemisphereLight(0xffffff, 0x8a8378, 1.4), sun, sun.target);

let pending = 0;
/** Walls up / low / see-inside + faint floors above; cheap, so it runs whenever the camera turns. */
function view() {
  if (!building || !controls) return;
  const d = camera.position.clone().sub(controls.target);
  const len = Math.hypot(d.x, d.z) || 1;
  applyView(building, {
    mode: props.mode ?? "full",
    level: props.level ?? "",
    above: new Set(props.above ?? []),
    toCamera: { x: d.x / len, y: -d.z / len },
  });
}

function render() {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    renderer?.render(scene, camera);
  });
}

function rebuild() {
  if (building) {
    scene.remove(building);
    disposeGroup(building);
  }
  const c = props.dark ? DARK : LIGHT;
  scene.background = new Color(props.dark ? 0x1d1f22 : 0xf4f5f7);
  building = buildGroup(props.model, c, {
    selected: new Set(props.selection),
    marks: props.marks ?? {},
    faces: props.faces ?? {},
  });
  view();
  scene.add(building);
  placeGround();
  render();
}

/** Ground, grid and sun follow the building's size. */
function placeGround() {
  const b = building ? new Box3().setFromObject(building) : new Box3();
  const size = b.isEmpty() ? 10 : Math.max(10, b.max.x - b.min.x, b.max.z - b.min.z) * 2;
  const mid = b.isEmpty() ? new Vector3() : b.getCenter(new Vector3());
  if (ground) {
    scene.remove(ground);
    ground.geometry.dispose();
  }
  if (grid) {
    scene.remove(grid);
    grid.dispose();
  }
  ground = new Mesh(new PlaneGeometry(size, size), new ShadowMaterial({ opacity: props.dark ? 0.35 : 0.18 }));
  ground.rotateX(-Math.PI / 2);
  ground.position.set(mid.x, -0.001, mid.z);
  ground.receiveShadow = true;
  ground.raycast = () => undefined;
  grid = new GridHelper(
    Math.ceil(size),
    Math.ceil(size),
    props.dark ? 0x3a3d42 : 0xd5d8dd,
    props.dark ? 0x2a2d31 : 0xe4e6ea,
  );
  grid.position.set(Math.round(mid.x), -0.002, Math.round(mid.z));
  grid.raycast = () => undefined;
  scene.add(ground, grid);
  const r = size / 2;
  sun.position.set(mid.x + r * 0.6, r * 1.2, mid.z + r * 0.8);
  sun.target.position.copy(mid);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -r;
  sc.right = sc.top = r;
  sc.far = r * 4;
  sc.updateProjectionMatrix();
}

function fit() {
  if (!building || !controls) return;
  const b = new Box3().setFromObject(building);
  if (b.isEmpty()) return;
  const mid = b.getCenter(new Vector3());
  const r = b.getSize(new Vector3()).length() / 2;
  const v = (camera.fov * Math.PI) / 180;
  const h = 2 * Math.atan(Math.tan(v / 2) * camera.aspect); // narrow panes: the width limits
  const d = (r / Math.sin(Math.min(v, h) / 2)) * 1.05;
  const dir = new Vector3(0.55, 0.6, 0.75).normalize();
  camera.position.copy(mid).addScaledVector(dir, d);
  controls.target.copy(mid);
  controls.update();
  render();
}

function resize() {
  const el = host.value;
  if (!el || !renderer) return;
  const w = el.clientWidth || 1;
  const h = el.clientHeight || 1;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  render();
}

// --- picking: a click that didn't drag ---------------------------------------------------------------
let down: { x: number; y: number } | null = null;
function onDown(e: PointerEvent) {
  down = e.button === 0 ? { x: e.clientX, y: e.clientY } : null;
}
function onUp(e: PointerEvent) {
  if (!down || !renderer || !building) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4;
  down = null;
  if (moved) return;
  const r = renderer.domElement.getBoundingClientRect();
  const ndc = new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  const ray = new Raycaster();
  ray.setFromCamera(ndc, camera);
  const shown = (o: Object3D | null): boolean => !o || (o.visible && shown(o.parent));
  const hit = ray
    .intersectObjects(building.children, true)
    .find((h) => h.object instanceof Mesh && !h.object.userData.ghost && shown(h.object));
  emit("pick", (hit?.object.userData.id as string | undefined) ?? null);
}

onMounted(() => {
  const el = host.value;
  if (!el) return;
  try {
    renderer = new WebGLRenderer({ antialias: true });
  } catch {
    failed.value = true;
    return;
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  el.appendChild(renderer.domElement);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.maxPolarAngle = Math.PI / 2 - 0.02; // never under the ground
  controls.addEventListener("change", () => {
    if (props.mode === "cutaway") view();
    render();
  });
  controls.addEventListener("start", () => (userMoved = true));
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);
  ro = new ResizeObserver(() => {
    resize();
    if (!userMoved) fit(); // until the user turns the camera, keep the building framed
  });
  ro.observe(el);
  rebuild();
  resize();
  fit();
});

onBeforeUnmount(() => {
  if (pending) cancelAnimationFrame(pending);
  ro?.disconnect();
  controls?.dispose();
  if (building) disposeGroup(building);
  ground?.geometry.dispose();
  (ground?.material as MeshStandardMaterial | undefined)?.dispose();
  grid?.dispose();
  renderer?.dispose();
  renderer?.domElement.remove();
});

watch(() => [props.model, props.selection, props.dark, props.marks, props.faces], rebuild);
watch(
  () => [props.mode, props.level, props.above],
  () => {
    view();
    render();
  },
);
watch(
  () => props.fitKey,
  () => {
    userMoved = false;
    fit();
  },
);
</script>

<template>
  <div ref="host" class="view3d">
    <p v-if="failed" class="fail"><slot name="failed" /></p>
  </div>
</template>

<style scoped>
.view3d {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.view3d :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
}
.fail {
  margin: 40px auto;
  max-width: 320px;
  text-align: center;
  opacity: 0.7;
}
</style>
