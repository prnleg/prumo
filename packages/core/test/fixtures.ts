import { CORE_API_VERSION, ModuleHost, emptyProject, type ModuleManifest, type Project, type Wall } from "../src";

export const NOW = "2026-11-16T12:00:00.000Z";
export const ARCH = "org.prumo.architect";
export const ELEC = "org.example.electrical";

export function manifest(id: string, extra: Partial<ModuleManifest> = {}): ModuleManifest {
  return {
    id,
    name: { key: `module.${id}` },
    version: "0.1.0",
    apiVersion: CORE_API_VERSION,
    dependsOn: [],
    elementTypes: [],
    ...extra,
  };
}

export const archManifest = () => manifest(ARCH, { component: { version: 1, migrations: {} }, required: true });
export const elecManifest = () =>
  manifest(ELEC, {
    version: "0.3.0",
    dependsOn: [],
    component: { version: 3, migrations: {} },
    elementTypes: [`${ELEC}:outlet`],
  });

/** The sender has every module used in the fixtures. */
export const SENDER = new ModuleHost([archManifest(), elecManifest()]);

export const blank = (): Project =>
  emptyProject({ id: "p-1", levelId: "l-1", name: "Casa térrea", now: NOW, profileId: "br-nbr/structural-masonry" });

export function wall(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return {
    id,
    type: "wall",
    levelId: "l-1",
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    alignment: "center",
    kind: "full",
    thickness: 140,
    height: 2700,
    baseOffset: 0,
    components: {},
    ...extra,
  };
}
