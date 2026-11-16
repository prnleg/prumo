<script setup lang="ts">
// SVG plan renderer (ADR-002: SVG first). Pure view: draws what it's given and reports pointer
// events in MODEL coordinates. No model edits, no tool logic, no strings of its own (labels come in).
import type { PlanGeometry, SnapKind, V, Wall } from "@prumo/core";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { toModel, toScreen, zoomAt, type PlanPointer, type ViewState } from "./view";

const props = defineProps<{
  geometry: PlanGeometry;
  walls: readonly Wall[];
  view: ViewState;
  hover?: { point: V; kind: SnapKind } | null;
  selectedIds?: readonly string[];
  /** Text bubbles near points (e.g. the length of the wall being drawn), already localized. */
  labels?: readonly { at: V; text: string }[];
  /** Grid step, mm. */
  grid?: number;
  /** Detected rooms: floor polygon + a localized label (e.g. area). Drawn under the walls. */
  rooms?: readonly { key: string; floor: readonly V[]; at: V; label: string }[];
  /** Rubber band (model coords); "touching" draws dashed (CAD convention). */
  box?: { minX: number; minY: number; maxX: number; maxY: number; mode: "inside" | "touching" } | null;
}>();

const emit = defineEmits<{
  pointer: [e: PlanPointer];
  "update:view": [v: ViewState];
  resize: [w: number, h: number];
  leave: [];
}>();

const svg = ref<SVGSVGElement>();
const size = ref({ w: 800, h: 600 });
let ro: ResizeObserver | undefined;
onMounted(() => {
  ro = new ResizeObserver(([e]) => {
    if (!e) return;
    size.value = { w: e.contentRect.width, h: e.contentRect.height };
    emit("resize", size.value.w, size.value.h);
  });
  if (svg.value) ro.observe(svg.value);
});
onBeforeUnmount(() => ro?.disconnect());

const S = (p: V) => toScreen(props.view, p);
const pts = (poly: readonly V[]) => poly.map((p) => `${S(p).x},${S(p).y}`).join(" ");

// Grid: minor every `grid` mm when ≥ 8 px apart, major every 1 m.
const gridLines = computed(() => {
  const step = props.grid ?? 100;
  const v = props.view;
  const tl = toModel(v, 0, 0);
  const br = toModel(v, size.value.w, size.value.h);
  const out: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = [];
  for (const [s, major] of [
    [step, false],
    [1000, true],
  ] as const) {
    if (s * v.scale < 8) continue;
    const n = (br.x - tl.x) / s + (tl.y - br.y) / s;
    if (n > 600) continue;
    for (let x = Math.ceil(tl.x / s) * s; x <= br.x; x += s) {
      const a = S({ x, y: tl.y });
      out.push({ x1: a.x, y1: 0, x2: a.x, y2: size.value.h, major });
    }
    for (let y = Math.ceil(br.y / s) * s; y <= tl.y; y += s) {
      const a = S({ x: tl.x, y });
      out.push({ x1: 0, y1: a.y, x2: size.value.w, y2: a.y, major });
    }
  }
  return out;
});

const kindOf = computed(() => new Map(props.walls.map((w) => [w.id, w.kind])));
const selected = computed(() => new Set(props.selectedIds ?? []));

// --- input -----------------------------------------------------------------------------------
let pan: { x: number; y: number } | null = null;
let spaceDown = false;
const onKey = (e: KeyboardEvent) => {
  if (e.code === "Space") spaceDown = e.type === "keydown";
};
onMounted(() => {
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey);
  window.removeEventListener("keyup", onKey);
});

function local(e: MouseEvent) {
  const r = svg.value?.getBoundingClientRect() ?? { left: 0, top: 0 };
  return { sx: e.clientX - r.left, sy: e.clientY - r.top };
}
function report(type: PlanPointer["type"], e: MouseEvent) {
  const { sx, sy } = local(e);
  emit("pointer", {
    type,
    at: toModel(props.view, sx, sy),
    scale: props.view.scale,
    free: e.altKey,
    shift: e.shiftKey,
    mod: e.ctrlKey || e.metaKey,
    button: e.button,
  });
}
function down(e: PointerEvent) {
  if (e.button === 1 || (e.button === 0 && spaceDown)) {
    pan = { x: e.clientX, y: e.clientY };
    svg.value?.setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }
  svg.value?.setPointerCapture(e.pointerId); // keep receiving moves/up while dragging outside
  report("down", e);
}
function move(e: PointerEvent) {
  if (pan) {
    const v = props.view;
    emit("update:view", { ...v, x: v.x - (e.clientX - pan.x) / v.scale, y: v.y + (e.clientY - pan.y) / v.scale });
    pan = { x: e.clientX, y: e.clientY };
    return;
  }
  report("move", e);
}
function up(e: PointerEvent) {
  if (pan) {
    pan = null;
    return;
  }
  report("up", e);
}
function wheel(e: WheelEvent) {
  e.preventDefault();
  const { sx, sy } = local(e);
  // Pinch (ctrlKey) or a mouse wheel zooms; a trackpad two-finger scroll pans (fractional/X deltas).
  const trackpadPan = !e.ctrlKey && e.deltaMode === 0 && (e.deltaX !== 0 || !Number.isInteger(e.deltaY));
  if (trackpadPan) {
    const v = props.view;
    emit("update:view", { ...v, x: v.x + e.deltaX / v.scale, y: v.y - e.deltaY / v.scale });
    return;
  }
  emit("update:view", zoomAt(props.view, sx, sy, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))));
}
</script>

