// Undo/redo (ADR-011): immutable snapshots + command objects. A command is a pure function
// project → project; undo restores the previous snapshot (structural sharing keeps that cheap),
// so commands never need hand-written inverse code that could drift.
// One user gesture = one undo step: a gesture previews freely and commits once (ADR-025 events).
import { changedIds, checkInvariants, type Label, type Problem } from "./edit";
import type { Project } from "./model";

export interface Command {
  label: Label;
  apply(p: Project): Project;
}

/** Several commands as one undo step (multi-element operations, removals with cascades). */
export function batch(label: Label, commands: readonly Command[]): Command {
  return { label, apply: (p) => commands.reduce((acc, c) => c.apply(acc), p) };
}

export type Result = { ok: true; project: Project } | { ok: false; problems: Problem[] };

/**
 * - `change`: the visible model changed (also during a gesture preview) → redraw.
 * - `commit`: a step settled (execute, gesture commit, undo, redo) → analysis may run; findings wait for
 *   the settle delay (ADR-025, 2 s) in the UI layer, never during a gesture.
 */
export type HistoryEvent =
  | { type: "change"; project: Project; reason: "execute" | "preview" | "cancel" | "undo" | "redo" }
  | { type: "commit"; project: Project; label: Label };

interface Entry {
  label: Label;
  before: Project;
  after: Project;
}

export interface HistoryOptions {
  /** Deep-freeze every snapshot so an accidental mutation throws (tests, dev builds). */
  freeze?: boolean;
}

export class HistoryError extends Error {}

export class Gesture {
  private preview_: Project;
  private done = false;
  constructor(
    private readonly h: History,
    readonly label: Label,
    readonly base: Project,
  ) {
    this.preview_ = base;
  }
  get project(): Project {
    return this.preview_;
  }
  /** Re-apply from the gesture's base (not cumulative), so a drag is "where is it now", not deltas. */
  preview(cmd: Command): Result {
    this.assertOpen();
    const r = this.h["tryApply"](this.base, cmd);
    if (r.ok) {
      this.preview_ = r.project;
      this.h["emit"]({ type: "change", project: r.project, reason: "preview" });
    }
    return r; // invalid preview keeps the last valid one (Q-072: block)
  }
  commit(): Project {
    this.assertOpen();
    this.done = true;
    this.h["endGesture"](this, this.preview_);
    return this.h.current;
  }
  cancel(): void {
    this.assertOpen();
    this.done = true;
    this.h["endGesture"](this, null);
  }
  private assertOpen() {
    if (this.done) throw new HistoryError("gesture already ended");
  }
}

export class History {
  private past: Entry[] = [];
  private future: Entry[] = [];
  private present: Project;
  private gesture: Gesture | null = null;
  private saved: Project;
  private readonly listeners = new Set<(e: HistoryEvent) => void>();

  constructor(
    initial: Project,
    private readonly opts: HistoryOptions = {},
  ) {
    this.present = this.prepare(initial);
    this.saved = this.present;
  }

  get current(): Project {
    return this.gesture ? this.gesture.project : this.present;
  }
  get canUndo() {
    return !this.gesture && this.past.length > 0;
  }
  get canRedo() {
    return !this.gesture && this.future.length > 0;
  }
  get undoLabel(): Label | null {
    return this.past.at(-1)?.label ?? null;
  }
  get redoLabel(): Label | null {
    return this.future.at(-1)?.label ?? null;
  }
  get inGesture() {
    return this.gesture !== null;
  }
  /** True when the committed model differs from the last saved one. */
  get dirty() {
    return this.present !== this.saved;
  }
  markSaved() {
    this.saved = this.present;
  }

  subscribe(fn: (e: HistoryEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  execute(cmd: Command): Result {
    this.assertIdle("execute");
    const r = this.tryApply(this.present, cmd);
    if (!r.ok) return r;
    if (r.project === this.present) return r; // no-op: no undo step
    this.push(cmd.label, r.project);
    this.emit({ type: "change", project: this.present, reason: "execute" });
    this.emit({ type: "commit", project: this.present, label: cmd.label });
    return r;
  }

  beginGesture(label: Label): Gesture {
    this.assertIdle("beginGesture");
    this.gesture = new Gesture(this, label, this.present);
    return this.gesture;
  }

  undo(): boolean {
    this.assertIdle("undo");
    const e = this.past.pop();
    if (!e) return false;
    this.future.push(e);
    this.present = e.before;
    this.emit({ type: "change", project: this.present, reason: "undo" });
    this.emit({ type: "commit", project: this.present, label: e.label });
    return true;
  }

  redo(): boolean {
    this.assertIdle("redo");
    const e = this.future.pop();
    if (!e) return false;
    this.past.push(e);
    this.present = e.after;
    this.emit({ type: "change", project: this.present, reason: "redo" });
    this.emit({ type: "commit", project: this.present, label: e.label });
    return true;
  }

  // --- internals (also used by Gesture) ---------------------------------------------------

  private tryApply(base: Project, cmd: Command): Result {
    const next = cmd.apply(base);
    if (next === base) return { ok: true, project: base };
    const problems = checkInvariants(next, changedIds(base, next));
    if (problems.length) return { ok: false, problems };
    return { ok: true, project: this.prepare(next) };
  }

  private endGesture(g: Gesture, result: Project | null) {
    if (this.gesture !== g) throw new HistoryError("not the active gesture");
    this.gesture = null;
    if (result === null || result === this.present) {
      this.emit({ type: "change", project: this.present, reason: "cancel" });
      return;
    }
    this.push(g.label, result);
    this.emit({ type: "commit", project: this.present, label: g.label });
  }

  private push(label: Label, next: Project) {
    this.past.push({ label, before: this.present, after: next });
    this.future = [];
    this.present = next;
  }

  private emit(e: HistoryEvent) {
    for (const fn of [...this.listeners]) fn(e);
  }

  private assertIdle(op: string) {
    if (this.gesture) throw new HistoryError(`${op} during an active gesture`);
  }

  private prepare(p: Project): Project {
    return this.opts.freeze ? deepFreeze(p) : p;
  }
}

/** Freezes recursively; stops at already-frozen objects (shared, unchanged subtrees). */
export function deepFreeze<T>(v: T): T {
  if (v === null || typeof v !== "object" || Object.isFrozen(v)) return v;
  Object.freeze(v);
  for (const k of Object.keys(v)) deepFreeze((v as Record<string, unknown>)[k]);
  return v;
}
