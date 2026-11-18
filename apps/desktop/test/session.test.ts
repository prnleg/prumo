import {
  CORE_API_VERSION,
  History,
  ModuleHost,
  counterIds,
  emptyProject,
  openProjectFile,
  putCommand,
  saveProjectFile,
  type Project,
  type Wall,
} from "@prumo/core";
import { architectManifest } from "@prumo/module-architect";
import { describe, expect, it } from "vitest";
import type { OpenedFile, Platform } from "../src/platform/types";
import { Session } from "../src/session";

const NOW = "2026-11-16T12:00:00.000Z";
const blank = () => emptyProject({ id: "p", levelId: "l-1", name: "x", now: NOW, profileId: "br" });
const wall: Wall = {
  id: "w",
  type: "wall",
  levelId: "l-1",
  start: { x: 0, y: 0 },
  end: { x: 4000, y: 0 },
  alignment: "center",
  kind: "full",
  thickness: 140,
  height: 2700,
  baseOffset: 0,
  components: {},
};

/** A scripted platform: answers queued up front, writes captured. */
function fakePlatform(
  o: { savePath?: string | null; open?: OpenedFile | null; answers?: boolean[]; app?: Map<string, Uint8Array> } = {},
) {
  const writes: { path: string; bytes: Uint8Array }[] = [];
  const asked: string[] = [];
  const answers = [...(o.answers ?? [])];
  /** The app-data folder (recovery copies), shared when passed in: "the next launch". */
  const app = o.app ?? new Map<string, Uint8Array>();
  const p: Platform = {
    kind: "desktop",
    pickSavePath: async () => (o.savePath === undefined ? "/tmp/casa.prumo" : o.savePath),
    pickOpenFile: async () => o.open ?? null,
    writeFile: async (path, bytes) => void writes.push({ path, bytes }),
    ask: async (m) => (asked.push(m), answers.shift() ?? false),
    setTitle: async () => {},
    onCloseRequested: () => {},
    readAppText: async () => null,
    writeAppText: async () => {},
    readAppBytes: async (n) => app.get(n) ?? null,
    writeAppBytes: async (n, b) => void app.set(n, b),
    listAppFiles: async (dir) =>
      [...app.keys()].filter((n) => n.startsWith(`${dir}/`)).map((n) => n.slice(dir.length + 1)),
    removeAppFile: async (n) => void app.delete(n),
    appVersion: async () => "test",
    openUrl: async () => false,
  };
  return { p, writes, asked, app };
}

function setup(plat: Platform, modules = new ModuleHost([architectManifest])) {
  const h = new History(blank());
  const s = new Session(
    h,
    modules,
    plat,
    (k, params) => (params ? `${k} ${JSON.stringify(params)}` : k),
    blank,
    counterIds("s"),
    () => NOW,
  );
  return { h, s };
}

