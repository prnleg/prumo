<script setup lang="ts">
// App shell for Phase 1 slice 3: one level, wall tool, undo/redo, pan/zoom. No file I/O yet.
import {
  DEFAULT_SNAP,
  History,
  ModuleHost,
  dist,
  emptyProject,
  planGeometry,
  randomIds,
  wallsOnLevel,
  type Label,
  type Project,
} from "@prumo/core";
import { WallTool, architectManifest } from "@prumo/module-architect";
import { PlanView, fit, type PlanPointer, type ViewState } from "@prumo/renderer-2d";
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import { detectLocale, formatLength, formatSmall, translate, type Params } from "./i18n";

const locale = ref(detectLocale(navigator.languages));
const t = (key: string, params?: Params) => translate(locale.value, key, params);
const tl = (l: Label | null) => (l ? t(l.key, l.params) : "");

// Modules (ADR-020: bundled). Only Architect for now; it's required.
const modules = new ModuleHost([architectManifest]);
void modules;

const levelId = randomIds();
const history = new History(
  emptyProject({
    id: randomIds(),
    levelId,
    name: t("project.untitled"),
    now: new Date().toISOString(),
    profileId: "br-nbr/structural-masonry",
  }),
  { freeze: import.meta.env.DEV },
);

const project = shallowRef<Project>(history.current);
const tick = ref(0); // undo/redo availability changes without a model change on commit
history.subscribe((e) => {
  project.value = e.project;
  tick.value++;
});

const wallTool = new WallTool(history, {
  ids: randomIds,
  levelId,
  thickness: 140, // drawing default, editable later (slice 7); not a structural value
  height: history.current.levels[0]?.defaultWallHeight ?? 2700,
  alignment: "center",
  kind: "full",
  snap: DEFAULT_SNAP,
});

type ToolName = "select" | "wall";
const tool = ref<ToolName>("wall");
const hover = shallowRef(wallTool.hover);
const blocked = ref<string[]>([]);

const geometry = computed(() => planGeometry(project.value, levelId));
const walls = computed(() => wallsOnLevel(project.value, levelId));
const view = ref<ViewState>({ x: -2000, y: 6000, scale: 0.1 });
let fitted = false;

function onResize(w: number, h: number) {
  if (fitted) return;
  fitted = true;
  view.value = fit({ minX: -1000, minY: -1000, maxX: 9000, maxY: 7000 }, w, h, 0);
}
function fitAll() {
  const pts = walls.value.flatMap((w) => [w.start, w.end]);
  if (!pts.length) return;
  const el = document.querySelector(".canvas")?.getBoundingClientRect();
  if (!el) return;
  view.value = fit(
    {
      minX: Math.min(...pts.map((p) => p.x)),
      minY: Math.min(...pts.map((p) => p.y)),
      maxX: Math.max(...pts.map((p) => p.x)),
      maxY: Math.max(...pts.map((p) => p.y)),
    },
    el.width,
    el.height,
  );
}

function sync() {
  hover.value = wallTool.hover ? { ...wallTool.hover } : null;
  blocked.value = [...new Set(wallTool.blocked.map((p) => p.code))];
}

function onPointer(e: PlanPointer) {
  if (tool.value !== "wall") return;
  const info = { at: e.at, scale: e.scale, free: e.free };
  if (e.type === "move") wallTool.move(info);
  else if (e.type === "dblclick") wallTool.finish();
  else if (e.type === "down" && e.button === 0) wallTool.click(info);
  else if (e.type === "down" && e.button === 2) wallTool.finish();
  sync();
}

const labels = computed(() => {
  const a = wallTool.anchor;
  const h = hover.value;
  void project.value; // re-evaluate on model change
  if (!a || !h) return [];
  return [{ at: h.point, text: formatLength(dist(a, h.point), locale.value) }];
});

function undo() {
  if (wallTool.active) wallTool.finish();
  history.undo();
  sync();
}
function redo() {
  if (wallTool.active) wallTool.finish();
  history.redo();
  sync();
}
function setTool(n: ToolName) {
  if (wallTool.active) wallTool.finish();
  tool.value = n;
  hover.value = null;
}

const undoTip = computed(
  () => (void tick.value, history.undoLabel ? t("action.undo.tip", { label: tl(history.undoLabel) }) : ""),
);
const redoTip = computed(
  () => (void tick.value, history.redoLabel ? t("action.redo.tip", { label: tl(history.redoLabel) }) : ""),
);
// Based on the stack, not `history.canUndo`: mid-chain a gesture is open, and undo() ends it first.
const canUndo = computed(() => (void tick.value, history.undoLabel !== null));
const canRedo = computed(() => (void tick.value, history.redoLabel !== null));
const hint = computed(() => {
  void tick.value;
  void hover.value;
  if (tool.value === "select") return t("hint.select");
  return wallTool.active ? t("hint.wall.active") : t("hint.wall.idle");
});

