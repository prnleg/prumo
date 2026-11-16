import {
  CORE_API_VERSION,
  History,
  ModuleHost,
  counterIds,
  emptyProject,
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
function fakePlatform(o: { savePath?: string | null; open?: OpenedFile | null; answers?: boolean[] } = {}) {
  const writes: { path: string; bytes: Uint8Array }[] = [];
  const asked: string[] = [];
  const answers = [...(o.answers ?? [])];
  const p: Platform = {
    kind: "desktop",
    pickSavePath: async () => (o.savePath === undefined ? "/tmp/casa.prumo" : o.savePath),
    pickOpenFile: async () => o.open ?? null,
    writeFile: async (path, bytes) => void writes.push({ path, bytes }),
    ask: async (m) => (asked.push(m), answers.shift() ?? false),
    setTitle: async () => {},
    onCloseRequested: () => {},
  };
  return { p, writes, asked };
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