describe("file session (New / Open / Save)", () => {
  it("first Save asks where; later Saves don't; the title shows unsaved changes", async () => {
    const f = fakePlatform();
    const { h, s } = setup(f.p);
    h.execute(putCommand({ key: "x" }, [wall]));
    expect(s.title).toBe("• project.untitled.prumo — Prumo");
    expect(await s.save()).toEqual({ ok: true });
    expect([s.path, s.fileName, s.title]).toEqual(["/tmp/casa.prumo", "casa.prumo", "casa.prumo — Prumo"]);
    h.execute(putCommand({ key: "x" }, [{ ...wall, thickness: 200 }]));
    await s.save();
    expect(f.writes.map((w) => w.path)).toEqual(["/tmp/casa.prumo", "/tmp/casa.prumo"]);
  });

  it("start screen: begin() replaces the document without asking; the first Save still asks where", async () => {
    const f = fakePlatform({ answers: [] });
    const { h, s } = setup(f.p);
    h.execute(putCommand({ key: "x" }, [wall]));
    await s.save();
    const ex = putCommand({ key: "x" }, [{ ...wall, id: "e" }]).apply(blank());
    s.begin(ex, "Casa pequena");
    expect(f.asked).toEqual([]);
    expect([s.path, s.fileName, h.dirty, h.canUndo]).toEqual([null, "Casa pequena.prumo", false, false]);
    expect(Object.keys(h.current.elements)).toEqual(["e"]);
    s.begin();
    expect([s.fileName, Object.keys(h.current.elements)]).toEqual(["project.untitled.prumo", []]);
  });

  it("cancelling the save dialog changes nothing", async () => {
    const f = fakePlatform({ savePath: null });
    const { h, s } = setup(f.p);
    h.execute(putCommand({ key: "x" }, [wall]));
    expect(await s.save()).toEqual({ ok: false, reason: "cancelled" });
    expect(h.dirty).toBe(true);
  });

  it("save → open round trip restores the model (fresh session)", async () => {
    const a = fakePlatform();
    const one = setup(a.p);
    one.h.execute(putCommand({ key: "x" }, [wall]));
    await one.s.save();
    const b = fakePlatform({ open: { name: "casa.prumo", bytes: a.writes[0]!.bytes, path: "/tmp/casa.prumo" } });
    const two = setup(b.p);
    expect(await two.s.open()).toEqual({ ok: true });
    expect(two.h.current.elements["w"]).toEqual(wall);
    expect([two.h.dirty, two.h.canUndo, two.s.fileName]).toEqual([false, false, "casa.prumo"]);
  });

  it("unsaved changes: New/Open ask first; 'no' keeps everything", async () => {
    const f = fakePlatform({ answers: [false, true] });
    const { h, s } = setup(f.p);
    h.execute(putCommand({ key: "x" }, [wall]));
    expect(await s.newProject()).toEqual({ ok: false, reason: "cancelled" });
    expect(h.current.elements["w"]).toBeDefined();
    expect(await s.newProject()).toEqual({ ok: true });
    expect(h.current.elements).toEqual({});
    expect(f.asked).toHaveLength(2);
  });

  it("a broken file is refused with a message; the current document stays", async () => {
    const f = fakePlatform({ open: { name: "x.prumo", bytes: new Uint8Array([1, 2, 3]), path: "/x" } });
    const { h, s } = setup(f.p);
    h.execute(putCommand({ key: "x" }, [wall]));
    h.markSaved();
    const r = await s.open();
    expect(r.ok).toBe(false);
    expect(h.current.elements["w"]).toBeDefined();
  });

  it("ADR-032: a module we don't have → ask; 'remove' = snapshot + ONE undoable step, unsaved", async () => {
    const elec = {
      id: "org.example.electrical",
      name: { key: "m" },
      version: "0.3.0",
      apiVersion: CORE_API_VERSION,
      dependsOn: [],
      elementTypes: [],
      component: { version: 1, migrations: {} },
    };
    const sender = new ModuleHost([architectManifest, elec]);
    const p: Project = putCommand({ key: "x" }, [
      { ...wall, components: { [elec.id]: { v: 1, data: { circuit: "C1" } } } },
    ]).apply(blank());
    const bytes = saveProjectFile({ project: p, snapshots: [], extra: {} }, sender);

    const no = setup(fakePlatform({ open: { name: "e.prumo", bytes, path: "/e" }, answers: [false] }).p);
    expect(await no.s.open()).toEqual({ ok: false, reason: "cancelled" });

    const f = fakePlatform({ open: { name: "e.prumo", bytes, path: "/e" }, answers: [true] });
    const yes = setup(f.p);
    expect(await yes.s.open()).toEqual({ ok: true });
    expect(yes.h.current.elements["w"]!.components).toEqual({});
    expect([yes.h.dirty, yes.h.canUndo]).toEqual([true, true]);
    await yes.s.save();
    const { unzipSync } = await import("fflate");
    expect(Object.keys(unzipSync(f.writes[0]!.bytes)).sort()).toEqual(["project.json", "snapshots/s-1.json"]);
  });
});

