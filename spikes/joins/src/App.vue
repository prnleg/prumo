<script setup lang="ts">
import { computed, reactive, ref, shallowRef, watch } from "vue";
import { computeJoins, DEFAULTS, type WallIn } from "./joins";
import { visibleOutline } from "./outline";
import { PRESETS } from "./presets";
import type { V } from "./geom";

const presetName = ref(Object.keys(PRESETS)[0]!);
const walls = ref<WallIn[]>([]);
const opts = reactive({ ...DEFAULTS });
const show = reactive({ fill: true, outline: true, raw: false, centre: true, nodes: true, issues: true });
const selected = ref<string | null>(null);
const view = reactive({ x: 0, y: 0, scale: 0.2 });
const svg = ref<SVGSVGElement>();
const GRID = 100; // 10 cm snap (ADR-031), Alt = free

function load(name: string) {
  walls.value = PRESETS[name]!().map((w) => structuredClone(w));
  selected.value = null;
  fit();
}

const result = shallowRef(computeJoins([]));
const outline = shallowRef(visibleOutline([]));
const ms = ref(0);
watch(
  [walls, opts],
  () => {
    const t0 = performance.now();
    result.value = computeJoins(walls.value, { ...opts });
    outline.value = visibleOutline(result.value.walls);
    ms.value = performance.now() - t0;
  },
  { deep: true, immediate: true },
);
watch(presetName, load, { immediate: true });

function fit() {
  const pts = walls.value.flatMap((w) => [w.start, w.end]);
  if (!pts.length || !svg.value) return;
  const r = svg.value.getBoundingClientRect();
  const minX = Math.min(...pts.map((p) => p.x)) - 600, maxX = Math.max(...pts.map((p) => p.x)) + 600;
  const minY = Math.min(...pts.map((p) => p.y)) - 600, maxY = Math.max(...pts.map((p) => p.y)) + 600;
  view.scale = Math.min(r.width / (maxX - minX), r.height / (maxY - minY));
  view.x = (minX + maxX) / 2 - r.width / 2 / view.scale;
  view.y = (minY + maxY) / 2 + r.height / 2 / view.scale;
}
setTimeout(fit, 0);

// model (Y up) → screen
const sx = (p: V) => (p.x - view.x) * view.scale;
const sy = (p: V) => (view.y - p.y) * view.scale;
const pts = (poly: V[]) => poly.map((p) => `${sx(p)},${sy(p)}`).join(" ");
function toModel(e: { clientX: number; clientY: number }): V {
  const r = svg.value!.getBoundingClientRect();
  return { x: view.x + (e.clientX - r.left) / view.scale, y: view.y - (e.clientY - r.top) / view.scale };
}

let drag: { kind: "pan"; cx: number; cy: number } | { kind: "end"; wall: WallIn; which: "start" | "end" } | null = null;
function downBg(e: PointerEvent) {
  drag = { kind: "pan", cx: e.clientX, cy: e.clientY };
  selected.value = null;
  svg.value!.setPointerCapture(e.pointerId);
}
function downEnd(e: PointerEvent, wall: WallIn, which: "start" | "end") {
  e.stopPropagation();
  drag = { kind: "end", wall, which };
  selected.value = wall.id;
  svg.value!.setPointerCapture(e.pointerId);
}
function move(e: PointerEvent) {
  if (!drag) return;
  if (drag.kind === "pan") {
    view.x -= (e.clientX - drag.cx) / view.scale;
    view.y += (e.clientY - drag.cy) / view.scale;
    drag.cx = e.clientX;
    drag.cy = e.clientY;
    return;
  }
  let p = toModel(e);
  if (!e.altKey) {
    // snap to other endpoints within 12 px, else to the 10 cm grid
    const others = walls.value.flatMap((w) => (w === (drag as { wall: WallIn }).wall ? [] : [w.start, w.end]));
    const near = others.find((q) => Math.hypot(q.x - p.x, q.y - p.y) * view.scale < 12);
    p = near ? { ...near } : { x: Math.round(p.x / GRID) * GRID, y: Math.round(p.y / GRID) * GRID };
  }
  drag.wall[drag.which] = p;
}
function up() {
  drag = null;
}
function wheel(e: WheelEvent) {
  e.preventDefault();
  const before = toModel(e);
  view.scale *= Math.exp(-e.deltaY * 0.0015);
  const after = toModel(e);
  view.x += before.x - after.x;
  view.y += before.y - after.y;
}

const sel = computed(() => walls.value.find((w) => w.id === selected.value));
function addWall() {
  const c = toModel({ clientX: svg.value!.getBoundingClientRect().left + 200, clientY: svg.value!.getBoundingClientRect().top + 200 });
  const s = { x: Math.round(c.x / GRID) * GRID, y: Math.round(c.y / GRID) * GRID };
  const id = `n${walls.value.length + 1}-${Date.now() % 1000}`;
  walls.value.push({ id, start: s, end: { x: s.x + 2000, y: s.y }, thickness: 200, alignment: "center", kind: "full" });
  selected.value = id;
}
function del() {
  walls.value = walls.value.filter((w) => w.id !== selected.value);
  selected.value = null;
}
const kindFill: Record<string, string> = { full: "#c9c3b6", half: "#e3dccb", fence: "#d8e6d0", railing: "#d0dbe6" };
</script>

