<script setup lang="ts">
// App shell (Phase 1): one level, room/wall/door/window/select tools, undo/redo, pan/zoom, files,
// start screen + examples, settings.
import {
  DEFAULT_SNAP,
  History,
  ModuleHost,
  dist,
  emptyProject,
  planGeometry,
  randomIds,
  wallsOnLevel,
  deleteCommand,
  detectRooms,
  editRoomCommand,
  faceOffsets,
  inside,
  updateCommand,
  matchRoomTags,
  nameRoomCommand,
  roomTags,
  wallLength,
  duplicateCommand,
  mirrorCommand,
  rotateCommand,
  selectionBounds,
  selectionCentre,
  setGridCommand,
  type MirrorAxis,
  type Command,
  type Label,
  type Project,
} from "@prumo/core";
import {
  DEFAULT_OPENING_SIZES,
  OpeningTool,
  ROOM_PREFIX,
  RoomTool,
  architectData,
  finishById,
  setRoomFloor,
  setRoomType,
  roomTypeKey,
  setWallSide,
  SelectTool,
  WallTool,
  architectManifest,
} from "@prumo/module-architect";
import { PlanView, fit, type PlanPointer, type ViewState } from "@prumo/renderer-2d";
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import PropertiesPanel from "./PropertiesPanel.vue";
import SettingsPanel from "./SettingsPanel.vue";
import StartScreen from "./StartScreen.vue";
import { EXAMPLES, type Example } from "./examples";
import { platform } from "./platform";
import { Session, type Outcome } from "./session";
import { detectLocale, formatArea, formatLength, formatSmall, translate, type Params } from "./i18n";

const locale = ref(detectLocale(navigator.languages));
const t = (key: string, params?: Params) => translate(locale.value, key, params);
const tl = (l: Label | null) => (l ? t(l.key, l.params) : "");

// Modules (ADR-020: bundled). Only Architect for now; it's required.
const modules = new ModuleHost([architectManifest]);
const PROFILE = "br-nbr/structural-masonry";

const firstLevelId = randomIds();
const history = new History(
  emptyProject({
    id: randomIds(),
    levelId: firstLevelId,
    name: t("project.untitled"),
    now: new Date().toISOString(),
    profileId: PROFILE,
  }),
  { freeze: import.meta.env.DEV },
);

const project = shallowRef<Project>(history.current);
const newProject = () =>
  emptyProject({
    id: randomIds(),
    levelId: randomIds(),
    name: t("project.untitled"),
    now: new Date().toISOString(),
    profileId: PROFILE,
  });
const session = new Session(history, modules, platform, t, newProject, randomIds, () => new Date().toISOString());
const fileTick = ref(0);
const readOnly = computed(() => (void fileTick.value, session.readOnly));
history.subscribe(() => void platform.setTitle(session.title));
void platform.setTitle(session.title);
platform.onCloseRequested(() => session.confirmDiscard());

async function file(op: () => Promise<Outcome>) {
  endTools();
  const r = await op();
  fileTick.value++;
  if (!r.ok && r.reason === "error") notice.value = r.message;
  else if (r.ok) notice.value = "";
  void platform.setTitle(session.title);
  sync();
  if (r.ok) setTimeout(fitAll, 0);
}
// Start screen (Q-119): at launch, and on New after the unsaved-changes question.
const devDemo = import.meta.env.DEV && new URLSearchParams(location.search).has("demo");
const showStart = ref(!devDemo);
const showSettings = ref(false);
async function doNew() {
  endTools();
  if (await session.confirmDiscard()) showStart.value = true;
}
const doOpen = () => file(() => session.open());
async function startWith(op: () => Promise<Outcome> | Outcome) {
  await file(async () => {
    const r = await op();
    if (r.ok) showStart.value = false;
    return r;
  });
}
const startBlank = () => startWith(() => (session.begin(), { ok: true }));
const startExample = (ex: Example) =>
  startWith(() => {
    const p = ex.build({ ids: randomIds, t, now: new Date().toISOString(), profileId: PROFILE });
    session.begin(p, t(ex.title));
    return { ok: true };
  });
