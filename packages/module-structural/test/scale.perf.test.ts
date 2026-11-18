// Q-140 scale probe (not a regular test): how long the plan + checks take as a level grows from a
// house to a hotel floor. Skipped unless PRUMO_PERF=1:
//   PRUMO_PERF=1 npx vitest run test/scale.perf.test.ts
// Numbers go to docs/SESSION_LOG.md; nothing here is asserted except that the work completes.
import {
  checkInvariants,
  detectRooms,
  emptyProject,
  planGeometry,
  putElements,
  saveProjectFile,
  type Element,
  type Opening,
  type Wall,
} from "@prumo/core";
import { describe, it } from "vitest";
import { architectManifest } from "@prumo/module-architect";
import { ModuleHost } from "@prumo/core";
import { runChecks, structuralManifest } from "../src";

const HOST = new ModuleHost([architectManifest, structuralManifest]);

const W = 4000;
const D = 3000;
function grid(nx: number, ny: number) {
  const els: Element[] = [];
  let k = 0;
  const wall = (x1: number, y1: number, x2: number, y2: number): Wall => ({
    id: `w${k++}`,
    type: "wall",
    levelId: "l",
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    alignment: "center",
    kind: "full",
    thickness: 140,
    height: 2700,
    baseOffset: 0,
    components: {},
  });
  // one wall per cell edge (what the room tool leaves when rooms share walls)
  for (let j = 0; j <= ny; j++) for (let i = 0; i < nx; i++) els.push(wall(i * W, j * D, (i + 1) * W, j * D));
  for (let i = 0; i <= nx; i++) for (let j = 0; j < ny; j++) els.push(wall(i * W, j * D, i * W, (j + 1) * D));
  const walls = els.slice() as Wall[];
  for (const w of walls)
    if (w.start.y === w.end.y && w.start.y > 0) {
      const door: Opening = {
        id: `d-${w.id}`,
        type: "opening",
        levelId: "l",
        host: { elementId: w.id, offset: 1000 },
        width: 800,
        height: 2100,
        sillHeight: 0,
        kind: "door",
        components: {},
      };
      els.push(door);
    }
  return putElements(
    emptyProject({ id: "p", levelId: "l", name: "t", now: "", profileId: "br-nbr/structural-masonry" }),
    els,
  );
}

const time = (f: () => unknown) => {
  const t0 = performance.now();
  f();
  return Math.round(performance.now() - t0);
};

describe.skipIf(!process.env.PRUMO_PERF)("Q-140 scale probe", () => {
  it("rooms → ms", () => {
    const rows: string[] = ["| rooms | walls | plan geometry | room detection | all checks | invariants | save |"];
    for (const [nx, ny] of [
      [3, 2],
      [10, 5],
      [20, 10],
      [25, 20],
      [40, 25],
    ] as const) {
      const p = grid(nx, ny);
      const walls = Object.values(p.elements).filter((e) => e.type === "wall").length;
      planGeometry(p, "l"); // warm-up
      rows.push(
        `| ${nx * ny} | ${walls} | ${time(() => planGeometry(p, "l"))} | ${time(() => detectRooms(p, "l"))} | ${time(() => runChecks(p, "l"))} | ${time(() => checkInvariants(p))} | ${time(() => saveProjectFile({ project: p, snapshots: [], extra: {} }, HOST))} |`,
      );
    }
    console.log(rows.join("\n"));
  }, 600_000);
});
