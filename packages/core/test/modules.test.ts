import { describe, expect, it } from "vitest";
import {
  ExportError,
  History,
  ModuleError,
  ModuleHost,
  SaveError,
  exportCopy,
  moduleFootprint,
  openProjectFile,
  openWithModules,
  putCommand,
  removeModuleCommand,
  saveProjectFile,
  snapshotBefore,
  type Element,
  type ModuleElement,
  type Project,
} from "../src";
import { ARCH, ELEC, NOW, SENDER, archManifest, blank, elecManifest, manifest, wall } from "./fixtures";

const L = (key: string) => ({ key });

describe("ModuleHost registration (MODULES §2–3)", () => {
  it("rejects duplicates, wrong API, un-namespaced element types, missing dependencies", () => {
    expect(() => new ModuleHost([archManifest(), archManifest()])).toThrow("duplicate module");
    expect(() => new ModuleHost([manifest("a.b", { apiVersion: "9.9" })])).toThrow("targets API 9.9");
    expect(() => new ModuleHost([manifest("a.b", { elementTypes: ["outlet"] })])).toThrow('must be "a.b:<name>"');
    expect(() => new ModuleHost([manifest("a.b", { elementTypes: ["a.b:"] })])).toThrow(ModuleError);
    expect(() => new ModuleHost([manifest("a.b", { dependsOn: ["c.d"] })])).toThrow("depends on missing module c.d");
  });

  it("disabling a module disables its dependents (rule 7 keeps their data)", () => {
    const h = new ModuleHost([archManifest(), manifest("org.prumo.structural", { dependsOn: [ARCH] })], {
      disabled: [ARCH],
    });
    expect(h.isEnabled(ARCH)).toBe(false);
    expect(h.isEnabled("org.prumo.structural")).toBe(false);
    expect(h.isInstalled("org.prumo.structural")).toBe(true);
    expect(() => h.contextFor(ARCH)).toThrow("is disabled");
  });
});

describe("module context: namespaced writes (rule 4)", () => {
  const ctx = SENDER.contextFor(ELEC);
  const w = wall("w-1", 0, 0, 4000, 0, { components: { [ARCH]: { v: 1, data: { finish: "paint" } } } });

  it("setComponent writes only its own namespace, versioned, and copies the data", () => {
    const data = { circuit: "C1" };
    const w2 = ctx.setComponent(w, data);
    data.circuit = "changed";
    expect(w2.components).toEqual({
      [ARCH]: { v: 1, data: { finish: "paint" } },
      [ELEC]: { v: 3, data: { circuit: "C1" } },
    });
    expect(w.components[ELEC]).toBeUndefined(); // input untouched (immutable)
    expect(ctx.getComponent(w2)).toEqual({ circuit: "C1" });
    expect(ctx.clearComponent(w2).components).toEqual(w.components);
  });

  it("createElement only for owned types", () => {
    expect(ctx.createElement(`${ELEC}:outlet`, { id: "e-1", levelId: "l-1" })).toEqual({
      id: "e-1",
      levelId: "l-1",
      type: `${ELEC}:outlet`,
      ownerModule: ELEC,
      components: {},
    });
    expect(() => ctx.createElement(`${ARCH}:sofa`, { id: "x", levelId: "l-1" })).toThrow("does not own type");
  });
});

