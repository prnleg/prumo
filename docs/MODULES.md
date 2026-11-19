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
3. **Unknown data is never dropped silently.** ~~Keep it untouched and show a banner~~ → **Updated session #8 (owner, Q-113):** opening a project that uses a module you don't have **stops first** and asks you to choose (see §6). Data is only removed when the user explicitly picks "remove".
4. **Module data is namespaced** by module id inside each element: `element.components["org.project.structural"]`.
5. **Rules declare their inputs** (which components they read), so the engine knows what to re-run and cross-module rules are explicit.
6. **Each module owns its migrations.** *(Implemented: `ComponentDecl.migrations`; also `ComponentDecl.mirror` — how a module's data changes when its element is mirrored, e.g. Architect swaps a wall's painted sides; core calls it without knowing the data, s#11.)*
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

## 6. Modules vs plugins — terminology (owner, session #8)

| | **Module** | **Plugin** |
|---|---|---|
| Size | Big: a whole discipline / Vision | Small add-on |
| Examples | Structural, Electrical, Plumbing, Rendering/Export (Q-118) | Language packs, compatibility with external things (e.g. import/export of other formats), *maybe* country/city rule packs (Q-121) |
| Installed | "Install if you want" | "Install if you want" |
| Relation to ADR-030 | = code modules | **Resolved (Q-121):** users only see *Modules* and *Plugins*. Internally a plugin is **data-only** (languages, rule values; publishable early) or **code** (import/export; internal until ADR-020's condition). "Data pack" is an internal term only. |

## 7. Opening a project that uses a module you don't have (owner, session #8 — ADR-032)

Example: the engineer has the Electrical module, you don't, and they send you the project.

```
┌──────────────────────────────────────────────────────────────┐
│  This project uses modules you don't have installed:         │
│   • Electrical (v0.3) — 42 items                             │
│                                                              │
│  [Install Electrical]   [Remove those 42 items…]   [Cancel]  │
└──────────────────────────────────────────────────────────────┘
```
- "Remove…" shows the list of items first and needs a second confirmation; it's destructive. The removal is an undoable command and gets a snapshot ("Before removing Electrical items").
- Owner decision (Q-122): **no read-only option.** Not installing the module means you can't see its work. Recovery path: the automatic snapshot before removal + the sender's own copy.
- A file from a **newer app version** (same modules, newer format): default **read-only + "Update Prumo to edit"** (not discussed by the owner yet; keep this default).

## 8. Sending/exporting a project: choose which modules to include (owner, session #8)

When saving a copy to send ("Export project…" / "Hand off…"):
```
This project uses these modules:
  [x] Architect (required)
  [x] Structural   — 18 items
  [ ] Electrical   — 42 items   ← unchecked = stripped from the exported copy
[Export]
```
- Stripping happens **only in the exported copy**, never in your working file.
- Required modules (Architect/core) can't be unchecked.
- Doubt: if Structural findings depend on data you strip, the receiver sees a different result. Show "the receiver won't see: …" under each unchecked module.

## 9. Optional installs (owner, session #8–9 — ADR-020 revision PROPOSED)

- Modules are **opt-in installs**: each role installs only what its work needs. The electrical engineer never sees wall paint; the architect never sees circuits. Side effect: a lighter app.
- **Resolved (Q-128, owner):** every installation has the same core: the **basic building**: levels, walls, floors/slabs, openings, rooms as shapes ("the blueprint"). **No colours, no finishes, no furniture** in the core. Original question: if an electrical engineer installs *only* Electrical, what's the minimum they still need? Walls, openings, and rooms (geometry) are needed by everyone, but **finishes (paint, tiles) and room-type lists** are Architect concerns. Proposal: split into
  - **core "Building" model** (always present): levels, walls (geometry + kind), openings, rooms (geometry), slabs: the shared skeleton;
  - **Architect module**: finishes, room types/names, the room tool, architect rules;
  - **Structural / Electrical / …**: their own data on top of the skeleton.
  The UX in every Vision still lets you draw walls (you can't place an outlet without a wall), but only the Architect module adds the "pretty" layer.
- Uninstalling a module that open projects use → those projects hit the missing-module dialog (§7) next time.


## Screen parts of a module (ADR-059)

A module's screen part is one `ModuleUi` object (`@prumo/ui-api`), exported from `<module>/ui`:
- `name`, `defaultOn`, `messages` (its own strings, every locale),
- `tools` (strip button + hint + a framework-free tool: move / click / finish / active),
- `marks(ctx)` / `links(ctx)` (symbols and dashed links on the plan),
- `elementTypes` + `elementPanel` (the panel for its own items), `roomPanel` (a section in each room's panel).
The app never names the module: `apps/desktop/src/installed-modules.ts` is the install list. Edits go through `ctx.run(command)`. Example: `packages/module-electrical/src/ui/index.ts`.