const startOpen = () => startWith(() => session.open(true));
const doSave = (as = false) => file(() => session.save(as));
/** The level being edited (UI shows one level until Phase 5, ADR-015). Follows New/Open. */
const level = ref(firstLevelId);
const tick = ref(0); // undo/redo availability changes without a model change on commit
history.subscribe((e) => {
  project.value = e.project;
  tick.value++;
});
history.subscribe((e) => {
  if (e.type === "commit") {
    selectTool.prune();
    selection.value = [...selectTool.selection];
  }
});

const wallTool = new WallTool(history, {
  ids: randomIds,
  levelId: firstLevelId,
  thickness: 140, // drawing default, editable later (slice 7); not a structural value
  height: history.current.levels[0]?.defaultWallHeight ?? 2700,
  alignment: "center",
  kind: "full",
  snap: DEFAULT_SNAP,
});

const openingTool = new OpeningTool(history, {
  ids: randomIds,
  levelId: firstLevelId,
  kind: "door",
  sizes: DEFAULT_OPENING_SIZES,
  grid: DEFAULT_SNAP.grid,
  magnetPx: DEFAULT_SNAP.endpointRadiusPx,
});

/** After New/Open the level ids change: point every tool at the project's first level. */
history.subscribe((e) => {
  if (e.project.levels.some((l) => l.id === level.value)) return;
  const first = e.project.levels[0];
  if (!first) return;
  level.value = first.id;
  for (const tl of [wallTool, openingTool, roomTool, selectTool]) tl.options = { ...tl.options, levelId: first.id };
  selectTool.selection = [];
});

const selectTool = new SelectTool(history, { levelId: firstLevelId, grid: DEFAULT_SNAP.grid, dragPx: 4, pickPx: 6 });
const selection = ref<string[]>([]);
const box = shallowRef(selectTool.box);

const roomTool = new RoomTool(history, {
  ids: randomIds,
  levelId: firstLevelId,
  thickness: 140,
  height: history.current.levels[0]?.defaultWallHeight ?? 2700,
  alignment: "center",
  kind: "full",
  snap: DEFAULT_SNAP,
  minSide: 500, // smaller = probably a mis-click; drawing value, not a rule
});
const roomHover = shallowRef(roomTool.hover);

// Snap settings: grid = the project's (Q-108, saved + undoable); angle step = app preference.
const angleStep = ref(DEFAULT_SNAP.angleStepDeg);
const gridSize = computed(() => project.value.settings.gridSize);
const snap = computed(() => ({ ...DEFAULT_SNAP, grid: gridSize.value, angleStepDeg: angleStep.value }));
watch(
  snap,
  (s) => {
    wallTool.options = { ...wallTool.options, snap: s };
    roomTool.options = { ...roomTool.options, snap: s };
    openingTool.options = { ...openingTool.options, grid: s.grid };
    selectTool.options = { ...selectTool.options, grid: s.grid };
  },
  { immediate: true },
);
function setGrid(mm: number) {
  if (mm !== gridSize.value) run(setGridCommand(mm));
}

type ToolName = "select" | "room" | "wall" | "door" | "window";
const tool = ref<ToolName>("room"); // ADR-031: the room tool is the default
const hover = shallowRef(wallTool.hover);
const blocked = ref<string[]>([]);
const tooShort = ref(false);

const geometry = computed(() => planGeometry(project.value, level.value));
const walls = computed(() => wallsOnLevel(project.value, level.value));
const detected = computed(() => {
  const rs = detectRooms(project.value, level.value);
  const tags = matchRoomTags(rs, roomTags(project.value, level.value));
  return rs.map((r) => {
    const tag = tags.get(r.key);
    const data = tag ? architectData(tag) : {};
    // Label: the user's name, else the room type ("Quarto"), else nothing (area only).
    const typeKey = roomTypeKey(data.roomType);
    const label = tag?.name || (typeKey ? t(typeKey) : "");
    return { ...r, name: tag?.name ?? "", label, roomType: data.roomType ?? "", floorFinish: data.floor };
  });
});

