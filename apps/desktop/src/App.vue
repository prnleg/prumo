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
  addLevelCommand,
  deleteLevelCommand,
  levelBelow,
  levelsByElevation,
  renameLevelCommand,
  type NewLevelStart,
  deleteCommand,
  detectRooms,
  isHosted,
  roomOwnWalls,
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
  type Opening,
  DOOR_STYLES,
  WINDOW_STYLES,
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
  buildingModel,
  wallSides,
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
  aboveOf,
  joistDirection,
  setAbove,
  SLAB_KINDS,
  SlabTool,
  setSlabInfo,
  slabInfo,
  type SlabKind,
  type SlabMode,
  STRUCTURAL,
  materialTable,
  wallLoads,
  lintelCheck,
  setLintelSize,
  type LintelSize,
  structuralPacks,
  setWallMaterial,
  type WallMaterial,
  type Above,
  type JoistDir,
  type ChaseDir,
  type CheckResult,
  type Finding,
  type ConstructionSystem,
  type FindingsDiff,
  type RoleOrigin,
  type WallEnd,
  type WallRole,
} from "@prumo/module-structural";
import { PlanView, fit, toScreen, type PlanPointer, type ViewState } from "@prumo/renderer-2d";
import { View3D, type Surface, type WallMode } from "@prumo/renderer-3d";
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import {
  Sun as SunIcon,
  ArrowDownToLine,
  ArrowUpToLine,
  Eye,
  Box,
  BrickWall,
  Columns2,
  Map as MapIcon,
  Cable,
  DoorOpen,
  GitCompare,
  Grid2x2,
  Layers as LayersIcon,
  Maximize,
  MessageSquare,
  MousePointer2,
  MoveHorizontal,
  MoveVertical,
  Pentagon,
  RectangleHorizontal,
  Redo2,
  Save,
  Send,
  SquareStack,
  Settings as SettingsIcon,
  SquareDashed,
  SquareSplitHorizontal,
  Undo2,
} from "@lucide/vue";
import FindingsPanel from "./FindingsPanel.vue";
import AddFloorDialog from "./AddFloorDialog.vue";
import LayersPanel from "./LayersPanel.vue";
import MenuBar, { type Menu } from "./MenuBar.vue";
import HandoffDialog from "./HandoffDialog.vue";
import ExportDialog, { type ExportOptions } from "./ExportDialog.vue";
import {
  drawNotesPage,
  drawSheet,
  layoutNotes,
  layoutSheet,
  PAPERS,
  pdfWithImages,
  type NotesInput,
} from "@prumo/module-export";
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
import { findingText, lintelText, paramText, unitWeightText, wallLoadText } from "./structural-ui";
import { CRASH_LOG_FILE, appendEntry, issueUrl, makeEntry, osName, type CrashEntry } from "./crashlog";
import { AUTOSAVE_MS, type RecoveryEntry } from "./recovery";
import { Session, type Outcome } from "./session";
import {
  detectLocale,
  formatArea,
  formatCm,
  formatLength,
  formatSmall,
  parseNumber,
  registerMessages,
  translate,
  type Params,
} from "./i18n";
import type { ModuleUi, UiContext, UiTool } from "@prumo/ui-api";
import { MODULE_UIS, OPTIONAL_MANIFESTS } from "./installed-modules";

// dev screenshots: ?lang=pt-BR forces the language (ignored in builds)
const devLang = import.meta.env.DEV ? new URLSearchParams(location.search).get("lang") : null;
const locale = ref(detectLocale(devLang ? [devLang] : navigator.languages));
const t = (key: string, params?: Params) => translate(locale.value, key, params);
const tl = (l: Label | null) => (l ? t(l.key, l.params) : "");

// Modules (ADR-020: bundled). Only Architect for now; it's required.
const MANIFESTS = [architectManifest, structuralManifest, ...OPTIONAL_MANIFESTS];
/**
 * Modules with a screen part (ADR-059). The app knows only this list: tools, plan symbols, panel
 * sections, strings and the Settings line all come from each module's `ModuleUi`.
 */
for (const m of MODULE_UIS) registerMessages(m.messages);
const modulesOn = ref<Record<string, boolean>>(Object.fromEntries(MODULE_UIS.map((m) => [m.moduleId, m.defaultOn])));
const activeUis = computed(() => MODULE_UIS.filter((m) => modulesOn.value[m.moduleId]));
/** A module tool's id in the tool strip: "mod:<module id>/<tool id>". */
type ModTool = `mod:${string}`;
const modToolId = (m: ModuleUi, toolId: string): ModTool => `mod:${m.moduleId}/${toolId}`;
const isModTool = (n: string): n is ModTool => n.startsWith("mod:");
/** Module tool instances, created on first use. */
const modTools = new Map<string, UiTool>();
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

// --- slab tool (ADR-050): cover rooms, or draw an outline -------------------------------------------
const slabTool = new SlabTool(history, {
  ids: randomIds,
  levelId: firstLevelId,
  mode: "rooms",
  grid: DEFAULT_SNAP.grid,
  snapPx: DEFAULT_SNAP.endpointRadiusPx,
});
const slabMode = ref<SlabMode>("rooms");
/** Type for new slabs; "" = don't know. */
const slabNewKind = ref<SlabKind | "">("");
const slabPreview = shallowRef<V[][]>([]);
const slabPicked = ref<string[]>([]);
function setSlabMode(m: SlabMode) {
  slabTool.cancel();
  slabMode.value = m;
  slabTool.options = { ...slabTool.options, mode: m };
  sync();
}
function setSlabNewKind(k: SlabKind | "") {
  slabNewKind.value = k;
  const o = { ...slabTool.options };
  delete o.kind;
  slabTool.options = k ? { ...o, kind: k } : o;
}
function finishSlab() {
  slabTool.finish();
  sync();
}
function editSlab(id: string, info: { kind?: SlabKind; joists?: JoistDir; thickness?: number }) {
  run(updateCommand({ key: "cmd.editSlab" }, [id], (e) => (e.type === "slab" ? setSlabInfo(e, info) : e)));
}
function setChaseDir(d: ChaseDir) {
  chaseTool.finish();
  slabTool.cancel();
  chaseDirection.value = d;
  chaseTool.options = { ...chaseTool.options, dir: d };
  sync();
}

/** After New/Open (or undoing "add floor") the level is gone: go to the lowest floor. */
history.subscribe((e) => {
  if (e.project.levels.some((l) => l.id === level.value)) return;
  const first = levelsByElevation(e.project)[0];
  if (first) pointToolsAt(first.id, first.defaultWallHeight);
});
function pointToolsAt(id: string, wallHeight: number) {
  level.value = id;
  for (const tl of [openingTool, selectTool, chaseTool, slabTool]) tl.options = { ...tl.options, levelId: id };
  wallTool.options = { ...wallTool.options, levelId: id, height: wallHeight };
  roomTool.options = { ...roomTool.options, levelId: id, height: wallHeight };
  selectTool.selection = [];
}

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
  if (prefs.prefs.locale && !devLang) locale.value = prefs.prefs.locale;
  if (prefs.prefs.angleStepDeg) angleStep.value = prefs.prefs.angleStepDeg;
  if (prefs.prefs.structuralOff) structuralOn.value = false;
  if (prefs.prefs.modules) modulesOn.value = { ...modulesOn.value, ...prefs.prefs.modules };
  if (prefs.prefs.name) myName.value = prefs.prefs.name;
  watch(structuralOn, (on) => savePrefs({ structuralOff: !on }));
  watch(modulesOn, (m) => savePrefs({ modules: m }));
  watch(locale, (l) => savePrefs({ locale: l }));
  watch(angleStep, (a) => savePrefs({ angleStepDeg: a }));
});

