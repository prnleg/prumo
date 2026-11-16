<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import type { Wall } from "./walls";

const props = defineProps<{ walls: Wall[] }>();
// view: model point at screen origin + px per mm
const view = reactive({ x: -2000, y: 62000, scale: 0.012 });
const svg = ref<SVGSVGElement>();
const selected = ref<number | null>(null);

// Model Y is up, screen Y is down → flip here, and only here.
const transform = computed(() => `scale(${view.scale} ${-view.scale}) translate(${-view.x} ${-view.y})`);

function toModel(e: { clientX: number; clientY: number }) {
  const r = svg.value!.getBoundingClientRect();
  return { x: view.x + (e.clientX - r.left) / view.scale, y: view.y - (e.clientY - r.top) / view.scale };
}

let drag: { kind: "pan" | "wall"; id?: number; last: { x: number; y: number }; sx: number; sy: number } | null = null;

function onDown(e: PointerEvent, wallId?: number) {
  (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  drag = { kind: wallId === undefined ? "pan" : "wall", id: wallId, last: toModel(e), sx: e.clientX, sy: e.clientY };
  if (wallId !== undefined) selected.value = wallId;
  e.stopPropagation();
}
function onMove(e: PointerEvent) {
  if (!drag) return;
  if (drag.kind === "pan") {
    view.x -= (e.clientX - drag.sx) / view.scale;
    view.y += (e.clientY - drag.sy) / view.scale;
    drag.sx = e.clientX; drag.sy = e.clientY;
  } else {
    const p = toModel(e);
    moveWall(drag.id!, p.x - drag.last.x, p.y - drag.last.y);
    drag.last = p;
  }
}
function onUp() { drag = null; }
function onWheel(e: WheelEvent) {
  e.preventDefault();
  const before = toModel(e);
  view.scale *= Math.exp(-e.deltaY * 0.0015);
  const after = toModel(e);
  view.x += before.x - after.x;
  view.y += before.y - after.y;
}

function moveWall(id: number, dx: number, dy: number) {
  const w = props.walls[id]!;
  w.x1 += dx; w.y1 += dy; w.x2 += dx; w.y2 += dy;
}
function setView(x: number, y: number, scale: number) { view.x = x; view.y = y; view.scale = scale; }
defineExpose({ moveWall, setView, select: (id: number) => (selected.value = id) });
</script>

<template>
  <svg ref="svg" class="plan" @pointerdown="onDown($event)" @pointermove="onMove" @pointerup="onUp" @wheel="onWheel">
    <g :transform="transform">
      <line
        v-for="w in walls"
        :key="w.id"
        :x1="w.x1" :y1="w.y1" :x2="w.x2" :y2="w.y2"
        :stroke-width="w.thickness"
        :class="{ wall: true, half: w.height < 2000, sel: w.id === selected }"
        @pointerdown="onDown($event, w.id)"
      />
    </g>
  </svg>
</template>

<style scoped>
.plan { width: 100%; height: 100%; background: #f7f5f0; touch-action: none; cursor: grab; display: block; }
.wall { stroke: #333; stroke-linecap: square; cursor: move; }
.wall.half { stroke: #8a8a8a; }
.wall.sel { stroke: #d2691e; }
</style>
