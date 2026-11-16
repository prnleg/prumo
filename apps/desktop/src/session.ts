// The open document's file lifecycle: New / Open / Save / Save as, unsaved-changes guard, the ADR-032
// missing-module stop, read-only files. Framework-free and platform-injected, so it is unit-tested.
import {
  SaveError,
  openWithModules,
  removeModuleCommand,
  saveProjectFile,
  snapshotBefore,
  type History,
  type IdSource,
  type ModuleHost,
  type Project,
  type ProjectFile,
} from "@prumo/core";
import { PRUMO_EXT, baseName, type Platform } from "./platform/types";

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
    return this.platform.ask(this.t("file.discard.message", { name: this.fileName }), {
      title: this.t("file.discard.title"),
      ok: this.t("file.discard.ok"),
      cancel: this.t("file.discard.cancel"),
    });
  }

  async newProject(): Promise<Outcome> {
    if (!(await this.confirmDiscard())) return { ok: false, reason: "cancelled" };
    this.reset(this.makeNew(), null, this.untitled(), { snapshots: [], extra: {} });
    return { ok: true };
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
    return { ok: true };
  }

  async open(): Promise<Outcome> {
    if (!(await this.confirmDiscard())) return { ok: false, reason: "cancelled" };
    const f = await this.platform.pickOpenFile();
    if (!f) return { ok: false, reason: "cancelled" };
    const r = openWithModules(f.bytes, this.modules);
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
  }
}