describe("autosave + recovery (Q-111/126/129)", () => {
  const files = (app: Map<string, Uint8Array>) => [...app.keys()].sort();

  it("copies only unsaved changes, once per change; nothing while saved", async () => {
    const f = fakePlatform();
    const { h, s } = setup(f.p);
    expect(await s.autosave()).toBe(false); // clean
    h.execute(putCommand({ key: "x" }, [wall]));
    expect(await s.autosave()).toBe(true);
    expect(files(f.app)).toEqual(["recovery/p.json", "recovery/p.prumo"]);
    expect(await s.autosave()).toBe(false); // same model: no rewrite
    const meta = JSON.parse(new TextDecoder().decode(f.app.get("recovery/p.json")));
    expect(meta).toEqual({ v: 1, name: "project.untitled.prumo", path: null, savedAt: NOW });
  });

  it("not during a drag", async () => {
    const f = fakePlatform();
    const { h, s } = setup(f.p);
    h.execute(putCommand({ key: "x" }, [wall]));
    const g = h.beginGesture({ key: "x" });
    expect(await s.autosave()).toBe(false);
    g.cancel();
    expect(await s.autosave()).toBe(true);
  });

  it("saving removes the copy (resolved)", async () => {
    const f = fakePlatform();
    const { h, s } = setup(f.p);
    h.execute(putCommand({ key: "x" }, [wall]));
    await s.autosave();
    await s.save();
    expect(files(f.app)).toEqual([]);
  });

  it("discarding the changes (New → 'don't save') removes the copy; cancelling keeps it", async () => {
    const f = fakePlatform({ answers: [false, true] });
    const { h, s } = setup(f.p);
    h.execute(putCommand({ key: "x" }, [wall]));
    await s.autosave();
    expect(await s.confirmDiscard()).toBe(false);
    expect(files(f.app)).toHaveLength(2);
    expect(await s.confirmDiscard()).toBe(true);
    expect(files(f.app)).toEqual([]);
  });

  it("after a crash: listed at the next launch, recovered as unsaved work, kept until saved", async () => {
    const app = new Map<string, Uint8Array>();
    const before = setup(fakePlatform({ app }).p);
    before.h.execute(putCommand({ key: "x" }, [wall]));
    await before.s.autosave(); // …and the app crashes here

    const f = fakePlatform({ app });
    const { h, s } = setup(f.p);
    const list = await s.listRecovery();
    expect(list).toEqual([{ key: "p", name: "project.untitled.prumo", path: null, savedAt: NOW }]);
    expect(await s.recover(list[0]!)).toEqual({ ok: true });
    expect(Object.keys(h.current.elements)).toEqual(["w"]);
    expect([h.dirty, s.path, s.fileName]).toEqual([true, null, "project.untitled.prumo"]);
    expect(files(app)).toHaveLength(2); // still there: not resolved yet
    await s.save();
    expect(files(app)).toEqual([]);
  });

  it("discarding a copy asks first; a damaged copy is reported and kept", async () => {
    const app = new Map<string, Uint8Array>([["recovery/bad.prumo", new Uint8Array([1, 2, 3])]]);
    const f = fakePlatform({ app, answers: [false, true] });
    const { s } = setup(f.p);
    const [e] = await s.listRecovery();
    expect(e).toEqual({ key: "bad", name: "bad.prumo", path: null, savedAt: "" });
    const r = await s.recover(e!);
    expect(r.ok).toBe(false);
    expect(files(app)).toEqual(["recovery/bad.prumo"]);
    expect(await s.discardRecovery(e!)).toBe(false);
    expect(files(app)).toEqual(["recovery/bad.prumo"]);
    expect(await s.discardRecovery(e!)).toBe(true);
    expect(files(app)).toEqual([]);
  });
});

