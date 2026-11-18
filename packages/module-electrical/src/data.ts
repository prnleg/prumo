// Electrical items (ADR-058). Heights are drawing defaults the user can change, not rules.
import { type Element, type Id, type ModuleElement, type V, type Wall } from "@prumo/core";
import { ELECTRICAL, LIGHT, OUTLET, SWITCH } from "./manifest";

export type ItemKind = "outlet" | "switch" | "light";
export type Face = "left" | "right";
export type OutletPurpose = "general" | "dedicated";
export const OUTLET_PURPOSES: readonly OutletPurpose[] = ["general", "dedicated"];

export interface ElectricalData {
  /** Outlet / switch: centre height above the floor, mm. */
  height?: number | undefined;
  /** Outlet / switch: which face of the wall it's on (looking start → end). */
  face?: Face | undefined;
  /** Outlet: general use (TUG) or for one appliance (TUE). Missing = general. */
  purpose?: OutletPurpose | undefined;
  /** Switch: the lights it turns on (the link graph). */
  lights?: Id[] | undefined;
  [more: string]: unknown;
}
export const ELECTRICAL_DATA_VERSION = 1;

/** Drawing defaults (common practice, editable; no rule reads them): low outlet 30 cm, switch 1.10 m. */
export const DEFAULT_HEIGHT: Record<"outlet" | "switch", number> = { outlet: 300, switch: 1100 };

export const kindOf = (e: Element | undefined): ItemKind | null =>
  e?.type === OUTLET ? "outlet" : e?.type === SWITCH ? "switch" : e?.type === LIGHT ? "light" : null;

export function electricalData(e: Element): ElectricalData {
  return (e.components[ELECTRICAL]?.data as ElectricalData | undefined) ?? {};
}

export function withElectricalData<T extends Element>(e: T, data: ElectricalData): T {
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  return { ...e, components: { ...e.components, [ELECTRICAL]: { v: ELECTRICAL_DATA_VERSION, data: clean } } };
}

export function newWallItem(id: Id, kind: "outlet" | "switch", wall: Wall, offset: number, face: Face): ModuleElement {
  const data: ElectricalData = { height: DEFAULT_HEIGHT[kind], face, ...(kind === "switch" ? { lights: [] } : {}) };
  return {
    id,
    type: kind === "outlet" ? OUTLET : SWITCH,
    ownerModule: ELECTRICAL,
    levelId: wall.levelId,
    host: { elementId: wall.id, offset },
    components: { [ELECTRICAL]: { v: ELECTRICAL_DATA_VERSION, data } },
  };
}

export function newLight(id: Id, levelId: Id, at: V): ModuleElement {
  return {
    id,
    type: LIGHT,
    ownerModule: ELECTRICAL,
    levelId,
    at,
    components: { [ELECTRICAL]: { v: ELECTRICAL_DATA_VERSION, data: {} } },
  };
}

/** The lights a switch turns on that still exist (deleted ones are skipped, the ids are kept: rule 13). */
export function switchLights(p: { elements: Record<Id, Element> }, s: Element): Id[] {
  return (electricalData(s).lights ?? []).filter((id) => kindOf(p.elements[id]) === "light");
}

/** Link / unlink a light (sorted, no duplicates). */
export function setSwitchLight(s: ModuleElement, lightId: Id, on: boolean): ModuleElement {
  const d = electricalData(s);
  const set = new Set(d.lights ?? []);
  if (on) set.add(lightId);
  else set.delete(lightId);
  return withElectricalData(s, { ...d, lights: [...set].sort() });
}
