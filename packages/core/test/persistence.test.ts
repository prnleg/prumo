import { strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  CanonicalJsonError,
  canonicalJson,
  counterIds,
  modulesReferenced,
  nearlyEqual,
  openProjectFile,
  saveProjectFile,
  type Project,
  type ProjectFile,
  type Wall,
} from "../src";

import { ARCH, NOW, SENDER, blank } from "./fixtures";

const save = (f: ProjectFile) => saveProjectFile(f, SENDER);
const file = (project: Project): ProjectFile => ({ project, snapshots: [], extra: {} });
const open = (bytes: Uint8Array, installed = [ARCH]) => openProjectFile(bytes, { installedModules: installed });

function withWall(): Project {
  const p = blank();
  const w: Wall = {
    id: "w-1",
    type: "wall",
    levelId: "l-1",
    start: { x: 0, y: 0 },
    end: { x: 4000, y: 0 },
    alignment: "center",
    kind: "full",
    thickness: 140,
    height: 2700,
    baseOffset: 0,
    components: { [ARCH]: { v: 1, data: { finishes: { sideA: "paint-white" } } } },
  };
  p.elements[w.id] = w;
  p.elements["o-1"] = {
    id: "o-1",
    type: "opening",
    levelId: "l-1",
    host: { elementId: "w-1", offset: 1400 },
    width: 1200,
    height: 1200,
    sillHeight: 1000,
    kind: "window",
    components: {},
  };
  p.modules[ARCH] = { version: "0.1.0" };
  return p;
}

describe("empty project", () => {
  it("has one level and nothing else", () => {
    const p = blank();
    expect(p.levels).toHaveLength(1);
    expect(p.format).toBe("prumo-project");
    expect(p.schemaVersion).toBe(3);
    expect(modulesReferenced(p)).toEqual([]);
  });

  it("save → open → save is byte-identical (slice-1 exit check)", () => {
    const a = save(file(blank()));
    const r = open(a);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.file.project).toEqual(blank());
    expect(Buffer.from(save(r.file)).equals(Buffer.from(a))).toBe(true);
  });
});

describe("determinism", () => {
  it("same model, different key insertion order → same bytes", () => {
    const p = withWall();
    const shuffled = JSON.parse(JSON.stringify(p), (_k, v) =>
      v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).reverse()) : v,
    ) as Project;
    expect(Object.keys(shuffled)[0]).not.toBe(Object.keys(p)[0]);
    expect(Buffer.from(save(file(shuffled))).equals(Buffer.from(save(file(p))))).toBe(true);
  });

  it("two saves at different wall-clock times → same bytes (no timestamps leak in)", async () => {
    const a = save(file(withWall()));
    await new Promise((r) => setTimeout(r, 1100)); // zip times have 2 s resolution; cross a boundary-ish
    expect(Buffer.from(save(file(withWall()))).equals(Buffer.from(a))).toBe(true);
  });

  it("canonical JSON sorts keys, keeps arrays, normalizes -0, ends with a newline", () => {
    expect(canonicalJson({ b: 1, a: [3, 1, { d: -0, c: "é" }] })).toBe(
      '{\n  "a": [\n    3,\n    1,\n    {\n      "c": "é",\n      "d": 0\n    }\n  ],\n  "b": 1\n}\n',
    );
  });

  it("canonical JSON refuses undefined, NaN, Infinity, class instances", () => {
    expect(() => canonicalJson({ a: undefined })).toThrow(CanonicalJsonError);
    expect(() => canonicalJson([1, NaN])).toThrow("non-finite number at $[1]");
    expect(() => canonicalJson({ x: Infinity })).toThrow(CanonicalJsonError);
    expect(() => canonicalJson({ d: new Date(0) })).toThrow("non-plain object at $.d");
  });
});

