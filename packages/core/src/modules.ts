// Internal module API (ADR-020: bundled, apiVersion 0.x, may break freely) — MODULES §2–3.
// Rules (§3 rule 5) arrive with the Structural Vision in Phase 2; this is registration,
// enable/disable, namespaced writes (rule 4), and per-module migrations (rule 6).
import type { Label } from "./edit";
import type { ComponentData, Element, Host, Id, ModuleElement, ModuleId, Project } from "./model";

export const CORE_API_VERSION = "0.1";

export interface ComponentDecl {
  /** Schema version this module writes. */
  version: number;
  /** Rule 6: the module owns its migrations. Key = from-version → data for from-version + 1. */
  migrations: Record<number, (data: unknown) => unknown>;
}

export interface ModuleManifest {
  id: ModuleId;
  /** i18n key of the display name (ADR-034). */
  name: Label;
  version: string;
  apiVersion: string;
  dependsOn: ModuleId[];
  component?: ComponentDecl;
  /** Element types this module owns, as `${id}:${name}`. */
  elementTypes: string[];
  /** Can't be stripped from an exported copy (MODULES §8). */
  required?: boolean;
}

export class ModuleError extends Error {}

export interface ModuleContext {
  readonly moduleId: ModuleId;
  getComponent<T>(el: Element): T | undefined;
  /** New element with this module's component set. Only ever writes this module's namespace (rule 4). */
  setComponent<T>(el: Element, data: T): Element;
  /** New element with this module's component removed. */
  clearComponent(el: Element): Element;
  createElement(type: string, fields: { id: Id; levelId: Id; host?: Host }): ModuleElement;
}

export class ModuleHost {
  private readonly manifests = new Map<ModuleId, ModuleManifest>();
  private readonly enabled = new Set<ModuleId>();

  constructor(manifests: readonly ModuleManifest[], opts: { disabled?: readonly ModuleId[] } = {}) {
    for (const m of manifests) {
      if (this.manifests.has(m.id)) throw new ModuleError(`duplicate module ${m.id}`);
      if (m.apiVersion !== CORE_API_VERSION)
        throw new ModuleError(`${m.id} targets API ${m.apiVersion}, core is ${CORE_API_VERSION}`);
      for (const t of m.elementTypes)
        if (!t.startsWith(`${m.id}:`) || t.length === m.id.length + 1)
          throw new ModuleError(`${m.id}: element type ${t} must be "${m.id}:<name>"`);
      this.manifests.set(m.id, m);
    }
    for (const m of manifests)
      for (const d of m.dependsOn)
        if (!this.manifests.has(d)) throw new ModuleError(`${m.id} depends on missing module ${d}`);
    const disabled = new Set(opts.disabled ?? []);
    for (const id of this.manifests.keys()) if (!disabled.has(id)) this.enabled.add(id);
    // A module whose dependency is disabled is disabled too (to a fixed point).
    for (let changed = true; changed;) {
      changed = false;
      for (const id of [...this.enabled].sort())
        if (this.manifests.get(id)?.dependsOn.some((d) => !this.enabled.has(d))) {
          this.enabled.delete(id);
          changed = true;
        }
    }
  }

  installedIds(): ModuleId[] {
    return [...this.manifests.keys()].sort();
  }
  isInstalled(id: ModuleId) {
    return this.manifests.has(id);
  }
  /** Rule 7: disabled = UI and findings hidden; data kept. */
  isEnabled(id: ModuleId) {
    return this.enabled.has(id);
  }
  manifest(id: ModuleId): ModuleManifest | undefined {
    return this.manifests.get(id);
  }

  contextFor(moduleId: ModuleId): ModuleContext {
    const m = this.manifests.get(moduleId);
    if (!m) throw new ModuleError(`module ${moduleId} not installed`);
    if (!this.enabled.has(moduleId)) throw new ModuleError(`module ${moduleId} is disabled`);
    return {
      moduleId,
      getComponent: <T>(el: Element) => el.components[moduleId]?.data as T | undefined,
      setComponent: <T>(el: Element, data: T): Element => {
        if (!m.component) throw new ModuleError(`${moduleId} declares no component`);
        const c: ComponentData = { v: m.component.version, data: structuredClone(data) };
        return { ...el, components: { ...el.components, [moduleId]: c } };
      },
      clearComponent: (el: Element): Element => {
        if (!(moduleId in el.components)) return el;
        const components = Object.fromEntries(Object.entries(el.components).filter(([m]) => m !== moduleId));
        return { ...el, components };
      },
      createElement: (type, fields) => {
        if (!m.elementTypes.includes(type)) throw new ModuleError(`${moduleId} does not own type ${type}`);
        return {
          ...structuredClone(fields),
          type: type as ModuleElement["type"],
          ownerModule: moduleId,
          components: {},
        };
      },
    };
  }

  /**
   * Bring every component up to its module's current version (rule 6). Pure.
   * A component NEWER than the installed module can't be understood → `newer` lists it; the caller
   * opens the project read-only (same policy as a newer file schema).
   */
  migrateComponents(p: Project): { project: Project; newer: { moduleId: ModuleId; v: number }[] } {
    const newer = new Map<ModuleId, number>();
    let elements: Project["elements"] | null = null;
    for (const [id, el] of Object.entries(p.elements)) {
      let comps: Element["components"] | null = null;
      for (const [mid, c] of Object.entries(el.components)) {
        const decl = this.manifests.get(mid)?.component;
        if (!decl || c.v === decl.version) continue; // uninstalled modules: untouched (rule 13)
        if (c.v > decl.version) {
          newer.set(mid, Math.max(newer.get(mid) ?? 0, c.v));
          continue;
        }
        let data = c.data;
        for (let v = c.v; v < decl.version; v++) {
          const step = decl.migrations[v];
          if (!step) throw new ModuleError(`${mid}: no migration from component v${v}`);
          data = step(structuredClone(data));
        }
        comps ??= { ...el.components };
        comps[mid] = { v: decl.version, data };
      }
      if (comps) {
        elements ??= { ...p.elements };
        elements[id] = { ...el, components: comps };
      }
    }
    return {
      project: elements ? { ...p, elements } : p,
      newer: [...newer].sort(([a], [b]) => (a < b ? -1 : 1)).map(([moduleId, v]) => ({ moduleId, v })),
    };
  }
}
