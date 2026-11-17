# DECISIONS (Architecture Decision Records)

Statuses:
- `OPEN` — not decided. **AI must not implement anything that depends on it.**
- `PROPOSED` — someone recommended an option; waiting for the owner.
- `ACCEPTED` — the owner explicitly agreed. Record date + who.
- `SUPERSEDED by ADR-xxx` — replaced. Never delete old ADRs.

Every ADR lists: context, options, my lean, **confidence**, what would change my mind, and consequences.

> Confidence in every "lean" below is the planning session's honest opinion. It's **not** a decision.

---

## ADR-000 — Template

```
## ADR-XXX — Title
Status: OPEN | PROPOSED | ACCEPTED (YYYY-MM-DD, by ...) | SUPERSEDED by ADR-YYY
Blocks: ...
Context: ...
Options:
  A) ... (+) ... (−) ...
  B) ...
Lean: ...  Confidence: low|medium|high
What would change my mind: ...
Consequences if accepted: ...
Reversibility: easy | painful | near-impossible
```

---

## ADR-001 — Platform: web app vs desktop app vs plugin
Status: **ACCEPTED (2026-11-15, owner): Tauri 2 desktop app with a web front end; a pure web build stays possible.** Owner: "anything that works everywhere"; open to a better framework if Spike D shows one. **v1 targets Windows + macOS; Linux deferred** (ADR-027). · Blocks: everything · Reversibility: **painful**

**Owner input (2026-11-15):** Senior SWE (.NET, Angular/Vue). Comfortable with Rust, C#, Python, WPF, Flutter, Tauri 2. Priority: **easiest install on Windows, macOS, Linux**; "the easiest and better one".

Updated comparison for a cross-platform, modular, 2D→3D editor:

| Option | Install size / ease | Owner fit | 2D/3D ecosystem | Plugins | Web build possible | Main worry |
|---|---|---|---|---|---|---|
| **Tauri 2 + Vue/TS** | Small (a few MB, *verify*), native installers for all 3 OS | Vue ✔, Rust ✔ | Excellent (SVG/Canvas/Three.js) | Easy (JS modules) | ✔ | 3 different WebViews; Linux WebKitGTK quirks |
| Electron + Vue/TS | Large (~100 MB+) | ✔ | Excellent | Easy | ✔ | Size, RAM |
| Avalonia (.NET) | Medium, all 3 OS | **Best language fit** (C#) | Good 2D (Skia); 3D weaker | Assemblies, natural in .NET | Partial (*verify* browser support maturity) | Smaller 3D/geometry ecosystem; fewer contributors know it |
| Flutter | Medium, all 3 OS | ✔ | 2D good, 3D weak | Hard (no dynamic code loading) | ✔ | Plugins + 3D |
| .NET MAUI | — | ✔ | — | — | — | **No official Linux** → rejected |
| WPF | — | ✔ | — | — | — | **Windows only** → rejected |

Lean: **Tauri 2 + Vue 3 + TypeScript.** Confidence: **medium-high**.
Why not Avalonia, since C# is the owner's strongest language? Because modules/add-ons, 3D (Three.js), geometry libraries, open-source contributor reach, and a possible web version are all much stronger in the TS world, and the owner already knows Vue.
What would change my mind: Spike D shows Linux WebKitGTK can't handle the editor smoothly, or the owner strongly prefers C# for long-term enjoyment (enjoyment matters on a hobby project!).

**Spike D result (session #11, macOS only):** 3.1 MiB app / 1.7 MiB DMG, warm start ~0.55 s, 60 fps at 500 and ~4,900 SVG walls + a Three.js scene. Nothing on macOS argues against the accepted stack. **Windows still unmeasured** (CI written, not run). See CURRENT_STATE.

**Spike D (Phase 0):** a Tauri 2 + Vue hello-world with an SVG canvas (500 walls, pan/zoom) and a Three.js scene, built and run on Windows, macOS, and Linux. Measure installer size and smoothness.

Options:
- **A) Web app (browser), runs locally, no server.** (+) Zero install, easy to share, good 2D/3D libraries (Canvas/SVG/WebGL/Three.js), Claude Code is very fluent in TS/React. (−) Heavy computation must run in Web Workers; file access is clunkier.
- **B) Desktop (Electron/Tauri wrapping a web app).** (+) Real file system, can ship later from A. (−) Packaging overhead.
- **C) Native desktop (Python + Qt, C#, etc.).** (+) Python has engineering libraries (numpy, PyNite). (−) UI development is slower; harder to share.
- **D) Plugin for an existing tool (FreeCAD / Blender+Bonsai / SketchUp).** (+) Geometry, file formats, and 3D come free. (−) You inherit their complexity and UX; "live consequence feedback" may be hard to fit into their workflows. See ADR-010.

Lean: **A (web, local-first), designed so B is possible later.** Confidence: **medium**.
What would change my mind: the owner already knows Python and not JS (Q-002), or Spike C shows a plugin gets 70% of the value for 10% of the effort.

---

## ADR-002 — Language & core stack
Status: **ACCEPTED (2026-11-15, owner): TypeScript strict + Vite + Vue 3 + pnpm monorepo + Vitest.** Sub-choices (2D renderer, state lib) remain PROPOSED below. · Depends on ADR-001 · Reversibility: painful

**Update 2026-11-15:** status → **PROPOSED: TypeScript (strict) + Vite + Vue 3 (Composition API) + pnpm workspaces monorepo + Vitest.** Vue rather than React because the owner knows Vue; the AI is fluent in both. Angular is possible too but heavier for a canvas-centric app. Owner: please confirm Vue vs Angular (Q-056).
State: Pinia for UI state only. **The building model lives in the framework-free core**, not in Pinia.