describe("round trip with content", () => {
  it("walls, openings, components, snapshots, UTF-8 names survive", () => {
    const p = withWall();
    p.levels[0]!.name = "Térreo";
    const snap = { id: "s-1", name: "Antes da reforma", createdAt: NOW, author: "Dona Ana", project: blank() };
    const bytes = save({ project: p, snapshots: [snap], extra: {} });
    const r = open(bytes);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.file.project).toEqual(p);
    expect(r.file.snapshots).toEqual([snap]);
    expect(Object.keys(unzipSync(bytes))).toEqual(["project.json", "snapshots/s-1.json"]);
  });

  it("unknown entries (thumbnail, future files) are kept byte-for-byte (rule 13)", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const bytes = save({
      project: blank(),
      snapshots: [],
      extra: { "thumbnail.png": png, "future/x.bin": strToU8("?") },
    });
    const r = open(bytes);
    if (r.status !== "ok") throw new Error(r.status);
    expect(r.file.extra["thumbnail.png"]).toEqual(png);
    expect(Buffer.from(save(r.file)).equals(Buffer.from(bytes))).toBe(true);
  });
});

describe("opening files (ADR-032, read-only, invalid)", () => {
  it("a module that isn't installed → missing-modules, data intact", () => {
    const p = withWall();
    p.elements["w-1"]!.components["org.example.electrical"] = {
      v: 3,
      data: { circuit: "C2", weird: [1, { z: null }] },
    };
    const r = open(save(file(p)));
    expect(r.status).toBe("missing-modules");
    if (r.status !== "missing-modules") return;
    expect(r.modules).toEqual(["org.example.electrical"]);
    expect(r.file.project.elements["w-1"]!.components["org.example.electrical"]).toEqual({
      v: 3,
      data: { circuit: "C2", weird: [1, { z: null }] },
    });
  });

  it("a module element type counts as a reference too", () => {
    const p = blank();
    p.elements["x-1"] = {
      id: "x-1",
      type: "org.example.electrical:outlet",
      ownerModule: "org.example.electrical",
      levelId: "l-1",
      components: {},
    };
    expect(modulesReferenced(p)).toEqual(["org.example.electrical"]);
  });

  it("a newer schema opens read-only, without validating against today's schema", () => {
    const future = { ...blank(), schemaVersion: 4, newThing: { a: 1 }, levels: "changed shape" };
    const bytes = zipSync({ "project.json": strToU8(JSON.stringify(future)) });
    const r = open(bytes);
    expect(r.status).toBe("read-only");
    if (r.status === "read-only" && r.reason === "newer-schema") expect(r.schemaVersion).toBe(4);
    else throw new Error("wrong reason");
  });

  it.each([
    ["not a zip", new Uint8Array([1, 2, 3])],
    ["no project.json", zipSync({ "a.txt": strToU8("hi") })],
    ["bad JSON", zipSync({ "project.json": strToU8("{") })],
    ["wrong format id", zipSync({ "project.json": strToU8(JSON.stringify({ ...blank(), format: "other" })) })],
    ["schemaVersion 0", zipSync({ "project.json": strToU8(JSON.stringify({ ...blank(), schemaVersion: 0 })) })],
  ])("invalid: %s", (_name, bytes) => {
    expect(open(bytes).status).toBe("invalid");
  });

  it("dangling references are reported, sorted", () => {
    const p = withWall();
    (p.elements["o-1"] as { host: { elementId: string } }).host.elementId = "gone";
    p.elements["w-1"]!.levelId = "nope";
    const r = open(save(file(p)));
    expect(r).toEqual({
      status: "invalid",
      errors: ["element o-1: host gone doesn't exist", "element w-1: unknown level nope"],
    });
  });
});

describe("small helpers", () => {
  it("counter ids are predictable; tolerance compares within 0.01 mm", () => {
    const ids = counterIds("w");
    expect([ids(), ids()]).toEqual(["w-1", "w-2"]);
    expect(nearlyEqual(1000, 1000.009)).toBe(true);
    expect(nearlyEqual(1000, 1000.011)).toBe(false);
    expect(nearlyEqual(0.1 + 0.2, 0.3)).toBe(true);
  });
});

describe("cross-machine determinism", () => {
  // Golden value: if this changes, saved files changed. Update only on purpose (format change or fflate upgrade),
  // and say so in SESSION_LOG. Must match on every OS/timezone (CI runs in UTC, the owner's Mac in BRT).
  it("the wall project always saves to the same bytes", async () => {
    const { createHash } = await import("node:crypto");
    const hash = createHash("sha256")
      .update(save(file(withWall())))
      .digest("hex");
    expect(hash).toMatchInlineSnapshot(`"7da5386bfa7d7866beeb80efbe2669e62acb25fa12b61a50202a36974e8d8f60"`);
  });
});
