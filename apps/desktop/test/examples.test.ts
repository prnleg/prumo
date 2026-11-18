import {
  ModuleHost,
  checkInvariants,
  counterIds,
  detectRooms,
  matchRoomTags,
  openWithModules,
  roomTags,
  saveProjectFile,
  validateProject,
  type Opening,
  type Wall,
} from "@prumo/core";
import { architectManifest } from "@prumo/module-architect";
import { runChecks, structuralManifest } from "@prumo/module-structural";
import { describe, expect, it } from "vitest";
import { EXAMPLES } from "../src/examples";
import { translate } from "../src/i18n";

const args = (prefix: string) => ({
  ids: counterIds(prefix),
  t: (k: string) => translate("pt-BR", k),
  now: "2026-11-16T12:00:00.000Z",
  profileId: "br-nbr/structural-masonry",
});

describe.each(EXAMPLES.map((e) => [e.id, e] as const))("example %s", (_, ex) => {
  const p = ex.build(args("x"));
  const level = p.levels[0]!.id;
  const els = Object.values(p.elements);

  it("is a valid model: schema ok, no invariant problems, every name translated", () => {
    expect(validateProject(p)).toEqual([]);
    expect(checkInvariants(p)).toEqual([]);
    for (const k of [ex.title, ex.description]) expect(translate("en", k)).not.toBe(k);
    for (const t of roomTags(p, level)) expect(t.name).not.toMatch(/^example\./);
  });

  it("every named room is a detected room, one tag each, none left unnamed", () => {
    const rooms = detectRooms(p, level);
    const tags = roomTags(p, level);
    expect(rooms).toHaveLength(tags.length);
    expect(matchRoomTags(rooms, tags).size).toBe(rooms.length);
  });

  it("openings stay clear of the walls that join their host (no door cut into a corner)", () => {
    const walls = els.filter((e): e is Wall => e.type === "wall");
    for (const o of els.filter((e): e is Opening => e.type === "opening")) {
      const host = p.elements[o.host.elementId] as Wall;
      const L = Math.hypot(host.end.x - host.start.x, host.end.y - host.start.y);
      const u = { x: (host.end.x - host.start.x) / L, y: (host.end.y - host.start.y) / L };
      for (const w of walls) {
        if (w.id === host.id) continue;
        for (const q of [w.start, w.end]) {
          const dx = q.x - host.start.x,
            dy = q.y - host.start.y;
          if (Math.abs(dx * u.y - dy * u.x) > 1) continue; // not on the host line
          const s = dx * u.x + dy * u.y;
          const gap = Math.max(o.host.offset - s, s - (o.host.offset + o.width));
          expect(gap, `${o.id} vs ${w.id}`).toBeGreaterThan(w.thickness / 2);
        }
      }
    }
  });

  it("is deterministic and survives save → open", () => {
    expect(ex.build(args("x"))).toEqual(p);
    const host = new ModuleHost([architectManifest, structuralManifest]);
    const back = openWithModules(saveProjectFile({ project: p, snapshots: [], extra: {} }, host), host);
    expect(back.status).toBe("ok");
    if (back.status !== "ok") return;
    // the save adds the usage record (room types are Architect data); everything else is identical
    expect(Object.keys(back.file.project.modules)).toEqual(["org.prumo.architect", "org.prumo.structural"]);
    expect({ ...back.file.project, modules: p.modules }).toEqual(p);
  });
});

describe("structural checks on the examples (Phase 2)", () => {
  const run = (id: string) => {
    const ex = EXAMPLES.find((e) => e.id === id)!;
    const p = ex.build(args("s"));
    return runChecks(p, p.levels[0]!.id).findings.map((f) => f.ruleId);
  };
  it("the small house and the apartment: lintels everywhere → no possible issues from these checks", () => {
    expect(run("house")).toEqual([]);
    expect(run("apartment")).toEqual([]);
  });
  it("the house with problems: two openings without a lintel (one a window: no contraverga either), a horizontal chase + one wall marked as a partition", () => {
    expect(run("problems")).toEqual(["R-OPEN-001", "R-OPEN-001", "R-WALL-004", "R-OPEN-006", "R-ROLE-001"]);
  });
});