Original notes (kept for history):
If web: **TypeScript** (strict mode) + **Vite** + a UI framework (React is the most common, so the AI is most fluent in it) + a 2D renderer (options: SVG, Canvas2D, Konva, PixiJS) + **Three.js** (maybe via react-three-fiber) for 3D later + Vitest for tests.

Sub-questions still OPEN:
- 2D renderer: **SVG** (simple, crisp, easy hit-testing, slow at thousands of elements) vs **Canvas/WebGL** (fast, more work). Lean: SVG for Phase 1 — a house has hundreds of elements, not millions. Confidence: medium.
- State management: a hand-rolled immutable store + command pattern vs a library (Zustand/Immer). Lean: Immer + our own command layer. Confidence: low-medium.
- Numeric work: plain TS is probably enough through Tier 1. A Tier 2 solver needs linear algebra (a JS lib, or WASM, or a Python backend → ADR-013).

---

## ADR-003 — 2D-first or 3D-first
Status: **ACCEPTED (2026-11-16, owner: "lean"): A — 2D plan is the source of truth, 3D derived; elevations stored per element.** · Reversibility: medium

- **A) 2D plan is the source of truth; 3D is derived.** (+) Much simpler editing; this is how most architectural tools started. (−) Things like sloped roofs or split-level floors are awkward.
- **B) 3D model is the truth; plans are views.** (+) More general. (−) Far harder UI and geometry; scope explosion.

Lean: **A**, with elevations stored per element (base elevation, height) so 3D extrusion is possible. Confidence: **high**.

---

## ADR-004 — Which construction system(s) do we model? ⚠️ CRITICAL
Status: **PARTIALLY ACCEPTED (2026-11-15, owner):** construction systems are **switchable**, and all engineering knowledge (materials, bricks, formulas, resistance) lives in the **Structural module**, not in the core. **Update 2026-11-15 (owner):** first rule pack = **structural masonry**; other systems are welcome as further packs. ~~The owner mentioned "grid", interpreted as a column-grid frame system.~~ **Corrected session #3:** "grid" meant the drawing/snapping grid (ADR-031). The second rule pack is **undecided**; ask the engineer (E-01).
**Clarified intent (owner):** the split exists because *an architect doesn't want to deal with engineering; that's not their job*. Visions are **role-based**: the Architect Vision must be fully usable with zero engineering knowledge.
Original status: **Still OPEN:** which system the Structural module implements *first* (Q-055). · Blocks: all structural rules · Reversibility: **near-impossible later** (rules are system-specific)

⚠️ Critic's note on "switchable": switching systems isn't like switching a colour. Each system needs its own rule set, materials, and assumptions (see DOMAIN_PRIMER §5). "Switchable" really means **a "construction system" setting on the project, plus one rule pack per system.** Implementing one pack well beats three packs badly. Proposal: rule packs are data + code inside the Structural module; v1 ships **one** pack.

Why this matters: "put a window in a wall" means **completely different things** depending on the system:
- **Structural masonry** (walls carry the building): every opening weakens a load-carrying element. Very sensitive.
- **Reinforced-concrete frame + infill masonry** (very common in Brazil and much of the world): the columns/beams carry loads; infill walls usually *don't* — openings in them are mostly fine structurally (but there are exceptions!).
- **Light timber frame / light steel frame:** studs + headers; openings need headers and king/jack studs.
- **Cast-in-place concrete walls.**

Options:
- A) One system only (pick the one most relevant to the owner).
- B) Two systems with a shared rule interface.
- C) "System-agnostic" generic rules only. (−) Generic rules are vague, which defeats the purpose.

Lean: **A, choosing based on Q-010 (where/what the owner wants to model).** If the owner is in Brazil, the realistic candidates are "RC frame + infill" (most common) or "structural masonry" (most interesting structurally, since openings actually matter). Confidence: **low** — I really need the owner's input.

---

## ADR-005 — Analysis depth (tiers)
Status: **ACCEPTED (2026-11-16, owner: "lean"; "most of it is simple right now … later on it will get better (v1.1 or v2)"): MVP Tier 0, Phase 3 Tier 1, Tier 2 optional, Tier 3 non-goal.** · Reversibility: easy to *add* tiers, painful to remove trust once given

Tiers are defined in `STRUCTURAL_ANALYSIS.md`:
- Tier 0: geometric/topological rules.
- Tier 1: simplified hand-calc formulas (load takedown, lintel bending, wall stress).
- Tier 2: 2D frame stiffness analysis.
- Tier 3: FEA.

Lean: **MVP = Tier 0. Phase 3 = Tier 1. Tier 2 optional. Tier 3 is a non-goal.** Confidence: **high.**

---

## ADR-006 — Units, precision, coordinate system
Status: **ACCEPTED (2026-11-16, owner: "lean"): float64 mm + explicit tolerance + snapping; X right, Y up; radians inside, degrees in UI; SI.** Tolerance values still to fix in Phase 1 (spike values: join 5 mm, EPS 1e-9 geometry). · Reversibility: **painful** (affects every saved file)

Proposal:
- Internal length unit: **millimetres**. Options: (a) integers (no float drift, but rotation/mirror on non-axis lines produce non-integers → must round, and rounding can break joins), (b) float64 with a global tolerance `EPS = 0.01 mm` for comparisons.
- Lean: **float64 mm + explicit tolerance + snapping**, never compare floats with `===`. Confidence: medium.
- Forces in **N**, stresses in **MPa (N/mm²)**, loads in **kN/m²** in the UI (converted internally). Consistent SI everywhere.
- Coordinate system: X right, Y up (math convention) in the model; the renderer flips for screen. *(Screen Y points down — classic source of mirror bugs.)*
- Angles: radians internally, degrees in the UI.
- Display units: metric only at first? (Q-012)