// Painted faces (Architect finishes): a strip just inside each painted face, clipped by the renderer.
const faces = computed(() => {
  const inset = 2.5 / view.value.scale; // half the 5 px strip
  return walls.value.flatMap((w) => {
    const sides = architectData(w).sides ?? {};
    const len = wallLength(w);
    if (!len) return [];
    const u = { x: (w.end.x - w.start.x) / len, y: (w.end.y - w.start.y) / len };
    const n = { x: -u.y, y: u.x };
    const { l, r } = faceOffsets(w);
    const mid = (l + r) / 2;
    const ext = w.thickness * 2; // overshoot the ends; the clip trims to the joined shape
    return (["left", "right"] as const).flatMap((side) => {
      const f = finishById(sides[side]);
      if (!f) return [];
      const face = side === "left" ? l : r;
      const off = face + Math.sign(mid - face) * inset;
      const P = (s: number) => ({ x: w.start.x + u.x * s + n.x * off, y: w.start.y + u.y * s + n.y * off });
      return [{ key: `${w.id}:${side}`, wallId: w.id, line: [P(-ext), P(len + ext)] as const, color: f.color }];
    });
  });
});

/** What each side of the selected wall looks at, in plain words ("Sala", "outside"). */
const wallSideLabels = computed(() => {
  const id = selection.value.length === 1 ? selection.value[0] : undefined;
  const w = id ? project.value.elements[id] : undefined;
  if (w?.type !== "wall") return null;
  const len = wallLength(w);
  const u = { x: (w.end.x - w.start.x) / len, y: (w.end.y - w.start.y) / len };
  const n = { x: -u.y, y: u.x };
  const { l, r } = faceOffsets(w);
  const m = { x: (w.start.x + w.end.x) / 2, y: (w.start.y + w.end.y) / 2 };
  const look = (off: number) => {
    const q = { x: m.x + n.x * off, y: m.y + n.y * off };
    const room = detected.value.find((x) => inside(q, x.floor));
    return room ? room.label || formatArea(room.floorArea, locale.value) : t("finish.outside");
  };
  return { left: look(l + 200), right: look(r - 200) };
});
const rooms = computed(() =>
  detected.value.map((r) => ({
    key: r.key,
    floor: r.floor,
    at: r.labelAt,
    label: [r.label, formatArea(r.floorArea, locale.value)],
    selected: selection.value.includes(ROOM_PREFIX + r.key),
    ...(() => {
      const f = finishById(r.floorFinish);
      return f ? { fill: f.color } : {};
    })(),
  })),
);
const panelRooms = computed(() =>
  detected.value.map((r) => ({
    key: r.key,
    name: r.name,
    area: r.floorArea,
    floor: r.floorFinish ?? "",
    roomType: r.roomType,
  })),
);
function paintSide(wallId: string, side: "left" | "right", finishId: string) {
  run(
    updateCommand({ key: "cmd.paint" }, [wallId], (e) =>
      e.type === "wall" ? setWallSide(e, side, finishId || undefined) : e,
    ),
  );
}
function paintFloor(key: string, finishId: string) {
  run(
    editRoomCommand(
      history.current,
      level.value,
      key,
      { key: "cmd.paint" },
      (tg) => setRoomFloor(tg, finishId || undefined),
      randomIds,
    ),
  );
}
function typeRoom(key: string, typeId: string) {
  run(
    editRoomCommand(
      history.current,
      level.value,
      key,
      { key: "cmd.roomType" },
      (tg) => setRoomType(tg, typeId || undefined),
      randomIds,
    ),
  );
}
function nameRoom(key: string, name: string) {
  run(nameRoomCommand(history.current, level.value, key, name, randomIds));
}
const view = ref<ViewState>({ x: -2000, y: 6000, scale: 0.1 });
let fitted = false;

