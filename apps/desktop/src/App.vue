<script setup lang="ts">
// App shell (Phase 1): one level, room/wall/door/window/select tools, undo/redo, pan/zoom, files,
// start screen + examples, settings.
import {
  DEFAULT_SNAP,
  History,
  anchorOutsideWalls,
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
  copyToClipboard,
  hitTest,
  putCommand,
  type Note,
  offsetAlong,
  pasteCommand,
  pasteOpeningsCommand,
  type Clipboard,
  type V,
  mirrorCommand,
  rotateCommand,
  selectionBounds,
  selectionCentre,
  setGridCommand,
  setOutsideFacesCommand,
  handoffGuard,
  isHolder,
  compareLevel,
  type MirrorAxis,
  type Command,
  type Wall,
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
import {
  constructionSystem,
  diffFindings,
  profileIdFor,
  runChecks,
  ChaseTool,
  isChase,
  isProtection,
  protectCommand,
  protectionData,
  protectionsOn,
  unprotectCommand,
  setBonded,
  setContraverga,
  setLintel,
  setSystemCommand,
  setTieBeam,
  setWallRole,
  structuralManifest,
  type ChaseDir,
  type CheckResult,
  type ConstructionSystem,
  type FindingsDiff,
  type RoleOrigin,
  type WallEnd,
  type WallRole,
} from "@prumo/module-structural";
import { PlanView, fit, toScreen, type PlanPointer, type ViewState } from "@prumo/renderer-2d";
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import FindingsPanel from "./FindingsPanel.vue";
import HandoffDialog from "./HandoffDialog.vue";
import NotePopover from "./NotePopover.vue";
import NotesPanel from "./NotesPanel.vue";
import PropertiesPanel from "./PropertiesPanel.vue";
import RecoveryPanel from "./RecoveryPanel.vue";
import SettingsPanel from "./SettingsPanel.vue";
import StartScreen from "./StartScreen.vue";
import TourBubble, { type TourStep } from "./TourBubble.vue";
import { EXAMPLES, type Example } from "./examples";
import { platform } from "./platform";
import { PREFS_FILE, parsePrefs, serializePrefs, type LoadedPrefs } from "./prefs";
import { paramText } from "./structural-ui";
import { CRASH_LOG_FILE, appendEntry, issueUrl, makeEntry, osName, type CrashEntry } from "./crashlog";
import { AUTOSAVE_MS, type RecoveryEntry } from "./recovery";
import { Session, type Outcome } from "./session";
import { detectLocale, formatArea, formatLength, formatSmall, translate, type Params } from "./i18n";

const locale = ref(detectLocale(navigator.languages));
const t = (key: string, params?: Params) => translate(locale.value, key, params);
const tl = (l: Label | null) => (l ? t(l.key, l.params) : "");

// Modules (ADR-020: bundled). Only Architect for now; it's required.
const MANIFESTS = [architectManifest, structuralManifest];
const modules = new ModuleHost(MANIFESTS);
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
  // ADR-038 outside faces; ADR-044 hand-off lock (someone else holds the project → only notes change)
  { freeze: import.meta.env.DEV, normalize: anchorOutsideWalls, guard: handoffGuard(() => myName.value) },
);

const project = shallowRef<Project>(history.current);
// Remembered preferences (ADR-037). Loaded once at launch; written whenever one changes.
let prefs: LoadedPrefs = parsePrefs(null);
const newProject = () => {
  const p = emptyProject({
    id: randomIds(),
    levelId: randomIds(),
    name: t("project.untitled"),
    now: new Date().toISOString(),
    profileId: PROFILE,
  });
  const g = prefs.prefs.gridSize;
  return g ? { ...p, settings: { ...p.settings, gridSize: g } } : p;
};
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
const startBlank = (system: ConstructionSystem) =>
  startWith(() => {
    const p = newProject();
    session.begin({ ...p, profileId: profileIdFor(system) });
    return { ok: true };
  });
const startExample = (ex: Example) =>
  startWith(() => {
    const p = ex.build({ ids: randomIds, t, now: new Date().toISOString(), profileId: PROFILE });
    session.begin(p, t(ex.title));
    return { ok: true };
  });
const startOpen = () => startWith(() => session.open(true));

// Autosave + recovery (Q-111/126/129): a copy every 30 s while there are unsaved changes; at launch,
// copies left by a crash (or a quit without saving) are offered back.
const recoveries = ref<RecoveryEntry[]>([]);
if (!devDemo) void session.listRecovery().then((es) => (recoveries.value = es));
const autosaveTimer = setInterval(() => void session.autosave(), AUTOSAVE_MS);
onBeforeUnmount(() => clearInterval(autosaveTimer));
async function recoverEntry(e: RecoveryEntry) {
  let ok = false;
  await startWith(async () => {
    const r = await session.recover(e);
    ok = r.ok;
    return r;
  });
  if (ok) recoveries.value = []; // the others stay on disk and come back next launch
}
async function discardEntry(e: RecoveryEntry) {
  if (await session.discardRecovery(e)) recoveries.value = recoveries.value.filter((x) => x.key !== e.key);
}
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

/** Chase tool (Structural, R-WALL-004): where a wall gets cut for pipes or wiring. */
const chaseTool = new ChaseTool(history, {
  ids: randomIds,
  levelId: firstLevelId,
  dir: "horizontal",
  grid: DEFAULT_SNAP.grid,
});
const chaseDirection = ref<ChaseDir>("horizontal");
function setChaseDir(d: ChaseDir) {
  chaseTool.finish();
  chaseDirection.value = d;
  chaseTool.options = { ...chaseTool.options, dir: d };
  sync();
}