describe("component migrations (rule 6)", () => {
  // Electrical v1 { amps: number } → v2 { current: { a } } → v3 adds { phase: "?" }.
  const host = new ModuleHost([
    archManifest(),
    manifest(ELEC, {
      component: {
        version: 3,
        migrations: {
          1: (d) => ({ current: { a: (d as { amps: number }).amps } }),
          2: (d) => ({ ...(d as object), phase: "?" }),
        },
      },
    }),
  ]);

  it("v1 → v3 through each step; other modules and up-to-date components untouched", () => {
    const p = putCommand(L("x"), [
      wall("w-1", 0, 0, 4000, 0, {
        components: { [ELEC]: { v: 1, data: { amps: 10 } }, "x.unknown": { v: 7, data: 1 } },
      }),
      wall("w-2", 0, 0, 0, 4000, { components: { [ELEC]: { v: 3, data: { current: { a: 2 }, phase: "A" } } } }),
    ]).apply(blank());
    const r = host.migrateComponents(p);
    expect(r.newer).toEqual([]);
    expect(r.project.elements["w-1"]!.components).toEqual({
      [ELEC]: { v: 3, data: { current: { a: 10 }, phase: "?" } },
      "x.unknown": { v: 7, data: 1 },
    });
    expect(r.project.elements["w-2"]).toBe(p.elements["w-2"]);
    expect(p.elements["w-1"]!.components[ELEC]).toEqual({ v: 1, data: { amps: 10 } }); // input untouched
  });

  it("nothing to migrate → same project object", () => {
    const p = blank();
    expect(host.migrateComponents(p).project).toBe(p);
  });

  it("a component newer than the installed module is reported (caller opens read-only)", () => {
    const p = putCommand(L("x"), [wall("w-1", 0, 0, 1, 0, { components: { [ELEC]: { v: 5, data: {} } } })]).apply(
      blank(),
    );
    expect(host.migrateComponents(p).newer).toEqual([{ moduleId: ELEC, v: 5 }]);
  });
});

/** Engineer's project: walls with Architect + Electrical data, an outlet hosted on a wall. */
function engineersProject(): Project {
  const outlet: ModuleElement = {
    id: "e-1",
    type: `${ELEC}:outlet`,
    ownerModule: ELEC,
    levelId: "l-1",
    host: { elementId: "w-1", offset: 500 },
    components: { [ELEC]: { v: 3, data: { h: 300 } } },
  };
  const els: Element[] = [
    wall("w-1", 0, 0, 4000, 0, {
      components: { [ARCH]: { v: 1, data: { finish: "paint" } }, [ELEC]: { v: 3, data: { conduit: true } } },
    }),
    wall("w-2", 4000, 0, 4000, 3000),
    outlet,
  ];
  return putCommand(L("x"), els).apply(blank());
}

describe("footprint, removal, export (ADR-032, MODULES §8)", () => {
  it("footprint separates owned elements from elements that only carry data (Q-132)", () => {
    expect(moduleFootprint(engineersProject(), ELEC)).toEqual({ owned: ["e-1"], withData: ["w-1"] });
  });

  it("removal is one undoable step; walls stay, their Electrical data goes", () => {
    const h = new History(engineersProject(), { freeze: true });
    const before = h.current;
    const cmd = removeModuleCommand(ELEC, h.current);
    expect(cmd.label).toEqual({ key: "cmd.removeModuleData", params: { module: ELEC, owned: 1, withData: 1 } });
    expect(h.execute(cmd).ok).toBe(true);
    expect(Object.keys(h.current.elements)).toEqual(["w-1", "w-2"]);
    expect(h.current.elements["w-1"]!.components).toEqual({ [ARCH]: { v: 1, data: { finish: "paint" } } });
    h.undo();
    expect(h.current).toBe(before);
  });

  it("export without Electrical strips project AND snapshots, never the working file; required modules refuse", () => {
    const p = engineersProject();
    const f = {
      project: p,
      snapshots: [snapshotBefore(p, { id: "s-1", name: "v1", now: NOW, author: null })],
      extra: {},
    };
    const copy = exportCopy(f, [ELEC], (m) => SENDER.manifest(m)?.required === true);
    expect(moduleFootprint(copy.project, ELEC)).toEqual({ owned: [], withData: [] });
    expect(moduleFootprint(copy.snapshots[0]!.project, ELEC)).toEqual({ owned: [], withData: [] });
    expect(moduleFootprint(f.project, ELEC).owned).toEqual(["e-1"]);
    expect(() => exportCopy(f, [ARCH], (m) => SENDER.manifest(m)?.required === true)).toThrow(ExportError);
  });
});