<template>
  <svg
    ref="svg"
    class="plan"
    @pointerdown="down"
    @pointermove="move"
    @pointerup="up"
    @pointerleave="emit('leave')"
    @dblclick="report('dblclick', $event)"
    @wheel="wheel"
    @contextmenu.prevent
  >
    <g class="grid">
      <line v-for="(l, k) in gridLines" :key="k" v-bind="l" :class="{ major: l.major }" />
    </g>
    <g class="rooms">
      <polygon v-for="r in rooms ?? []" :key="r.key" :points="pts(r.floor)" />
      <text v-for="r in rooms ?? []" :key="r.key + 't'" :x="S(r.at).x" :y="S(r.at).y">{{ r.label }}</text>
    </g>
    <g class="walls">
      <polygon
        v-for="g in geometry.walls"
        :key="g.id"
        :points="pts(g.polygon)"
        :class="['wall', kindOf.get(g.id), { selected: selected.has(g.id) }]"
      />
    </g>
    <g class="outline">
      <line v-for="(s, k) in geometry.outline" :key="k" :x1="S(s.a).x" :y1="S(s.a).y" :x2="S(s.b).x" :y2="S(s.b).y" />
    </g>
    <g class="openings">
      <g v-for="o in geometry.openings" :key="o.id">
        <polygon class="cover" :class="{ selected: selected.has(o.id) }" :points="pts(o.cover)" />
        <line
          v-for="(j, k) in o.jambs"
          :key="'j' + k"
          :x1="S(j[0]).x"
          :y1="S(j[0]).y"
          :x2="S(j[1]).x"
          :y2="S(j[1]).y"
        />
        <line
          v-for="(g, k) in o.glass"
          :key="'g' + k"
          class="glass"
          :x1="S(g[0]).x"
          :y1="S(g[0]).y"
          :x2="S(g[1]).x"
          :y2="S(g[1]).y"
        />
        <template v-if="o.leaf">
          <line class="leaf" :x1="S(o.leaf[0]).x" :y1="S(o.leaf[0]).y" :x2="S(o.leaf[1]).x" :y2="S(o.leaf[1]).y" />
          <polyline class="arc" :points="pts(o.arc)" />
        </template>
      </g>
    </g>
    <rect
      v-if="box"
      class="box"
      :class="box.mode"
      :x="S({ x: box.minX, y: box.maxY }).x"
      :y="S({ x: box.minX, y: box.maxY }).y"
      :width="(box.maxX - box.minX) * view.scale"
      :height="(box.maxY - box.minY) * view.scale"
    />
    <g v-if="hover" class="cursor" :class="hover.kind">
      <circle :cx="S(hover.point).x" :cy="S(hover.point).y" r="5" />
    </g>
    <g class="labels">
      <text v-for="(l, k) in labels ?? []" :key="k" :x="S(l.at).x + 12" :y="S(l.at).y - 12">{{ l.text }}</text>
    </g>
  </svg>
</template>

<style scoped>
.plan {
  width: 100%;
  height: 100%;
  display: block;
  background: var(--plan-bg);
  touch-action: none;
  cursor: crosshair;
  user-select: none;
}
.grid line {
  stroke: var(--grid-minor);
  stroke-width: 1;
}
.grid line.major {
  stroke: var(--grid-major);
}
.wall {
  fill: var(--wall-full);
}
.rooms polygon {
  fill: var(--room);
}
.rooms text {
  font:
    12px system-ui,
    sans-serif;
  fill: var(--muted);
  text-anchor: middle;
  dominant-baseline: middle;
  pointer-events: none;
}
.wall.half {
  fill: var(--wall-half);
}
.wall.fence,
.wall.railing {
  fill: var(--wall-light);
}
.wall.selected {
  fill: var(--accent-soft);
}
.outline line {
  stroke: var(--ink);
  stroke-width: 1.5;
  stroke-linecap: round;
}
/* The cover hides the wall fill AND the face outline strokes inside the opening (thick same-colour stroke). */
.openings .cover {
  fill: var(--plan-bg);
  stroke: var(--plan-bg);
  stroke-width: 3;
}
.openings .cover.selected {
  fill: var(--accent-soft);
  stroke: var(--accent-soft);
}
.box {
  fill: var(--accent-soft);
  fill-opacity: 0.35; /* not color-mix(): WKWebView on macOS 12 (Safari 15) lacks it */
  stroke: var(--accent);
  stroke-width: 1;
}
.box.touching {
  stroke-dasharray: 5 3;
}
.openings line,
.openings polyline {
  stroke: var(--ink);
  stroke-width: 1.5;
  fill: none;
}
.openings .glass {
  stroke-width: 1;
}
.openings .arc {
  stroke-width: 1;
  stroke-dasharray: 4 3;
}
.cursor circle {
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.5;
  pointer-events: none;
}
.cursor.endpoint circle {
  fill: var(--accent);
}
.labels text {
  font:
    12px system-ui,
    sans-serif;
  fill: var(--ink);
  paint-order: stroke;
  stroke: var(--plan-bg);
  stroke-width: 4px;
  pointer-events: none;
}
</style>
