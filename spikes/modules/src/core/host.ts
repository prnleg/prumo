// Spike E — module host: registration, namespaced access, rule engine.
import {
  isModuleElement,
  sortedElements,
  type Element,
  type ModuleElement,
  type ModuleId,
  type ProjectModel,
} from "./model";
import { CORE_API_VERSION, type Finding, type ModuleManifest, type RuleContext } from "./module-api";

export class ModuleError extends Error {}

export interface ModuleContext {
  readonly moduleId: ModuleId;
  getComponent<T>(el: Element): T | undefined;
  /** Returns a NEW element (immutable model). Only ever writes this module's namespace. */
  setComponent<T>(el: Element, data: T): Element;
  createElement(
    type: string,
    fields: Omit<ModuleElement, "type" | "ownerModule" | "components">,
  ): ModuleElement;
}

export class ModuleHost {
  private readonly manifests = new Map<ModuleId, ModuleManifest>();
  private readonly enabledSet = new Set<ModuleId>();

  constructor(manifests: ModuleManifest[], opts: { disabled?: ModuleId[] } = {}) {
    for (const m of manifests) {
      if (this.manifests.has(m.id)) throw new ModuleError(`duplicate module ${m.id}`);
      if (m.apiVersion !== CORE_API_VERSION)
        throw new ModuleError(`${m.id} targets API ${m.apiVersion}, core is ${CORE_API_VERSION}`);
      for (const t of m.elementTypes)
        if (!t.startsWith(`${m.id}/`)) throw new ModuleError(`${m.id}: element type ${t} not namespaced`);
      this.manifests.set(m.id, m);
    }
    for (const m of manifests)
      for (const dep of m.dependsOn)
        if (!this.manifests.has(dep)) throw new ModuleError(`${m.id} depends on missing module ${dep}`);
    const disabled = new Set(opts.disabled ?? []);
    for (const id of this.manifests.keys()) if (!disabled.has(id)) this.enabledSet.add(id);
    // A module whose dependency is disabled is disabled too.
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of [...this.enabledSet].sort()) {
        if (this.manifests.get(id)!.dependsOn.some((d) => !this.enabledSet.has(d))) {
          this.enabledSet.delete(id);
          changed = true;
        }
      }
    }
  }

  isInstalled(id: ModuleId): boolean {
    return this.manifests.has(id);
  }
  isEnabled(id: ModuleId): boolean {
    return this.enabledSet.has(id);
  }
  manifest(id: ModuleId): ModuleManifest | undefined {
    return this.manifests.get(id);
  }
  installedIds(): ModuleId[] {
    return [...this.manifests.keys()].sort();
  }

  contextFor(moduleId: ModuleId): ModuleContext {
    const m = this.manifests.get(moduleId);
    if (!m) throw new ModuleError(`module ${moduleId} not installed`);
    if (!this.isEnabled(moduleId)) throw new ModuleError(`module ${moduleId} is disabled`);
    return {
      moduleId,
      getComponent<T>(el: Element) {
        return el.components[moduleId]?.data as T | undefined;
      },
      setComponent<T>(el: Element, data: T) {
        if (!m.component) throw new ModuleError(`${moduleId} declares no component`);
        return {
          ...el,
          components: { ...el.components, [moduleId]: { v: m.component.version, data: structuredClone(data) } },
        };
      },
      createElement(type, fields) {
        if (!m.elementTypes.includes(type)) throw new ModuleError(`${moduleId} does not own type ${type}`);
        return { ...structuredClone(fields), type: type as ModuleElement["type"], ownerModule: moduleId, components: {} };
      },
    };
  }

  /**
   * Run every rule of every ENABLED module whose declared inputs are all enabled.
   * Rule 7: disabled module → no findings. Rule 5: undeclared reads throw.
   * Output is sorted → deterministic (CLAUDE.md rule 10).
   */
  runRules(model: ProjectModel): Finding[] {
    const out: Finding[] = [];
    for (const id of [...this.enabledSet].sort()) {
      for (const rule of this.manifests.get(id)!.rules) {
        if (!rule.reads.every((r) => this.enabledSet.has(r))) continue;
        const allowed = new Set(rule.reads);
        const ctx: RuleContext = {
          component<T>(el: Element, mid: ModuleId) {
            if (!allowed.has(mid)) throw new ModuleError(`rule ${rule.id} read undeclared module ${mid}`);
            return el.components[mid]?.data as T | undefined;
          },
        };
        out.push(...rule.evaluate(model, ctx));
      }
    }
    return out.sort(
      (a, b) =>
        a.ruleId.localeCompare(b.ruleId) || a.elementIds.join(",").localeCompare(b.elementIds.join(",")),
    );
  }

  /** Elements the given module's tools/overlays may show (MODULES §9: role-based view). */
  visibleElements(model: ProjectModel): Element[] {
    return sortedElements(model).filter((e) => !isModuleElement(e) || this.enabledSet.has(e.ownerModule));
  }
}
