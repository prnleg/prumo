// Structural integrity of a loaded project (file-level). Edit-time invariants (DATA_MODEL I-1…I-7)
// are enforced by commands; here we only refuse files the model can't represent.
import { isModuleElement, type Project } from "./model";

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isVec = (v: unknown) => isObj(v) && isNum(v.x) && isNum(v.y);

export function validateProject(p: Project): string[] {
  const errs: string[] = [];
  const raw = p as unknown as Record<string, unknown>;
  for (const k of ["id", "name", "createdAt", "updatedAt", "profileId"])
    if (typeof raw[k] !== "string") errs.push(`project.${k} must be a string`);
  if (!Array.isArray(p.levels) || p.levels.length === 0) errs.push("project needs at least one level");
  if (!isObj(p.elements)) errs.push("project.elements must be an object");
  if (!isObj(p.modules)) errs.push("project.modules must be an object");
  if (!isObj(p.settings) || !isNum(p.settings.gridSize)) errs.push("project.settings.gridSize must be a number");
  else if (p.settings.outsideFaces !== undefined && typeof p.settings.outsideFaces !== "boolean")
    errs.push("project.settings.outsideFaces must be a boolean");
  else if (p.settings.baseline !== undefined && typeof p.settings.baseline !== "string")
    errs.push("project.settings.baseline must be a string");
  const h = (p as { handoff?: unknown }).handoff;
  if (h !== undefined) {
    const entryOk = (e: unknown) =>
      isObj(e) &&
      (e.kind === "hand" || e.kind === "take") &&
      typeof e.from === "string" &&
      typeof e.to === "string" &&
      typeof e.at === "string";
    if (!isObj(h) || typeof h.holder !== "string" || !Array.isArray(h.log) || !h.log.every(entryOk))
      errs.push("project.handoff must be { holder, log[] }");
  }
  if (errs.length) return errs;

  const levels = new Set<string>();
  for (const l of p.levels) {
    if (!isObj(l) || typeof l.id !== "string" || !isNum(l.elevation) || !isNum(l.defaultWallHeight))
      errs.push("bad level");
    else if (levels.has(l.id)) errs.push(`duplicate level ${l.id}`);
    else levels.add(l.id);
  }

  for (const [key, e] of Object.entries(p.elements)) {
    const at = `element ${key}`;
    if (!isObj(e)) {
      errs.push(`${at}: not an object`);
      continue;
    }
    if (e.id !== key) errs.push(`${at}: id doesn't match its key`);
    if (!levels.has(e.levelId)) errs.push(`${at}: unknown level ${String(e.levelId)}`);
    if (!isObj(e.components)) errs.push(`${at}: components must be an object`);
    else
      for (const [m, c] of Object.entries(e.components))
        if (!isObj(c) || !Number.isInteger(c.v)) errs.push(`${at}: component ${m} needs an integer v`);

    if (e.type === "wall") {
      if (!isVec(e.start) || !isVec(e.end)) errs.push(`${at}: wall needs start/end`);
      for (const k of ["thickness", "height", "baseOffset"] as const)
        if (!isNum(e[k])) errs.push(`${at}: wall.${k} must be a number`);
    } else if (e.type === "opening") {
      for (const k of ["width", "height", "sillHeight"] as const)
        if (!isNum(e[k])) errs.push(`${at}: opening.${k} must be a number`);
      if (e.style !== undefined && typeof e.style !== "string") errs.push(`${at}: opening.style must be text`);
    } else if (e.type === "note") {
      if (!isVec(e.at) || typeof e.text !== "string" || typeof e.author !== "string" || typeof e.createdAt !== "string")
        errs.push(`${at}: note needs at, text, author and createdAt`);
      else if (!Array.isArray(e.targets) || !e.targets.every((t) => typeof t === "string"))
        errs.push(`${at}: note.targets must be a list of ids`);
    } else if (e.type === "room") {
      if (!isVec(e.seed) || typeof e.name !== "string") errs.push(`${at}: room needs a seed point and a name`);
    } else if (
      !isModuleElement(e) ||
      typeof e.type !== "string" ||
      !e.type.includes(":") ||
      typeof e.ownerModule !== "string"
    ) {
      errs.push(`${at}: unknown type ${String((e as { type: unknown }).type)}`);
    }

    const host = (e as { host?: unknown }).host;
    if (e.type === "opening" && host === undefined) errs.push(`${at}: opening needs a host`);
    if (host !== undefined) {
      if (!isObj(host) || typeof host.elementId !== "string" || !isNum(host.offset)) errs.push(`${at}: bad host`);
      else if (!p.elements[host.elementId]) errs.push(`${at}: host ${host.elementId} doesn't exist`);
    }
  }
  return errs.sort();
}
