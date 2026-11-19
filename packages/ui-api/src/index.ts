// What a module can add to the app's screens (ADR-059). The app knows these shapes, never a module's
// name: a module hands over one `ModuleUi` and the app shows its tools, plan symbols, panel sections,
// strings and its line in Settings → Modules. Internal API (ADR-020: public only after it settles).
import type { Command, Element, History, IdSource, Project, V } from "@prumo/core";
import type { Component } from "vue";

/** Where the pointer is, in plan terms (same shape the Architect tools use). */
export interface PointerInfo {
  /** Model coordinates, mm. */
  at: V;
  /** Screen px per mm (for snap radii). */
  scale: number;
  /** Alt held: no grid snap. */
  free: boolean;
}

/** A room as the app sees it (detected from walls; label = name or type). */
export interface UiRoom {
  key: string;
  label: string;
  /** Inner floor polygon, mm, and its area, mm². */
  floor: V[];
  floorArea: number;
  labelAt: V;
}

/** Everything a module's UI may read or do. Rebuilt by the app on every change (read it, don't keep it). */
export interface UiContext {
  readonly project: Project;
  /** The floor being edited. */
  readonly level: string;
  readonly selection: readonly string[];
  readonly locale: string;
  readonly rooms: readonly UiRoom[];
  /** The app's grid step, mm. */
  readonly grid: number;
  readonly history: History;
  readonly ids: IdSource;
  /** Translate a key (the module's own strings included). */
  t(key: string, params?: Record<string, string | number>): string;
  /** Run an edit as one undo step; false = refused (e.g. invalid). */
  run(cmd: Command): boolean;
  /** Redraw after a tool changed by itself (an options-bar button, a finished shape). */
  refresh(): void;
  /** The user's name as they gave it in Settings ("" = not given). For authorship (e.g. markers). */
  readonly userName: string;
  /** Now, ISO 8601 UTC (the app owns the clock; core never reads it). */
  now(): string;
  /** A floor's display name ("Ground floor", "Floor 1", or the name the user gave). */
  levelName(levelId: string): string;
  /** Room keys hidden in the layers panel (draw nothing over them). */
  readonly hiddenRooms: ReadonlySet<string>;
  /** "The existing building" (ADR-043): the marked version, when it was marked; mark it now / clear it. */
  readonly baseline: {
    project(): Project | null;
    date(): string | null;
    mark(): void;
    clear(): void;
  };
  /** Select these elements on the plan (switches to the Select tool). */
  select(ids: readonly string[]): void;
  /** Open the Settings panel. */
  openSettings(): void;
  formatLength(mm: number): string;
  formatArea(mm2: number): string;
  formatCm(mm: number): string;
  parseNumber(text: string): number | null;
}

/** A tool's behaviour (framework-free; the app feeds it pointer events). */
export interface UiTool {
  move(p: PointerInfo): void;
  click(p: PointerInfo): void;
  /** Esc / right-click / tool switch: drop previews and half-done work. */
  finish(): void;
  /** Mid-gesture (quiet while creating, ADR-025). */
  readonly active: boolean;
  /** The app sets `levelId` when the floor changes, and `grid` (mm) when the grid changes — if present. */
  options: { levelId: string; grid?: number };
  /** Double click on the plan (e.g. close a shape). */
  dblclick?(p: PointerInfo): void;
  /** Enter: complete what's being drawn. Without it, Enter does what Esc does (`finish`). */
  commit?(): void;
  /** Why the current preview can't be made: problem codes (shown as the app's `problem.<code>`). */
  readonly blocked?: readonly { code: string }[];
}

/** What a tool shows on the plan while it's on (ADR-059, Structural step 1). */
export interface ToolPreview {
  /** Dashed outlines being drawn (open while drawing corners). */
  outlines?: readonly (readonly V[])[];
  /** Rooms picked so far (highlighted like a selected room). */
  rooms?: readonly string[];
  /** Live measurements next to the pointer. */
  labels?: readonly { at: V; text: string }[];
}

export interface ToolContribution {
  /** Unique within the module. */
  id: string;
  /** A Lucide icon component (ADR-047). */
  icon: Component;
  /** i18n keys. */
  label: string;
  tip: string;
  /** The status-bar hint while the tool is on (`tool` = the instance `create` made). */
  hint(ctx: UiContext, tool: UiTool): string;
  create(ctx: UiContext): UiTool;
  /** The plan preview while the tool is on. */
  preview?(ctx: UiContext, tool: UiTool): ToolPreview;
  /**
   * The tool's options in the bar above the plan (direction, mode, type…). Props: `ctx`, `tool`.
   * Change `tool.options` and call `ctx.refresh()`.
   */
  bar?: Component;
}

