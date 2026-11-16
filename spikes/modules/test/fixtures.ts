import { addOpening, addWall, emptyProject, putElement, ModuleHost, type Project, type Wall } from "../src/core";
import { architect, ARCHITECT, type FinishesV1 } from "../src/modules/architect";
import { structural, STRUCTURAL, type StructuralOpeningV2, type StructuralWallV2 } from "../src/modules/structural";
import { electrical, OUTLET, type OutletProps } from "../src/modules/electrical";

export const ALL = [architect, structural, electrical];

/** A 2-wall house: W1 bearing with a window (no lintel), W2 painted, 1 outlet on W2. */
export function buildHouse(host = new ModuleHost(ALL)): Project {
  let p = emptyProject();
  p = addWall(p, { id: "W1", start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, thickness: 140, height: 2800, kind: "full" });
  p = addWall(p, { id: "W2", start: { x: 4000, y: 0 }, end: { x: 4000, y: 3000 }, thickness: 140, height: 2800, kind: "full" });
  p = addOpening(p, { id: "O1", hostWallId: "W1", offset: 1000, width: 1200, height: 1200, sillHeight: 1000, kind: "window" });

  const s = host.contextFor(STRUCTURAL);
  p = putElement(p, s.setComponent<StructuralWallV2>(p.model.elements.W1!, { role: "bearing" }));
  p = putElement(p, s.setComponent<StructuralOpeningV2>(p.model.elements.O1!, { lintel: false }));

  const a = host.contextFor(ARCHITECT);
  p = putElement(p, a.setComponent<FinishesV1>(p.model.elements.W2!, { sideA: ["paint-white"], sideB: ["tile-blue"] }));

  const e = host.contextFor(electrical.id);
  p = putElement(
    p,
    e.createElement(OUTLET, {
      id: "E1",
      levelId: "L0",
      host: { elementId: "W2", offset: 500 },
      props: { heightFromFloor: 300, circuit: "C1" } satisfies OutletProps,
    }),
  );
  return p;
}

export const wall = (p: Project, id: string) => p.model.elements[id] as Wall;