/** After New/Open the level ids change: point every tool at the project's first level. */
history.subscribe((e) => {
  if (e.project.levels.some((l) => l.id === level.value)) return;
  const first = e.project.levels[0];
  if (!first) return;
  level.value = first.id;
  for (const tl of [wallTool, openingTool, roomTool, selectTool, chaseTool])
    tl.options = { ...tl.options, levelId: first.id };
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
/** Room tool shape: rectangle (2 corners) or any shape (click every corner). */
const roomShape = ref<"rectangle" | "polygon">("rectangle");
function setRoomShape(s: "rectangle" | "polygon") {
  roomTool.finish();
  roomShape.value = s;
  roomTool.options = { ...roomTool.options, shape: s };
  sync();
}

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
  savePrefs({ gridSize: mm }); // the grid picked last becomes the default for new blank projects
}

let prefsLoaded = false;
const prefsReady = ref(false);
function savePrefs(change: LoadedPrefs["prefs"]) {
  prefs = { ...prefs, prefs: { ...prefs.prefs, ...change } };
  if (!prefsLoaded) return; // don't overwrite the file before it was read
  platform.writeAppText(PREFS_FILE, serializePrefs(prefs)).catch(() => {
    // not being able to remember a preference is not worth interrupting the user (logged in ADR-037)
  });
}
// Guided tour (Q-080): once, after the start screen (and any recovery question) is out of the way.
const TOUR: TourStep[] = ["room", "wall", "divider", "door", "select", "undo", "settings", "save"].map((id) => ({
  target: id,
  title: `tour.${id}.title`,
  text: `tour.${id}.text`,
}));
const showTour = ref(false);
function endTour() {
  showTour.value = false;
  savePrefs({ tourDone: true });
}
watch(
  () => [showStart.value, recoveries.value.length, prefsReady.value] as const,
  ([start, rec, ready]) => {
    if (!start && !rec && ready && !prefs.prefs.tourDone && !devDemo) showTour.value = true;
  },
);
void platform.readAppText(PREFS_FILE).then((text) => {
  const loaded = parsePrefs(text);
  prefs = { ...loaded, prefs: { ...loaded.prefs, ...prefs.prefs } }; // changes made while loading win
  prefsLoaded = true;
  prefsReady.value = true;
  if (prefs.prefs.locale) locale.value = prefs.prefs.locale;
  if (prefs.prefs.angleStepDeg) angleStep.value = prefs.prefs.angleStepDeg;
  if (prefs.prefs.structuralOff) structuralOn.value = false;
  if (prefs.prefs.name) myName.value = prefs.prefs.name;
  watch(structuralOn, (on) => savePrefs({ structuralOff: !on }));
  watch(locale, (l) => savePrefs({ locale: l }));
  watch(angleStep, (a) => savePrefs({ angleStepDeg: a }));
});

type ToolName = "select" | "room" | "wall" | "door" | "window" | "chase" | "note";
const tool = ref<ToolName>("room"); // ADR-031: the room tool is the default
const hover = shallowRef(wallTool.hover);
const blocked = ref<string[]>([]);
const tooShort = ref(false);

const geometry = computed(() => planGeometry(project.value, level.value));
const walls = computed(() => wallsOnLevel(project.value, level.value));

// --- Structural checks (Phase 2) ---------------------------------------------------------------
// Module manager stage 1 (ADR-020): Structural can be switched off in Settings → Modules (no UI, no
// checks; its data stays in the file). Quiet while creating (ADR-025): checks re-run only after an
// edit settles (not during a drag), with a short delay so findings don't flicker while working.
const structuralOn = ref(true);
const checks = shallowRef<CheckResult | null>(null);
const checksDiff = shallowRef<FindingsDiff | null>(null);
const SETTLE_MS = 1500;
let settleTimer: ReturnType<typeof setTimeout> | null = null;
function recheck(keepDiff = true) {
  if (!structuralOn.value) {
    checks.value = null;
    return;
  }
  const next = runChecks(history.current, level.value, { baseline: session.baselineProject() });
  checksDiff.value = keepDiff && checks.value ? diffFindings(checks.value.findings, next.findings) : null;
  checks.value = next;
}
function scheduleCheck(keepDiff: boolean) {
  if (settleTimer) clearTimeout(settleTimer);
  settleTimer = setTimeout(function fire() {
    if (history.inGesture) settleTimer = setTimeout(fire, SETTLE_MS);
    else recheck(keepDiff);
  }, SETTLE_MS);
}
history.subscribe((e) => {
  if (e.type === "commit") scheduleCheck(e.label.key !== "cmd.open");
});
watch(structuralOn, (on) => {
  if (!on && tool.value === "chase") setTool("select");
  recheck(false);
});
onBeforeUnmount(() => settleTimer && clearTimeout(settleTimer));
recheck(false);

/** A "!" over the element each finding is about (its first id). */
function protectionMid(e: Parameters<typeof protectionData>[0]): V | null {
  const d = protectionData(e);
  return d ? { x: (d.wall.start.x + d.wall.end.x) / 2, y: (d.wall.start.y + d.wall.end.y) / 2 } : null;
}
const badges = computed(() => {
  const c = checks.value;
  if (!c) return [];
  const p = project.value;
  const seen = new Set<string>();
  return c.findings.flatMap((f) => {
    const id = f.elementIds[0] ?? "";
    if (seen.has(id)) return [];
    seen.add(id);
    const e = p.elements[id];
    const wallOf = (w: Wall | undefined, along: number) => {
      if (!w) return null;
      const L = wallLength(w) || 1;
      return { x: w.start.x + ((w.end.x - w.start.x) * along) / L, y: w.start.y + ((w.end.y - w.start.y) * along) / L };
    };
    const at =
      e?.type === "wall"
        ? wallOf(e, wallLength(e) / 2)
        : e?.type === "opening"
          ? wallOf(p.elements[e.host.elementId] as Wall | undefined, e.host.offset + e.width / 2)
          : isChase(e)
            ? wallOf(p.elements[e.host.elementId] as Wall | undefined, e.host.offset + (e.host.length ?? 0) / 2)
            : isProtection(e)
              ? protectionMid(e)
              : null;
    return at ? [{ at, severity: f.severity, id }] : [];
  });
});
function selectFromCheck(ids: string[]) {
  setTool("select");
  selectTool.selection = ids.filter((id) => history.current.elements[id]).slice(0, 1);
  sync();
}
function setRole(wallId: string, role: WallRole | undefined, origin: RoleOrigin | undefined) {
  run(
    updateCommand({ key: "cmd.setRole" }, [wallId], (e) =>
      e.type === "wall" ? setWallRole(e, role, role ? (origin ?? "own-judgement") : undefined) : e,
    ),
  );
}
function setOpeningContraverga(id: string, has: boolean) {
  run(updateCommand({ key: "cmd.setContraverga" }, [id], (e) => (e.type === "opening" ? setContraverga(e, has) : e)));
}
function setWallTieBeam(id: string, has: boolean) {
  run(updateCommand({ key: "cmd.setTieBeam" }, [id], (e) => (e.type === "wall" ? setTieBeam(e, has) : e)));
}
function setWallBonded(id: string, end: WallEnd, bonded: boolean) {
  run(updateCommand({ key: "cmd.setBonded" }, [id], (e) => (e.type === "wall" ? setBonded(e, end, bonded) : e)));
}
// "Load-bearing, don't remove" markers (ADR-044 slice 2). Author = your name (may be unknown: "").
function protectWall(wallId: string) {
  const w = history.current.elements[wallId];
  if (w?.type === "wall") run(protectCommand(w, myName.value ?? "", new Date().toISOString(), randomIds()));
}
function protectAgain(protectionId: string) {
  const pr = history.current.elements[protectionId];
  const d = isProtection(pr) ? protectionData(pr) : null;
  if (d) protectWall(d.wallId);
}
function unprotect(protectionId: string) {
  run(unprotectCommand(protectionId));
}
const SAME_MM = 1; // drawing precision (same as R-PROT-001), not a structural value
/** Locks on protected walls; a protected wall that's gone or moved leaves a dashed ghost where it was. */
const protectionMarks = computed(() => {
  if (!structuralOn.value) return { locks: [], ghosts: [] };
  const p = project.value;
  const locks: { id: string; at: V; broken: boolean }[] = [];
  const ghosts: { id: string; a: V; b: V }[] = [];
  for (const pr of protectionsOn(p, level.value)) {
    const d = protectionData(pr);
    if (!d) continue;
    const w = p.elements[d.wallId];
    const same =
      w?.type === "wall" &&
      (w.kind === "full" || w.kind === "half") &&
      dist(w.start, d.wall.start) <= SAME_MM &&
      dist(w.end, d.wall.end) <= SAME_MM;
    const mid = (a: V, b: V) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    locks.push({ id: pr.id, at: mid(d.wall.start, d.wall.end), broken: !same });
    if (!same) ghosts.push({ id: pr.id, a: d.wall.start, b: d.wall.end });
  }
  return { locks, ghosts };
});
function setOpeningLintel(id: string, has: boolean) {
  run(updateCommand({ key: "cmd.setLintel" }, [id], (e) => (e.type === "opening" ? setLintel(e, has) : e)));
}
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
          : tool.value === "chase"
            ? []
            : openingTool.blocked;
  blocked.value = [...new Set(probs.map((p) => p.code))];
  tooShort.value = (tool.value === "door" || tool.value === "window") && openingTool.tooShort;
}