describe("the existing building (ADR-043)", () => {
  it("marking snapshots the plan, is undoable, makes the file unsaved and survives save → open", async () => {
    const f = fakePlatform();
    const { h, s } = setup(f.p);
    h.execute(putCommand({ key: "x" }, [wall]));
    await s.save();
    expect(s.baselineProject()).toBeNull();
    s.markBaseline();
    expect(h.dirty).toBe(true);
    expect(Object.keys(s.baselineProject()!.elements)).toEqual(["w"]);
    expect(s.baselineProject()!.settings.baseline).toBeUndefined(); // no pointer inside the snapshot
    expect(s.baselineDate()).toBe(NOW);
    h.execute(putCommand({ key: "x" }, [{ ...wall, id: "w2", start: { x: 0, y: 3000 }, end: { x: 4000, y: 3000 } }]));
    expect(Object.keys(s.baselineProject()!.elements)).toEqual(["w"]); // later edits don't change it
    await s.save();
    const g = fakePlatform({ open: { name: "casa.prumo", bytes: f.writes.at(-1)!.bytes, path: "/tmp/casa.prumo" } });
    const two = setup(g.p);
    await two.s.open();
    expect(Object.keys(two.s.baselineProject()!.elements)).toEqual(["w"]);
    h.undo();
    h.undo();
    expect(s.baselineProject()).toBeNull();
  });
});

describe("hand-off (ADR-044 slice 3)", () => {
  it("hand to: snapshot 'Sent to Bruno #1' + log entry; survives save → open; take over asks first", async () => {
    const f = fakePlatform({ answers: [false, true] });
    const { h, s } = setup(f.p);
    h.execute(putCommand({ key: "x" }, [wall]));
    expect(s.handOff({ from: "Ana", to: "Bruno", message: "Your turn" })).toBe(true);
    expect(h.current.handoff).toEqual({
      holder: "Bruno",
      log: [{ kind: "hand", from: "Ana", to: "Bruno", at: NOW, message: "Your turn", snapshotId: "s-1" }],
    });
    await s.save();
    const g = fakePlatform({ open: { name: "casa.prumo", bytes: f.writes.at(-1)!.bytes, path: "/tmp/casa.prumo" } });
    const two = setup(g.p);
    await two.s.open();
    expect(two.h.current.handoff?.holder).toBe("Bruno");
    // the snapshot travelled with the file (named for the recipient)
    const opened = openProjectFile(f.writes.at(-1)!.bytes, { installedModules: [architectManifest.id] });
    expect(opened.status === "ok" && opened.file.snapshots.map((x) => [x.name, x.author])).toEqual([
      ['handoff.snapshotName {"name":"Bruno","n":1}', "Ana"],
    ]);
    // Carla takes over: the first answer is "no" (nothing happens), the second "yes"
    expect(await s.takeOver("Carla")).toBe(false);
    expect(h.current.handoff?.holder).toBe("Bruno");
    expect(await s.takeOver("Carla")).toBe(true);
    expect(h.current.handoff?.log.at(-1)).toEqual({ kind: "take", from: "Bruno", to: "Carla", at: NOW });
    expect(f.asked).toHaveLength(2);
  });
});

describe("saved versions (Q-124)", () => {
  it("delete makes the file unsaved; the existing building can't be deleted while in use; clean copy has none", async () => {
    const f = fakePlatform();
    const { h, s } = setup(f.p);
    h.execute(putCommand({ key: "x" }, [wall]));
    s.markBaseline();
    s.handOff({ from: "Ana", to: "Bruno" });
    await s.save();
    expect(s.snapshotList().map((v) => v.id)).toEqual(["s-1", "s-2"]);
    expect(s.snapshotsSize()).toBeGreaterThan(0);
    expect(s.deleteSnapshot("s-1")).toBe(false); // the existing building, in use
    expect(s.deleteSnapshot("s-2")).toBe(true);
    expect(h.dirty).toBe(true);
    expect(s.snapshotList().map((v) => v.id)).toEqual(["s-1"]);
    expect(await s.exportClean()).toEqual({ ok: true });
    const clean = openProjectFile(f.writes.at(-1)!.bytes, { installedModules: [architectManifest.id] });
    expect(clean.status === "ok" && [clean.file.snapshots.length, clean.file.project.settings.baseline]).toEqual([
      0,
      undefined,
    ]);
    expect(s.path).toBe("/tmp/casa.prumo"); // the open file didn't change
  });
});
