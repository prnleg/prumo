// The open document's file lifecycle: New / Open / Save / Save as, unsaved-changes guard, the ADR-032
// missing-module stop, read-only files. Framework-free and platform-injected, so it is unit-tested.
import {
  SaveError,
  openWithModules,
  removeModuleCommand,
  saveProjectFile,
  setBaselineCommand,
  snapshotBefore,
  type History,
  type IdSource,
  type ModuleHost,
  type Project,
  type ProjectFile,
} from "@prumo/core";
import { PRUMO_EXT, baseName, type Platform } from "./platform/types";
import { RecoveryStore, recoveryKey, type RecoveryEntry } from "./recovery";

export type Translate = (key: string, params?: Record<string, string | number>) => string;

export type Outcome =
  { ok: true } | { ok: false; reason: "cancelled" } | { ok: false; reason: "error"; message: string };

export class Session {
  /** Where Save writes without asking (null = never saved / browser build). */
  path: string | null = null;
  fileName: string;
  /** Not editable-savable: e.g. data from a newer module version. Shown as a banner. */
  readOnly: string | null = null;
  private snapshots: ProjectFile["snapshots"] = [];
  private extra: ProjectFile["extra"] = {};
  /** Last model written as a recovery copy (skip identical copies). */
  private autosaved: Project | null = null;
  private readonly recovery: RecoveryStore;

  constructor(
    private readonly history: History,
    private readonly modules: ModuleHost,
    private readonly platform: Platform,
    private readonly t: Translate,
    private readonly makeNew: () => Project,
    private readonly ids: IdSource,
    private readonly now: () => string,
  ) {
    this.fileName = this.untitled();
    this.recovery = new RecoveryStore(platform);
  }

  get title(): string {
    return `${this.history.dirty ? "• " : ""}${this.fileName} — Prumo`;
  }

  private untitled() {
    return `${this.t("project.untitled")}.${PRUMO_EXT}`;
  }

  /** True when it's fine to drop the current document (saved, or the user said so). */
  async confirmDiscard(): Promise<boolean> {
    if (!this.history.dirty) return true;
    const yes = await this.platform.ask(this.t("file.discard.message", { name: this.fileName }), {
      title: this.t("file.discard.title"),
      ok: this.t("file.discard.ok"),
      cancel: this.t("file.discard.cancel"),
    });
    if (yes) await this.dropRecovery(); // the user chose to lose these changes: resolved (Q-129)
    return yes;
  }

  // --- autosave + recovery (Q-111/126/129) ---------------------------------------------------

  /** Write a recovery copy if there are unsaved changes not yet copied. Never interrupts the user. */
  async autosave(): Promise<boolean> {
    const p = this.history.current;
    if (!this.history.dirty || this.history.inGesture || this.readOnly || p === this.autosaved) return false;
    try {
      const bytes = saveProjectFile({ project: p, snapshots: this.snapshots, extra: this.extra }, this.modules);
      await this.recovery.write(p.id, bytes, { name: this.fileName, path: this.path, savedAt: this.now() });
      this.autosaved = p;
      return true;
    } catch {
      return false; // e.g. disk full: try again next time; the document itself is untouched
    }
  }

  // --- "the existing building" (ADR-043) --------------------------------------------------------

  /** The marked existing building, or null. */
  baselineProject(): Project | null {
    const id = this.history.current.settings.baseline;
    return (id && this.snapshots.find((s) => s.id === id)?.project) || null;
  }

  /** When it was marked (ISO), or null. */
  baselineDate(): string | null {
    const id = this.history.current.settings.baseline;
    return (id && this.snapshots.find((s) => s.id === id)?.createdAt) || null;
  }

  /**
   * Mark the current plan as the existing building: a named snapshot in the file + an undoable pointer
   * to it (so the document becomes unsaved). Undo removes the pointer; the snapshot stays in the file's
   * history (snapshots aren't part of undo).
   */
  markBaseline(): void {
    const { baseline: _old, ...settings } = this.history.current.settings;
    void _old;
    const snap = snapshotBefore(
      { ...this.history.current, settings },
      { id: this.ids(), name: this.t("baseline.snapshotName"), now: this.now(), author: null },
    );
    this.snapshots = [...this.snapshots, snap];
    this.history.execute(setBaselineCommand(snap.id));
  }

  clearBaseline(): void {
    this.history.execute(setBaselineCommand(undefined));
  }

  listRecovery(): Promise<RecoveryEntry[]> {
    return this.recovery.list();
  }

  /**
   * Open a recovery copy as unsaved work (Save asks where, suggesting the old name). The copy stays
   * until this work is saved or discarded, and autosave keeps refreshing it.
   */
  async recover(entry: RecoveryEntry): Promise<Outcome> {
    if (!(await this.confirmDiscard())) return { ok: false, reason: "cancelled" };
    const bytes = await this.recovery.read(entry.key);
    if (!bytes) return { ok: false, reason: "error", message: this.t("recovery.unreadable", { name: entry.name }) };
    const r = await this.openBytes(bytes, entry.name, null);
    if (r.ok) this.history.markUnsaved();
    else if (r.reason === "error") r.message = this.t("recovery.unreadable", { name: entry.name });
    return r;
  }

