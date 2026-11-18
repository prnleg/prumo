<script setup lang="ts">
// SVG plan renderer (ADR-002: SVG first). Pure view: draws what it's given and reports pointer
// events in MODEL coordinates. No model edits, no tool logic, no strings of its own (labels come in).
import type { PlanGeometry, SnapKind, V, Wall } from "@prumo/core";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { fitLabel, roomSpace } from "./label-fit";
import { toModel, toScreen, zoomAt, type PlanPointer, type ViewState } from "./view";

const props = defineProps<{
  geometry: PlanGeometry;
  walls: readonly Wall[];
  view: ViewState;
  hover?: { point: V; kind: SnapKind } | null;
  selectedIds?: readonly string[];
  /** Text bubbles near points (e.g. the length of the wall being drawn), already localized. */
  labels?: readonly { at: V; text: string }[];
  /** Structural findings: a small "!" mark per element (severity colour; never green). */
  badges?: readonly { at: V; severity: string; id: string }[];
  /** Protected walls ("load-bearing, don't remove"): a lock at `at`; `broken` = the wall was moved/removed. */
  locks?: readonly { id: string; at: V; broken: boolean }[];
  /** Where a protected wall used to be (dashed outline). */
  ghosts?: readonly { id: string; a: V; b: V }[];
  /** Compare view (ADR-029 b): new / changed walls and doors highlighted, removed ones dashed. */
  compare?: {
    added: readonly string[];
    changed: readonly string[];
    gone: readonly { id: string; kind: "wall" | "opening"; a: V; b: V }[];
  } | null;
  /** Grid step, mm. */
  grid?: number;
  /** Detected rooms: floor polygon + a localized label (e.g. area). Drawn under the walls. */
  /** `label` = parts, e.g. [name, area]: shown on one line, two lines, smaller, or name only — whatever fits. */
  rooms?: readonly {
    key: string;
    floor: readonly V[];
    at: V;
    label: readonly string[];
    selected?: boolean;
    fill?: string;
  }[];
  /** Drawn slabs (ADR-050): dashed outline, light hatch, a badge at `at` (what you click). */
  slabs?: readonly { id: string; outline: readonly V[]; at: V; label: string; selected?: boolean }[];
  /** Slab tool preview: outline(s) being made (open polyline while drawing corners). */
  slabPreview?: readonly (readonly V[])[];
  /** The floor below (ADR-048): wall shapes drawn faded under everything; never picked. */
  ghost?: readonly (readonly V[])[];
  /** Dimmed (hidden room's own walls and what's on them, Q-141): drawn faded; picking is the tools' job. */
  dimmed?: readonly string[];
  /** Double-headed arrows inside rooms (joist direction, structure on). */
  arrows?: readonly { key: string; a: V; b: V }[];
  /** Painted wall faces: a strip along `line`, clipped to the wall's drawn shape (clean corners). */
  faces?: readonly { key: string; wallId: string; line: readonly [V, V]; color: string }[];
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
const roomLabels = computed(() =>
  (props.rooms ?? []).flatMap((r) => {
    const room = roomSpace(r.floor, r.at);
    const fit = fitLabel(r.label, room.w * props.view.scale, room.h * props.view.scale);
    if (!fit) return [];
    const at = S(r.at);
    // centre the block vertically on the label point (text baseline is "middle")
    const dy0 = -((fit.lines.length - 1) * fit.size * 1.25) / 2;
    return [{ key: r.key, x: at.x, y: at.y, dy0, ...fit }];
  }),
);
const selected = computed(() => new Set(props.selectedIds ?? []));
const dim = computed(() => new Set(props.dimmed ?? []));
/** Badge width from the character count (deterministic, like the room labels). */
const badgeW = (label: string) => Math.ceil(label.length * 11 * 0.6) + 12;
/** Screen-space arrow head at `to`, pointing away from `from` (8 px). */
function arrowHead(from: V, to: V): string {
  const a = S(from);
  const b = S(to);
  const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const u = { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
  const n = { x: -u.y, y: u.x };
  const p = (s: number, t: number) => `${b.x - u.x * s + n.x * t},${b.y - u.y * s + n.y * t}`;
  return `${b.x},${b.y} ${p(8, 4)} ${p(8, -4)}`;
}
const cmpAdded = computed(() => new Set(props.compare?.added ?? []));
const cmpChanged = computed(() => new Set(props.compare?.changed ?? []));

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
      <polygon
        v-for="r in rooms ?? []"
        :key="r.key"
        :points="pts(r.floor)"
        :class="{ selected: r.selected }"
        :style="r.fill && !r.selected ? { fill: r.fill } : undefined"
      />
      <template v-for="r in roomLabels" :key="r.key + 't'">
        <text :x="r.x" :y="r.y" :style="{ fontSize: `${r.size}px` }">
          <tspan v-for="(line, i) in r.lines" :key="i" :x="r.x" :dy="i === 0 ? r.dy0 : r.size * 1.25">{{ line }}</tspan>
        </text>
      </template>
    </g>
    <g class="slabs">
      <polygon v-for="sl in slabs ?? []" :key="sl.id" :points="pts(sl.outline)" :class="{ selected: sl.selected }" />
      <polyline v-for="(pv, k) in slabPreview ?? []" :key="'p' + k" class="preview" :points="pts(pv)" />
    </g>
    <g class="below">
      <polygon v-for="(g, k) in ghost ?? []" :key="k" :points="pts(g)" />
    </g>
    <g class="walls">
      <polygon
        v-for="g in geometry.walls"
        :key="g.id"
        :points="pts(g.polygon)"
        :class="[
          'wall',
          kindOf.get(g.id),
          {
            selected: selected.has(g.id),
            dim: dim.has(g.id),
            'cmp-added': cmpAdded.has(g.id),
            'cmp-changed': cmpChanged.has(g.id),
          },
        ]"
      />
    </g>
    <g class="dividers">
      <line
        v-for="d in geometry.dividers"
        :key="d.id"
        :x1="S(d.a).x"
        :y1="S(d.a).y"
        :x2="S(d.b).x"
        :y2="S(d.b).y"
        :class="['divider', { selected: selected.has(d.id) }]"
      />
    </g>
    <defs>
      <clipPath v-for="g in geometry.walls" :id="`clip-${g.id}`" :key="g.id">
        <polygon :points="pts(g.polygon)" />
      </clipPath>
    </defs>
    <g class="faces">
      <line
        v-for="f in faces ?? []"
        :key="f.key"
        :x1="S(f.line[0]).x"
        :y1="S(f.line[0]).y"
        :x2="S(f.line[1]).x"
        :y2="S(f.line[1]).y"
        :stroke="f.color"
        :clip-path="`url(#clip-${f.wallId})`"
      />
    </g>
    <g class="outline">
      <line
        v-for="(s, k) in geometry.outline"
        :key="k"
        :class="{ dim: dim.has(s.wallId) }"
        :x1="S(s.a).x"
        :y1="S(s.a).y"
        :x2="S(s.b).x"
        :y2="S(s.b).y"
      />
    </g>
    <g class="openings">
      <g v-for="o in geometry.openings" :key="o.id" :class="{ dim: dim.has(o.id) }">
        <polygon
          class="cover"
          :class="{
            selected: selected.has(o.id),
            'cmp-added': cmpAdded.has(o.id),
            'cmp-changed': cmpChanged.has(o.id),
          }"
          :points="pts(o.cover)"
        />
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
        <line
          v-for="(lf, k) in o.leaves"
          :key="'l' + k"
          class="leaf"
          :x1="S(lf[0]).x"
          :y1="S(lf[0]).y"
          :x2="S(lf[1]).x"
          :y2="S(lf[1]).y"
        />
        <polyline v-for="(a, k) in o.arcs" :key="'a' + k" class="arc" :points="pts(a)" />
        <polyline v-for="(f, k) in o.folds" :key="'f' + k" class="leaf" :points="pts(f)" />
        <line
          v-for="(d, k) in o.dashed"
          :key="'d' + k"
          class="arc"
          :x1="S(d[0]).x"
          :y1="S(d[0]).y"
          :x2="S(d[1]).x"
          :y2="S(d[1]).y"
        />
      </g>
    </g>
    <!-- hosted module items (chases…): a run along the wall, or a ring for a point item -->
    <g class="items">
      <g v-for="it in geometry.items" :key="it.id" :class="{ selected: selected.has(it.id) }">
        <polygon v-if="selected.has(it.id)" class="hl" :points="pts(it.polygon)" />
        <line
          v-if="it.a.x !== it.b.x || it.a.y !== it.b.y"
          :x1="S(it.a).x"
          :y1="S(it.a).y"
          :x2="S(it.b).x"
          :y2="S(it.b).y"
        />
        <circle v-else :cx="S(it.a).x" :cy="S(it.a).y" r="4" />
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
      <!-- assists get their own mark: ▲ wall middle, ⊾ right angle -->
      <polygon
        v-if="hover.kind === 'midpoint'"
        :points="`${S(hover.point).x},${S(hover.point).y - 6} ${S(hover.point).x - 6},${S(hover.point).y + 4} ${S(hover.point).x + 6},${S(hover.point).y + 4}`"
      />
      <path
        v-else-if="hover.kind === 'perpendicular'"
        :d="`M${S(hover.point).x - 6},${S(hover.point).y - 6} V${S(hover.point).y + 6} H${S(hover.point).x + 6} M${S(hover.point).x - 6},${S(hover.point).y} H${S(hover.point).x} V${S(hover.point).y + 6}`"
      />
      <circle v-else :cx="S(hover.point).x" :cy="S(hover.point).y" r="5" />
    </g>
    <g v-if="compare" class="cmp-gone">
      <line
        v-for="gn in compare.gone"
        :key="gn.id"
        :class="gn.kind"
        :x1="S(gn.a).x"
        :y1="S(gn.a).y"
        :x2="S(gn.b).x"
        :y2="S(gn.b).y"
      />
    </g>
    <g class="ghosts">
      <line v-for="gh in ghosts ?? []" :key="gh.id" :x1="S(gh.a).x" :y1="S(gh.a).y" :x2="S(gh.b).x" :y2="S(gh.b).y" />
    </g>
    <g class="locks">
      <g v-for="l in locks ?? []" :key="l.id" :class="{ broken: l.broken }">
        <rect :x="S(l.at).x - 5" :y="S(l.at).y - 3" width="10" height="8" rx="1.5" />
        <path :d="`M${S(l.at).x - 3},${S(l.at).y - 3} v-2.5 a3,3 0 0 1 6,0 v2.5`" />
      </g>
    </g>
    <!-- notes (ADR-044): a speech-bubble pin centred on the noted spot (so a click on it picks it) -->
    <g class="notes">
      <path
        v-for="n in geometry.notes"
        :key="n.id"
        :class="{ resolved: n.resolved, selected: selected.has(n.id) }"
        :d="`M${S(n.at).x},${S(n.at).y + 11} l-4,-6 h-6 a3,3 0 0 1 -3,-3 v-10 a3,3 0 0 1 3,-3 h20 a3,3 0 0 1 3,3 v10 a3,3 0 0 1 -3,3 h-6 z`"
      />
    </g>
    <g class="badges">
      <g v-for="b in badges ?? []" :key="b.id" :class="['badge', b.severity]">
        <circle :cx="S(b.at).x" :cy="S(b.at).y - 14" r="7" />
        <text :x="S(b.at).x" :y="S(b.at).y - 10.5" text-anchor="middle">!</text>
      </g>
    </g>
    <g class="arrows">
      <!-- drawn 18 px below the room's label point so it never strikes through the label -->
      <g v-for="ar in arrows ?? []" :key="'ar' + ar.key" class="arrow" transform="translate(0 18)">
        <line :x1="S(ar.a).x" :y1="S(ar.a).y" :x2="S(ar.b).x" :y2="S(ar.b).y" />
        <polygon :points="arrowHead(ar.a, ar.b)" />
        <polygon :points="arrowHead(ar.b, ar.a)" />
      </g>
    </g>
    <g class="slab-badges">
      <g v-for="sl in slabs ?? []" :key="sl.id" :class="{ selected: sl.selected }">
        <rect :x="S(sl.at).x - badgeW(sl.label) / 2" :y="S(sl.at).y - 9" :width="badgeW(sl.label)" height="18" rx="4" />
        <text :x="S(sl.at).x" :y="S(sl.at).y + 4">{{ sl.label }}</text>
      </g>
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
.slabs polygon {
  fill: var(--slab, rgb(138 109 59 / 0.08));
  stroke: var(--plan-arrow, #8a6d3b);
  stroke-width: 1.5;
  stroke-dasharray: 8 4;
}
.slabs polygon.selected {
  fill: var(--accent-soft);
  fill-opacity: 0.35;
  stroke: var(--accent);
}
.slabs .preview {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
  stroke-dasharray: 6 3;
}
.slab-badges rect {
  fill: var(--panel, #fff);
  stroke: var(--plan-arrow, #8a6d3b);
}
.slab-badges .selected rect {
  stroke: var(--accent);
  stroke-width: 2;
}
.slab-badges text {
  font-size: 11px;
  text-anchor: middle;
  fill: var(--ink);
}
.below polygon {
  fill: none;
  stroke: var(--muted, #888);
  stroke-width: 1;
  stroke-dasharray: 4 3;
  opacity: 0.55;
}
.rooms polygon {
  fill: var(--room);
}
.rooms polygon.selected {
  fill: var(--accent-soft);
  fill-opacity: 0.5;
}
.arrows .arrow line {
  stroke: var(--plan-arrow, #8a6d3b);
  stroke-width: 1.5;
  stroke-dasharray: 6 3;
}
.arrows .arrow polygon {
  fill: var(--plan-arrow, #8a6d3b);
}
.rooms text {
  font:
    12px system-ui,
    sans-serif;
  fill: var(--ink);
  /* halo: readable on any floor colour */
  paint-order: stroke;
  stroke: var(--plan-bg);
  stroke-width: 3px;
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
.wall.dim,
.outline line.dim,
.openings g.dim {
  opacity: 0.25;
}
.wall.selected {
  fill: var(--accent-soft);
}
.faces line {
  stroke-width: 5;
  stroke-linecap: butt;
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
.items line,
.items circle {
  stroke: var(--item, #b8642a);
  stroke-width: 3;
  fill: var(--plan-bg);
  stroke-dasharray: 2 3;
}
.items circle {
  stroke-width: 2;
  stroke-dasharray: none;
}
.items .hl {
  fill: var(--accent-soft);
  stroke: none;
}
.items .selected line,
.items .selected circle {
  stroke: var(--accent);
}
.wall.cmp-added,
.openings .cover.cmp-added {
  fill: var(--cmp-added, #4f8fe8);
  stroke: var(--cmp-added, #4f8fe8);
}
.wall.cmp-changed,
.openings .cover.cmp-changed {
  fill: var(--cmp-changed, #e8a33d);
  stroke: var(--cmp-changed, #e8a33d);
}
.cmp-gone line {
  stroke: var(--muted);
  stroke-width: 2;
  stroke-dasharray: 3 4;
}
.cmp-gone line.opening {
  stroke-width: 4;
}
.ghosts line {
  stroke: #d64545;
  stroke-width: 2;
  stroke-dasharray: 6 5;
  opacity: 0.8;
}
.locks rect {
  fill: var(--panel);
  stroke: var(--ink);
  stroke-width: 1.2;
}
.locks path {
  fill: none;
  stroke: var(--ink);
  stroke-width: 1.2;
}
.locks .broken rect,
.locks .broken path {
  stroke: #d64545;
}
.notes path {
  fill: var(--note, #f2c94c);
  stroke: var(--ink);
  stroke-width: 1;
}
.notes path.resolved {
  fill: var(--plan-bg);
  stroke: var(--muted);
}
.notes path.selected {
  stroke: var(--accent);
  stroke-width: 2.5;
}
.divider {
  stroke: var(--muted);
  stroke-width: 1.5;
  stroke-dasharray: 6 4;
}
.divider.selected {
  stroke: var(--accent);
  stroke-width: 2.5;
}
.cursor circle,
.cursor polygon,
.cursor path {
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.5;
  pointer-events: none;
}
.cursor.endpoint circle,
.cursor.midpoint polygon {
  fill: var(--accent);
}
.badge circle {
  fill: #5b8bd6;
  stroke: var(--plan-bg);
  stroke-width: 1.5;
}
.badge.warning circle {
  fill: #e09a2b;
}
.badge.critical circle {
  fill: #d64545;
}
.badge text {
  fill: #fff;
  font:
    bold 10px system-ui,
    sans-serif;
  pointer-events: none;
}
.badges {
  pointer-events: none;
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