<template>
  <div class="app">
    <aside>
      <h1>Spike A — wall joins</h1>
      <label>Preset <select v-model="presetName"><option v-for="(_, k) in PRESETS" :key="k">{{ k }}</option></select></label>
      <p class="hint">Drag the dots at the wall ends. Snaps to other ends + 10 cm grid; hold <b>Alt</b> for free. Wheel = zoom, drag background = pan.</p>
      <fieldset>
        <legend>Show</legend>
        <label v-for="(_, k) in show" :key="k"><input type="checkbox" v-model="show[k]" /> {{ k }}</label>
      </fieldset>
      <fieldset>
        <legend>Tolerances (spike values)</legend>
        <label>Join/heal gap (mm) <input type="number" v-model.number="opts.joinTol" min="0" step="1" /></label>
        <label>Miter limit (× thickness) <input type="number" v-model.number="opts.miterLimit" min="1" step="0.5" /></label>
      </fieldset>
      <button @click="addWall">+ Add wall</button> <button @click="fit">Fit</button>
      <fieldset v-if="sel">
        <legend>Wall {{ sel.id }}</legend>
        <label>Thickness (mm) <input type="number" v-model.number="sel.thickness" min="10" step="10" /></label>
        <label>Alignment
          <select v-model="sel.alignment"><option>center</option><option>left</option><option>right</option></select>
        </label>
        <label>Kind <select v-model="sel.kind"><option>full</option><option>half</option><option>fence</option><option>railing</option></select></label>
        <button @click="del">Delete wall</button>
      </fieldset>
      <p class="stats">{{ walls.length }} walls · {{ result.nodes.length }} nodes · {{ ms.toFixed(1) }} ms</p>
      <ul class="issues">
        <li v-for="(i, k) in result.issues" :key="k">⚠ {{ i.code }} — {{ i.wallIds.join(", ") }}</li>
      </ul>
    </aside>
    <svg ref="svg" @pointerdown="downBg" @pointermove="move" @pointerup="up" @wheel="wheel">
      <g v-if="show.fill">
        <polygon
          v-for="g in result.walls" :key="g.id" :points="pts(g.polygon)"
          :fill="kindFill[walls.find((w) => w.id === g.id)?.kind ?? 'full']"
          :class="{ sel: g.id === selected }" @pointerdown.stop="selected = g.id"
        />
      </g>
      <g v-if="show.raw" class="raw"><polygon v-for="g in result.walls" :key="g.id" :points="pts(g.polygon)" /></g>
      <g v-if="show.outline" class="outline">
        <line v-for="(s, k) in outline" :key="k" :x1="sx(s.a)" :y1="sy(s.a)" :x2="sx(s.b)" :y2="sy(s.b)" />
      </g>
      <g v-if="show.centre" class="centre">
        <line v-for="w in walls" :key="w.id" :x1="sx(w.start)" :y1="sy(w.start)" :x2="sx(w.end)" :y2="sy(w.end)" />
      </g>
      <g v-if="show.nodes" class="nodes">
        <circle v-for="(n, k) in result.nodes" :key="k" :cx="sx(n.at)" :cy="sy(n.at)" r="9" />
      </g>
      <g v-if="show.issues" class="issue">
        <circle v-for="(i, k) in result.issues" :key="k" :cx="sx(i.at)" :cy="sy(i.at)" r="16" />
      </g>
      <g class="handles">
        <template v-for="w in walls" :key="w.id">
          <circle :cx="sx(w.start)" :cy="sy(w.start)" r="5" @pointerdown="downEnd($event, w, 'start')" />
          <circle :cx="sx(w.end)" :cy="sy(w.end)" r="5" @pointerdown="downEnd($event, w, 'end')" />
        </template>
      </g>
    </svg>
  </div>
</template>

<style>
html, body, #app { margin: 0; height: 100%; font: 13px system-ui, sans-serif; color: #222; }
.app { display: flex; height: 100%; }
aside { width: 280px; padding: 10px; border-right: 1px solid #ccc; overflow: auto; }
aside h1 { font-size: 15px; margin: 0 0 8px; }
aside label { display: block; margin: 4px 0; }
aside input[type="number"] { width: 70px; }
fieldset { margin: 8px 0; }
.hint, .stats { color: #555; }
.issues { padding-left: 16px; color: #b35c00; }
svg { flex: 1; background: #f7f5f0; touch-action: none; }
polygon.sel { fill: #f2c98f; }
.raw polygon { fill: none; stroke: #c00; stroke-width: 0.7; stroke-dasharray: 3 2; }
.outline line { stroke: #111; stroke-width: 1.6; }
.centre line { stroke: #2a6fdb; stroke-width: 0.8; stroke-dasharray: 6 4; pointer-events: none; }
.nodes circle { fill: none; stroke: #2a6fdb; stroke-width: 1; pointer-events: none; }
.issue circle { fill: none; stroke: #e07b00; stroke-width: 2; pointer-events: none; }
.handles circle { fill: #2a6fdb; cursor: grab; }
</style>
