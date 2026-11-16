# MODULES / VISIONS — design draft

> Status: **DRAFT.** Depends on ADR-019 (module system), ADR-020 (public API timing), ADR-022 (shared model), ADR-023 (plugin trust). Nothing here is accepted.

## 1. What a module can contribute (extension points)

| Extension point | Example (Structural) | Example (Electrical, future) |
|---|---|---|
| Element types | Column, Beam, Lintel | Outlet, Switch, Panel, Circuit |
| **Components** (extra data attached to core elements) | `structural` on Wall: role, material layers | `electrical` on Wall: conduit zones |
| Hosted-element kinds | — | Outlet hosted on a wall (same mechanism as openings!) |
| Tools (canvas interactions) | "Assign material" brush | "Place outlet" |
| Panels / inspectors | Findings panel, material picker | Circuit list |
| Overlays (rendering layers) | Load-bearing walls highlighted, stress heatmap | Circuit colouring |
| Rules (`model → findings`) | R-OPEN-001 … | "Outlet too close to sink" |
| Data packs | Materials, code profiles (BR, EU) | Wire gauges, local electrical codes |
| Commands | "Add lintel to opening" | "Assign circuit" |
| i18n strings | pt-BR, en | … |
| File schema + migrations | `structural` component v1 → v2 | … |

## 1b. Data packs vs code modules (ADR-030, PROPOSED, session #3)

| | Data pack | Code module |
|---|---|---|
| Contains | JSON: thresholds, loads, materials, finishes, rule parameters | TS: tools, element types, panels, **new** rule logic |
| Runs code? | **No** | Yes |
| Who can publish | Anyone, early (import from file; curated repo) | Internal until ADR-020's condition |
| Hierarchy | country → state → city (child overrides parent) | — |
| Example | `br` → `br-sp` → `br-sp-sao-paulo` (architect: minimum room areas) | `module-structural` |

Every value used by a rule shows **which pack (and version) it came from**.

## 2. Manifest (draft)

```jsonc
{
  "id": "org.project.structural",
  "name": { "en": "Structural", "pt-BR": "Estrutural" },
  "version": "0.1.0",
  "apiVersion": "0.x",                 // core module API it targets
  "dependsOn": { "org.project.architect": "^0.1" },
  "contributes": { "components": [...], "tools": [...], "rules": [...], "dataPacks": [...] }
}
```

## 3. Hard rules (proposed)

1. **The core never imports a module.** Modules depend on the core (and, if declared, on other modules).
2. **Built-in features are modules too.** The Architect Vision is a module on the same API. If the API can't express Architect, the API is wrong.
3. **Unknown data survives.** If a file contains components from a module that isn't installed, the app **keeps them untouched** on save and shows "This project uses module X (not installed)". Never silently drop data.
4. **Module data is namespaced** by module id inside each element: `element.components["org.project.structural"]`.
5. **Rules declare their inputs** (which components they read), so the engine knows what to re-run and cross-module rules are explicit.
6. **Each module owns its migrations.**
7. **Disabling a module hides its UI and findings but keeps its data.**

## 4. Open problems (critic's list)

- **Premature API (biggest risk).** Designing a public plugin API before having 2–3 real modules almost always produces the wrong API. → ADR-020: internal-only API until Architect + Structural + one more prove it.
- **Cross-module interactions.** An electrical box cut into a structural wall, or a plumbing pipe through a beam. Which module owns that rule? Proposal: a rule can depend on several modules and only activates when all are enabled. → Q-053
- **Conflicting edits.** Two modules both want to react to "wall deleted". Ordering? Proposal: modules can't mutate the model in reaction to events; they only *propose* commands, which the core applies in one transaction. (Needs thought.)
- **Third-party code safety.** Running an untrusted add-on = running arbitrary code on the user's machine. → ADR-023, Q-052.
- **Versioning hell.** A file made with Structural 0.3 opened with 0.1. → per-module schema versions + "newer than installed" warning.
- **Performance.** N modules × M rules on every edit. → rules declare inputs; incremental re-evaluation later.
- **UX overload.** Each module adds tools and panels. → only the active Vision's tools are shown; switching Vision = switching toolbar + overlays, same model.

## 5. Vision switching UX (draft)

- A top-level switcher: `Architect | Structural | (Electrical) | …`.
- The model stays the same; tools, panels, overlays, and default findings filter change.
- ~~Findings from other Visions show as a badge~~ → **Updated session #2 (owner, Q-054):** only **critical** findings from other Visions surface, quietly (a marker on the element + a counter), and **never during an active gesture**. Full rules in ADR-025.
- Visions are **role-based** (Architect, Engineer, Electrician…). A Vision must be usable without understanding any other Vision.
- Open: can a Vision mark elements as protected for others ("load-bearing, don't remove")? → Q-077. Handoff between different people → Q-076.