function endTools() {
  if (wallTool.active) wallTool.finish();
  roomTool.finish();
  openingTool.finish();
  chaseTool.finish();
  noteDraft.value = null;
  selectTool.cancel();
}

/** Run a command from the panel/keyboard; show why if the core refuses it (Q-072: blocked). */
function run(cmd: Command): boolean {
  endTools();
  notice.value = "";
  const r = history.execute(cmd);
  blocked.value = r.ok ? [] : [...new Set(r.problems.map((p) => p.code))];
  selectTool.prune();
  selection.value = [...selectTool.selection];
  return r.ok;
}
// --- Notes (ADR-044) -------------------------------------------------------------------------------
// The Note tool: click a spot (or a wall / door / window) → write the note. First time: asks your name.
const noteDraft = ref<{ at: V; targets: string[]; about: string | null } | null>(null);
const myName = ref<string | null>(null);
const noteSpot = computed(() => {
  const d = noteDraft.value;
  if (!d) return null;
  const q = toScreen(view.value, d.at);
  return { left: Math.max(8, q.x + 14), top: Math.max(8, q.y - 20) };
});
function startNote(at: V, scale: number) {
  const g = geometry.value;
  const hit = hitTest(g, at, 6 / scale);
  const e = hit ? history.current.elements[hit] : undefined;
  if (e?.type === "note") {
    setTool("select");
    selectTool.selection = [e.id];
    sync();
    return;
  }
  const about = e && e.type !== "room" ? paramText({ kind: "element", id: e.id }, history.current, locale.value) : null;
  noteDraft.value = { at, targets: e && about ? [e.id] : [], about };
}
function addNote(text: string, name: string) {
  const d = noteDraft.value;
  if (!d) return;
  if (name !== myName.value) {
    myName.value = name;
    savePrefs({ name });
  }
  const note: Note = {
    id: randomIds(),
    type: "note",
    levelId: level.value,
    text,
    author: name,
    createdAt: new Date().toISOString(),
    at: d.at,
    targets: d.targets,
    components: {},
  };
  noteDraft.value = null;
  if (run(putCommand({ key: "cmd.addNote" }, [note]))) {
    setTool("select");
    selectTool.selection = [note.id];
    sync();
  }
}
// --- Hand-off "baton" (ADR-044 slice 3) ---------------------------------------------------------------
const showHandoff = ref(false);
/** Someone else holds this project: you can look and leave notes (tools that edit are off). */
const notMyTurn = computed(() => !isHolder(project.value, myName.value));
const holder = computed(() => project.value.handoff?.holder ?? "");
async function sendHandoff(from: string, to: string, message: string) {
  showHandoff.value = false;
  if (from !== myName.value) setMyName(from);
  endTools();
  if (session.handOff({ from, to, ...(message ? { message } : {}) })) await doSave(false);
  setTool("select");
}
async function takeOver() {
  const name = myName.value;
  if (!name) {
    // who's taking over must be known (it's logged): set your name first
    notice.value = t("handoff.needName");
    showSettings.value = true;
    return;
  }
  if (await session.takeOver(name)) sync();
}
/** Tools that change the plan; off while it's not your turn. */
const EDIT_TOOLS: readonly ToolName[] = ["room", "wall", "door", "window", "chase"];
watch(notMyTurn, (locked) => {
  if (locked && EDIT_TOOLS.includes(tool.value)) setTool("select");
});