describe("save guard + usage record (rule 13)", () => {
  const archOnly = new ModuleHost([archManifest()]);

  it("refuses to save data from a module that isn't installed", () => {
    expect(() => saveProjectFile({ project: engineersProject(), snapshots: [], extra: {} }, archOnly)).toThrow(
      SaveError,
    );
  });

  it("usage record = exactly the referenced modules, with installed versions (stale entries dropped)", () => {
    const p: Project = {
      ...engineersProject(),
      modules: { "old.gone": { version: "1.0.0" }, [ELEC]: { version: "0.0.1" } },
    };
    const h = new ModuleHost([archManifest(), elecManifest(), manifest("old.gone")]);
    const r = openProjectFile(saveProjectFile({ project: p, snapshots: [], extra: {} }, h), {
      installedModules: [ARCH, ELEC],
    });
    if (r.status !== "ok") throw new Error(r.status);
    expect(r.file.project.modules).toEqual({ [ARCH]: { version: "0.1.0" }, [ELEC]: { version: "0.3.0" } });
  });
});

describe("end to end: engineer sends a project to an architect without Electrical (ADR-032)", () => {
  it("open → stop → snapshot + remove → save → reopen ok; snapshot keeps the Electrical work (Q-131)", () => {
    const sent = saveProjectFile({ project: engineersProject(), snapshots: [], extra: {} }, SENDER);
    const archOnly = new ModuleHost([archManifest()]);

    const r = openProjectFile(sent, { installedModules: archOnly.installedIds() });
    expect(r.status).toBe("missing-modules");
    if (r.status !== "missing-modules") return;
    expect(r.modules).toEqual([ELEC]);

    // User picks "Remove those items…": automatic snapshot first, then an undoable command.
    const snap = snapshotBefore(r.file.project, {
      id: "s-auto",
      name: "Before removing Electrical items",
      now: NOW,
      author: null,
    });
    const h = new History(r.file.project);
    h.execute(removeModuleCommand(ELEC, h.current));
    const saved = saveProjectFile({ project: h.current, snapshots: [snap], extra: r.file.extra }, archOnly);

    const again = openProjectFile(saved, { installedModules: archOnly.installedIds() });
    expect(again.status).toBe("ok");
    if (again.status !== "ok") return;
    expect(moduleFootprint(again.file.project, ELEC)).toEqual({ owned: [], withData: [] });
    expect(moduleFootprint(again.file.snapshots[0]!.project, ELEC)).toEqual({ owned: ["e-1"], withData: ["w-1"] });
  });
});

describe("openWithModules: open + migrate", () => {
  const oldElec = new ModuleHost([archManifest(), manifest(ELEC, { component: { version: 1, migrations: {} } })]);
  const newElec = new ModuleHost([
    archManifest(),
    manifest(ELEC, { component: { version: 2, migrations: { 1: (d) => ({ ...(d as object), migrated: true }) } } }),
  ]);
  const p = putCommand(L("x"), [
    wall("w-1", 0, 0, 4000, 0, { components: { [ELEC]: { v: 1, data: { a: 1 } } } }),
  ]).apply(blank());

  it("older component data is migrated on open", () => {
    const r = openWithModules(saveProjectFile({ project: p, snapshots: [], extra: {} }, oldElec), newElec);
    if (r.status !== "ok") throw new Error(r.status);
    expect(r.file.project.elements["w-1"]!.components[ELEC]).toEqual({ v: 2, data: { a: 1, migrated: true } });
  });

  it("newer component data → read-only, file intact", () => {
    const q = newElec.migrateComponents(p).project;
    const r = openWithModules(saveProjectFile({ project: q, snapshots: [], extra: {} }, newElec), oldElec);
    expect(r.status).toBe("read-only");
    if (r.status === "read-only" && r.reason === "newer-module-data") {
      expect(r.modules).toEqual([{ moduleId: ELEC, v: 2 }]);
      expect(r.file.project.elements["w-1"]!.components[ELEC]!.v).toBe(2);
    } else throw new Error("wrong reason");
  });
});
