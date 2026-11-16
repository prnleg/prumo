import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ModuleError,
  ModuleHost,
  canonicalJson,
  emptyProject,
  exportCopy,
  open,
  putElement,
  removeModuleItems,
  save,
  type ModuleManifest,
  type Project,
} from "../src/core";
import { architect, ARCHITECT } from "../src/modules/architect";
import { structural, STRUCTURAL } from "../src/modules/structural";
import { electrical, ELECTRICAL } from "../src/modules/electrical";
import { ALL, buildHouse } from "./fixtures";

const CORE_DIR = join(__dirname, "../src/core");

function expectOk(r: ReturnType<typeof open>): Project {
  if (r.status !== "ok") throw new Error(`expected ok, got ${r.status}`);
  return r.project;
}

describe("Rule 1 — the core never imports a module", () => {
  it("no file in src/core imports from src/modules", () => {
    for (const f of readdirSync(CORE_DIR)) {
      const src = readFileSync(join(CORE_DIR, f), "utf8");
      expect(src, f).not.toMatch(/from\s+["'][^"']*modules\//);
    }
  });
});

describe("Rule 2 — built-in features are modules too", () => {
  it("the core source never names a specific module", () => {
    for (const f of readdirSync(CORE_DIR)) {
      const src = readFileSync(join(CORE_DIR, f), "utf8").toLowerCase();
      for (const name of ["architect", "structural", "electrical"]) {
        // comments may mention them; code identifiers/strings may not
        const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
        expect(code, `${f} mentions ${name}`).not.toContain(name);
      }
    }
  });
  it("Architect registers through the same manifest API as the others", () => {
    const host = new ModuleHost(ALL);
    expect(host.installedIds()).toEqual([ARCHITECT, ELECTRICAL, STRUCTURAL]);
  });
});

describe("Rule 3 / ADR-032 — opening a file with a missing module", () => {
  const full = new ModuleHost(ALL);
  const json = save(buildHouse(full), full);
  const noElectrical = new ModuleHost([architect, structural]);

  it("stops and reports the missing module with its version and item count", () => {
    const r = open(json, noElectrical);
    expect(r.status).toBe("missing-modules");
    if (r.status !== "missing-modules") return;
    expect(r.missing).toEqual([{ id: ELECTRICAL, version: "0.3.0", items: 1 }]);
  });

  it("'Install' path: installing the module and reopening loses nothing (byte-identical round trip)", () => {
    const r = open(json, noElectrical);
    expect(r.status).toBe("missing-modules");
    // user installs Electrical → reopen with full host
    const p = expectOk(open(json, full));
    expect(save(p, full)).toBe(json);
  });

  it("refuses to save data from an uninstalled module (can't bypass the dialog)", () => {
    const r = open(json, noElectrical);
    expect(() => save(r.project, noElectrical)).toThrow(ModuleError);
  });

  it("'Remove' path: explicit, reports what goes, snapshots first, old project = undo", () => {
    const r = open(json, noElectrical);
    const before = r.project;
    const beforeJson = canonicalJson(before);
    const res = removeModuleItems(before, ELECTRICAL, "Before removing Electrical items");
    expect(res.removedElementIds).toEqual(["E1"]);
    expect(res.strippedElementIds).toEqual([]);
    expect(res.project.model.elements.E1).toBeUndefined();
    expect(res.project.modules[ELECTRICAL]).toBeUndefined();
    // snapshot holds the full previous model
    expect(res.project.snapshots.at(-1)!.name).toBe("Before removing Electrical items");
    expect(res.project.snapshots.at(-1)!.model.elements.E1).toBeDefined();
    // input untouched → undo is just "go back to `before`"
    expect(canonicalJson(before)).toBe(beforeJson);
    // now it opens fine without Electrical
    const again = save(res.project, noElectrical);
    expect(open(again, noElectrical).status).toBe("ok");
  });

  it("removing a component-only module strips components but keeps the walls", () => {
    const noArch = new ModuleHost([structural, electrical]);
    const r = open(json, noArch);
    expect(r.status).toBe("missing-modules");
    if (r.status !== "missing-modules") return;
    expect(r.missing).toEqual([{ id: ARCHITECT, version: "0.1.0", items: 1 }]);
    const res = removeModuleItems(r.project, ARCHITECT, "Before removing Architect items");
    expect(res.removedElementIds).toEqual([]);
    expect(res.strippedElementIds).toEqual(["W2"]);
    expect(res.project.model.elements.W2!.components[ARCHITECT]).toBeUndefined();
    expect(res.project.model.elements.W2!.type).toBe("wall");
  });
});

describe("Rule 4 — module data is namespaced and write-isolated", () => {
  it("stores data under element.components[moduleId]", () => {
    const p = buildHouse();
    expect(Object.keys(p.model.elements.W1!.components)).toEqual([STRUCTURAL]);
    expect(Object.keys(p.model.elements.W2!.components)).toEqual([ARCHITECT]);
  });
  it("a module context can only write its own namespace / own element types", () => {
    const host = new ModuleHost(ALL);
    const s = host.contextFor(STRUCTURAL);
    const p = buildHouse(host);
    const w2 = s.setComponent(p.model.elements.W2!, { role: "auto" });
    // Architect's finishes on W2 are untouched
    expect(w2.components[ARCHITECT]).toEqual(p.model.elements.W2!.components[ARCHITECT]);
    expect(() => s.createElement(`${ELECTRICAL}/outlet`, { id: "X", levelId: "L0", props: {} })).toThrow(ModuleError);
  });
  it("rejects module element types that aren't prefixed with the module id", () => {
    const bad: ModuleManifest = { ...electrical, id: "org.x", elementTypes: ["outlet"] };
    expect(() => new ModuleHost([bad])).toThrow(/not namespaced/);
  });
});

describe("Rule 5 — rules declare their inputs", () => {
  it("FAKE-STRUCT-001 fires for a bearing wall opening without lintel", () => {
    const host = new ModuleHost(ALL);
    const f = host.runRules(buildHouse(host).model);
    // Hand check: O1 sits in W1 (role bearing, set in fixture) with lintel=false → exactly 1 finding.
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ ruleId: "FAKE-STRUCT-001", elementIds: ["O1", "W1"], verified: false });
    expect(f[0]!.source).toMatch(/UNSOURCED/);
  });
  it("a rule reading an undeclared module throws", () => {
    const sneaky: ModuleManifest = {
      ...electrical,
      rules: [
        {
          id: "SNEAKY",
          reads: [],
          evaluate(model, ctx) {
            ctx.component(model.elements.W2!, ARCHITECT);
            return [];
          },
        },
      ],
    };
    const host = new ModuleHost([architect, structural, sneaky]);
    expect(() => host.runRules(buildHouse(new ModuleHost(ALL)).model)).toThrow(/undeclared/);
  });
  it("a cross-module rule only runs when all declared modules are enabled", () => {
    let ran = 0;
    const cross: ModuleManifest = {
      ...electrical,
      rules: [{ id: "CROSS", reads: [STRUCTURAL], evaluate: () => (ran++, []) }],
    };
    new ModuleHost([cross]).runRules(emptyProject().model);
    expect(ran).toBe(0);
    new ModuleHost([cross, structural]).runRules(emptyProject().model);
    expect(ran).toBe(1);
  });
});