function onResize(w: number, h: number) {
  if (fitted) return;
  fitted = true;
  if (walls.value.length) fitAll();
  else view.value = fit({ minX: -1000, minY: -1000, maxX: 9000, maxY: 7000 }, w, h, 0);
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
  hover.value =
    tool.value === "wall" && wallTool.hover
      ? { ...wallTool.hover }
      : tool.value === "room" && roomTool.hover
        ? { point: roomTool.hover, kind: "grid" as const }
        : null;
  roomHover.value = roomTool.hover;
  selection.value = [...selectTool.selection];
  box.value = selectTool.box ? { ...selectTool.box } : null;
  const probs =
    tool.value === "wall"
      ? wallTool.blocked
      : tool.value === "select"
        ? selectTool.blocked
        : tool.value === "room"
          ? roomTool.blocked
          : openingTool.blocked;
  blocked.value = [...new Set(probs.map((p) => p.code))];
  tooShort.value = tool.value !== "wall" && openingTool.tooShort;
}

function endTools() {
  if (wallTool.active) wallTool.finish();
  roomTool.finish();
  openingTool.finish();
  selectTool.cancel();
}

/** Run a command from the panel/keyboard; show why if the core refuses it (Q-072: blocked). */
function run(cmd: Command) {
  endTools();
  notice.value = "";
  const r = history.execute(cmd);
  blocked.value = r.ok ? [] : [...new Set(r.problems.map((p) => p.code))];
  selectTool.prune();
  selection.value = [...selectTool.selection];
}
function deleteSelection() {
  if (!selectTool.realIds().length) return;
  run(deleteCommand(history.current, selectTool.realIds()));
}
function rotateSelection(deg: number) {
  const ids = selectTool.elementIds();
  const pivot = selectionCentre(history.current, ids, gridSize.value);
  if (pivot) run(rotateCommand(ids, pivot, deg));
}
const keepOriginal = ref(true); // EDITING_OPERATIONS default: mirror copy
const notice = ref("");
function mirrorSelection(axis: MirrorAxis) {
  const ids = selectTool.elementIds();
  const b = selectionBounds(history.current, ids);
  if (!b) return;
  // Copy: mirror about the selection's right/top edge so the copy sits beside it (edge walls shared).
  // In place: about the centre.
  const through = keepOriginal.value
    ? { x: b.maxX, y: b.maxY }
    : (selectionCentre(history.current, ids, gridSize.value) ?? { x: 0, y: 0 });
  const r = mirrorCommand(history.current, ids, axis, through, {
    copy: keepOriginal.value,
    newId: randomIds,
    mirrorComponent: modules.mirrorComponent,
  });
  run(r.command);
  if (r.newIds.length) selectTool.selection = r.newIds;
  notice.value = r.skipped.length ? t("mirror.skipped", { count: r.skipped.length }) : "";
  sync();
}
function duplicateSelection() {
  const ids = selectTool.elementIds();
  if (!ids.length) return;
  const g = 500; // 50 cm down-right (EDITING_OPERATIONS "fixed offset" default)
  const d = duplicateCommand(history.current, ids, { x: g, y: -g }, randomIds);
  run(d.command);
  if (d.newIds.length) selectTool.selection = d.newIds;
  sync();
}