const levelNotes = computed(() =>
  Object.values(project.value.elements).filter((e): e is Note => e.type === "note" && e.levelId === level.value),
);
function selectNote(id: string) {
  setTool("select");
  selectTool.selection = [id];
  sync();
}
// --- Compare view (ADR-029 b): this plan vs a saved version in the file -------------------------------
const compareWith = ref<string | null>(null);
const snapshots = computed(() => (void tick.value, void fileTick.value, session.snapshotList()));
watch(fileTick, () => (compareWith.value = null)); // New / Open: the old file's versions are gone
const comparison = computed(() => {
  const before = compareWith.value ? session.snapshotProject(compareWith.value) : null;
  return before ? compareLevel(before, project.value, level.value) : null;
});
const compareName = computed(() => snapshots.value.find((x) => x.id === compareWith.value)?.name ?? "");
const whenShort = (iso: string) =>
  new Date(iso).toLocaleString(locale.value, { dateStyle: "short", timeStyle: "short" });

function setMyName(name: string) {
  myName.value = name;
  savePrefs({ name });
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

// Crash log (ADR-028 v1): errors go to a local log (scrubbed: no file names/paths/content); a quiet
// banner offers "Report on GitHub" with a pre-filled issue. Nothing is sent automatically.
const crash = ref<CrashEntry | null>(null);
const appVersion = ref("dev");
platform.appVersion().then(
  (v) => (appVersion.value = v),
  () => {},
);
let crashWrites = 0;
let lastCrash = "";
async function logCrash(err: unknown, kind: CrashEntry["kind"]) {
  try {
    const e = makeEntry(err, kind, {
      now: new Date().toISOString(),
      version: appVersion.value,
      os: osName(navigator.userAgent),
      modules: MANIFESTS.map((m) => `${m.id}@${m.version}`),
    });
    crash.value = e;
    if (e.message === lastCrash || ++crashWrites > 20) return; // a repeating error is written once
    lastCrash = e.message;
    await platform.writeAppText(CRASH_LOG_FILE, appendEntry(await platform.readAppText(CRASH_LOG_FILE), e));
  } catch {
    // the crash handler must never crash
  }
}
window.addEventListener("error", (ev) => void logCrash(ev.error ?? ev.message, "error"));
window.addEventListener("unhandledrejection", (ev) => void logCrash(ev.reason, "rejection"));
const vueApp = getCurrentInstance()?.appContext.config;
if (vueApp) vueApp.errorHandler = (err) => void logCrash(err, "vue");
async function reportCrash() {
  if (!crash.value) return;
  const url = issueUrl(crash.value);
  if (await platform.openUrl(url)) return;
  try {
    await navigator.clipboard.writeText(url);
    notice.value = t("crash.linkCopied");
  } catch {
    notice.value = t("crash.copyFailed");
  }
}
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

// Copy / Cut / Paste (EDITING_OPERATIONS "Copy"): app-internal clipboard, paste at the cursor.
let clipboard: Clipboard | null = null;
/** Last pointer position over the plan (model mm); null after it leaves → paste uses a fixed offset. */
let cursorAt: V | null = null;
function copySelection(cut: boolean) {
  // Cut takes only real elements (like Delete: cutting a room's walls would cut its neighbours too).
  const ids = cut ? selectTool.realIds() : selectTool.elementIds();
  if (!ids.length) return;
  clipboard = copyToClipboard(history.current, ids);
  if (cut) run(deleteCommand(history.current, ids));
  notice.value = t(cut ? "clip.cut" : "clip.copied", { count: ids.length });
}
function paste() {
  const clip = clipboard;
  if (!clip) return;
  endTools();
  if (clip.anchor) {
    const g = gridSize.value;
    const raw = cursorAt ? { x: cursorAt.x - clip.anchor.x, y: cursorAt.y - clip.anchor.y } : { x: 500, y: -500 };
    const delta = { x: Math.round(raw.x / g) * g + 0, y: Math.round(raw.y / g) * g + 0 };
    const r = pasteCommand(clip, delta, level.value, randomIds);
    if (run(r.command)) {
      setTool("select");
      selectTool.selection = r.newIds;
    }
  } else if (clip.loose.length) {
    // doors/windows alone: onto the wall under the cursor
    const hit = cursorAt ? hitTest(geometry.value, cursorAt, 8 / view.value.scale) : null;
    const w = hit ? history.current.elements[hit] : undefined;
    if (!cursorAt || w?.type !== "wall") {
      notice.value = t("clip.needWall");
      return;
    }
    const first = clip.loose[0]?.width ?? 0;
    const g = gridSize.value;
    const offset = Math.max(0, Math.round((offsetAlong(w, cursorAt) - first / 2) / g) * g);
    const r = pasteOpeningsCommand(clip, w, offset, randomIds);
    if (run(r.command)) {
      setTool("select");
      selectTool.selection = r.newIds;
    }
  }
  sync();
}

function onPointer(e: PlanPointer) {
  cursorAt = e.at;
  const info = { at: e.at, scale: e.scale, free: e.free };
  if (tool.value === "door" || tool.value === "window") {
    if (e.type === "move") openingTool.move(info);
    else if (e.type === "down" && e.button === 0) openingTool.click(info);
    sync();
    return;
  }
  if (tool.value === "note") {
    if (e.type === "down" && e.button === 0 && !noteDraft.value) startNote(e.at, e.scale);
    return;
  }
  if (tool.value === "chase") {
    if (e.type === "move") chaseTool.move(info);
    else if (e.type === "down" && e.button === 0) chaseTool.click(info);
    else if (e.type === "down" && e.button === 2) chaseTool.finish();
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
    else if (e.type === "down" && e.button === 2 && !roomTool.close()) roomTool.finish();
    else if (e.type === "dblclick") roomTool.close();
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
  if (tool.value === "chase") {
    void tick.value;
    const at = chaseTool.at;
    return at && chaseTool.length ? [{ at, text: formatLength(chaseTool.length, locale.value) }] : [];
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
/** The Divider button = the wall tool drawing room dividers (ADR-040: wall kind "separator"). */
const dividerMode = ref(false);
function setTool(n: ToolName, divider = false) {
  if (notMyTurn.value && EDIT_TOOLS.includes(n)) return; // keyboard shortcuts too (ADR-044)
  endTools();
  tool.value = n;
  dividerMode.value = n === "wall" && divider;
  wallTool.options = { ...wallTool.options, kind: dividerMode.value ? "separator" : "full" };
  if (n === "door" || n === "window") openingTool.options = { ...openingTool.options, kind: n };
  sync();
}
function onLeave() {
  cursorAt = null;
  if (tool.value === "door" || tool.value === "window") openingTool.finish();
  if (tool.value === "chase" && !chaseTool.active) chaseTool.finish();
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
  if (tool.value === "room" && roomShape.value === "polygon") {
    if (roomTool.crossing) return t("hint.roomShape.crossing");
    return roomTool.active ? t("hint.roomShape.active") : t("hint.roomShape.idle");
  }
  if (tool.value === "room") return roomTool.active ? t("hint.room.active") : t("hint.room.idle");
  if (tool.value === "note") return t("hint.note");
  if (tool.value === "chase")
    return chaseDirection.value === "vertical"
      ? t("hint.chase.vertical")
      : chaseTool.active
        ? t("hint.chase.active")
        : t("hint.chase.idle");
  if (tool.value === "door" || tool.value === "window")
    return tooShort.value ? t("hint.opening.tooShort", { kind: tool.value }) : t("hint.opening", { kind: tool.value });
  if (dividerMode.value) return wallTool.active ? t("hint.divider.active") : t("hint.divider.idle");
  return wallTool.active ? t("hint.wall.active") : t("hint.wall.idle");
});

function onKey(e: KeyboardEvent) {
  if (showTour.value && e.key === "Escape") {
    endTour();
    return;
  }
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
  } else if (mod && (e.key.toLowerCase() === "c" || e.key.toLowerCase() === "x") && tool.value === "select") {
    e.preventDefault();
    copySelection(e.key.toLowerCase() === "x");
  } else if (mod && e.key.toLowerCase() === "v") {
    e.preventDefault();
    paste();
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
    else if (roomTool.active && !(e.key === "Enter" && roomTool.close())) roomTool.finish();
    else if (chaseTool.active) chaseTool.finish();
    else if (e.key === "Escape") setTool("select");
    openingTool.finish();
    sync();
  } else if (!mod && e.key.toLowerCase() === "w") setTool("wall");
  else if (!mod && e.key.toLowerCase() === "q") setTool("room");
  else if (!mod && e.key.toLowerCase() === "l") setTool("wall", true);
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
if (demo === "tour") setTimeout(() => (showTour.value = true), 0);
if (demo === "shape") {
  // any-shape room in progress: an L with the pointer near the last corner
  setTool("room");
  setRoomShape("polygon");
  for (const [x, y] of [
    [0, 0],
    [6000, 0],
    [6000, 3000],
    [3000, 3000],
    [3000, 5000],
  ] as const)
    roomTool.click({ at: { x, y }, scale: 0.1, free: false });
  roomTool.move({ at: { x: 0, y: 5000 }, scale: 0.1, free: false });
  sync();
  setTimeout(fitAll, 0);
}
if (demo === "structure-panel") {
  const ex = EXAMPLES.find((e) => e.id === "problems");
  if (ex)
    void startExample(ex).then(() => {
      setTool("select");
      const w = Object.values(history.current.elements).find(
        (e) => e.type === "wall" && e.start.x === 5000 && e.end.y === 7000,
      );
      if (w) selectTool.selection = [w.id];
      sync();
      setTimeout(fitAll, 0);
    });
}
if (demo === "handoff" || demo === "handoff-dialog") {
  const ex = EXAMPLES.find((e) => e.id === "house");
  if (ex)
    void startExample(ex).then(() => {
      myName.value = "Ana";
      if (demo === "handoff") session.handOff({ from: "Ana", to: "Bruno", message: "Your turn" });
      else showHandoff.value = true;
      sync();
      setTimeout(fitAll, 0);
    });
}
if (demo === "protect") {
  const ex = EXAMPLES.find((e) => e.id === "house");
  if (ex)
    void startExample(ex).then(() => {
      myName.value = "Ana";
      const walls = Object.values(history.current.elements).filter((e): e is Wall => e.type === "wall");
      const inner = walls.find((w) => w.start.x === 5000 && w.end.x === 5000);
      const front = walls.find((w) => w.start.y === 0 && w.end.y === 0);
      if (inner) protectWall(inner.id);
      if (front) protectWall(front.id);
      if (inner) run(deleteCommand(history.current, [inner.id]));
      recheck(false);
      sync();
      setTimeout(fitAll, 0);
    });
}
if (demo === "note" || demo === "note-new" || demo === "notes-list") {
  const ex = EXAMPLES.find((e) => e.id === "house");
  if (ex)
    void startExample(ex).then(() => {
      const w = Object.values(history.current.elements).find((e) => e.type === "wall" && e.start.x === 5000);
      if (w?.type === "wall") {
        const at = { x: 5000, y: 5500 };
        run(
          putCommand({ key: "cmd.addNote" }, [
            {
              id: "demo-note",
              type: "note",
              levelId: level.value,
              text: "Can we open this wall into the kitchen? Ask the engineer first.",
              author: "Ana",
              createdAt: "2026-11-17T15:00:00.000Z",
              at,
              targets: [w.id],
              components: {},
            },
          ]),
        );
        setTool("select");
        selectTool.selection = ["demo-note"];
      }
      sync();
      setTimeout(fitAll, 0);
      if (demo === "notes-list") {
        selectTool.selection = [];
        sync();
      }
      if (demo === "note-new")
        setTimeout(() => {
          setTool("note");
          noteDraft.value = { at: { x: 2500, y: 2000 }, targets: [], about: null };
        }, 300);
    });
}
if (demo === "chase") {
  const ex = EXAMPLES.find((e) => e.id === "problems");
  if (ex)
    void startExample(ex).then(() => {
      setTool("select");
      const c = Object.values(history.current.elements).find(isChase);
      if (c) selectTool.selection = [c.id];
      sync();
      recheck(false);
      setTimeout(fitAll, 0);
    });
}
if (demo === "renovation" || demo === "compare") {
  const house = EXAMPLES.find((e) => e.id === "house");
  if (house)
    void startExample(house).then(() => {
      session.markBaseline();
      const els = Object.values(history.current.elements);
      const bath = els.find((e) => e.type === "wall" && e.start.x === 7000);
      const win = els.find((e) => e.type === "opening" && e.kind === "window" && e.width === 1500);
      if (bath) run(deleteCommand(history.current, [bath.id]));
      if (win)
        run(updateCommand({ key: "cmd.edit" }, [win.id], (e) => (e.type === "opening" ? { ...e, width: 2000 } : e)));
      if (demo === "compare") compareWith.value = history.current.settings.baseline ?? null;
      recheck(true);
      setTimeout(fitAll, 0);
    });
}
if (demo === "divider") {
  // open living room + kitchen: one 8 × 4 m box split by a divider at 5 m
  const P = (x: number, y: number) => ({ at: { x, y }, scale: 0.1, free: false });
  for (const [x, y] of [
    [0, 0],
    [8000, 0],
    [8000, 4000],
    [0, 4000],
    [0, 0],
  ] as const)
    wallTool.click(P(x, y));
  wallTool.finish();
  setTool("wall", true);
  wallTool.click(P(5000, 0));
  wallTool.click(P(5000, 4000));
  wallTool.finish();
  setTool("select");
  selectTool.down({ ...P(5000, 2000), additive: false });
  selectTool.up({ ...P(5000, 2000), additive: false });
  sync();
  setTimeout(fitAll, 0);
}
if (demo === "snap") {
  // gentle assists: a slanted wall, then a new wall from (0, 5000) hovering near the right-angle point
  setTool("wall");
  wallTool.click({ at: { x: 0, y: 0 }, scale: 0.1, free: true });
  wallTool.click({ at: { x: 4000, y: 3000 }, scale: 0.1, free: true });
  wallTool.finish();
  wallTool.click({ at: { x: 0, y: 5000 }, scale: 0.1, free: false });
  wallTool.move({ at: { x: 2430, y: 1840 }, scale: 0.1, free: false });
  sync();
  setTimeout(fitAll, 0);
}
if (demo === "crash") setTimeout(() => void logCrash(new TypeError("demo: cannot read wall of undefined"), "error"), 0);
if (demo === "recovery")
  recoveries.value = [
    { key: "a", name: "Casa da praia.prumo", path: null, savedAt: "2026-11-17T16:40:00.000Z" },
    { key: "b", name: "Sem título.prumo", path: null, savedAt: "" },
  ];
if (demo === "paste") {
  const house = EXAMPLES.find((e) => e.id === "house");
  if (house)
    void startExample(house).then(() => {
      setTool("select");
      selectTool.selectAll();
      copySelection(false);
      cursorAt = { x: 16000, y: 3500 };
      paste();
      setTimeout(fitAll, 0);
    });
}
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
        <button data-tour="save" :title="t('action.save.tip')" :disabled="!!readOnly" @click="doSave(false)">
          {{ t("action.save") }}
        </button>
        <select
          v-if="snapshots.length"
          class="compare"
          :title="t('compare.tip')"
          :value="compareWith ?? ''"
          @change="compareWith = ($event.target as HTMLSelectElement).value || null"
        >
          <option value="">{{ t("compare.off") }}</option>
          <option v-for="v in snapshots" :key="v.id" :value="v.id">{{ v.name }} · {{ whenShort(v.createdAt) }}</option>
        </select>
        <button :title="t('handoff.tip')" :disabled="!!readOnly || notMyTurn" @click="showHandoff = true">
          {{ t("handoff.button") }}
        </button>
      </div>
      <div class="group">
        <button
          data-tour="select"
          :class="{ on: tool === 'select' }"
          :title="t('tool.select.tip')"
          @click="setTool('select')"
        >
          {{ t("tool.select") }}
        </button>
        <button
          data-tour="room"
          :class="{ on: tool === 'room' }"
          :title="t('tool.room.tip')"
          :disabled="notMyTurn"
          @click="setTool('room')"
        >
          {{ t("tool.room") }}
        </button>
        <span v-if="tool === 'room'" class="seg" role="group" :aria-label="t('roomShape.label')">
          <button
            :class="{ on: roomShape === 'rectangle' }"
            :title="t('roomShape.rectangle.tip')"
            @click="setRoomShape('rectangle')"
          >
            ▭ {{ t("roomShape.rectangle") }}
          </button>
          <button
            :class="{ on: roomShape === 'polygon' }"
            :title="t('roomShape.polygon.tip')"
            @click="setRoomShape('polygon')"
          >
            ⬠ {{ t("roomShape.polygon") }}
          </button>
        </span>
        <button
          data-tour="wall"
          :class="{ on: tool === 'wall' && !dividerMode }"
          :title="t('tool.wall.tip')"
          :disabled="notMyTurn"
          @click="setTool('wall')"
        >
          {{ t("tool.wall") }}
        </button>
        <button
          :class="{ on: tool === 'wall' && dividerMode }"
          data-tour="divider"
          :title="t('tool.divider.tip')"
          :disabled="notMyTurn"
          @click="setTool('wall', true)"
        >
          {{ t("tool.divider") }}
        </button>
        <button
          data-tour="door"
          :class="{ on: tool === 'door' }"
          :title="t('tool.door.tip')"
          :disabled="notMyTurn"
          @click="setTool('door')"
        >
          {{ t("tool.door") }}
        </button>
        <button
          :class="{ on: tool === 'window' }"
          :title="t('tool.window.tip')"
          :disabled="notMyTurn"
          @click="setTool('window')"
        >
          {{ t("tool.window") }}
        </button>
        <button :class="{ on: tool === 'note' }" :title="t('tool.note.tip')" @click="setTool('note')">
          {{ t("tool.note") }}
        </button>
        <button
          v-if="structuralOn"
          :class="{ on: tool === 'chase' }"
          :title="t('tool.chase.tip')"
          :disabled="notMyTurn"
          @click="setTool('chase')"
        >
          {{ t("tool.chase") }}
        </button>
        <span v-if="tool === 'chase'" class="seg" role="group" :aria-label="t('chaseDir.label')">
          <button
            :class="{ on: chaseDirection === 'horizontal' }"
            :title="t('chaseDir.horizontal.tip')"
            @click="setChaseDir('horizontal')"
          >
            ⟷ {{ t("chaseDir.horizontal") }}
          </button>
          <button
            :class="{ on: chaseDirection === 'vertical' }"
            :title="t('chaseDir.vertical.tip')"
            @click="setChaseDir('vertical')"
          >
            ↕ {{ t("chaseDir.vertical") }}
          </button>
        </span>
      </div>
      <div class="group">
        <button data-tour="undo" :disabled="!canUndo" :title="undoTip" @click="undo">↶ {{ t("action.undo") }}</button>
        <button :disabled="!canRedo" :title="redoTip" @click="redo">↷ {{ t("action.redo") }}</button>
      </div>
      <button @click="fitAll">{{ t("action.fit") }}</button>
      <span class="spacer" />
      <button data-tour="settings" :title="t('action.settings.tip')" @click="showSettings = true">
        ⚙ {{ t("action.settings") }}
      </button>
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
        :badges="badges"
        :locks="protectionMarks.locks"
        :ghosts="protectionMarks.ghosts"
        :compare="comparison"
        :grid="gridSize"
        @pointer="onPointer"
        @resize="onResize"
        @leave="onLeave"
      />
      <NotePopover
        v-if="noteDraft && noteSpot"
        :locale="locale"
        :left="noteSpot.left"
        :top="noteSpot.top"
        :name="myName"
        :about="noteDraft.about"
        @add="addNote"
        @cancel="noteDraft = null"
      />
      <PropertiesPanel
        v-if="tool === 'select'"
        v-model:keep-original="keepOriginal"
        :project="project"
        :selection="selection"
        :locale="locale"
        :rooms="panelRooms"
        :wall-sides="wallSideLabels"
        :structural="structuralOn ? (checks?.system ?? null) : null"
        @role="setRole"
        @lintel="setOpeningLintel"
        @contraverga="setOpeningContraverga"
        @tie-beam="setWallTieBeam"
        @bonded="setWallBonded"
        @protect="protectWall"
        @unprotect="unprotect"
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
      <div v-if="crash" class="crash" role="status">
        <span>{{ t("crash.message") }}</span>
        <button @click="reportCrash">{{ t("crash.report") }}</button>
        <button @click="crash = null">{{ t("crash.dismiss") }}</button>
      </div>
      <div v-if="comparison" class="cmp-bar" role="status">
        <span>{{ t("compare.bar", { name: compareName }) }}</span>
        <span class="key added">{{ t("compare.added", { count: comparison.added.length }) }}</span>
        <span class="key changed">{{ t("compare.changed", { count: comparison.changed.length }) }}</span>
        <span class="key gone">{{ t("compare.gone", { count: comparison.gone.length }) }}</span>
        <button @click="compareWith = null">{{ t("compare.stop") }}</button>
      </div>
      <div v-if="notMyTurn" class="turn" role="status">
        <span>{{ t("handoff.banner", { name: holder }) }}</span>
        <button @click="takeOver">{{ t("handoff.takeOver") }}</button>
      </div>
      <HandoffDialog
        v-if="showHandoff"
        :locale="locale"
        :name="myName"
        @send="sendHandoff"
        @cancel="showHandoff = false"
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
      <TourBubble v-if="showTour" :locale="locale" :steps="TOUR" @done="endTour" />
      <RecoveryPanel
        v-if="recoveries.length"
        :locale="locale"
        :entries="recoveries"
        @recover="recoverEntry"
        @discard="discardEntry"
        @later="recoveries = []"
      />
      <NotesPanel
        v-if="!(tool === 'select' && selection.length)"
        :locale="locale"
        :notes="levelNotes"
        :selected="selection"
        @select="selectNote"
      />
      <FindingsPanel
        v-if="structuralOn && checks"
        :locale="locale"
        :project="project"
        :result="checks"
        :diff="checksDiff"
        :baseline="(void tick, session.baselineDate())"
        @mark="session.markBaseline()"
        @clear-baseline="session.clearBaseline()"
        @select="selectFromCheck"
        @protect-again="protectAgain"
        @unprotect="unprotect"
        @system="showSettings = true"
      />
      <SettingsPanel
        v-if="showSettings"
        :locale="locale"
        :grid="gridSize"
        :angle="angleStep"
        :outside-faces="project.settings.outsideFaces === true"
        :system="constructionSystem(project)"
        :structural="structuralOn"
        :name="myName"
        @name="setMyName"
        @system="(s) => run(setSystemCommand(s))"
        @structural="(on) => (structuralOn = on)"
        @grid="setGrid"
        @angle="(a) => (angleStep = a)"
        @outside-faces="(on) => run(setOutsideFacesCommand(on))"
        @tour="((showSettings = false), (showTour = true))"
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
      <span>{{ t("status.walls", { count: walls.filter((w) => w.kind !== "separator").length }) }}</span>
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
/* narrow windows: the toolbar wraps onto a second row instead of overflowing (row height is auto) */
.toolbar {
  flex-wrap: wrap;
  row-gap: 6px;
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
/* room shape toggle: a compact pair next to the Room button */
.seg {
  display: inline-flex;
}
.seg button {
  font-size: 12px;
  padding: 3px 8px;
}
.seg button:first-child {
  border-radius: 6px 0 0 6px;
}
.seg button:last-child {
  border-radius: 0 6px 6px 0;
  border-left: none;
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
.cmp-bar {
  position: absolute;
  top: 48px;
  left: 12px;
  right: 12px;
  margin: 0 auto;
  width: fit-content;
  max-width: calc(100% - 24px);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--panel);
  border: 1px solid var(--line);
  z-index: 6;
  font-size: 13px;
}
.cmp-bar .key::before {
  content: "";
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 4px;
  border-radius: 2px;
  vertical-align: -1px;
}
.cmp-bar .added::before {
  background: #4f8fe8;
}
.cmp-bar .changed::before {
  background: #e8a33d;
}
.cmp-bar .gone::before {
  border: 2px dashed var(--muted);
  width: 6px;
  height: 6px;
}
.cmp-bar button {
  padding: 2px 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  color: inherit;
  cursor: pointer;
  font: inherit;
}
select.compare {
  max-width: 150px;
}
.turn {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  max-width: calc(100% - 24px);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--panel);
  border: 1px solid var(--accent);
  z-index: 6;
  font-size: 13px;
}
.turn button {
  padding: 2px 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  color: inherit;
  cursor: pointer;
  font: inherit;
}
.crash {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  max-width: calc(100% - 24px);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--panel);
  border: 1px solid var(--warn);
  font-size: 13px;
  z-index: 5;
}
.crash button {
  padding: 2px 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--bg);
  color: inherit;
  cursor: pointer;
  font: inherit;
  white-space: nowrap;
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