describe("Rule 6 — each module owns its migrations", () => {
  it("structural v1 → v2 migrates only the structural namespace", () => {
    const host = new ModuleHost(ALL);
    const p = buildHouse(host);
    // Fake an old file: structural component written at v1 (bearing: boolean).
    const old: Project = structuredClone(p);
    old.model.elements.W1!.components[STRUCTURAL] = { v: 1, data: { bearing: true } };
    old.model.elements.O1!.components[STRUCTURAL] = { v: 1, data: { lintel: false } };
    const json = canonicalJson({ ...old, modules: { ...old.modules, [STRUCTURAL]: { version: "0.1.0", componentSchema: 1 } } });
    const migrated = expectOk(open(json, host));
    expect(migrated.model.elements.W1!.components[STRUCTURAL]).toEqual({ v: 2, data: { role: "bearing" } });
    expect(migrated.model.elements.O1!.components[STRUCTURAL]).toEqual({ v: 2, data: { lintel: false } });
    expect(migrated.model.elements.W2!.components[ARCHITECT]).toEqual(p.model.elements.W2!.components[ARCHITECT]);
  });
  it("a file from a NEWER module schema opens read-only", () => {
    const host = new ModuleHost(ALL);
    const p = buildHouse(host);
    const json = canonicalJson({ ...p, modules: { [STRUCTURAL]: { version: "0.9.0", componentSchema: 9 } } });
    const r = open(json, host);
    expect(r).toMatchObject({ status: "read-only", modules: [STRUCTURAL] });
  });
});

describe("Rule 7 — disabling a module hides findings/UI but keeps data", () => {
  it("disabled Structural: no findings, data survives save/load byte-for-byte", () => {
    const full = new ModuleHost(ALL);
    const json = save(buildHouse(full), full);
    const off = new ModuleHost(ALL, { disabled: [STRUCTURAL] });
    const p = expectOk(open(json, off)); // installed-but-disabled → no dialog
    expect(off.runRules(p.model)).toEqual([]);
    expect(save(p, off)).toBe(json);
  });
  it("disabled Electrical: its elements are hidden from views", () => {
    const off = new ModuleHost(ALL, { disabled: [ELECTRICAL] });
    const ids = off.visibleElements(buildHouse().model).map((e) => e.id);
    expect(ids).toEqual(["O1", "W1", "W2"]);
  });
  it("a disabled module can't be used to write", () => {
    const off = new ModuleHost(ALL, { disabled: [STRUCTURAL] });
    expect(() => off.contextFor(STRUCTURAL)).toThrow(/disabled/);
  });
});