---

## ADR-007 — Openings are hosted by walls
Status: **OPEN** (strong lean) · Reversibility: painful

- **A) Opening has `hostWallId` + `offsetAlongWall`.** It moves with the wall and can't exist without one. (+) Matches reality and every BIM tool. (−) Moving an opening across to another wall requires a "re-host" operation.
- B) Free-floating openings that cut whatever wall they overlap. (−) Ambiguous, fragile.

Lean: **A.** Confidence: **high.**
Open sub-question: can a "generic opening" (the owner said doors don't need to be real doors) also exist in slabs (e.g., a stair void)? Lean: yes, later, with `hostSlabId` as a separate type.

---

## ADR-008 — Project file format
Status: **ACCEPTED in principle (2026-11-15, owner: Q-104/105)**: one **zip-container** file, extension **`.prumo`** for now. It contains `project.json` (model, with `format: "prumo-project"` + `schemaVersion`), `snapshots/` (named versions for the compare view), `thumbnail.png`, and `packs.lock.json` (which data-pack versions were used). **Snapshots (Q-112, owner): full copies (option A).** Growth mitigation **ACCEPTED (Q-124)**: a size warning + manual deletion of old snapshots, "Export a clean copy" (no history), and an optional "keep only the last N" setting.
**Q-110 (owner): keep `.prumo` permanently**, even if the product is renamed. The format id inside the file is still recommended for robustness.
Original status: **OPEN**
Lean: **JSON**, with `schemaVersion` at the root, stable UUIDs for every element, and a migration function for every version bump. Possibly IFC export later, but **not** as the native format (IFC is huge and complex). Confidence: high.

---

## ADR-009 — Country / building code reference
Status: **ACCEPTED (2026-11-15, owner): two code profiles first: Brazil (ABNT NBR) and Europe (Eurocodes). Pluggable profile architecture (option C).** Still OPEN: which Eurocode National Annex (Q-051). · Blocks: thresholds, default loads, material values

**Update 2026-11-15 (owner):** EU was a reflex, not a requirement. **Brazil is the only profile for v1.** Country rule sets become **installable data packs/plugins** later ("follow the rules by country"). EU is deferred; the profile interface must still not be Brazil-shaped (R-24 stays). Q-051 parked.
**Principle (owner):** rules must **never stop anyone from creating anything**. They only inform. See ADR-026.

⚠️ Critic's note: **"EU" isn't one rulebook.** Eurocodes leave many safety factors and parameters as *Nationally Determined Parameters*, set by each country's **National Annex** (Portugal, Germany, France… differ). Options: (a) use the EN "recommended values" and label the profile `EU (EN recommended values, no National Annex)`; (b) pick one country's annex. Lean: (a) for v1. Confidence: medium.
⚠️ Brazil and the Eurocodes use different load-combination formats, partial factors, and material classes (e.g. concrete classes C20/25 in EN vs fck = 20 MPa in NBR 6118). The profile interface must not assume one style. Design it with both in mind from the start; this is a good stress test for the abstraction.

Codes differ by country. Examples (*verify current editions before use*):
- Brazil: ABNT NBR 6120 (loads), NBR 6123 (wind), NBR 6118 (concrete structures), NBR 16868 (structural masonry), NBR 7190 (timber), NBR 8800 (steel), NBR 15575 (housing performance).
- USA: IBC/IRC + ASCE 7 (loads) + ACI 318 / TMS 402 / NDS.
- Europe: Eurocodes EN 1990–1996.

Options: A) one country's codes, B) "code-agnostic" with thresholds marked as illustrative, C) pluggable "code profiles".
Lean: **C as architecture, A as content** (one profile populated, the interface ready for more). Confidence: medium.
⚠️ Codes are copyrighted documents (ABNT standards are sold). We can **cite** clause numbers but we shouldn't copy text into the repo. The owner may need to buy or access the standards to verify values (Q-031).

---

## ADR-010 — Build from scratch vs extend an existing tool
Status: **ACCEPTED (2026-11-16, owner: "lean"): build our own.** Owner caveat: *"we might need to add them in the future because people will probably want to implement tools that are present in other projects"* → keep the door open for **interoperability** later (import/export such as IFC/DXF, and modules that re-create familiar tools from other software), via the module API (ADR-020) — not now (golden rule 12). · Reversibility: near-impossible after Phase 1
See `ALTERNATIVES.md`.
Lean: **build from scratch (web)**, because the core value is the live, explained consequence UX, which is hard to bolt onto existing tools. Confidence: **low-medium.** I haven't validated this. Spike C exists to challenge it.

---

## ADR-011 — Undo/redo & state architecture
Status: **ACCEPTED (2026-11-16, owner: "lean"): immutable snapshots + command objects; one user action = one undo step.**
Lean: **immutable model snapshots + command objects** (`do`, `undo`, `label`). Group multi-step user actions into a single transaction. Analysis is a pure function of the current snapshot, so undo automatically restores findings. Confidence: high.

---