function onKey(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === "z") {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
  } else if (mod && e.key.toLowerCase() === "y") {
    e.preventDefault();
    redo();
  } else if (e.key === "Escape" || e.key === "Enter") {
    if (wallTool.active) wallTool.finish();
    else if (e.key === "Escape") setTool("select");
    sync();
  } else if (!mod && e.key.toLowerCase() === "w") setTool("wall");
  else if (!mod && e.key.toLowerCase() === "v") setTool("select");
}
onMounted(() => window.addEventListener("keydown", onKey));

// Dev-only smoke path (?demo=room): draws an L-shaped room through the real wall tool, for screenshots.
if (import.meta.env.DEV && new URLSearchParams(location.search).get("demo") === "room") {
  const pts = [
    [0, 0],
    [6000, 0],
    [6000, 3000],
    [3000, 3000],
    [3000, 5000],
    [0, 5000],
    [0, 0],
  ] as const;
  for (const [x, y] of pts) wallTool.click({ at: { x, y }, scale: 0.1, free: false });
  wallTool.click({ at: { x: 3000, y: 0 }, scale: 0.1, free: false });
  wallTool.move({ at: { x: 3000, y: 2400 }, scale: 0.1, free: false });
  sync();
  onMounted(() => setTimeout(fitAll, 50));
}
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <div class="shell">
    <header class="toolbar">
      <strong class="brand">{{ t("app.name") }}</strong>
      <div class="group">
        <button :class="{ on: tool === 'select' }" :title="t('tool.select.tip')" @click="setTool('select')">
          {{ t("tool.select") }}
        </button>
        <button :class="{ on: tool === 'wall' }" :title="t('tool.wall.tip')" @click="setTool('wall')">
          {{ t("tool.wall") }}
        </button>
      </div>
      <div class="group">
        <button :disabled="!canUndo" :title="undoTip" @click="undo">↶ {{ t("action.undo") }}</button>
        <button :disabled="!canRedo" :title="redoTip" @click="redo">↷ {{ t("action.redo") }}</button>
      </div>
      <button @click="fitAll">{{ t("action.fit") }}</button>
      <span class="spacer" />
      <select v-model="locale" aria-label="Language">
        <option value="pt-BR">Português</option>
        <option value="en">English</option>
      </select>
    </header>

    <main class="canvas">
      <PlanView
        v-model:view="view"
        :geometry="geometry"
        :walls="walls"
        :hover="tool === 'wall' ? hover : null"
        :labels="labels"
        :grid="DEFAULT_SNAP.grid"
        @pointer="onPointer"
        @resize="onResize"
      />
      <p v-if="blocked.length" class="blocked">{{ blocked.map((c) => t(`problem.${c}`)).join(" ") }}</p>
    </main>

    <footer class="status">
      <span>{{ hint }}</span>
      <span class="spacer" />
      <span class="muted">{{ t("hint.pan") }}</span>
      <span>{{
        t("status.snap", { grid: formatSmall(DEFAULT_SNAP.grid, locale), angle: DEFAULT_SNAP.angleStepDeg })
      }}</span>
      <span>{{ t("status.walls", { count: walls.length }) }}</span>
    </footer>
    <div class="disclaimer">{{ t("footer") }}</div>
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-rows: auto 1fr auto auto;
  height: 100%;
}
.toolbar,
.status {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 6px 10px;
  background: var(--panel);
  border-bottom: 1px solid var(--line);
}
.status {
  border-top: 1px solid var(--line);
  border-bottom: none;
  font-size: 12px;
  white-space: nowrap;
}
.status > span {
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.brand {
  font-size: 15px;
}
.group {
  display: flex;
  gap: 4px;
}
.spacer {
  flex: 1;
}
.muted {
  color: var(--muted);
}
button {
  padding: 4px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  cursor: pointer;
}
button.on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
button:disabled {
  opacity: 0.45;
  cursor: default;
}
.canvas {
  position: relative;
  min-height: 0;
}
.blocked {
  position: absolute;
  left: 12px;
  bottom: 8px;
  margin: 0;
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--panel);
  color: var(--warn);
  border: 1px solid var(--line);
}
.disclaimer {
  padding: 2px 10px;
  font-size: 11px;
  color: var(--muted);
  background: var(--panel);
  border-top: 1px solid var(--line);
}
</style>