function onPointer(e: PlanPointer) {
  const info = { at: e.at, scale: e.scale, free: e.free };
  if (tool.value === "door" || tool.value === "window") {
    if (e.type === "move") openingTool.move(info);
    else if (e.type === "down" && e.button === 0) openingTool.click(info);
    sync();
    return;
  }
  if (tool.value === "select") {
    if (e.button !== 0 && e.type !== "move") return;
    const sp = { ...info, additive: e.shift, detach: e.mod };
    if (e.type === "down") selectTool.down(sp);
    else if (e.type === "move") selectTool.move(sp);
    else if (e.type === "up") selectTool.up(sp);
    sync();
    return;
  }
  if (tool.value === "room") {
    if (e.type === "move") roomTool.move(info);
    else if (e.type === "down" && e.button === 0) roomTool.click(info);
    else if (e.type === "down" && e.button === 2) roomTool.finish();
    sync();
    return;
  }
  if (tool.value !== "wall") return;
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
  if (tool.value === "select") {
    // Dimensions of what's selected (ROADMAP Phase 1 "Dimensions displayed").
    const g = geometry.value;
    return selection.value.flatMap((id) => {
      const e = project.value.elements[id];
      if (e?.type === "wall") {
        const mid = { x: (e.start.x + e.end.x) / 2, y: (e.start.y + e.end.y) / 2 };
        return [{ at: mid, text: formatLength(wallLength(e), locale.value) }];
      }
      const o = g.openings.find((x) => x.id === id);
      if (e?.type === "opening" && o) {
        const c = o.cover.reduce((s, q) => ({ x: s.x + q.x / 4, y: s.y + q.y / 4 }), { x: 0, y: 0 });
        return [{ at: c, text: formatLength(e.width, locale.value) }];
      }
      return [];
    });
  }
  if (tool.value === "room") {
    const r = roomHover.value;
    if (!roomTool.size || !r) return [];
    return [
      {
        at: r,
        text: `${formatLength(roomTool.size.w, locale.value)} × ${formatLength(roomTool.size.h, locale.value)}`,
      },
    ];
  }
  if (!a || !h) return [];
  return [{ at: h.point, text: formatLength(dist(a, h.point), locale.value) }];
});

function undo() {
  endTools();
  history.undo();
  sync();
}
function redo() {
  endTools();
  history.redo();
  sync();
}
function setTool(n: ToolName) {
  endTools();
  tool.value = n;
  if (n === "door" || n === "window") openingTool.options = { ...openingTool.options, kind: n };
  sync();
}
function onLeave() {
  if (tool.value === "door" || tool.value === "window") openingTool.finish();
  sync();
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
  if (tool.value === "room") return roomTool.active ? t("hint.room.active") : t("hint.room.idle");
  if (tool.value === "door" || tool.value === "window")
    return tooShort.value ? t("hint.opening.tooShort", { kind: tool.value }) : t("hint.opening", { kind: tool.value });
  return wallTool.active ? t("hint.wall.active") : t("hint.wall.idle");
});

function onKey(e: KeyboardEvent) {
  if (showStart.value || showSettings.value) {
    // a dialog is open: only Esc (close it); the plan's shortcuts wait
    if (e.key === "Escape") {
      showSettings.value = false;
      showStart.value = false;
    }
    return;
  }
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === "z") {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
  } else if (mod && e.key.toLowerCase() === "y") {
    e.preventDefault();
    redo();
  } else if (mod && e.key.toLowerCase() === "s") {
    e.preventDefault();
    void doSave(e.shiftKey);
  } else if (mod && e.key.toLowerCase() === "o") {
    e.preventDefault();
    void doOpen();
  } else if (mod && e.key.toLowerCase() === "n") {
    e.preventDefault();
    void doNew();
  } else if (mod && e.key.toLowerCase() === "d") {
    e.preventDefault();
    duplicateSelection();
  } else if (mod && e.key.toLowerCase() === "a") {
    e.preventDefault();
    setTool("select");
    selectTool.selectAll();
    sync();
  } else if (!mod && e.key.toLowerCase() === "r" && tool.value === "select") {
    rotateSelection(e.shiftKey ? -90 : 90);
  } else if ((e.key === "Delete" || e.key === "Backspace") && tool.value === "select") {
    e.preventDefault();
    deleteSelection();
  } else if (e.key === "Escape" && tool.value === "select") {
    selectTool.cancel();
    selectTool.selection = [];
    sync();
  } else if (e.key === "Escape" || e.key === "Enter") {
    if (wallTool.active) wallTool.finish();
    else if (roomTool.active) roomTool.finish();
    else if (e.key === "Escape") setTool("select");
    openingTool.finish();
    sync();
  } else if (!mod && e.key.toLowerCase() === "w") setTool("wall");
  else if (!mod && e.key.toLowerCase() === "q") setTool("room");
  else if (!mod && e.key.toLowerCase() === "v") setTool("select");
  else if (!mod && e.key.toLowerCase() === "d") setTool("door");
  else if (!mod && e.key.toLowerCase() === "j") setTool("window");
}
onMounted(() => window.addEventListener("keydown", onKey));