## ADR-012 — Geometry library
Status: **ACCEPTED (2026-11-16, owner: "lean"): own 2D math for joins + outline in Phase 1; a polygon-boolean library only when areas/quantities/opening cuts need it, with its own dependency ADR.**
Needs: segment intersection, polygon offset (wall thickness), polygon boolean (wall-join cleanup, opening cuts), point-in-polygon, snapping.
Options: write our own minimal 2D geometry (+ full control, − bugs), or use a library for polygon booleans (e.g. a Clipper port or a polygon-clipping library — **verify current maintenance status before choosing**).
Lean: own small vector math + a battle-tested polygon boolean library. Confidence: low (needs Spike A).
**Spike A evidence (session #11):** our own math (~250 lines) handles every join type needed for drawing, *including* the clean outline, with no library. The places where it falls short are all **area/union** problems: unequal-thickness near-straight joins, X-crossing overlap (double-counted area), and short walls at sharp angles. Those are exactly what a polygon-union library solves, and Phase 1 doesn't need quantities. Updated lean: **own math for joins + outline in Phase 1; add a boolean library only when areas/quantities or opening cuts need it** (its own ADR then). Confidence: medium.

---

## ADR-013 — Where does the structural solver run?
Status: **OPEN** (not needed until Tier 2)
Options: TS in a Web Worker / Rust→WASM / a Python backend (e.g. PyNite) / Pyodide (Python in the browser).
Lean: **TS in a Worker for Tier 0–1** (simple formulas). Decide Tier 2 later. Confidence: medium.

---

## ADR-014 — Licensing / open source / private
Status: **ACCEPTED (2026-11-15, owner): open source, Apache-2.0, public repository from day 1.** Installers unsigned for now (signing later, R-26 accepted).
Options:
- **MIT / Apache-2.0** (permissive): anyone, including companies, can use it and close their forks. Apache-2.0 adds a patent grant. Maximizes adoption and plugin authors.
- **MPL-2.0** (file-level copyleft): changes to *our* files must stay open; plugins and apps around it can be anything.
- **GPL-3.0 / AGPL** (strong copyleft): derivatives must be open. Can scare off plugin authors and companies.
Lean: **Apache-2.0** for core + official modules (permissive + patent clause + a clear "AS IS" warranty disclaimer, which matters for a tool that talks about structures). Confidence: medium.
Consequence: GPL dependencies are not allowed in core (license-check in CI).
⚠️ Code profiles: we can't redistribute text or tables copied from ABNT standards or Eurocodes. Profiles hold **values + clause references**, never copied text. Even numeric tables may be sensitive; when in doubt, cite and let the user enter the value. → R-10 upgraded.

---

## ADR-015 — Single storey vs multi-storey
Status: **ACCEPTED (2026-11-16, owner: "lean"): `levels[]` in the model from day 1; UI edits one level until Phase 5.**
Lean: **support `levels[]` in the data model from day 1, but the UI only edits one level until Phase 5.** Confidence: high. (Cheap now, expensive to retrofit.)

---

## ADR-016 — Project name
Status: OPEN. Not urgent. Avoid names that imply certification ("SafeBuild", "StructCheck Pro"…).

**Candidates (session #3):**
- Owner's ideas: **Rustitect**, **Archirust**.
  - ⚠️ Critique: (1) most of the code will be TypeScript/Vue; Rust is only the Tauri shell, so "Rust" in the name misleads contributors; (2) the persona has never used CAD and "Rust" means nothing to them; (3) the Rust Foundation has a trademark policy about using "Rust" in project names. **Check it before choosing.**
- Planning session's ideas (Portuguese construction words, short, friendly; **availability unchecked**: GitHub org, domain, trademarks, app stores):
  - **Prumo** (plumb line: the tool that checks a wall is true; nice metaphor for "checks")
  - **Esquadro** (builder's square)
  - **Croqui** (a quick sketch)
  - **Traço** (stroke, or a concrete mix ratio)
  - **Planta** (floor plan; ambiguous with "plant" in English)
- Process: pick 3 → check GitHub/domain/trademark collisions → decide. Use a codename until then.

**Update session #4 (2026-11-15): owner likes "Prumo". Status: Prumo = CODENAME (accepted); final name PENDING the availability check.**
⚠️ Collision found in a quick web search (2026-11-15): a commercial **"Prumo"** product already exists, a cloud **remodeling estimating** app for residential remodelers (getprumo.com, listed in "Remodeling Estimating Software" directories). It's the **same broad industry** (construction/remodeling), which is the riskiest kind of collision for trademarks and for search/discoverability. There may be other Brazilian companies using "Prumo" too (unverified).
Options: (a) keep "Prumo" as an open-source project name and accept the confusion; (b) a distinctive variant (e.g. "Prumo Studio", "OpenPrumo", "Prumo3D"; still close); (c) a different name before going public.
Lean: use **Prumo as the codename**, check the trademark registers (INPI in Brazil; USPTO/EUIPO if international) before the first public release, and decide then. Renaming an early public repo is cheap; renaming after users and packs exist isn't. → Q-109

---

## ADR-017 — How do we know whether a wall is load-bearing? ⚠️ CRITICAL
Status: **OPEN** · Blocks Phase 2

This is the single most important structural modelling decision. Options:
- **A) User declares it** per wall. (+) Simple, honest. (−) A non-expert will often get it wrong; garbage in → garbage out.
- **B) Inferred** from what's above: a slab/roof region with a span direction, and walls perpendicular to the span that support its edges are bearing. (+) Teaches the concept. (−) Needs slabs and span directions modelled; inference can be wrong.
- **C) Inferred, shown to the user, user can override,** and the override is flagged ("you marked this as non-bearing, but it appears to support the slab above").
- **D) Depends on the construction system:** in structural masonry, *all* walls are treated as bearing/bracing by default; in an RC frame, infill is non-bearing by default.

