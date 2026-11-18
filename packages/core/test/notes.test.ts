// Notes (ADR-044): a core element, not hosted. Survives deleting what it's about; travels with it.
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  deleteCommand,
  hitTest,
  moveCommand,
  openProjectFile,
  planGeometry,
  putCommand,
  rotateCommand,
  validateProject,
  boxSelect,
  type Note,
  type Opening,
  type Project,
} from "../src";
import { ARCH, blank, wall } from "./fixtures";

const note = (id: string, x: number, y: number, targets: string[] = [], extra: Partial<Note> = {}): Note => ({
  id,
  type: "note",
  levelId: "l-1",
  text: "Check this wall with the engineer",
  author: "Ana",
  createdAt: "2026-11-17T12:00:00.000Z",
  at: { x, y },
  targets,
  components: {},
  ...extra,
});
const door: Opening = {
  id: "d1",
  type: "opening",
  levelId: "l-1",
  host: { elementId: "w1", offset: 1000 },
  width: 800,
  height: 2100,
  sillHeight: 0,
  kind: "door",
  components: {},
};
function base(): Project {
  return putCommand({ key: "x" }, [
    wall("w1", 0, 0, 4000, 0),
    wall("w2", 0, 3000, 4000, 3000),
    door,
    note("n-wall", 2000, 300, ["w1"]),
    note("n-door", 1400, -300, ["d1"]),
    note("n-free", 2000, 1500),
    note("n-both", 2000, 1600, ["w1", "w2"]),
  ]).apply(blank());
}
const at = (p: Project, id: string) => (p.elements[id] as Note).at;

describe("notes", () => {
  it("are valid project elements", () => {
    expect(validateProject(base())).toEqual([]);
    const bad = { ...base(), elements: { ...base().elements, x: { ...note("x", 0, 0), targets: "w1" } } };
    expect(validateProject(bad as unknown as Project)).toEqual(["element x: note.targets must be a list of ids"]);
  });

  it("survive deleting what they are about (not hosted)", () => {
    const p = deleteCommand(base(), ["w1"]).apply(base());
    expect(p.elements.d1).toBeUndefined(); // the door goes with its wall
    expect(p.elements["n-wall"]).toBeDefined();
    expect(p.elements["n-door"]).toBeDefined();
  });

  it("travel with a moved wall (and its doors); a note about two walls moves only when both do", () => {
    const p = moveCommand(["w1"], { x: 0, y: -500 }).apply(base());
    expect(at(p, "n-wall")).toEqual({ x: 2000, y: -200 });
    expect(at(p, "n-door")).toEqual({ x: 1400, y: -800 }); // its door rides on w1
    expect(at(p, "n-free")).toEqual({ x: 2000, y: 1500 });
    expect(at(p, "n-both")).toEqual({ x: 2000, y: 1600 });
    const q = moveCommand(["w1", "w2"], { x: 100, y: 0 }).apply(base());
    expect(at(q, "n-both")).toEqual({ x: 2100, y: 1600 });
  });

  it("move on their own when selected; rotate with their wall", () => {
    expect(at(moveCommand(["n-free"], { x: 10, y: 20 }).apply(base()), "n-free")).toEqual({ x: 2010, y: 1520 });
    // 90° about the origin: (2000, 300) → (−300, 2000)
    expect(at(rotateCommand(["w1"], { x: 0, y: 0 }, 90).apply(base()), "n-wall")).toEqual({ x: -300, y: 2000 });
  });

  it("are pins on the plan: picked first, box-selected by their point", () => {
    const g = planGeometry(base(), "l-1");
    expect(g.notes.map((n) => n.id)).toEqual(["n-both", "n-door", "n-free", "n-wall"]);
    expect(hitTest(g, { x: 2005, y: 300 }, 30)).toBe("n-wall");
    expect(hitTest(g, { x: 2000, y: 0 }, 30)).toBe("w1");
    expect(boxSelect(g, { minX: 1900, minY: 1400, maxX: 2100, maxY: 1550 }, "inside")).toEqual(["n-free"]);
  });

  it("a v1 file (before notes) opens as v2 (migration 1 → 2)", () => {
    const v1 = { ...blank(), schemaVersion: 1 };
    const r = openProjectFile(zipSync({ "project.json": strToU8(JSON.stringify(v1)) }), { installedModules: [ARCH] });
    expect(r.status).toBe("ok");
    if (r.status === "ok") expect(r.file.project.schemaVersion).toBe(3); // 1 → 2 → 3, both no-ops
  });
});