// Dev-only smoke path (?demo=room): draws an L-shaped room through the real wall tool, for screenshots.
const demo = import.meta.env.DEV ? new URLSearchParams(location.search).get("demo") : null;
if (demo === "rooms" || demo === "names" || demo === "paint") {
  const c = (x: number, y: number) => roomTool.click({ at: { x, y }, scale: 0.1, free: false });
  c(0, 0);
  c(4000, 3000);
  c(4000, 0);
  c(7000, 3000);
  c(0, 3000);
  c(5000, 6000);
  setTool("door");
  openingTool.click({ at: { x: 4000, y: 1500 }, scale: 0.1, free: false });
  setTool("room");
  roomTool.click({ at: { x: 5000, y: 3000 }, scale: 0.1, free: false });
  roomTool.move({ at: { x: 7000, y: 5200 }, scale: 0.1, free: false });
  if (demo === "names" || demo === "paint") {
    roomTool.finish();
    const key = (x: number, y: number) =>
      detectRooms(history.current, level.value).find(
        (r) => r.floor.length && r.labelAt && Math.abs(r.labelAt.x - x) < 1500 && Math.abs(r.labelAt.y - y) < 1500,
      )?.key ?? "";
    nameRoom(key(2000, 1500), "Sala");
    nameRoom(key(2500, 4500), "Cozinha");
    setTool("select");
    const P = (x: number, y: number, additive = false) => ({ at: { x, y }, scale: 0.1, free: false, additive });
    if (demo === "paint") {
      paintFloor(key(2000, 1500), "floor-wood");
      paintFloor(key(2500, 4500), "floor-ceramic");
      const shared = Object.values(history.current.elements).find(
        (e) => e.type === "wall" && e.start.x === 4000 && e.end.x === 4000,
      );
      if (shared) {
        paintSide(shared.id, "left", "paint-blue");
        paintSide(shared.id, "right", "paint-terracotta");
        selectTool.selection = [shared.id];
      }
    } else {
      selectTool.down(P(2000, 4500));
      selectTool.up(P(2000, 4500));
      selectTool.down(P(5500, 0, true));
      selectTool.up(P(5500, 0, true));
    }
  }
  sync();
}
if (demo === "settings") showSettings.value = true;
if (demo?.startsWith("example-")) {
  const ex = EXAMPLES.find((e) => `example-${e.id}` === demo);
  if (ex) void startExample(ex);
}
if (demo === "room" || demo === "select" || demo === "mirror") {
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
  wallTool.click({ at: { x: 3000, y: 2400 }, scale: 0.1, free: false });
  wallTool.finish();
  for (const [kind, x, y] of [
    ["window", 1500, 0],
    ["window", 4500, 0],
    ["door", 3000, 1500],
    ["door", 1500, 5000],
    ["window", 6000, 1500],
  ] as const) {
    setTool(kind);
    openingTool.click({ at: { x, y }, scale: 0.1, free: false });
  }
  setTool("window");
  openingTool.move({ at: { x: 0, y: 2500 }, scale: 0.1, free: false });
  if (demo === "mirror") {
    setTool("select");
    selectTool.selectAll();
    mirrorSelection("vertical");
  }
  if (demo === "select") {
    setTool("select");
    const p = { at: { x: 3000, y: 1500 }, scale: 0.1, free: false, additive: false };
    selectTool.down(p);
    selectTool.up(p);
  }
  sync();
}
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <div class="shell">
    <header class="toolbar">
      <strong class="brand">{{ t("app.name") }}</strong>
      <div class="group">
        <button :title="t('action.new.tip')" @click="doNew">{{ t("action.new") }}</button>
        <button :title="t('action.open.tip')" @click="doOpen">{{ t("action.open") }}</button>
        <button :title="t('action.save.tip')" :disabled="!!readOnly" @click="doSave(false)">
          {{ t("action.save") }}
        </button>
      </div>
      <div class="group">
        <button :class="{ on: tool === 'select' }" :title="t('tool.select.tip')" @click="setTool('select')">
          {{ t("tool.select") }}
        </button>
        <button :class="{ on: tool === 'room' }" :title="t('tool.room.tip')" @click="setTool('room')">
          {{ t("tool.room") }}
        </button>
        <button :class="{ on: tool === 'wall' }" :title="t('tool.wall.tip')" @click="setTool('wall')">
          {{ t("tool.wall") }}
        </button>
        <button :class="{ on: tool === 'door' }" :title="t('tool.door.tip')" @click="setTool('door')">
          {{ t("tool.door") }}
        </button>
        <button :class="{ on: tool === 'window' }" :title="t('tool.window.tip')" @click="setTool('window')">
          {{ t("tool.window") }}
        </button>
      </div>
      <div class="group">
        <button :disabled="!canUndo" :title="undoTip" @click="undo">↶ {{ t("action.undo") }}</button>
        <button :disabled="!canRedo" :title="redoTip" @click="redo">↷ {{ t("action.redo") }}</button>
      </div>
      <button @click="fitAll">{{ t("action.fit") }}</button>
      <span class="spacer" />
      <button :title="t('action.settings.tip')" @click="showSettings = true">⚙ {{ t("action.settings") }}</button>
    </header>

    <main class="canvas">
      <PlanView
        v-model:view="view"
        :geometry="geometry"
        :walls="walls"
        :hover="tool === 'wall' || tool === 'room' ? hover : null"
        :rooms="rooms"
        :faces="faces"
        :selected-ids="selection"
        :box="box"
        :labels="labels"
        :grid="gridSize"
        @pointer="onPointer"
        @resize="onResize"
        @leave="onLeave"
      />
      <PropertiesPanel
        v-if="tool === 'select'"
        v-model:keep-original="keepOriginal"
        :project="project"
        :selection="selection"
        :locale="locale"
        :rooms="panelRooms"
        :wall-sides="wallSideLabels"
        @apply="run"
        @name="nameRoom"
        @paint-side="paintSide"
        @paint-floor="paintFloor"
        @room-type="typeRoom"
        @delete="deleteSelection"
        @duplicate="duplicateSelection"
        @rotate="rotateSelection"
        @mirror="mirrorSelection"
      />
      <p v-if="readOnly" class="blocked">{{ readOnly }}</p>
      <p v-if="notice" class="blocked">{{ notice }}</p>
      <p v-if="blocked.length" class="blocked">{{ blocked.map((c) => t(`problem.${c}`)).join(" ") }}</p>
      <StartScreen
        v-if="showStart"
        :locale="locale"
        :closable="true"
        @blank="startBlank"
        @example="startExample"
        @open="startOpen"
        @close="showStart = false"
      />
      <SettingsPanel
        v-if="showSettings"
        :locale="locale"
        :grid="gridSize"
        :angle="angleStep"
        @grid="setGrid"
        @angle="(a) => (angleStep = a)"
        @locale="(l) => (locale = l)"
        @close="showSettings = false"
      />
    </main>

    <footer class="status">
      <span :title="hint">{{ hint }}</span>
      <span class="spacer" />
      <span class="muted">{{ t("hint.pan") }}</span>
      <button class="link" :title="t('status.snap.tip')" @click="showSettings = true">
        {{ t("status.snap", { grid: formatSmall(gridSize, locale), angle: angleStep }) }}
      </button>
      <span>{{ t("status.walls", { count: walls.length }) }}</span>
    </footer>
    <div class="disclaimer">{{ t("footer") }}</div>
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-rows: auto 1fr auto auto;
  /* minmax(0, …): long no-wrap status text must not widen the canvas past the window */
  grid-template-columns: minmax(0, 1fr);
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
  overflow: hidden;
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
button.link {
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  color: inherit;
  text-decoration: underline dotted;
  cursor: pointer;
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