type ToolName = "select" | "room" | "wall" | "door" | "window" | "chase" | "note" | "slab" | ModTool;
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
const badges = computed(() => badgePoints(checks.value?.findings ?? []));
/** Where each finding's "!" goes: on the element it's about (first id); one per element. */
function badgePoints(findings: readonly Finding[]) {
  const p = project.value;
  const seen = new Set<string>();
  return findings.flatMap((f) => {
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
}
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
function setMaterial(id: string, m: WallMaterial | undefined) {
  run(updateCommand({ key: "cmd.material" }, [id], (e) => (e.type === "wall" ? setWallMaterial(e, m) : e)));
}
function setOpeningLintelSize(id: string, size: LintelSize) {
  run(updateCommand({ key: "cmd.setLintel" }, [id], (e) => (e.type === "opening" ? setLintelSize(e, size) : e)));
}
function setOpeningLintel(id: string, has: boolean) {
  run(updateCommand({ key: "cmd.setLintel" }, [id], (e) => (e.type === "opening" ? setLintel(e, has) : e)));
}
const detected = computed(() => detectedOn(level.value));
/** Rooms of one floor with their labels (the plan, the export). */
function detectedOn(levelId: string) {
  const rs = detectRooms(project.value, levelId);
  const tags = matchRoomTags(rs, roomTags(project.value, levelId));
  return rs.map((r) => {
    const tag = tags.get(r.key);
    const data = tag ? architectData(tag) : {};
    // Label: the user's name, else the room type ("Quarto"), else nothing (area only).
    const typeKey = roomTypeKey(data.roomType);
    const label = tag?.name || (typeKey ? t(typeKey) : "");
    const up = tag ? aboveOf(tag) : { above: null, joists: null };
    return { ...r, name: tag?.name ?? "", label, roomType: data.roomType ?? "", floorFinish: data.floor, ...up };
  });
}

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
  detected.value
    .filter((r) => !hiddenRooms.value.has(r.key))
    .map((r) => ({
      key: r.key,
      floor: r.floor,
      at: r.labelAt,
      label: [r.label, formatArea(r.floorArea, locale.value)],
      selected: selection.value.includes(ROOM_PREFIX + r.key) || slabPicked.value.includes(r.key),
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
    above: r.above,
    joists: r.joists,
    coveredBySlab: geometry.value.slabs.some((g) => inside(r.labelAt, g.outline)),
  })),
);
// --- modules' screen parts (ADR-059) ---------------------------------------------------------------
const uiCtx = computed<UiContext>(() => ({
  project: project.value,
  level: level.value,
  selection: selection.value,
  locale: locale.value,
  rooms: detected.value.map((r) => ({
    key: r.key,
    label: r.label,
    floor: r.floor,
    floorArea: r.floorArea,
    labelAt: r.labelAt,
  })),
  grid: gridSize.value,
  history,
  ids: randomIds,
  t: (k, p) => t(k, p),
  run,
  formatLength: (mm) => formatLength(mm, locale.value),
  formatArea: (mm2) => formatArea(mm2, locale.value),
  formatCm: (mm) => formatCm(mm, locale.value),
  parseNumber: (text) => parseNumber(text, locale.value),
}));
const moduleMarks = computed(() => activeUis.value.flatMap((m) => m.marks?.(uiCtx.value) ?? []));
const moduleLinks = computed(() => activeUis.value.flatMap((m) => m.links?.(uiCtx.value) ?? []));
/** The panel a module draws for the selected element (one element of one of its types). */
const modulePanel = computed(() => {
  if (selection.value.length !== 1) return null;
  const e = project.value.elements[selection.value[0] ?? ""];
  return (e && activeUis.value.find((m) => m.elementTypes?.includes(e.type))?.elementPanel) ?? null;
});
const moduleRoomPanels = computed(() => activeUis.value.flatMap((m) => (m.roomPanel ? [m.roomPanel] : [])));
const moduleToggles = computed(() =>
  MODULE_UIS.map((m) => ({ id: m.moduleId, name: m.name, on: !!modulesOn.value[m.moduleId] })),
);
function setModuleOn(id: string, on: boolean) {
  modulesOn.value = { ...modulesOn.value, [id]: on };
  if (!on && isModTool(tool.value) && tool.value.startsWith(`mod:${id}/`)) setTool("select");
}

// --- data packs (ADR-049): bundled with the Structural module; values shown with their source ---------
const packs = structuralPacks();
const packValues = computed(() =>
  materialTable(packs, project.value).map((r) => {
    const label = t(`material.${r.material}`);
    if (!r.unitWeight) return { key: r.material, label, text: null, review: "", from: "" };
    const w = unitWeightText(r.unitWeight, locale.value, packs.name(STRUCTURAL, r.unitWeight.pack, locale.value));
    return { key: r.material, label, ...w };
  }),
);

/** Drawn slabs on this floor (structure on): outline + badge; selected ones highlighted. */
const slabMarks = computed(() => {
  if (!structuralOn.value) return [];
  return geometry.value.slabs.map((g) => {
    const e = project.value.elements[g.id];
    const kind = e?.type === "slab" ? slabInfo(e).kind : null;
    return {
      id: g.id,
      outline: g.outline,
      at: g.at,
      label: kind ? t(`slabKind.${kind}.short`) : t("slab.badge"),
      selected: selection.value.includes(g.id),
    };
  });
});

/** The selected wall's load (ADR-051), structure on only; computed for the one wall shown. */
const selectedLoad = computed(() => {
  if (!structuralOn.value || selection.value.length !== 1) return null;
  const id = selection.value[0] ?? "";
  const w = project.value.elements[id];
  if (w?.type !== "wall") return null;
  const L = wallLoads(project.value, level.value, packs).get(id);
  if (!L) return null;
  return wallLoadText(L, locale.value, slabOrRoomName);
});
function slabOrRoomName(ref: string) {
  if (ref.startsWith("slab:")) return t("slab.badge");
  if (ref.startsWith("level:")) return floorName(project.value, ref.slice(6));
  const r = detected.value.find((x) => x.key === ref.slice(5));
  return r ? r.label || formatArea(r.floorArea, locale.value) : t("finish.outside");
}

/** The selected opening's lintel (ADR-052), structure on only. */
const selectedLintel = computed(() => {
  if (!structuralOn.value || selection.value.length !== 1) return null;
  const o = project.value.elements[selection.value[0] ?? ""];
  if (o?.type !== "opening") return null;
  const c = lintelCheck(project.value, o, wallLoads(project.value, level.value, packs).get(o.host.elementId), packs);
  return c ? lintelText(c, locale.value, slabOrRoomName) : null;
});

// --- floors (ADR-048) ------------------------------------------------------------------------------
/** Generated names follow the floor's place from the bottom: Ground floor, Floor 1, Floor 2… */
function floorName(p: Project, id: string): string {
  const ls = levelsByElevation(p);
  const i = ls.findIndex((l) => l.id === id);
  const l = ls[i];
  return l?.name ?? (i <= 0 ? t("level.ground") : t("level.n", { n: i }));
}
/** Top floor first, like the building. */
const floorList = computed(() =>
  levelsByElevation(project.value)
    .reverse()
    .map((l) => ({ id: l.id, name: floorName(project.value, l.id) })),
);
const currentFloorName = computed(() => floorName(project.value, level.value));
const showAddFloor = ref(false);
const showBelow = ref(true);
// --- 3D view (ADR-053): "Plan | 3D" switch, plus side by side (drag the grip / divider) ---------------
type ViewMode = "plan" | "3d";
const viewMode = ref<ViewMode>("plan");
const split = ref(false);
/** Where the divider sits, as a fraction of the canvas width (plan on the left). */
const splitAt = ref(0.5);
const show3d = computed(() => split.value || viewMode.value === "3d");
const showPlan = computed(() => split.value || viewMode.value === "plan");
const fit3d = ref(0);
const darkQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
const prefersDark = ref(darkQuery?.matches ?? false);
darkQuery?.addEventListener?.("change", (e) => (prefersDark.value = e.matches));
const EMPTY_MODEL = { solids: [], shells: [] };
const model3d = computed(() =>
  show3d.value ? buildingModel(project.value, { slabThickness: (s) => slabInfo(s).thickness }) : EMPTY_MODEL,
);
/** Walls of the floor being edited in 3D (ADR-054): low / see inside (default) / full. */
const wallMode = ref<WallMode>("cutaway");
const WALL_MODES = [
  { id: "low", icon: ArrowDownToLine },
  { id: "cutaway", icon: Eye },
  { id: "full", icon: ArrowUpToLine },
] as const;
/**
 * Sun by time of day (ADR-057): approximate — north = the top of the plan, no date or place. 6 h rises
 * in the east, 18 h sets in the west; at noon it stands to the north (southern hemisphere, Brazil
 * profiles) or to the south, at 60° up.
 */
const sunHour = ref(10);
const sun3d = computed(() => {
  const t = ((Math.min(18, Math.max(6, sunHour.value)) - 6) / 12) * Math.PI; // 0 … π
  const south = project.value.profileId.startsWith("br");
  return {
    azimuth: south ? Math.PI / 2 - t : Math.PI / 2 + t,
    elevation: Math.max((5 * Math.PI) / 180, ((60 * Math.PI) / 180) * Math.sin(t)),
  };
});
const sunLabel = computed(() => {
  const h = Math.floor(sunHour.value);
  return `${h}:${sunHour.value % 1 ? "30" : "00"}`;
});
const levelsAbove = computed(() => {
  const here = project.value.levels.find((l) => l.id === level.value)?.elevation ?? 0;
  return project.value.levels.filter((l) => l.elevation > here).map((l) => l.id);
});
/** Each wall face's finish as a 3D surface (colour + pattern). */
const faces3d = computed(() => {
  const out: Record<string, { left?: Surface; right?: Surface }> = {};
  if (!show3d.value) return out;
  const surf = (id: string | undefined): Surface | undefined => {
    const f = finishById(id);
    return f ? { color: parseInt(f.color.slice(1), 16), pattern: f.pattern ?? "plain" } : undefined;
  };
  for (const e of Object.values(project.value.elements)) {
    if (e.type !== "wall") continue;
    const sides = architectData(e).sides ?? {};
    const l = surf(sides.left);
    const r = surf(sides.right);
    if (l || r) out[e.id] = { ...(l ? { left: l } : {}), ...(r ? { right: r } : {}) };
  }
  return out;
});
const selection3d = computed(() =>
  selection.value.map((id) =>
    id.startsWith(ROOM_PREFIX) ? `room:${level.value}:${id.slice(ROOM_PREFIX.length)}` : id,
  ),
);
/** Findings in 3D (Phase 4): worst severity per element; chases / protections light up their wall. */
const marks3d = computed(() => {
  const out: Record<string, "critical" | "warning" | "advisory" | "info"> = {};
  const order = { critical: 0, warning: 1, advisory: 2, info: 3 } as const;
  // like the plan's "!" badges: the element each finding is about (its first id)
  for (const f of checks.value?.findings ?? [])
    for (const id of f.elementIds.slice(0, 1)) {
      const e = project.value.elements[id];
      const target = isChase(e) ? e.host.elementId : isProtection(e) ? (protectionData(e)?.wallId ?? id) : id;
      const cur = out[target];
      if (!cur || order[f.severity] < order[cur]) out[target] = f.severity;
    }
  return out;
});
/** A click in 3D selects in the plan too (switching floor if needed). */
function pick3d(id: string | null) {
  if (tool.value !== "select") setTool("select");
  let target = id;
  let lv: string | undefined;
  if (id?.startsWith("room:")) {
    const [, l = "", ...key] = id.split(":");
    lv = l;
    target = ROOM_PREFIX + key.join(":");
  } else if (id) lv = project.value.elements[id]?.levelId;
  if (lv && lv !== level.value) setLevel(lv);
  selectTool.selection = target ? [target] : [];
  sync();
}
function setViewMode(m: ViewMode) {
  viewMode.value = m;
  split.value = false;
  if (m === "3d") fit3d.value++;
}
// the plan pane changes width: frame the plan again, and the 3D view
watch(split, () =>
  setTimeout(() => {
    fitAll();
    fit3d.value++;
  }, 60),
);
function toggleSplit() {
  split.value = !split.value;
  splitAt.value = 0.5;
}
const canvasEl = ref<HTMLElement>();
/** Drag the grip (or the divider) sideways; a plain click on the grip opens side by side at half. */
function startSplitDrag(e: PointerEvent) {
  const el = canvasEl.value;
  if (!el || e.button !== 0) return;
  e.preventDefault();
  const r = el.getBoundingClientRect();
  const x0 = e.clientX;
  let f = splitAt.value;
  let moved = false;
  const move = (ev: PointerEvent) => {
    if (!moved && Math.abs(ev.clientX - x0) < 4) return;
    moved = true;
    f = (ev.clientX - r.left) / r.width;
    split.value = true;
    splitAt.value = Math.min(0.85, Math.max(0.15, f));
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    if (!moved) {
      if (!split.value) toggleSplit();
      return;
    }
    // dragged to an edge: that side's view takes the whole canvas
    if (f < 0.1) setViewMode("3d");
    else if (f > 0.9) setViewMode("plan");
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

function setLevel(id: string) {
  const l = project.value.levels.find((x) => x.id === id);
  if (!l || id === level.value) return;
  endTools();
  pointToolsAt(id, l.defaultWallHeight);
  hiddenRooms.value = new Set();
  sync();
  recheck(false);
}
function addFloor(name: string, height: number, start: NewLevelStart) {
  showAddFloor.value = false;
  const id = randomIds();
  // the suggested name stays generated (null), so it follows the language
  const suggested = t("level.n", { n: levelsByElevation(project.value).length });
  const cmd = addLevelCommand(history.current, {
    id,
    name: name && name !== suggested ? name : null,
    below: level.value,
    height,
    start,
    newId: randomIds,
  });
  if (run(cmd)) setLevel(id);
}
function renameLevel(id: string, name: string) {
  if (name.trim() === floorName(project.value, id)) return;
  run(renameLevelCommand(id, name));
}
async function deleteLevel(id: string) {
  const count = Object.values(project.value.elements).filter((e) => e.levelId === id).length;
  const yes = await platform.ask(t("floor.delete.message", { name: floorName(project.value, id), count }), {
    title: t("floor.delete.title"),
    ok: t("floor.delete"),
    cancel: t("handoff.take.cancel"),
  });
  if (!yes) return;
  const was = level.value;
  if (run(deleteLevelCommand(id)) && id === was) {
    const first = levelsByElevation(history.current)[0];
    if (first) setLevel(first.id);
  }
}
/** The floor below, faded under the plan (owner: yes, toggle in View). Not pickable: it's only drawn. */
const ghostBelow = computed(() => {
  const below = showBelow.value ? levelBelow(project.value, level.value) : null;
  return below ? planGeometry(project.value, below.id).walls.map((w) => w.polygon) : [];
});

// --- layers panel (Q-141): hidden rooms are view state only (not saved, not undoable) ------------
const showLayers = ref(false);
const hiddenRooms = ref<ReadonlySet<string>>(new Set());
const roomList = computed(() => detectRooms(project.value, level.value));
/** Ids that are dimmed and can't be picked: hidden rooms' own walls + what sits on them + the rooms. */
const hiddenIds = computed<ReadonlySet<string>>(() => {
  const rs = roomList.value;
  const walls = new Set(rs.filter((r) => hiddenRooms.value.has(r.key)).flatMap((r) => roomOwnWalls(rs, r.key)));
  const out = new Set<string>(walls);
  for (const e of Object.values(project.value.elements)) if (isHosted(e) && walls.has(e.host.elementId)) out.add(e.id);
  for (const k of hiddenRooms.value) out.add(ROOM_PREFIX + k);
  return out;
});
watch(hiddenIds, (h) => {
  selectTool.options = { ...selectTool.options, hidden: h };
  selectTool.selection = selectTool.selection.filter((id) => !h.has(id));
  sync();
});
const layerRooms = computed(() =>
  detected.value
    .map((r) => ({
      key: r.key,
      label: r.label || formatArea(r.floorArea, locale.value),
      hidden: hiddenRooms.value.has(r.key),
      canRemove: roomOwnWalls(roomList.value, r.key).length > 0,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, locale.value) || (a.key < b.key ? -1 : 1)),
);
function toggleRoom(key: string) {
  const next = new Set(hiddenRooms.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  hiddenRooms.value = next;
}
function selectRoom(key: string) {
  setTool("select");
  selectTool.selection = [ROOM_PREFIX + key];
  sync();
}
async function removeRoom(key: string) {
  const r = layerRooms.value.find((x) => x.key === key);
  const walls = roomOwnWalls(roomList.value, key);
  if (!r || !walls.length) return;
  const yes = await platform.ask(t("layers.remove.message", { name: r.label, count: walls.length }), {
    title: t("layers.remove.title"),
    ok: t("layers.remove"),
    cancel: t("handoff.take.cancel"),
  });
  if (!yes) return;
  // the room's tag goes too: with its walls gone it would never match a room again
  const tag = matchRoomTags(roomList.value, roomTags(project.value, level.value)).get(key);
  run(deleteCommand(history.current, [...walls, ...(tag ? [tag.id] : [])]));
}

/** Joist arrows (structure on): through the label point, 60% of the room's space that way. */
const joistArrows = computed(() => {
  if (!structuralOn.value || !checks.value) return [];
  return detected.value.flatMap((r) => {
    if (hiddenRooms.value.has(r.key)) return [];
    const u = r.above === "joist-slab" ? joistDirection(r.floor, r.joists) : null;
    if (!u) return [];
    const half = 0.3 * Math.min(roomReach(r.floor, r.labelAt, u), 4000);
    const at = r.labelAt;
    return [
      {
        key: r.key,
        a: { x: at.x - u.x * half, y: at.y - u.y * half },
        b: { x: at.x + u.x * half, y: at.y + u.y * half },
      },
    ];
  });
});
/** Joist arrows of drawn joist slabs (structure on). */
const slabArrows = computed(() => {
  if (!structuralOn.value || !checks.value) return [];
  return geometry.value.slabs.flatMap((g) => {
    const e = project.value.elements[g.id];
    const info = e?.type === "slab" ? slabInfo(e) : null;
    const u = info?.kind === "joist" ? joistDirection(g.outline, info.joists) : null;
    if (!u) return [];
    const half = 0.3 * Math.min(roomReach(g.outline, g.at, u), 4000);
    return [
      {
        key: "s" + g.id,
        a: { x: g.at.x - u.x * half, y: g.at.y - u.y * half },
        b: { x: g.at.x + u.x * half, y: g.at.y + u.y * half },
      },
    ];
  });
});
/** Distance across the room through `at` along ±u (to the nearest edge each way, doubled). */
function roomReach(poly: readonly V[], at: V, u: V): number {
  let best = Infinity;
  for (const [i, a] of poly.entries()) {
    const b = poly[(i + 1) % poly.length] ?? a;
    const e = { x: b.x - a.x, y: b.y - a.y };
    const den = u.x * e.y - u.y * e.x;
    if (Math.abs(den) < 1e-9) continue;
    const w = { x: a.x - at.x, y: a.y - at.y };
    const t = (w.x * e.y - w.y * e.x) / den;
    const s2 = (w.x * u.y - w.y * u.x) / den;
    if (s2 >= 0 && s2 <= 1) best = Math.min(best, Math.abs(t));
  }
  return Number.isFinite(best) ? 2 * best : 0;
}
function setRoomAbove(key: string, above: Above | undefined, joists: JoistDir | undefined) {
  run(
    editRoomCommand(
      history.current,
      level.value,
      key,
      { key: "cmd.above" },
      (tg) => setAbove(tg, above, joists),
      randomIds,
    ),
  );
}
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
  const el = document.querySelector(".canvas .plan-pane")?.getBoundingClientRect();
  if (!el || !el.width) return;
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
  slabPreview.value = tool.value === "slab" ? slabTool.preview : [];
  slabPicked.value = tool.value === "slab" ? [...slabTool.picked] : [];
  selection.value = [...selectTool.selection];
  box.value = selectTool.box ? { ...selectTool.box } : null;
  const probs =
    tool.value === "wall"
      ? wallTool.blocked
      : tool.value === "select"
        ? selectTool.blocked
        : tool.value === "room"
          ? roomTool.blocked
          : tool.value === "chase" || isModTool(tool.value)
            ? []
            : tool.value === "slab"
              ? slabTool.blocked
              : openingTool.blocked;
  blocked.value = [...new Set(probs.map((p) => p.code))];
  tooShort.value = (tool.value === "door" || tool.value === "window") && openingTool.tooShort;
}

function endTools() {
  if (wallTool.active) wallTool.finish();
  roomTool.finish();
  openingTool.finish();
  chaseTool.finish();
  for (const tl of modTools.values()) tl.finish();
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

// --- export a picture / PDF of the current floor (ADR-056) ------------------------------------------
const showExport = ref(false);
/** Structure checks for the export (same baseline as the panel); null when the module is off. */
const checksFor = (levelId: string) =>
  structuralOn.value ? runChecks(history.current, levelId, { baseline: session.baselineProject() }) : null;
/**
 * Draws one floor's sheet on `canvas` (default: the current floor); null when it has no walls. With
 * `o.marks`, findings get numbers from `first` on, shown on the plan; they are returned for the notes page.
 */
function drawExport(canvas: HTMLCanvasElement, o: ExportOptions, px: number, levelId = level.value, first = 1) {
  const g = planGeometry(project.value, levelId);
  const pts = g.walls.flatMap((w) => w.polygon);
  if (!pts.length) return null;
  const bounds = {
    minX: Math.min(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxX: Math.max(...pts.map((p) => p.x)),
    maxY: Math.max(...pts.map((p) => p.y)),
  };
  const L = layoutSheet(bounds, o.paper, o.scale);
  canvas.width = Math.round(L.page.w * px);
  canvas.height = Math.round(L.page.h * px);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const kindOf = (id: string) => {
    const e = project.value.elements[id];
    return e?.type === "wall" ? e.kind : "full";
  };
  const checked = o.marks ? checksFor(levelId) : null;
  const numbered = (checked?.findings ?? []).map((f, i) => ({ n: first + i, f }));
  // one mark per element: its numbers, coloured by the worst finding (findings come worst first)
  const marks = badgePoints(checked?.findings ?? []).map((b) => {
    const ns = numbered.filter((x) => x.f.elementIds[0] === b.id).map((x) => x.n);
    return { at: b.at, severity: b.severity, label: ns.join(",") };
  });
  const date = new Intl.DateTimeFormat(locale.value, { dateStyle: "medium" }).format(new Date());
  drawSheet(
    ctx,
    {
      walls: g.walls.map((w) => ({ polygon: w.polygon, kind: kindOf(w.id) })),
      outline: g.outline,
      openings: g.openings,
      rooms: detectedOn(levelId).map((r) => ({
        at: r.labelAt,
        lines: [r.label, formatArea(r.floorArea, locale.value)].filter((x): x is string => !!x),
      })),
      marks,
      bounds,
      texts: {
        title: project.value.name || t("export.untitled"),
        subtitle: t("export.subtitle", {
          floor: floorName(project.value, levelId),
          n: L.scale,
          paper: o.paper.toUpperCase(),
          date,
        }),
        disclaimer: t("export.disclaimer"),
        length: (mm) => formatLength(mm, locale.value),
        metres: (m) => `${new Intl.NumberFormat(locale.value).format(m)} m`,
      },
    },
    L,
    px,
  );
  return { scale: L.scale, fits: L.fits, numbered, checksRun: checked?.checksRun.length ?? 0 };
}
/** 200 dots per inch: sharp on paper, a few hundred KB a page. */
const EXPORT_PX = 200 / 25.4;
const canvasBytes = async (c: HTMLCanvasElement, type: string) => {
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, type, 0.92));
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
};
/** Every page of an export as canvases: one sheet per floor, then the notes pages (PDF with marks). */
function exportCanvases(o: ExportOptions) {
  const pdf = o.format === "pdf";
  const levels = pdf && o.floors === "all" ? levelsByElevation(project.value).map((l) => l.id) : [level.value];
  const sheets: HTMLCanvasElement[] = [];
  const notes: HTMLCanvasElement[] = [];
  const sections: NotesInput["sections"] = [];
  let next = 1;
  for (const lv of levels) {
    const canvas = document.createElement("canvas");
    const r = drawExport(canvas, o, EXPORT_PX, lv, next);
    if (!r) continue;
    next += r.numbered.length;
    sheets.push(canvas);
    sections.push({
      heading: floorName(project.value, lv),
      items: r.numbered.map(({ n, f }) => ({
        label: String(n),
        severity: f.severity,
        tag: t(`severity.${f.severity}`),
        text: findingText(f, project.value, locale.value),
      })),
      empty: t("export.notes.none", { count: r.checksRun }),
    });
  }
  const paper = PAPERS[o.paper];
  if (pdf && o.marks && sections.length) {
    // the notes: what each number on the plans means
    const m = document.createElement("canvas").getContext("2d");
    const measure = (text: string, size: number, bold: boolean) => {
      if (!m) return text.length * size * 0.5;
      m.font = `${bold ? "600 " : ""}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      return m.measureText(text).width;
    };
    const pages = layoutNotes(
      { title: t("export.notes.title"), intro: t("export.notes.intro"), sections, disclaimer: t("checks.disclaimer") },
      paper,
      measure,
    );
    for (const lines of pages) {
      const c = document.createElement("canvas");
      c.width = Math.round(paper.w * EXPORT_PX);
      c.height = Math.round(paper.h * EXPORT_PX);
      const g = c.getContext("2d");
      if (!g) continue;
      drawNotesPage(g, lines, paper, EXPORT_PX);
      notes.push(c);
    }
  }
  return { levels, sheets, notes };
}
async function doExport(o: ExportOptions) {
  showExport.value = false;
  const pdf = o.format === "pdf";
  const { levels, sheets, notes } = exportCanvases(o);
  if (!sheets.length) return;
  const name =
    `${project.value.name || t("export.untitled")}` +
    (levels.length > 1 ? "" : ` - ${floorName(project.value, levels[0] ?? "")}`);
  let out: Uint8Array | null;
  if (pdf) {
    const pages: { jpeg: Uint8Array; width: number; height: number }[] = [];
    for (const c of [...sheets, ...notes]) {
      const jpeg = await canvasBytes(c, "image/jpeg");
      if (jpeg) pages.push({ jpeg, width: c.width, height: c.height });
    }
    out = pages.length
      ? pdfWithImages({ pages, pageMm: PAPERS[o.paper], title: name, producer: `Prumo ${await platform.appVersion()}` })
      : null;
  } else out = sheets[0] ? await canvasBytes(sheets[0], "image/png") : null;
  if (!out) return;
  const path = await platform.pickSavePath(name, { label: o.format.toUpperCase(), ext: o.format });
  if (!path) return;
  try {
    await platform.writeFile(path, out);
    notice.value = "";
  } catch (e) {
    notice.value = t("export.failed", { error: String(e) });
  }
}
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
const EDIT_TOOLS: readonly ToolName[] = ["room", "wall", "door", "window", "chase", "slab"];
/** Every module tool edits the plan. */
const editsPlan = (n: ToolName) => EDIT_TOOLS.includes(n) || isModTool(n);
watch(notMyTurn, (locked) => {
  if (locked && editsPlan(tool.value)) setTool("select");
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
watch(fileTick, () => {
  compareWith.value = null; // New / Open: the old file's versions are gone
  hiddenRooms.value = new Set(); // and its hidden rooms (view state)
});
const comparison = computed(() => {
  const before = compareWith.value ? session.snapshotProject(compareWith.value) : null;
  return before ? compareLevel(before, project.value, level.value) : null;
});
const compareName = computed(() => snapshots.value.find((x) => x.id === compareWith.value)?.name ?? "");
const whenShort = (iso: string) =>
  new Date(iso).toLocaleString(locale.value, { dateStyle: "short", timeStyle: "short" });

async function deleteVersion(id: string) {
  const v = snapshots.value.find((x) => x.id === id);
  const yes = await platform.ask(t("versions.delete.message", { name: v?.name ?? "" }), {
    title: t("versions.delete.title"),
    ok: t("versions.delete"),
    cancel: t("handoff.take.cancel"),
  });
  if (yes && session.deleteSnapshot(id)) {
    if (compareWith.value === id) compareWith.value = null;
    fileTick.value++;
    void platform.setTitle(session.title);
  }
}

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
  const mt = currentModTool();
  if (mt) {
    if (e.type === "move") mt.move(info);
    else if (e.type === "down" && e.button === 0) mt.click(info);
    else if (e.type === "down" && e.button === 2) mt.finish();
    sync();
    return;
  }
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
  if (tool.value === "slab") {
    if (e.type === "move") slabTool.move(info);
    else if (e.type === "down" && e.button === 0) slabTool.click(info);
    else if (e.type === "down" && e.button === 2) slabTool.cancel();
    else if (e.type === "dblclick") slabTool.finish();
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
  if (notMyTurn.value && editsPlan(n)) return; // keyboard shortcuts too (ADR-044)
  endTools();
  if (n !== "select" && viewMode.value === "3d" && !split.value) viewMode.value = "plan"; // drawing needs the plan
  tool.value = n;
  dividerMode.value = n === "wall" && divider;
  wallTool.options = { ...wallTool.options, kind: dividerMode.value ? "separator" : "full" };
  if (n === "door" || n === "window") applyOpeningStyle(n);
  if (isModTool(n)) currentModTool()?.finish();
  sync();
}
/** The module tool that's on, created on first use (with the current floor). */
function currentModTool(): UiTool | null {
  const n = tool.value;
  if (!isModTool(n)) return null;
  let tl = modTools.get(n);
  if (!tl) {
    const [moduleId, toolId] = n.slice(4).split("/");
    const c = MODULE_UIS.find((m) => m.moduleId === moduleId)?.tools?.find((x) => x.id === toolId);
    if (!c) return null;
    tl = c.create(uiCtx.value);
    modTools.set(n, tl);
  }
  if (tl.options.levelId !== level.value) tl.options = { ...tl.options, levelId: level.value };
  return tl;
}
/** The contribution behind a module tool id (for its hint). */
const modToolDef = (n: ToolName) => {
  if (!isModTool(n)) return null;
  const [moduleId, toolId] = n.slice(4).split("/");
  return MODULE_UIS.find((m) => m.moduleId === moduleId)?.tools?.find((x) => x.id === toolId) ?? null;
};
function onLeave() {
  cursorAt = null;
  if (tool.value === "door" || tool.value === "window") openingTool.finish();
  if (tool.value === "chase" && !chaseTool.active) chaseTool.finish();
  const mt = currentModTool();
  if (mt && !mt.active) mt.finish();
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
  const mdef = modToolDef(tool.value);
  if (mdef) return mdef.hint(uiCtx.value);
  if (tool.value === "slab")
    return slabMode.value === "rooms"
      ? slabPicked.value.length
        ? t("hint.slab.rooms.active", { count: slabPicked.value.length })
        : t("hint.slab.rooms.idle")
      : slabPreview.value.length
        ? t("hint.slab.outline.active")
        : t("hint.slab.outline.idle");
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

/** Type for new doors / windows (ADR-046), chosen in the options bar; this session only. */
const placeStyle = ref<{ door: string; window: string }>({ door: "hinged", window: "" });
function applyOpeningStyle(kind: "door" | "window") {
  const style = placeStyle.value[kind];
  const o = { ...openingTool.options, kind };
  delete o.style;
  // "hinged" is the default door: leave the field out so placed doors look like before
  openingTool.options = style && style !== "hinged" ? { ...o, style } : o;
}
function setPlaceStyle(kind: "door" | "window", style: string) {
  placeStyle.value = { ...placeStyle.value, [kind]: style };
  openingTool.finish();
  applyOpeningStyle(kind);
  sync();
}

// --- menu bar, tool strip, options bar (ADR-047) -------------------------------------------------
const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
const keyName = (k: string) => (isMac ? k.replace("Mod+", "⌘").replace("Shift+", "⇧") : k.replace("Mod+", "Ctrl+"));
/** The left tool strip: icon + short label; `edits` = off while it's not your turn (hand-off). */
const toolButtons = computed(() => [
  {
    id: "select",
    icon: MousePointer2,
    label: "tool.select",
    tip: "tool.select.tip",
    tour: "select",
    edits: false,
    on: tool.value === "select",
    pick: () => setTool("select"),
  },
  {
    id: "room",
    icon: SquareDashed,
    label: "tool.room",
    tip: "tool.room.tip",
    tour: "room",
    edits: true,
    on: tool.value === "room",
    pick: () => setTool("room"),
  },
  {
    id: "wall",
    icon: BrickWall,
    label: "tool.wall",
    tip: "tool.wall.tip",
    tour: "wall",
    edits: true,
    on: tool.value === "wall" && !dividerMode.value,
    pick: () => setTool("wall"),
  },
  {
    id: "divider",
    icon: SquareSplitHorizontal,
    label: "tool.divider",
    tip: "tool.divider.tip",
    tour: "divider",
    edits: true,
    on: tool.value === "wall" && dividerMode.value,
    pick: () => setTool("wall", true),
  },
  {
    id: "door",
    icon: DoorOpen,
    label: "tool.door",
    tip: "tool.door.tip",
    tour: "door",
    edits: true,
    on: tool.value === "door",
    pick: () => setTool("door"),
  },
  {
    id: "window",
    icon: Grid2x2,
    label: "tool.window",
    tip: "tool.window.tip",
    tour: undefined,
    edits: true,
    on: tool.value === "window",
    pick: () => setTool("window"),
  },
  {
    id: "note",
    icon: MessageSquare,
    label: "tool.note",
    tip: "tool.note.tip",
    tour: undefined,
    edits: false,
    on: tool.value === "note",
    pick: () => setTool("note"),
  },
  ...(structuralOn.value
    ? [
        {
          id: "chase",
          icon: Cable,
          label: "tool.chase",
          tip: "tool.chase.tip",
          tour: undefined,
          edits: true,
          on: tool.value === "chase",
          pick: () => setTool("chase"),
        },
        {
          id: "slab",
          icon: SquareStack,
          label: "tool.slab",
          tip: "tool.slab.tip",
          tour: undefined,
          edits: true,
          on: tool.value === "slab",
          pick: () => setTool("slab"),
        },
      ]
    : []),
  ...activeUis.value.flatMap((m) =>
    (m.tools ?? []).map((tl) => ({
      id: modToolId(m, tl.id),
      icon: tl.icon,
      label: tl.label,
      tip: tl.tip,
      tour: undefined,
      edits: true,
      on: tool.value === modToolId(m, tl.id),
      pick: () => setTool(modToolId(m, tl.id)),
    })),
  ),
]);
const currentTool = computed(() => toolButtons.value.find((b) => b.on) ?? toolButtons.value[0]);
const hasSelection = computed(() => selection.value.length > 0);
const menus = computed<Menu[]>(() => {
  const locked = !!readOnly.value || notMyTurn.value;
  return [
    {
      id: "file",
      label: t("menu.file"),
      items: [
        { id: "new", label: t("action.new"), shortcut: keyName("Mod+N") },
        { id: "open", label: t("action.open"), shortcut: keyName("Mod+O") },
        "sep",
        { id: "save", label: t("action.save"), shortcut: keyName("Mod+S"), disabled: !!readOnly.value },
        { id: "saveAs", label: t("menu.saveAs"), shortcut: keyName("Mod+Shift+S") },
        { id: "exportSheet", label: t("export.menu") },
        { id: "exportClean", label: t("versions.exportClean"), disabled: !snapshots.value.length },
        "sep",
        { id: "handoff", label: t("handoff.button"), disabled: locked },
        "sep",
        { id: "settings", label: t("action.settings") + "…" },
      ],
    },
    {
      id: "edit",
      label: t("menu.edit"),
      items: [
        { id: "undo", label: t("action.undo"), shortcut: keyName("Mod+Z"), disabled: !canUndo.value },
        {
          id: "redo",
          label: t("action.redo"),
          shortcut: keyName(isMac ? "Mod+Shift+Z" : "Mod+Y"),
          disabled: !canRedo.value,
        },
        "sep",
        { id: "cut", label: t("menu.cut"), shortcut: keyName("Mod+X"), disabled: !hasSelection.value || locked },
        { id: "copy", label: t("menu.copy"), shortcut: keyName("Mod+C"), disabled: !hasSelection.value },
        { id: "paste", label: t("menu.paste"), shortcut: keyName("Mod+V"), disabled: locked },
        {
          id: "duplicate",
          label: t("action.duplicate"),
          shortcut: keyName("Mod+D"),
          disabled: !hasSelection.value || locked,
        },
        {
          id: "delete",
          label: t("action.delete"),
          shortcut: isMac ? "⌫" : "Del",
          disabled: !hasSelection.value || locked,
        },
        "sep",
        { id: "rotate", label: t("menu.rotate"), shortcut: "R", disabled: !hasSelection.value || locked },
        { id: "selectAll", label: t("menu.selectAll"), shortcut: keyName("Mod+A") },
      ],
    },
    {
      id: "view",
      label: t("menu.view"),
      items: [
        { id: "fit", label: t("action.fit") },
        "sep",
        { id: "viewPlan", label: t("view3d.plan"), checked: !split.value && viewMode.value === "plan" },
        { id: "view3d", label: t("view3d.3d"), checked: !split.value && viewMode.value === "3d" },
        { id: "viewSplit", label: t("view3d.split"), checked: split.value },
        "sep",
        { id: "layers", label: t("layers.title"), checked: showLayers.value },
        {
          id: "showBelow",
          label: t("menu.showBelow"),
          checked: showBelow.value,
          disabled: !levelBelow(project.value, level.value),
        },
        { id: "structure", label: t("menu.structureChecks"), checked: structuralOn.value },
      ],
    },
    {
      id: "tools",
      label: t("menu.tools"),
      items: toolButtons.value.map((b) => ({
        id: "tool:" + b.id,
        label: t(b.label),
        checked: b.on,
        disabled: b.edits && notMyTurn.value,
        ...(TOOL_KEYS[b.id] ? { shortcut: TOOL_KEYS[b.id] } : {}),
      })),
    },
    {
      id: "help",
      label: t("menu.help"),
      items: [{ id: "tour", label: t("menu.tour") }],
    },
  ];
});
const TOOL_KEYS: Record<string, string> = { select: "V", room: "Q", wall: "W", divider: "L", door: "D", window: "J" };
function onMenu(id: string) {
  if (id.startsWith("tool:")) return toolButtons.value.find((b) => "tool:" + b.id === id)?.pick();
  const acts: Record<string, () => void> = {
    new: () => void doNew(),
    open: () => void doOpen(),
    save: () => void doSave(false),
    saveAs: () => void doSave(true),
    exportClean: () => void file(() => session.exportClean()),
    exportSheet: () => (showExport.value = true),
    handoff: () => (showHandoff.value = true),
    viewPlan: () => setViewMode("plan"),
    view3d: () => setViewMode("3d"),
    viewSplit: toggleSplit,
    settings: () => (showSettings.value = true),
    undo,
    redo,
    cut: () => copySelection(true),
    copy: () => copySelection(false),
    paste,
    duplicate: duplicateSelection,
    delete: deleteSelection,
    rotate: () => rotateSelection(90),
    selectAll: () => {
      setTool("select");
      selectTool.selectAll();
      sync();
    },
    fit: () => {
      fitAll();
      fit3d.value++;
    },
    structure: () => (structuralOn.value = !structuralOn.value),
    layers: () => (showLayers.value = !showLayers.value),
    showBelow: () => (showBelow.value = !showBelow.value),
    tour: () => (showTour.value = true),
  };
  acts[id]?.();
}

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
    else if (slabTool.active) {
      if (e.key === "Enter") slabTool.finish();
      else slabTool.cancel();
    } else if (e.key === "Escape") setTool("select");
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
if (demo === "types") {
  const ex = EXAMPLES.find((e) => e.id === "house");
  if (ex)
    void startExample(ex).then(() => {
      const ops = Object.values(history.current.elements)
        .filter((e): e is Opening => e.type === "opening")
        .sort((a, b) => (a.id < b.id ? -1 : 1));
      const doors = ["sliding", "double", "pocket", "folding", "garage", "sliding-double"];
      const wins = ["sliding", "casement", "top-hung", "tilting", "fixed"];
      let d = 0;
      let w = 0;
      const pick = (o: Opening) => (o.kind === "door" ? doors[d++ % doors.length] : wins[w++ % wins.length]) ?? "";
      run(
        updateCommand(
          { key: "cmd.edit" },
          ops.map((o) => o.id),
          (e) => (e.type === "opening" ? { ...e, style: pick(e) } : e),
        ),
      );
      const firstWin = ops.find((o) => o.kind === "window");
      setTool("select");
      if (firstWin) selectTool.selection = [firstWin.id];
      sync();
      setTimeout(fitAll, 0);
    });
}
if (demo === "place-type") {
  const ex = EXAMPLES.find((e) => e.id === "house");
  if (ex)
    void startExample(ex).then(() => {
      setTool("door");
      setPlaceStyle("door", "folding");
      sync();
      setTimeout(fitAll, 0);
    });
}
if (demo === "layers") {
  const ex = EXAMPLES.find((e) => e.id === "house");
  if (ex)
    void startExample(ex).then(() => {
      showLayers.value = true;
      const bath = detected.value.find((r) => r.roomType === "bathroom") ?? detected.value[0];
      if (bath) toggleRoom(bath.key);
      sync();
      setTimeout(fitAll, 0);
    });
}
if (demo === "floors" || demo === "add-floor") {
  const ex = EXAMPLES.find((e) => e.id === "house");
  if (ex)
    void startExample(ex).then(() => {
      showLayers.value = true;
      if (demo === "add-floor") showAddFloor.value = true;
      else addFloor("", 2800, "outside");
      sync();
      setTimeout(fitAll, 0);
    });
}
if (demo === "materials" || demo === "values") {
  const ex = EXAMPLES.find((e) => e.id === "house");
  if (ex)
    void startExample(ex).then(() => {
      if (demo === "values") showSettings.value = true;
      const w = Object.values(history.current.elements).find((e): e is Wall => e.type === "wall");
      if (w) {
        setMaterial(w.id, "ceramic-block");
        setTool("select");
        selectTool.selection = [w.id];
      }
      sync();
      setTimeout(fitAll, 0);
    });
}
if (
  demo === "loads" ||
  demo === "upper" ||
  demo === "upper-problem" ||
  demo === "lintel" ||
  demo === "3d" ||
  demo === "3d-low" ||
  demo === "3d-full" ||
  demo === "split"
) {
  const ex = EXAMPLES.find((e) => e.id === "house");
  if (ex)
    void startExample(ex).then(() => {
      setTool("slab");
      setSlabNewKind("joist");
      for (const r of detected.value) slabTool.click({ at: r.labelAt, scale: 0.1, free: false });
      slabTool.finish();
      setTool("select");
      const s = Object.values(history.current.elements).find((e) => e.type === "slab");
      if (s) editSlab(s.id, { kind: "joist", joists: "short" });
      const w = Object.values(history.current.elements)
        .filter((e): e is Wall => e.type === "wall")
        .sort((a, b) => wallLength(b) - wallLength(a))[0];
      if (w) {
        setMaterial(w.id, "ceramic-block");
        selectTool.selection = [w.id];
      }
      const o = Object.values(history.current.elements).find(
        (e): e is Opening => e.type === "opening" && e.kind === "window",
      );
      if (demo === "lintel" && o) {
        const hw = history.current.elements[o.host.elementId];
        if (hw?.type === "wall") setMaterial(hw.id, "ceramic-block");
        setOpeningLintel(o.id, true);
        setOpeningLintelSize(o.id, { height: 100, bars: { count: 2, diameter: 8 } });
        selectTool.selection = [o.id];
      }
      if (demo === "upper-problem" && w) {
        // upstairs: a copy of the ground floor + one load-bearing wall across the living room
        addFloor("", 2800, "all");
        const up = wallsOnLevel(history.current, level.value)[0];
        if (up) {
          const mid = { x: (w.start.x + w.end.x) / 2, y: (w.start.y + w.end.y) / 2 };
          const extra = {
            ...up,
            id: "demo-upper-wall",
            start: { x: mid.x - 1500, y: mid.y },
            end: { x: mid.x - 1500, y: mid.y + 4000 },
          };
          run(putCommand({ key: "cmd.addWall" }, [extra]));
          selectTool.selection = [];
        }
      }
      if (demo === "upper" && w) {
        // a full copy of the ground floor on top (slab included), then back to the ground floor's wall
        const ground = level.value;
        addFloor("", 2800, "all");
        setLevel(ground);
        selectTool.selection = [w.id];
      }
      if (demo === "3d" || demo === "3d-low" || demo === "3d-full") {
        // outside faces in exposed brick, one room's walls in drywall (shows the patterns)
        for (const [id, side] of wallSides(history.current, level.value).outside) paintSide(id, side, "brick-exposed");
        setViewMode("3d");
        wallMode.value = demo === "3d-low" ? "low" : demo === "3d-full" ? "full" : "cutaway";
        selectTool.selection = [];
      }
      if (demo === "split") split.value = true;
      sync();
      setTimeout(() => {
        fitAll();
        document.querySelectorAll(".load details").forEach((d) => d.setAttribute("open", ""));
      }, 50);
    });
}
if (demo === "export" || demo === "export-full") {
  const ex = EXAMPLES.find((e) => e.id === "problems");
  if (ex)
    void startExample(ex).then(() => {
      if (demo === "export") return void (showExport.value = true);
      // the real 200 dpi sheet, shown as an image over the app (checking the output)
      const all = exportCanvases({ format: "pdf", paper: "a4", scale: "fit", floors: "all", marks: true });
      const c = new URLSearchParams(location.search).has("notes") ? all.notes[0] : all.sheets[0];
      if (!c) return;
      const img = document.createElement("img");
      img.src = c.toDataURL("image/png");
      img.style.cssText = "position:fixed;inset:0;z-index:99;width:100vw;background:#fff";
      document.body.append(img);
    });
}
if (demo === "module" || demo === "module-room") {
  // every module with a screen part on, its sample items placed (`ModuleUi.demo`)
  const ex = EXAMPLES.find((e) => e.id === "house");
  if (ex)
    void startExample(ex).then(() => {
      modulesOn.value = Object.fromEntries(MODULE_UIS.map((m) => [m.moduleId, true]));
      setTool("select");
      for (const m of MODULE_UIS) {
        const r = m.demo?.(uiCtx.value);
        if (r) selectTool.selection = [demo === "module" ? r.item : ROOM_PREFIX + r.room];
      }
      sync();
    });
}
if (demo === "3d-problems") {
  const ex = EXAMPLES.find((e) => e.id === "problems");
  if (ex) void startExample(ex).then(() => setViewMode("3d"));
}
if (demo === "slabs" || demo === "slab-pick") {
  const ex = EXAMPLES.find((e) => e.id === "house");
  if (ex)
    void startExample(ex).then(() => {
      setTool("slab");
      setSlabNewKind("joist");
      const P = (q: V) => ({ at: q, scale: 0.1, free: false });
      const rs = [...detected.value].sort((a, b) => b.floorArea - a.floorArea);
      for (const r of rs.slice(0, demo === "slabs" ? rs.length : 2)) slabTool.click(P(r.labelAt));
      if (demo === "slabs") {
        slabTool.finish();
        // a balcony drawn by its outline, sticking out at the front
        setSlabMode("outline");
        setSlabNewKind("solid");
        for (const q of [
          { x: 1000, y: 0 },
          { x: 1000, y: -1200 },
          { x: 4000, y: -1200 },
          { x: 4000, y: 0 },
        ])
          slabTool.click(P(q));
        slabTool.finish();
        setTool("select");
        const first = Object.values(history.current.elements).find((e) => e.type === "slab");
        if (first) {
          editSlab(first.id, { kind: "joist", joists: "short", thickness: 120 });
          selectTool.selection = [first.id];
        }
      }
      sync();
      setTimeout(fitAll, 0);
    });
}
if (demo === "above") {
  const ex = EXAMPLES.find((e) => e.id === "house");
  if (ex)
    void startExample(ex).then(() => {
      const rs = [...detected.value].sort((a, b) => b.floorArea - a.floorArea);
      const [big, second, third] = rs;
      if (big) setRoomAbove(big.key, "joist-slab", "short");
      if (second) setRoomAbove(second.key, "joist-slab", "long");
      if (third) setRoomAbove(third.key, "roof", undefined);
      setTool("select");
      if (big) selectTool.selection = [ROOM_PREFIX + big.key];
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
if (demo === "renovation" || demo === "compare" || demo === "versions") {
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
      if (demo === "versions") {
        session.handOff({ from: "Ana", to: "Bruno" });
        myName.value = "Bruno";
        showSettings.value = true;
      }
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
    <MenuBar :menus="menus" :start-open="demo === 'menu' ? 'edit' : null" @pick="onMenu">
      <template #start
        ><strong class="brand">{{ t("app.name") }}</strong></template
      >
      <template #end>
        <div class="quick">
          <button
            class="icon"
            data-tour="save"
            :title="t('action.save.tip')"
            :aria-label="t('action.save')"
            :disabled="!!readOnly"
            @click="doSave(false)"
          >
            <Save :size="16" />
          </button>
          <button
            class="icon"
            data-tour="undo"
            :disabled="!canUndo"
            :title="undoTip"
            :aria-label="t('action.undo')"
            @click="undo"
          >
            <Undo2 :size="16" />
          </button>
          <button class="icon" :disabled="!canRedo" :title="redoTip" :aria-label="t('action.redo')" @click="redo">
            <Redo2 :size="16" />
          </button>
          <button class="icon" :title="t('action.fit')" :aria-label="t('action.fit')" @click="fitAll">
            <Maximize :size="16" />
          </button>
          <button
            class="icon"
            data-tour="settings"
            :title="t('action.settings.tip')"
            :aria-label="t('action.settings')"
            @click="showSettings = true"
          >
            <SettingsIcon :size="16" />
          </button>
        </div>
      </template>
    </MenuBar>

    <!-- options bar: the current tool's name + its options; versions on the right (ADR-047) -->
    <div class="optbar">
      <template v-if="currentTool">
        <component :is="currentTool.icon" :size="15" class="muted" />
        <strong>{{ t(currentTool.label) }}</strong>
      </template>
      <span v-if="tool === 'room'" class="seg" role="group" :aria-label="t('roomShape.label')">
        <button
          :class="{ on: roomShape === 'rectangle' }"
          :title="t('roomShape.rectangle.tip')"
          @click="setRoomShape('rectangle')"
        >
          <RectangleHorizontal :size="14" /> {{ t("roomShape.rectangle") }}
        </button>
        <button
          :class="{ on: roomShape === 'polygon' }"
          :title="t('roomShape.polygon.tip')"
          @click="setRoomShape('polygon')"
        >
          <Pentagon :size="14" /> {{ t("roomShape.polygon") }}
        </button>
      </span>
      <label v-if="tool === 'door' || tool === 'window'" class="cmp-pick">
        {{ t("props.openingStyle") }}
        <select
          :value="placeStyle[tool]"
          @change="setPlaceStyle(tool as 'door' | 'window', ($event.target as HTMLSelectElement).value)"
        >
          <option v-if="tool === 'window'" value="">{{ t("windowStyle.plain") }}</option>
          <option v-for="st in tool === 'door' ? DOOR_STYLES : WINDOW_STYLES" :key="st" :value="st">
            {{ t(`${tool}Style.${st}`) }}
          </option>
        </select>
      </label>
      <span v-if="tool === 'chase'" class="seg" role="group" :aria-label="t('chaseDir.label')">
        <button
          :class="{ on: chaseDirection === 'horizontal' }"
          :title="t('chaseDir.horizontal.tip')"
          @click="setChaseDir('horizontal')"
        >
          <MoveHorizontal :size="14" /> {{ t("chaseDir.horizontal") }}
        </button>
        <button
          :class="{ on: chaseDirection === 'vertical' }"
          :title="t('chaseDir.vertical.tip')"
          @click="setChaseDir('vertical')"
        >
          <MoveVertical :size="14" /> {{ t("chaseDir.vertical") }}
        </button>
      </span>
      <template v-if="tool === 'slab'">
        <span class="seg" role="group" :aria-label="t('slabMode.label')">
          <button :class="{ on: slabMode === 'rooms' }" :title="t('slabMode.rooms.tip')" @click="setSlabMode('rooms')">
            <SquareDashed :size="14" /> {{ t("slabMode.rooms") }}
          </button>
          <button
            :class="{ on: slabMode === 'outline' }"
            :title="t('slabMode.outline.tip')"
            @click="setSlabMode('outline')"
          >
            <Pentagon :size="14" /> {{ t("slabMode.outline") }}
          </button>
        </span>
        <label class="cmp-pick">
          {{ t("props.openingStyle") }}
          <select
            :value="slabNewKind"
            @change="setSlabNewKind(($event.target as HTMLSelectElement).value as SlabKind | '')"
          >
            <option value="">{{ t("above.unknown") }}</option>
            <option v-for="k in SLAB_KINDS" :key="k" :value="k">{{ t(`slabKind.${k}`) }}</option>
          </select>
        </label>
        <button v-if="slabMode === 'rooms'" :disabled="!slabPicked.length" @click="finishSlab">
          {{ t("slab.create", { count: slabPicked.length }) }}
        </button>
      </template>
      <span class="spacer" />
      <span class="seg" role="group" :aria-label="t('view3d.label')">
        <button
          :class="{ on: !split && viewMode === 'plan' }"
          :title="t('view3d.plan.tip')"
          @click="setViewMode('plan')"
        >
          <MapIcon :size="14" /> {{ t("view3d.plan") }}
        </button>
        <button :class="{ on: !split && viewMode === '3d' }" :title="t('view3d.3d.tip')" @click="setViewMode('3d')">
          <Box :size="14" /> {{ t("view3d.3d") }}
        </button>
        <button
          :class="{ on: split }"
          :title="t('view3d.split.tip')"
          :aria-label="t('view3d.split')"
          @click="toggleSplit"
        >
          <Columns2 :size="14" />
        </button>
      </span>
      <button v-if="project.levels.length > 1" class="floor-chip" :title="t('layers.tip')" @click="showLayers = true">
        <LayersIcon :size="14" /> {{ t("floor.on", { name: currentFloorName }) }}
      </button>
      <label v-if="snapshots.length" class="cmp-pick" :title="t('compare.tip')">
        <GitCompare :size="14" />
        <select
          class="compare"
          :value="compareWith ?? ''"
          @change="compareWith = ($event.target as HTMLSelectElement).value || null"
        >
          <option value="">{{ t("compare.off") }}</option>
          <option v-for="v in snapshots" :key="v.id" :value="v.id">{{ v.name }} · {{ whenShort(v.createdAt) }}</option>
        </select>
      </label>
      <button :title="t('handoff.tip')" :disabled="!!readOnly || notMyTurn" @click="showHandoff = true">
        <Send :size="14" /> {{ t("handoff.button") }}
      </button>
    </div>

    <div class="work">
      <nav class="tools" :aria-label="t('menu.tools')">
        <button
          v-for="tb in toolButtons"
          :key="tb.id"
          :data-tour="tb.tour"
          :class="{ on: tb.on }"
          :title="t(tb.tip)"
          :disabled="tb.edits && notMyTurn"
          @click="tb.pick()"
        >
          <component :is="tb.icon" :size="20" :stroke-width="1.75" />
          <span>{{ t(tb.label) }}</span>
        </button>
        <span class="grow" />
        <button :class="{ on: showLayers }" :title="t('layers.tip')" @click="showLayers = !showLayers">
          <LayersIcon :size="20" :stroke-width="1.75" />
          <span>{{ t("layers.title") }}</span>
        </button>
      </nav>

      <main ref="canvasEl" class="canvas">
        <div v-show="showPlan" class="pane plan-pane" :style="split ? { right: `${100 - splitAt * 100}%` } : undefined">
          <PlanView
            v-model:view="view"
            :marks="moduleMarks"
            :links="moduleLinks"
            :geometry="geometry"
            :walls="walls"
            :hover="tool === 'wall' || tool === 'room' ? hover : null"
            :rooms="rooms"
            :slabs="slabMarks"
            :slab-preview="slabPreview"
            :faces="faces"
            :selected-ids="selection"
            :box="box"
            :labels="labels"
            :badges="badges"
            :arrows="[...joistArrows, ...slabArrows]"
            :dimmed="[...hiddenIds]"
            :ghost="ghostBelow"
            :locks="protectionMarks.locks"
            :ghosts="protectionMarks.ghosts"
            :compare="comparison"
            :grid="gridSize"
            @pointer="onPointer"
            @resize="onResize"
            @leave="onLeave"
          />
        </div>
        <div v-if="show3d" class="pane" :style="split ? { left: `${splitAt * 100}%` } : undefined">
          <span class="seg walls3d" role="group" :aria-label="t('view3d.walls')">
            <button
              v-for="m in WALL_MODES"
              :key="m.id"
              :class="{ on: wallMode === m.id }"
              :title="t(`view3d.walls.${m.id}.tip`)"
              @click="wallMode = m.id"
            >
              <component :is="m.icon" :size="14" /> {{ t(`view3d.walls.${m.id}`) }}
            </button>
            <label class="sun" :title="t('view3d.sun.tip')">
              <SunIcon :size="14" />
              <input v-model.number="sunHour" type="range" min="6" max="18" step="0.5" :aria-label="t('view3d.sun')" />
              <span>{{ sunLabel }}</span>
            </label>
          </span>
          <View3D
            :model="model3d"
            :mode="wallMode"
            :level="level"
            :above="levelsAbove"
            :faces="faces3d"
            :sun="sun3d"
            :selection="selection3d"
            :marks="marks3d"
            :dark="prefersDark"
            :fit-key="fit3d"
            @pick="pick3d"
          >
            <template #failed>{{ t("view3d.noWebgl") }}</template>
          </View3D>
        </div>
        <div
          v-if="split"
          class="divider"
          :style="{ left: `${splitAt * 100}%` }"
          :title="t('view3d.divider.tip')"
          @pointerdown="startSplitDrag"
        />
        <button v-else class="split-grip" :title="t('view3d.grip.tip')" @pointerdown="startSplitDrag">
          <Columns2 :size="12" />
        </button>
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
        <AddFloorDialog
          v-if="showAddFloor"
          :locale="locale"
          :below="currentFloorName"
          :suggested="t('level.n', { n: levelsByElevation(project).length })"
          @add="addFloor"
          @cancel="showAddFloor = false"
        />
        <LayersPanel
          v-if="showLayers"
          :locale="locale"
          :levels="floorList"
          :level="level"
          :rooms="layerRooms"
          @toggle="toggleRoom"
          @pick-level="setLevel"
          @add-level="showAddFloor = true"
          @rename-level="renameLevel"
          @delete-level="deleteLevel"
          @remove="removeRoom"
          @select="selectRoom"
          @close="showLayers = false"
        />
        <PropertiesPanel
          v-if="tool === 'select'"
          v-model:keep-original="keepOriginal"
          :packs="structuralOn ? packs : null"
          :load="selectedLoad"
          :ui-ctx="uiCtx"
          :module-panel="modulePanel"
          :module-room-panels="moduleRoomPanels"
          :lintel-load="selectedLintel"
          :project="project"
          :selection="selection"
          :locale="locale"
          :rooms="panelRooms"
          :wall-sides="wallSideLabels"
          :structural="structuralOn ? (checks?.system ?? null) : null"
          @role="setRole"
          @lintel="setOpeningLintel"
          @lintel-size="setOpeningLintelSize"
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
          @above="setRoomAbove"
          @material="setMaterial"
          @slab="editSlab"
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
        <ExportDialog
          v-if="showExport"
          :locale="locale"
          :floor="currentFloorName"
          :floor-count="project.levels.length"
          :structure="structuralOn"
          :draw="drawExport"
          @export="doExport"
          @cancel="showExport = false"
        />
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
          :module-toggles="moduleToggles"
          :structural="structuralOn"
          :values="packValues"
          :name="myName"
          :versions="snapshots.map((v) => ({ ...v, inUse: v.id === project.settings.baseline }))"
          :versions-size="(void tick, void fileTick, session.snapshotsSize())"
          @delete-version="deleteVersion"
          @export-clean="file(() => session.exportClean())"
          @name="setMyName"
          @system="(s) => run(setSystemCommand(s))"
          @structural="(on) => (structuralOn = on)"
          @module="setModuleOn"
          @grid="setGrid"
          @angle="(a) => (angleStep = a)"
          @outside-faces="(on) => run(setOutsideFacesCommand(on))"
          @tour="((showSettings = false), (showTour = true))"
          @locale="(l) => (locale = l)"
          @close="showSettings = false"
        />
      </main>
    </div>

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
  grid-template-rows: auto auto 1fr auto auto;
  /* minmax(0, …): long no-wrap status text must not widen the canvas past the window */
  grid-template-columns: minmax(0, 1fr);
  height: 100%;
}
.optbar {
  display: flex;
  gap: 10px;
  align-items: center;
  min-height: 36px;
  padding: 3px 10px;
  background: var(--bg);
  border-bottom: 1px solid var(--line);
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
}
.floor-chip {
  font-weight: 600;
}
.optbar button,
.seg button,
.quick button,
.cmp-pick {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.quick {
  display: flex;
  gap: 2px;
}
button.icon {
  padding: 5px 7px;
  border-color: transparent;
  background: none;
}
button.icon:hover:not(:disabled) {
  background: var(--accent-soft);
}
.work {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  min-height: 0;
}
.tools {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 62px;
  padding: 6px 4px;
  background: var(--panel);
  border-right: 1px solid var(--line);
  overflow-y: auto;
}
.tools .grow {
  flex: 1;
}
.tools button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 7px 2px 5px;
  border-color: transparent;
  background: none;
  font-size: 10.5px;
  line-height: 1.15;
}
.tools button:hover:not(:disabled) {
  background: var(--accent-soft);
}
.tools button.on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.status {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 6px 10px;
  background: var(--panel);
  border-bottom: 1px solid var(--line);
}
/* narrow windows: the toolbar wraps onto a second row instead of overflowing (row height is auto) */
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
.pane {
  position: absolute;
  inset: 0;
}
.divider {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 10px;
  margin-left: -5px;
  cursor: col-resize;
  z-index: 6;
  background: linear-gradient(to right, transparent 4px, var(--line) 4px, var(--line) 6px, transparent 6px);
}
.divider:hover {
  background: linear-gradient(to right, transparent 4px, var(--accent) 4px, var(--accent) 6px, transparent 6px);
}
.split-grip {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 6;
  width: 10px;
  height: 56px;
  padding: 0;
  display: grid;
  place-items: center;
  border: 1px solid var(--line);
  border-right: none;
  border-radius: 6px 0 0 6px;
  background: var(--panel);
  color: var(--muted);
  cursor: col-resize;
}
.walls3d .sun {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 8px;
  color: var(--muted);
  font-size: 12px;
}
.walls3d .sun input {
  width: 90px;
}
.walls3d {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 5;
  background: var(--panel);
  border-radius: 7px;
  box-shadow: 0 1px 4px rgb(0 0 0 / 15%);
}
.split-grip:hover {
  color: var(--accent);
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