  /** Delete a recovery copy after the user confirms (Q-129: only when they say so). */
  async discardRecovery(entry: RecoveryEntry): Promise<boolean> {
    const yes = await this.platform.ask(this.t("recovery.discard.message", { name: entry.name }), {
      title: this.t("recovery.discard.title"),
      ok: this.t("recovery.discard.ok"),
      cancel: this.t("file.discard.cancel"),
    });
    if (yes) await this.recovery.clear(entry.key).catch(() => {});
    return yes;
  }

  private async dropRecovery() {
    this.autosaved = null;
    await this.recovery.clear(recoveryKey(this.history.current.id)).catch(() => {});
  }

  async newProject(): Promise<Outcome> {
    if (!(await this.confirmDiscard())) return { ok: false, reason: "cancelled" };
    this.reset(this.makeNew(), null, this.untitled(), { snapshots: [], extra: {} });
    return { ok: true };
  }

  /**
   * Start screen: replace the document with `p` (blank or an example) as a new, never-saved file.
   * No question here: the caller already got the user's OK (confirmDiscard) before showing the screen.
   */
  begin(p: Project = this.makeNew(), name?: string): void {
    this.reset(p, null, name ? `${name}.${PRUMO_EXT}` : this.untitled(), { snapshots: [], extra: {} });
  }

  async save(as = false): Promise<Outcome> {
    if (this.readOnly) return { ok: false, reason: "error", message: this.t("file.readOnlyNoSave") };
    let path = as ? null : this.path;
    if (!path) path = await this.platform.pickSavePath(this.fileName);
    if (!path) return { ok: false, reason: "cancelled" };
    try {
      const bytes = saveProjectFile(
        { project: this.history.current, snapshots: this.snapshots, extra: this.extra },
        this.modules,
      );
      await this.platform.writeFile(path, bytes);
    } catch (e) {
      const message =
        e instanceof SaveError ? this.t("file.saveMissingModules") : this.t("file.saveFailed", { error: String(e) });
      return { ok: false, reason: "error", message };
    }
    if (this.platform.kind === "desktop") this.path = path;
    this.fileName = baseName(path);
    this.history.markSaved();
    await this.dropRecovery(); // saved: resolved (Q-129)
    return { ok: true };
  }

  /** `confirmed`: the user already agreed to drop unsaved changes (start screen). */
  async open(confirmed = false): Promise<Outcome> {
    if (!confirmed && !(await this.confirmDiscard())) return { ok: false, reason: "cancelled" };
    const f = await this.platform.pickOpenFile();
    if (!f) return { ok: false, reason: "cancelled" };
    return this.openBytes(f.bytes, f.name, f.path);
  }

  private async openBytes(bytes: Uint8Array, name: string, path: string | null): Promise<Outcome> {
    const f = { name, path };
    const r = openWithModules(bytes, this.modules);
    switch (r.status) {
      case "ok":
        this.reset(r.file.project, f.path, f.name, r.file);
        return { ok: true };
      case "invalid":
        return { ok: false, reason: "error", message: this.t("file.invalid", { name: f.name }) };
      case "read-only":
        // Newer FILE format: we can't trust today's model to show it → refuse with "update Prumo".
        if (r.reason === "newer-schema") return { ok: false, reason: "error", message: this.t("file.newerApp") };
        this.reset(r.file.project, f.path, f.name, r.file);
        this.readOnly = this.t("file.newerModule", { modules: r.modules.map((m) => m.moduleId).join(", ") });
        return { ok: true };
      case "missing-modules": {
        // ADR-032: stop; the only choice we can offer with bundled modules is "remove those items".
        const yes = await this.platform.ask(this.t("file.missing.message", { modules: r.modules.join(", ") }), {
          title: this.t("file.missing.title"),
          ok: this.t("file.missing.remove"),
          cancel: this.t("file.discard.cancel"),
        });
        if (!yes) return { ok: false, reason: "cancelled" };
        const snap = snapshotBefore(r.file.project, {
          id: this.ids(),
          name: this.t("file.missing.snapshot", { modules: r.modules.join(", ") }),
          now: this.now(),
          author: null,
        });
        // Installed modules' data may still need migrating: do it first, so the removal below stays
        // an ordinary undoable, unsaved edit (ADR-032: "the removal is an undoable command").
        this.reset(this.modules.migrateComponents(r.file.project).project, f.path, f.name, {
          snapshots: [...r.file.snapshots, snap],
          extra: r.file.extra,
        });
        for (const m of r.modules) this.history.execute(removeModuleCommand(m, this.history.current));
        return { ok: true };
      }
    }
  }

  private reset(p: Project, path: string | null, name: string, file: Pick<ProjectFile, "snapshots" | "extra">) {
    this.history.load(p);
    this.path = path;
    this.fileName = name;
    this.snapshots = file.snapshots;
    this.extra = file.extra;
    this.readOnly = null;
    this.autosaved = null;
  }
}