/** Props an options-bar component receives. */
export interface ToolBarProps {
  ctx: UiContext;
  tool: UiTool;
}

/** A symbol on the plan (screen px around `at`): an SVG path, optional text, outline or filled. */
export interface PlanMark {
  id: string;
  at: V;
  path: string;
  text?: string;
  filled?: boolean;
}

export interface PlanLink {
  key: string;
  a: V;
  b: V;
}

/** A panel section. Props given: `ctx: UiContext` + `element: Element` (element panel) or `roomKey` (room panel). */
export type PanelSection = Component;

export interface ModuleUi {
  moduleId: string;
  /** i18n key of the module's name (Settings → Modules). */
  name: string;
  /** On for a new user? (Owner: modules are opt-in for each role.) */
  defaultOn: boolean;
  /** The module's own strings, per locale ("en", "pt-BR"). */
  messages: Readonly<Record<string, Readonly<Record<string, string>>>>;
  tools?: readonly ToolContribution[];
  marks?(ctx: UiContext): PlanMark[];
  links?(ctx: UiContext): PlanLink[];
  /** Element types whose panel this module draws, and the section component. */
  elementTypes?: readonly string[];
  elementPanel?: PanelSection;
  /** A section in the room panel (each room). */
  roomPanel?: PanelSection;
  /**
   * Sections added to the panels of the core's own elements ("wall", "opening", "slab"), under the app's
   * fields. Props: `ctx` + `element` (as `elementPanel`). ADR-059 step 2.
   */
  sections?: Readonly<Partial<Record<"wall" | "opening" | "slab", PanelSection>>>;
  /** Switched on: start its session (analysis, panels, marks). `ctx` always returns the current context. */
  start?(ctx: () => UiContext): ModuleSession;
  /** Dev only (`?demo=module`): add sample items; returns an item and a room key to select. */
  demo?(ctx: UiContext): { item: string; room: string } | null;
}

/** How serious a mark is (never a green / "OK" level: SAFETY_AND_LIABILITY). */
export type Severity = "critical" | "warning" | "advisory" | "info";

/** What a running module draws on the plan (ADR-059 step 3). All optional. */
export interface PlanLayers {
  /** A "!" per element, coloured by severity. */
  badges?: readonly { id: string; at: V; severity: Severity }[];
  /** A lock symbol; `broken` = drawn as a warning. */
  locks?: readonly { id: string; at: V; broken: boolean }[];
  /** Dashed lines where something used to be. */
  ghosts?: readonly { id: string; a: V; b: V }[];
  /** Two-headed arrows (e.g. joist direction). */
  arrows?: readonly { key: string; a: V; b: V }[];
  /** Outlined areas with a clickable badge (e.g. drawn slabs). */
  areas?: readonly { id: string; outline: readonly V[]; at: V; label: string; selected?: boolean }[];
}

/** Numbered notes for an exported sheet: each item gets a number on the plan and a line on the notes page. */
export interface ExportNotes {
  /**
   * Worst first. Each gets a number; `at` places it on the plan (one mark per element, its numbers
   * joined; null = listed on the notes page only).
   */
  items: readonly { elementId: string; at: V | null; severity: Severity; text: string }[];
  /** "No issues detected by the N checks…" wording uses this count. */
  checksRun: number;
  /** Closing text of the notes page. */
  disclaimer: string;
}

/**
 * A module that's on and running (ADR-059 step 3): created by `ModuleUi.start` when the module is
 * switched on (inside the app's reactive scope, so it may use Vue refs / watchers), stopped when it's
 * switched off. Results it computes live here; the app reads them through these hooks.
 */
export interface ModuleSession {
  stop(): void;
  /** Re-run its analysis now (dev demos; normally it follows the history itself). */
  refresh?(): void;
  /** A floating panel over the plan, bottom-left (the app draws the frame). Props: `ctx`. */
  overlay?: Component;
  plan?(ctx: UiContext): PlanLayers;
  /** Element id → severity, coloured in the 3D view. */
  marks3d?(ctx: UiContext): Readonly<Record<string, Severity>>;
  /** Notes for an exported floor (the export's "marks" option); null = nothing to add. */
  exportNotes?(ctx: UiContext, levelId: string): ExportNotes | null;
}

/** Narrow helper for module authors: the props panel sections receive. */
export interface ElementPanelProps {
  ctx: UiContext;
  element: Element;
}
export interface RoomPanelProps {
  ctx: UiContext;
  roomKey: string;
}