describe("Dependencies", () => {
  const plugin: ModuleManifest = { ...electrical, id: "org.x.needs-arch", elementTypes: [], dependsOn: [ARCHITECT] };
  it("a module whose dependency isn't installed is rejected", () => {
    expect(() => new ModuleHost([plugin])).toThrow(/depends on missing/);
  });
  it("disabling a dependency disables dependents", () => {
    const h = new ModuleHost([architect, plugin], { disabled: [ARCHITECT] });
    expect(h.isEnabled(plugin.id)).toBe(false);
  });
  it("API version mismatch is rejected", () => {
    expect(() => new ModuleHost([{ ...architect, apiVersion: "0.2" }])).toThrow(/targets API/);
  });
});

describe("Export with module selection (MODULES §8)", () => {
  it("strips excluded modules from the copy only, incl. snapshots, and reports what the receiver loses", () => {
    const host = new ModuleHost(ALL);
    let p = buildHouse(host);
    p = { ...p, snapshots: [{ id: "s1", name: "Sent to engineer #1", model: structuredClone(p.model) }] };
    const working = canonicalJson(p);
    const r = exportCopy(p, host, [ELECTRICAL, ARCHITECT]);
    expect(r.receiverWontSee).toEqual([
      { moduleId: ARCHITECT, items: 1 },
      { moduleId: ELECTRICAL, items: 1 },
    ]);
    expect(canonicalJson(p)).toBe(working); // working project untouched
    expect(r.json).not.toContain(ELECTRICAL);
    expect(r.json).not.toContain(ARCHITECT);
    // a receiver with ONLY Structural opens it without the dialog
    expect(open(r.json, new ModuleHost([structural])).status).toBe("ok");
  });
  it("required modules can't be excluded", () => {
    const host = new ModuleHost([{ ...architect, required: true }, structural, electrical]);
    expect(() => exportCopy(buildHouse(host), host, [ARCHITECT])).toThrow(/required/);
  });
});

describe("Electrical-only install (MODULES §9, Q-128)", () => {
  const elecOnly = new ModuleHost([electrical]);

  it("can build the skeleton (walls) and place outlets with no Architect/Structural", () => {
    let p = emptyProject();
    p = putElement(p, {
      id: "W1", type: "wall", levelId: "L0", components: {},
      start: { x: 0, y: 0 }, end: { x: 3000, y: 0 }, thickness: 140, height: 2800, kind: "full",
    });
    p = putElement(p, elecOnly.contextFor(ELECTRICAL).createElement(`${ELECTRICAL}/outlet`, {
      id: "E1", levelId: "L0", host: { elementId: "W1", offset: 200 }, props: { heightFromFloor: 300, circuit: "C1" },
    }));
    const json = save(p, elecOnly);
    expect(expectOk(open(json, elecOnly)).model.elements.E1).toBeDefined();
    expect(elecOnly.runRules(p.model)).toEqual([]);
  });

  it("receives the architect's full file → dialog lists Architect + Structural, then removal leaves skeleton + outlet", () => {
    const full = new ModuleHost(ALL);
    const json = save(buildHouse(full), full);
    const r = open(json, elecOnly);
    expect(r.status).toBe("missing-modules");
    if (r.status !== "missing-modules") return;
    expect(r.missing.map((m) => [m.id, m.items])).toEqual([
      [ARCHITECT, 1],
      [STRUCTURAL, 2],
    ]);
    let p = r.project;
    for (const m of r.missing) p = removeModuleItems(p, m.id, `Before removing ${m.id}`).project;
    const opened = expectOk(open(save(p, elecOnly), elecOnly));
    expect(Object.keys(opened.model.elements).sort()).toEqual(["E1", "O1", "W1", "W2"]);
    for (const el of Object.values(opened.model.elements)) expect(Object.keys(el.components)).toEqual([]);
    // the recovery snapshots still hold the removed data (opaque; not counted by the dialog)
    expect(opened.snapshots).toHaveLength(2);
    expect(opened.snapshots[0]!.model.elements.W2!.components[ARCHITECT]).toBeDefined();
  });

  it("the architect wants it back: install-path on the Electrical engineer's file preserves outlets", () => {
    const full = new ModuleHost(ALL);
    const fromElectrician = save(buildHouse(full), full);
    expect(save(expectOk(open(fromElectrician, full)), full)).toBe(fromElectrician);
  });
});

describe("Determinism (CLAUDE.md rule 10)", () => {
  it("same model built in different insertion order → identical bytes", () => {
    const host = new ModuleHost(ALL);
    const a = buildHouse(host);
    const reversed: Project = {
      ...a,
      model: {
        ...a.model,
        elements: Object.fromEntries(Object.entries(a.model.elements).reverse()),
      },
    };
    expect(save(reversed, host)).toBe(save(a, host));
    expect(host.runRules(reversed.model)).toEqual(host.runRules(a.model));
  });
});
