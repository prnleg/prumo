// Spike E — minimal core commands. Immutable: every command returns a new Project.
import type { Element, Id, Opening, Project, Wall } from "./model";

export function putElement(p: Project, el: Element): Project {
  return { ...p, model: { ...p.model, elements: { ...p.model.elements, [el.id]: el } } };
}

export function addWall(p: Project, w: Omit<Wall, "type" | "components" | "levelId"> & { levelId?: Id }): Project {
  return putElement(p, { levelId: "L0", ...w, type: "wall", components: {} });
}

export function addOpening(
  p: Project,
  o: Omit<Opening, "type" | "components" | "levelId"> & { levelId?: Id },
): Project {
  const host = p.model.elements[o.hostWallId];
  // Invariant I-5: the host wall exists.
  if (!host || host.type !== "wall") throw new Error(`I-5: host ${o.hostWallId} is not a wall`);
  return putElement(p, { levelId: host.levelId, ...o, type: "opening", components: {} });
}