Lean: **C + D.** Confidence: medium. Needs Q-010 and ADR-004 first.
Spike B (session #11): modelled as a per-wall mark (`bearing` / `non-bearing` / `unmarked`) plus a profile setting for unmarked walls (`assume-bearing` = option D, or `skip`). Each finding names *why* the wall counts as bearing (assumption A-ROLE-1 "you marked it" / A-ROLE-2 "profile default"). Works for both; decides nothing. Engineer: E-04, E-07.

---

## ADR-032 — Missing modules & export with module selection
Status: **ACCEPTED (2026-11-15, owner, Q-113)**: opening a project with uninstalled modules **stops** and offers **install** or **remove the module's items**. Exporting/sending a copy shows the modules used and lets you **remove modules from the exported copy**. Details: MODULES.md §7–8. **No read-only option** (owner, Q-122): if you choose not to install the module, its work isn't viewable; you either install it or remove those items. Risk R-47 accepted, mitigated by the confirmation + automatic snapshot.
Supersedes MODULES rule 3's "keep untouched silently" default and CLAUDE.md rule 13's wording (both updated).

## ADR-019 — Modular "Visions" architecture
Status: **ACCEPTED in principle (2026-11-15, owner):** the product is a shared model + installable Visions/modules (Architect, Civil/Structural, Electrical later…). Details (extension points, manifest, naming) are **PROPOSED** in `MODULES.md`.
Still OPEN: the user-facing name ("Vision", "Mode", "Module", "Add-on"?) → Q-059.
**Terminology (owner, session #8):** **modules** = big, install-if-you-want disciplines (Electrical, Structural…); **plugins** = smaller things (languages, compatibility with external tools/formats…). See MODULES §6; overlap with ADR-030 → Q-121.

## ADR-020 — When does the plugin API become public?
Status: **ACCEPTED (2026-11-15, owner liked the approach)**
Proposal: v1 modules are **bundled at build time** (no runtime install, no marketplace). The module API is internal and may break freely (`apiVersion 0.x`). It becomes a public, stable API only after **three** real modules use it (Architect, Structural, + one more).
Why: designing a plugin API before you have plugins is the classic way to get it wrong.

**⚠️ Revised session #9 (owner, Q-123):** modules must be **truly optional installs**, not just switches. Owner's reasons: (1) each role sees only what it needs (*"an electrical engineer doesn't need to know the colour of the wall"*), (2) it makes the system lighter.
Reconciliation proposed (still keeps the anti-platform-trap intent):
- **"Public API" ≠ "separately installed".** Official modules (Structural, Electrical…) can be *distributed* separately while the API stays **internal**: they're built in the same monorepo, released **in lockstep** with the app version, and only first-party modules are installable. Third-party code modules still wait for ADR-020's 3-module condition.
- **Staged delivery (Q-127):**
  - **Stage 1 (Phases 1–2):** modules ship inside the installer but are **not loaded** unless enabled (no UI, no memory, no rules). Lighter at runtime, not on disk. Cheap.
  - **Stage 2 (when a 3rd module exists):** real **download-on-demand** (app downloads the module from GitHub Releases, verifies a hash/signature, loads it dynamically). Lighter on disk too. Needs: dynamic JS loading in Tauri, integrity checks, offline "install from file", version compatibility checks.
- Why staged: real downloadable modules are exactly the platform plumbing R-22 warns about; doing it before there's a second module to download is premature.
Status of revision: **ACCEPTED (2026-11-15, owner: Q-127, stage 1 and 2)**.
Confidence: high. Owner: accept?

## ADR-021 — Internationalization
**Owner principle (session #7, Q-116/117):** *every locale-dependent default follows the UI language and stays customizable*: number format for display **and** input (no mixed parsing), floor names (Térreo / Ground floor), room-type names, etc.
Status: **ACCEPTED (2026-11-16, owner: "lean")**: i18n from day 1 (no hard-coded UI strings), shipping **pt-BR + en**. Every module ships its own strings. Rule/finding messages are i18n keys with parameters, never concatenated sentences.
Why now: "for everyone" + Brazil + EU, and retrofitting i18n is painful.
**Spike B evidence (session #11):** keys + typed params (`length` formatted per locale at display time, `element` labels generated, never stored) worked for one rule in both languages. Needed beyond plain `{slots}`: **plural on a named param, nested** ("2 possible issues found by the 1 check") and soon **gender select** (R-56). That's ICU MessageFormat territory → choosing an i18n library (e.g. vue-i18n vs an ICU formatter) needs its own dependency ADR in Phase 1. Tests that paid off: catalogue key + slot parity across locales; banned-words scan over every catalogue string.

## ADR-022 — Shared model with namespaced module components
Status: **ACCEPTED (2026-11-16, owner: "lean")** (see ARCHITECTURE "Model kernel", MODULES §3).
Spike E evidence (session #11): `element.components[moduleId] = { v, data }` worked for all 7 MODULES rules, per-module migrations, ADR-032 removal, and export stripping. Limitation: in-process TS can't *enforce* write isolation (a module can build objects by hand); it's convention + the module context + review until ADR-023.
Alternatives rejected: (a) one separate model per Vision, synced (sync bugs); (b) a giant model where the core knows every discipline (breaks modularity).

## ADR-023 — Trust model for third-party add-ons
Status: **OPEN** (not needed until the API is public — ADR-020)
Options: only official/bundled modules; unsigned community modules with a big warning; sandboxed modules (iframe/Web Worker/WASM with a message-passing API only). Lean: sandboxed when the public API arrives. Bundled-only until then.

## ADR-024 — Generic hosting of elements on walls/slabs
Spike E note (session #11): an Electrical outlet hosted on a core wall needed a generic `host` field **in the core** (the core must know hosting to cascade deletes later). Supports this ADR. Cascade not tested yet.
Status: **ACCEPTED (2026-11-16, owner: "lean")**: replaces the opening-only `hostWallId` (ADR-007) with a generic `host: {elementId, offset, ...}` so future electrical outlets, switches, or wall-mounted fixtures use the same mechanism. ADR-007's intent stays.

## ADR-025 — When and how findings appear ("quiet while creating")
Status: **ACCEPTED (2026-11-16, owner: "lean", settle delay **2 s** after the user stops)** (from the owner's Q-054 answer, 2026-11-15)
Owner's concern: *"I'm still connecting the wall and there's an annoying warning saying I'm creating a structural failure."*
Proposal:
1. **No findings during an active gesture** (drawing a wall chain, dragging, typing a value). Evaluate only when the command **commits** (gesture ends).
2. **Settle delay:** after a commit, wait **2 s** of inactivity (owner, 2026-11-16) before *showing* new findings (computing can happen earlier). Tunable constant, not per-user yet.
3. **Incomplete geometry is "draft", not an error.** An open wall chain, a dangling wall end, or a room not closed yet → no structural findings for those elements until they're "settled" (the chain is closed/ended, or N seconds pass). Hard part: defining "settled" (Q-073).
4. **Inside the Architect Vision:** only **critical** findings from other Visions surface, as a quiet badge/dot on the element + a counter. **No popups, no modals, no sounds**, never stealing focus.
5. **Inside the Structural Vision:** the full findings panel.
6. Per-user setting: "Show critical engineering alerts in Architect Vision: on/off" (default on).
Reversibility: easy (UX).

## ADR-026 — Rules inform, never block
Status: **ACCEPTED (2026-11-15, owner):** "That should not stop anyone from creating anything; it should help them know if they're following the rules."
Consequences:
- Code/structural rules **never** prevent an edit.
- ⚠️ Distinction to confirm (Q-027 reworded → Q-072): **geometric impossibilities** (window longer than its wall, zero-length wall) are *model validity*, not rules. Lean: still prevent or auto-clamp those, because the model can't represent them. Owner to confirm.
- Wording: "following the rules" must be phrased as *"matches the N checks in profile X"*, never "compliant" (SAFETY doc).

## ADR-027 — Supported platforms v1
Status: **ACCEPTED (2026-11-15, owner): Windows + macOS.** Linux deferred to a later phase.
Notes: keep the code Linux-friendly (no OS-specific APIs outside the platform adapter); CI *may* build Linux unofficially so regressions are visible. ❓ Q-075.

## ADR-028 — Crash/error reporting
Status: **ACCEPTED in principle (2026-11-15, owner):** "would be nice to have at least error/crashing" reports. Details **PROPOSED**:
- **Opt-in** (asked once, off until the user says yes). Brazil's LGPD and the EU's GDPR both make opt-in the safe choice.
- Reports contain: app version, OS, stack trace, module versions. **Never** project content, file names, or paths (scrubbed).
- No usage analytics in v1.
- Provider OPEN: a hosted service with an open-source plan, self-hosted, or plain "copy error details → open a GitHub issue" (zero infrastructure, a fine v1). Lean: **v1 = local crash log + "Report on GitHub" button that pre-fills an issue**; a hosted provider later. Confidence: medium.

## ADR-029 — Architect ↔ Engineer handoff model
Status: **ACCEPTED in principle (2026-11-15, owner: Q-076 "yes, your case makes a lot of sense")**. Mechanics **PROPOSED**:
- Different people, same project file, passed back and forth (no real-time collaboration: still a non-goal).
- Data model gets: `author` (local display name, no accounts — Q-092), `createdBy/modifiedBy` per element, **notes** attached to elements, and **protection markers** set by a Vision ("structural: load-bearing, don't remove").
- Protection doesn't block (ADR-026). Deleting/moving a protected element is allowed but leaves a **critical marker** (Q-077 ✅ option b).
- **RESOLVED session #4 (owner, Q-091): no parallel edits.** Owner: *"It's like two devs working on the same issue. It's just a mess."* → **Sequential turns ("baton" model)**:
  - The project has exactly **one holder** at a time. The holder edits; everyone else opens it **read-only + can add notes**.
  - Handing off = an explicit action ("Hand to engineer…") that records who, when, and a message, and creates a **named snapshot** ("Sent to engineer #1") for the compare view.
  - Opening a copy where you're not the holder → read-only banner + a "Take over" button (logged, with a warning). File-based locks can't be enforced (copies exist), so this is **convention + visibility**, not security.
  - **Q-102 resolved: no.** While someone else holds the project, you can only view and add notes.
  - **Q-103 resolved:** the app doesn't move files; people send them however they like (email, Drive, etc.). Sync features only if needed later.
- (Previous text kept for history:) ⚠️ **Biggest open problem: parallel edits.** If the architect keeps working while the engineer reviews a copy, there are two divergent files. Options: (a) **sequential "turns"** — only one side edits at a time, enforced by convention + a "handed off to X" banner; (b) **compare view** (diff two versions visually) but merge manually; (c) automatic merge (element-level three-way merge: hard). Lean: **(a) + (b) for v1.** Merge is a later problem. → Q-091.

## ADR-030 — Two kinds of extensions: data packs vs code modules
Status: **ACCEPTED (2026-11-15, owner: Q-094 "yes")** (prompted by Q-078: "everyone can implement their plugins: city, state, country")
Tension: ADR-020 keeps the *code* module API internal until 3 modules exist, but the owner wants anyone to publish country/state/city rule plugins.
Proposal:
- **Data packs** (JSON/YAML, no code): thresholds, default loads, material lists, and rule *parameters* for rules that already exist in a module. Example: `br-sp-sao-paulo-architect.json` sets "minimum bedroom area = X m²" for the existing rule `A-ROOM-001`. These are safe (no code execution), easy to review, and can be **public early**.
- **Code modules**: new tools, element types, *new kinds of rules*. Internal until ADR-020's condition is met.
- Packs are hierarchical: **country → state → city**, with child packs overriding parent values; every value shows which pack it came from.
- The core ships **no** code profiles; even Brazil is a pack bundled with the Structural module (owner: "the core might not need all of that").
Confidence: medium-high. This is how the "plugins for everyone" goal stays compatible with the anti-platform-trap rule.

## ADR-031 — Build mode interaction model ("Sims-like, without the cage")
Status: **ACCEPTED in principle (2026-11-15, owner)**. See `UX_PRINCIPLES.md`.
- Room tool + wall tool (both; room tool is the default). Rooms are closed loops; half walls, fences, and railings are allowed and don't need to close (Q-079 ✅).
- Any angle allowed; snapping is the default (grid + angle steps), with free placement on a modifier key (Q-087 for defaults).
- Doors/windows snap into walls and cut them.
- **Snapping defaults ACCEPTED (Q-087):** 10 cm grid, 15° steps, Alt = free. They **must be easy to discover and change**: visible in the status bar (click to change), in Settings, and mentioned in the guided tour.
- **Half walls can close a room (Q-088, owner):** e.g. a half wall dividing an open kitchen. Fences/railings: open (Q-106). The invisible room separator stays as an option.
- **Material = finish vs structure split ACCEPTED (Q-090):** see DATA_MODEL "Finishes vs structure".
- "Grid" (Q-071) = the **drawing/snapping grid**, not a construction system (owner, session #3).

## ADR-018 — Is the AI allowed to invent structural thresholds?
Status: **ACCEPTED (2026-11-16, owner: "lean")**
Proposal: **No.** Any threshold without a source is stored with `source: "UNSOURCED"` and shown as `UNVERIFIED` in the UI, and it's listed in `STRUCTURAL_ANALYSIS.md` §"Unverified values" until someone verifies it. Owner: please accept or reject.

---

## ADR-033 — Monorepo & tooling for Phase 1
Status: **ACCEPTED (2026-11-16, owner: "lean"; Node: "Node 22 or higher")**
Setup notes (2026-11-16, checked on npm): **Node ≥ 22.12** (`engines`; Vitest 5 needs ^22.12), `.nvmrc` = 22. **TypeScript 6.0.x, not 7**: typescript-eslint 8.72 supports `<6.1`; revisit when it supports TS 7 (native compiler). Exact versions pinned in package.json.
Proposal:
- **pnpm workspaces** with the ARCHITECTURE layout (`apps/desktop`, `packages/core`, `packages/renderer-2d`, `packages/ui-kit`, `packages/module-architect`; `module-structural` waits for Phase 2).
- **TypeScript strict** (+ `noUncheckedIndexedAccess`, as in the spikes), **Vitest**, **vue-tsc**; versions pinned exactly (spike set: Vue 3.5, Vite 6, Vitest 3, TS 5.7; Tauri 2.12).
- **Node pinned** in `.nvmrc` + `engines` + CI. Lean: Node 22 LTS (lets us move to Vite 7 later; R-55). Owner's machine currently has Node 20.11 → would need an upgrade.
- **Boundary enforcement** (golden rules 11 + 16) by a lint rule, not convention: `core` can't import Vue/modules/Tauri; modules can't import each other's internals; only the platform adapter imports `@tauri-apps/*`. Options: ESLint `no-restricted-imports` per package (no extra dep beyond ESLint) vs `dependency-cruiser`. Lean: ESLint + `no-restricted-imports` (one tool, enough for our rules).
- **Prettier** for formatting (exempt from debates, rule 3).
- **CI**: lint + typecheck + test on every push; installers (from `spike-stack.yml`) on tags/manual.
Dependencies added: pnpm, TypeScript, Vitest, Vite, vue-tsc, ESLint (+ typescript-eslint, eslint-plugin-vue), Prettier. **Verify current maintenance/versions at setup time.**
Lean: as above. Confidence: high (all already used in spikes or industry default). Reversibility: easy.

## ADR-034 — i18n library
Status: **ACCEPTED (2026-11-16, owner: "lean"): B — `intl-messageformat` + own Vue glue.** Owner addition: language *"should be probably attached to the country"* (construction vocabulary is local), but unsure about excluding other languages → Q-137 (default: UI language stays the user's choice; the project's country profile suggests the default language for new projects, and its local terms are shown alongside, e.g. "lintel (verga)"; nothing is excluded).
Need (Spike B): keys + params; **plural on a named param, nested**; **gender `select`** (R-56); formatting must also work **outside Vue** (rules/findings are produced in `core`/modules and rendered for exports and tests).
Options:
- A) **vue-i18n** — (+) Vue standard, tooling. (−) its own message syntax (plural via `|` pipes, no ICU `select`); Vue-only, so core/modules need a second formatter.
- B) **ICU MessageFormat formatter (`intl-messageformat`, FormatJS)** + our own ~30-line Vue glue — (+) full ICU (plural, select, nested), framework-free, same strings in core and UI. (−) less Vue tooling; bundle a bit bigger.
- C) Keep Spike B's own mini formatter — (+) zero deps. (−) re-implementing ICU badly; translators expect ICU.
Lean: **B**. Confidence: medium (verify maintenance and bundle size at setup; also check whether the built-in `Intl` APIs cover enough by then).

## ADR-035 — `.prumo` zip container library
Status: **ACCEPTED (2026-11-16, owner: "lean"): A — fflate.**
Need: read/write the zip container (`project.json`, snapshots, later thumbnails) **in `core`**, so it's testable in Node and a web build stays possible (no Tauri in core, rule 16). Deterministic output (fixed entry order + timestamps) so saves are byte-stable (rule 10).
Options:
- A) **fflate** (pure JS, small, no dependencies) — (+) runs anywhere, fast. (−) another JS dep.
- B) **JSZip** — (+) very well known. (−) larger, slower, promise-heavy API.
- C) Rust `zip` crate behind the platform adapter — (+) native. (−) core can't open files in tests/web without Tauri; two code paths.
Lean: **A**. Confidence: medium (verify maintenance; check deterministic timestamps).

## ADR-036 — Save/open dialogs and file access (desktop)
Status: **ACCEPTED (2026-11-16, owner: "let's go with Option A")**: official Tauri plugins `tauri-plugin-dialog` + `tauri-plugin-fs`, 2.x.
Context: `core` already writes/reads `.prumo` bytes (ADR-008/035). The desktop app needs native "Save as…" / "Open…" dialogs and to read/write the chosen file. Today Tauri has no permission to touch files (capability `core:default` only).
Options:
- **A) Official Tauri plugins `tauri-plugin-dialog` + `tauri-plugin-fs`** (JS `@tauri-apps/plugin-dialog` 2.8 / `plugin-fs` 2.7, Rust crates 2.x; maintained by the Tauri team, updated Oct 2026). Permissions scoped in the capability file (only the files the user picked). (+) standard, small, both OSes, least own code. (−) two new deps (JS + Rust each).
- **B) Own Rust commands** (`save_file`, `open_file`) using the `rfd` crate for native dialogs + `std::fs`. (+) one Rust dep, no JS dep, full control. (−) more own code to maintain and secure.
- **C) Browser-style** (download link + `<input type="file">`): no new deps. (−) no "save in place" (always a new file in Downloads), poor UX for a desktop app.
Lean: **A**. Confidence: high (Tauri's documented way; plugin 2.x matches Tauri 2.12; v3 is alpha — stay on 2.x). Imports stay in `apps/desktop/src/platform/` (rule 16). Autosave/recovery (Q-111) later reuses the same fs plugin with the app-data directory.

## ADR-037 — App data folder: preferences, autosave and recovery copies (desktop)
Status: **ACCEPTED (2026-11-17, owner: A — "most apps do exactly that")**. Settings part implemented (`apps/desktop/src/prefs.ts`; capability `fs:allow-appdata-read-recursive` + `fs:allow-appdata-write-recursive`). Recovery copies implemented (`apps/desktop/src/recovery.ts`): `recovery/<key>.prumo` + `recovery/<key>.json` (`{ v: 1, name, path, savedAt }`), key = project id with anything outside `[A-Za-z0-9-]` escaped; written to `*.tmp` then renamed.
Context: settings (angle step, language, later the user's default grid) are forgotten when Prumo restarts. Autosave + crash recovery (Q-111/126/129) need a place outside the user's project file. Both are new persisted data and widen the app's file access (today: only files the user picks, ADR-036).
Options:
- **A) One Prumo folder in the OS app-data directory** (`%APPDATA%\org.prumo.desktop\` / `~/Library/Application Support/org.prumo.desktop/`), reached with the **fs plugin we already have** (ADR-036), capability scope limited to `$APPDATA/**`. Inside: `settings.json` (`{ "v": 1, "locale", "angleStepDeg", "gridSize" }`) and `recovery/<project-id>.prumo` (autosave copies, removed only when resolved, Q-129). Browser dev build: `localStorage` for settings, no recovery. (+) no new dependency; one rule for "where Prumo keeps its own things"; easy to show the user ("open the folder"). (−) we write the small read/merge/versioning code ourselves.
- **B) WebView `localStorage` for settings, app-data folder only for recovery.** (+) settings need no file code. (−) two storage places; WebView storage is per-OS-engine (WebView2 / WKWebView) and can be wiped by updates or "clear browsing data"-like actions we don't control.
- **C) `tauri-plugin-store`** (official key-value plugin) for settings + fs for recovery. (+) ready-made. (−) one more dependency (JS + Rust) for ~40 lines of code.
Lean: **A**. Confidence: medium-high (same plugin, smallest new surface; the scope widening is to Prumo's own folder only). What would change my mind: if you want settings to sync between machines later (then neither A nor B is enough anyway).

## ADR-038 — Outside walls drawn by their outside face (project setting)
Status: **ACCEPTED (2026-11-17, owner: "Yes. In any case we can tweak those items in the future")** — resolves Q-134 for outside junctions.
Context: walls are drawn by their centre line, so two walls of different thickness meeting on the outside leave a step or a cut wedge (Q-134). Owner: inside junctions may stay mismatched; outside faces should line up; "outside" = the outside of each block (connected group of walls closing loops), even a block inside another; it should be a setting.
Decision:
- Project setting `settings.outsideFaces: boolean` (saved in the file; missing = off, so older files and the examples don't change). New blank projects: on. Settings → Drawing → "Line up outside walls by their outer face"; changing it is an undoable command.
- When on, a wall that **first becomes part of a closed block** and lies on that block's outside switches from `center` to `left`/`right` alignment, so the drawn line is its outside face and the body goes inward (core `anchorOutsideWalls`, run by `History` on every change and preview through the `normalize` option; same undo step as the edit that closed the block).
- Never touched: walls already in a loop before the change (deleting a neighbour moves nothing), walls whose alignment isn't `center` (the user's choice wins), copies (paste/duplicate/mirror copy: `Command.exact`), and every wall when the setting is turned on later.
- Consequence (told to the owner): a free-drawn shape gets ~half a wall thickness smaller inside when it closes; the outside size stays what was drawn. The room tool closes in one step, so its walls never appear centred.
Inside junctions with mixed thickness keep today's mitre (small wedge, Q-134 option C for those); a general polygon fix stays possible later (Q-134 B).
