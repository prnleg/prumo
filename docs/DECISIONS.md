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
Status: **ACCEPTED (2026-11-17, owner, on the engineer contact's answer E-04 — review level VERIFIED-UNSIGNED, ADR-041): D as the default + A as an explicit, recorded exception; B only to explain, never to decide; C not used for masonry.**
- **Structural masonry:** every wall (full, half) counts as load-bearing / bracing by default. Reason (engineer): walls carry slabs AND brace the building; a wall parallel to the slab span still braces and takes load from bonded neighbours, so slab-based inference (B) under-counts.
- **Exception (A):** the user may mark a wall `non-bearing` ("vedação") and the app stores **where that came from** (e.g. "my structural drawing says so", "I assume"). A `non-bearing` mark in a masonry project gets its own warning: partitions are the exception in structural masonry; confirm with the structural drawing before removing or opening it.
- **B (slab/span):** may be shown to explain the load path; it never downgrades a wall to non-bearing.
- **Reinforced-concrete frame (later pack):** the default flips toward partitions, but "partition" is NOT a safe default for self-built houses (slab sitting on the masonry, missing columns) → decide with that pack.
- Spike B's model stays: per-wall mark `bearing` / `non-bearing` / `unmarked` + profile setting for unmarked (`assume-bearing`), plus the mark's **origin** (new).
Previous status: OPEN · Blocks Phase 2

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
Status: **ACCEPTED (2026-11-16, owner: "lean")**: replaces the opening-only `hostWallId` (ADR-007) with a generic `host: {elementId, offset, ...}` so future electrical outlets, switches, or wall-mounted fixtures use the same mechanism. ADR-007's intent stays. **2026-11-17:** optional `host.length` (extent along the host) added for module items (first user: chases, ADR-042 addition); move / stretch / mirror / copy / delete now carry any hosted item, not just openings.

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
- **v1 ACCEPTED (2026-11-17, owner: "Yes, I like this. Easy and direct.")** and implemented: `crash-log.jsonl` in the app-data folder (newest 50), scrubbed (paths, `.prumo` names, e-mails), quiet banner with "Report on GitHub" (pre-filled issue the user reviews before sending). Nothing is sent automatically, so no opt-in question is needed yet; a hosted provider later would bring the opt-in back. Desktop opens the browser via ADR-039 (accepted).

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

## ADR-039 — Open web links from the desktop app (`tauri-plugin-opener`)
Status: **ACCEPTED (2026-11-17, owner: A — "I lean to your decision too")**. Implemented: `@tauri-apps/plugin-opener` 2.7.2 (exact) + `tauri-plugin-opener` 2.7.2 (locked; 2.7.3 was a week old), capability `opener:allow-open-url` scoped to `https://github.com/prnleg/prumo/*`. If opening fails, the link is still copied.
Context: Tauri's WebView doesn't open external links in the system browser by itself; there's no core API for it.
Options:
- **A) `tauri-plugin-opener`** (official Tauri plugin, JS + Rust, 2.x line like our other plugins), permission limited to `https://github.com/prnleg/prumo/*` URLs. (+) one click; scope can be narrowed to our repo. (−) one more dependency.
- **B) Keep copying the link.** (+) no dependency. (−) clumsy: paste a very long URL by hand.
- **C) `tauri-plugin-shell` `open`.** (−) bigger surface (shell), Tauri itself now points to the opener plugin for this.
Lean: **A**. Confidence: high (official, narrow scope; we'll need it again for "Help" links and module pages). What would change my mind: wanting zero network-facing features in v1.

## ADR-040 — Room divider = wall kind "separator"
Status: **ACCEPTED (2026-11-17, owner picked A + toolbar button)**. Replaces the PROPOSED `RoomSeparator` element in DATA_MODEL.
Context: an invisible line that splits one open space into two rooms (living | kitchen). Options: A) a wall kind `"separator"` (reuses move/rotate/mirror/copy/delete/snap/select/overlap rules), B) its own element type (cleaner, but every operation needs new code).
Decision: **A.** `Wall.kind = "separator"`: closes rooms; the floor is measured to its LINE (no body); not in joins/outline (drawn as a dashed line, picked as a 1 mm strip); no doors/windows (`host-not-wall`), no paint (panel hides it), ignored by the outside-faces rule (ADR-038). `thickness/height/alignment` stay stored (the model requires them) but mean nothing. Future structural checks must skip it (`isDivider`). UI: "Divider" toolbar button (L) = the wall tool drawing dividers; any wall can be switched in the panel's Type list.
Compatibility: an older Prumo build has no "separator" kind; it'd treat a divider like an unknown wall kind (no crash; validation doesn't check kinds). Acceptable before v1.

## ADR-041 — Review levels: UNVERIFIED → VERIFIED-UNSIGNED → VERIFIED
Status: **ACCEPTED (2026-11-17, owner)**. Amends CLAUDE.md rule 17 and SAFETY_AND_LIABILITY.
Context: the owner's engineer contact answered batch 1 informally and doesn't want to be named (signing would make Prumo an engineering product, which isn't the plan, GOALS). Rule 17 required a named reviewer.
Decision — three levels per rule / value / validation case:
- `UNVERIFIED` — no source, or the engineer marked it "check" ([CONFERIR]), or a value given from memory. Shown as UNVERIFIED (unchanged).
- `VERIFIED-UNSIGNED` — an engineer reviewed the statement informally and agreed, **anonymously, without technical responsibility** (no ART/RRT). Recorded as `reviewer: owner's engineer contact (anonymous, unsigned)` + date + question id. Applies only to what they stated without a "check" mark. **No numeric threshold reaches this level from a value recalled from memory.**
- `VERIFIED` — reviewed by a named professional who signs it. Not used now; would need its own ADR (liability).
UI wording (pt-BR / en): *"Regra revisada informalmente por um engenheiro, sem assinatura técnica (sem ART)."* / *"Rule informally reviewed by an engineer; not a signed technical review."* It describes **the rule**, never the user's design; it never appears as a badge of approval, and the banned-words test keeps covering it.

## ADR-042 — Structural data names: construction system, wall role, lintel
Status: **ACCEPTED (2026-11-17, owner: "use defaults")**.
- **Construction system** = the system part of `project.profileId` (ADR-004/009 "country/system"): `br-nbr/structural-masonry` | `br-nbr/rc-frame` | `br-nbr/unknown`. Anything unrecognised reads as `unknown`. `unknown` runs the structural-masonry rules (conservative, E-01) and every finding says so (assumption A-SYS-1). `rc-frame` runs no rules until its pack exists. Asked on the start screen when starting blank (owner); examples are masonry; changeable later.
- **Module** `org.prumo.structural` (optional, depends on Architect), component v1 (ADR-022 namespacing):
  - wall → `{ role?: "bearing" | "non-bearing", origin?: "drawing" | "professional" | "own-judgement" }` — absent = not specified → the system's default (ADR-017: masonry = load-bearing).
  - opening → `{ lintel?: true }` — absent = not specified → R-OPEN-001 applies.
  - Unknown fields are kept; an empty component is removed (no clutter). Mirroring changes nothing.
- **Additions (2026-11-17, owner: "yes, they make a lot of sense"):** opening `contraverga?: true` (windows); wall `tieBeam?: true`, `bonded?: { start?: true, end?: true }` (a junction counts as bonded when any wall END there is marked; a T's through-wall has no end there, so the stem decides). Chases (R-WALL-004) → a new element, later.
- **Addition (2026-11-17, owner: "let's start it and go with the Horizontal"):** chase = module element `org.prumo.structural:chase`, hosted on a wall (ADR-024), component `{ dir: "horizontal" | "vertical" }`. A horizontal chase's run along the wall is a new generic **`host.length`** (mm; missing = a point item — vertical chases, future outlets). Core treats every hosted module item like a door/window when walls move, stretch, mirror, copy or get deleted; new invariant `item-outside-wall` (may not run past the wall's ends; overlaps allowed). Height and depth not stored (no rule uses them yet; R-WALL-004 has no threshold until E-33).
- Findings: Spike B's shape + `review` (ADR-041 level, reviewer, date, question id). Rule strings live in the desktop catalogue for now (same as Architect's; module-owned catalogues later, ADR-021).

## ADR-043 — "The existing building" (baseline) for renovation checks
Status: **ACCEPTED (2026-11-17, owner: "Yes")**.
Context: the engineer's top two rules (E-02: R-WALL-002 load-bearing wall removed/moved, R-OPEN-NEW opening added/enlarged) compare the plan with the building as it was.
Decision:
- "Mark the current plan as the existing building" (checks panel) saves a **named snapshot** in the file (`snapshots[]`, same format as ADR-032's) and an undoable pointer **`project.settings.baseline = <snapshot id>`** (marking makes the document unsaved; undo removes the pointer; the snapshot stays in the file's history — snapshots aren't part of undo). "Mark again" adds a new snapshot; "Stop comparing" clears the pointer.
- Rules with `needsBaseline` run only when one is marked; otherwise the panel lists them under "Not checked — needs the existing building" with the button.
- Comparison is by element id within a level: a wall that was load-bearing (by the baseline's own marks + the system default) and is now gone / moved or resized by > 1 mm / no longer full or half → R-WALL-002 (critical). An opening in a load-bearing wall that is new (id not in the baseline, or on another wall) → R-OPEN-NEW critical; wider, or reaching lower/higher → warning ("critical / warning", E-02); slid along the wall → nothing.
- Later: the compare view (Q-104) starts from the same snapshot.

## ADR-044 — Notes, protection markers and the handoff "baton" (ADR-029 mechanics)
Status: **ACCEPTED (2026-11-17, owner: "Yes, build it")**; protected wall moved by the holder → the critical warning stays until the protection is removed or renewed (owner: "Yes, stays").
Three slices, each its own branch, in this order:
1. **Who you are + notes.**
   - Identity (Q-092 default): a local display name in the app's prefs (`settings.json` → `name`). Asked the first time it's needed (first note / first hand-off), changeable in Settings. Not verified, no accounts.
   - Note = new **core element** `type: "note"`: `{ text, author, createdAt, at: Vec2, targets: Id[], resolved?: true }` (+ the usual `id`, `levelId`, `components`). Pinned to a point and, optionally, to elements (`targets`). Not hosted → **survives deleting its element** ("the wall this note was about was removed"). Undoable like any edit. Plan: a pin; side list "Notes" (open / resolved).
   - **Schema 1 → 2** (new core type): migration is a no-op; an older Prumo opens a v2 file read-only (existing policy).
2. **Protection markers** ("load-bearing, don't remove", Q-077 b).
   - Module element `org.prumo.structural:protection`, **not hosted** (deleting the wall leaves it behind), data `{ wallId, wall: {start, end, kind}, author, createdAt }`: a copy of the wall as it was when protected. No core change.
   - Rule **R-PROT-001** (critical): the protected wall is gone, moved, or no longer a wall/half wall → "A wall {author} marked 'load-bearing, don't remove' was removed". Never blocks (ADR-026). The marker stays until someone removes it ("I know — remove the protection") or re-protects the wall where it is now.
   - Panel: "Protect: load-bearing, don't remove" on a wall; a small lock on the plan.
3. **Hand-off (baton).**
   - `project.handoff?: { holder: string; log: { kind: "hand" | "take"; from: string; to: string; at: string; message?: string; snapshotId?: Id }[] }`. No `handoff` = solo use: nothing changes.
   - "Hand to…" (name + message) → named snapshot "Sent to {name} #{n}" + log entry + save.
   - Opening a project whose holder ≠ your name → banner "Ana is working on this. You can look and add notes." + **Take over** (logged, with a warning). Read-only except notes. Convention + visibility, not security (copies exist).
Not now: per-element `createdBy / modifiedBy` (noisy in diffs; later if the compare view needs it).
Confidence: medium. Biggest doubt: the schema bump (cheap now, before any public release).

## ADR-045 — What's above: slabs and roofs ("o que tem em cima")
Status: **ACCEPTED (2026-11-18): C** — owner: "A now, B later". A implemented on `phase2/what-above`: the room tag's structural data gets `above: "solid-slab" | "joist-slab" | "roof" | "open"` (missing = "don't know") and, for a joist slab, `joists: "long" | "short"` — **relative to the room's long side** (its longest edge), so rotate/mirror never need to touch the tag. Unknown values read as "don't know". No rules use it yet (R-WALL-005 / R-SLAB-001 wait on E-40; engineering deferred by the owner). Plan: a dashed double arrow in the room shows the joist direction (structure on).
(Drafted 2026-11-17 as PROPOSED.)
Why now: ROADMAP Phase 2 scope ("minimal what's above: slab/roof regions with span direction"); ADR-017 option B (explain the load path, never downgrade a wall); R-WALL-005 (no vertical continuity), R-SLAB-001; Phase 3 loads; Phase 5 floors (the ceiling of floor 1 is the floor of floor 2 — owner's Q-140).
Options:
- **A) Per room ("what's above this room?")** — each detected room gets a choice in the panel: *solid slab (laje maciça)* · *joist slab (laje de vigota/treliçada) + which way the joists run* · *roof on the walls (telhado)* · *nothing / open* · *don't know*. Stored as Structural data on the room's tag (`components["org.prumo.structural"].above`), like a floor finish. (+) No new drawing; beginner-friendly; one click per room; "don't know" is honest. (−) A slab that covers several rooms as one piece is several entries; balconies/eaves outside rooms can't be described.
- **B) Drawn slabs** — a new element with an outline polygon + span direction (DATA_MODEL `Slab`), drawn with a tool like the room tool. (+) Exact; handles slabs across rooms, overhangs, voids (stairs). (−) A new drawing skill for beginners; more UI; snapping/validation work (I-6).
- **C) A now, B later** — per-room answers in Phase 2 (enough to explain the load path and run presence rules); drawn slabs in Phase 3 when loads are computed and exact areas matter. Per-room answers become the default slabs then.
Lean: **C**. Confidence: medium — A's limit (one slab over several rooms) only matters once loads are computed, and by then the engineer's answers (E-40) tell us which slab types to support.
Not decided here: loads per slab type (Phase 3, sourced values only — ADR-018); roofs other than "on the walls" (pitched roofs are a non-goal for now).


## ADR-046 — Door, window and wall types (Q-139)
Status: **ACCEPTED (2026-11-18)** — owner: "all usual types"; the proposed list approved as is.
- **Doors** — `Opening.style` (core, optional string): `hinged` (default when missing) · `double` · `sliding` · `sliding-double` · `pocket` · `folding` · `garage`. "Opening only" stays `kind: "void"`.
- **Windows** — `Opening.style`: `sliding` · `casement` · `top-hung` (maxim-ar) · `tilting` (basculante) · `fixed`; missing = not specified (the plain window symbol, as before).
- **Walls** — what it's built with, in the **Structural** component (Q-090: structure owns the core material): `components["org.prumo.structural"].data.material` = `ceramic-block` · `concrete-block` · `solid-brick` · `drywall` · `concrete`; missing = don't know. Shown in the wall's Structure section. **Informs only**: no role default and no rule changes (drywall shows a plain note) until the engineer answers E-41 (owner deferred engineering, 2026-11-18). The wall *kinds* (full / half / fence / railing / divider) stay.
- **Why a string, not an enum check:** a newer version's types must survive in older versions (rule 13) — an unknown style draws the default symbol and is saved untouched. **No schema bump**: the field is optional and older Prumo keeps it (its validation ignores unknown fields).
- **Side:** `handing` = the side a sliding / pocket / folding leaf goes to (the hinge side for hinged); `swing` = which face. Sliding, casement and top-hung windows use `swing` too and flip it on mirror like doors (property test: every type's symbol mirrors exactly).
- **Symbols** (core `openingPlan`, hand-checked tests): CAD-style plan conventions — staggered panes for sliding, swing arcs for hinged/casement, dashed for hidden or "when open" parts (pocket inside the wall, garage / top-hung sweep), zig-zag for folding, tick marks for tilting panes, double glass line for fixed.
- **Placing a type** (`ui/opening-type`): the options bar of the Door / Window tools has a "Type" picker (this session only; defaults hinged door / plain window). Drawing-default widths for wide types: double 1.20 m, sliding 2 leaves 1.60 m, garage 2.50 m (UX values, editable; not structural).

## ADR-047 — In-app menu bar, tool strip, options bar; Lucide icons (Q-138)
Status: **ACCEPTED (2026-11-18)** — owner: native OS menus are "not OK" (Windows menus look dated); "a simple toolbar aligned with the market" (Premiere / Vegas) → chose **menu + side tools**; icons → **Lucide**.
- **Layout** (Premiere / Photoshop / Figma pattern, same on Windows and macOS): (1) a thin **menu bar drawn by us** — File · Edit · View · Tools · Help, shortcuts shown per OS (⌘ on macOS, Ctrl elsewhere), quick icons on the right (Save, Undo, Redo, Fit, Settings); (2) an **options bar** under it — the current tool's name + its options (room shape, chase direction), versions to compare and "Hand to…" on the right; (3) a **left tool strip** — icon + short label (labels stay: beginner-first, Q-050). Never wraps; the top row no longer grows with tool options.
- **No native menus.** Tauri doesn't get a custom native menu on Windows (none today). macOS keeps the system's default app menu (Quit, Hide, text copy/paste in fields) — that's the OS's, not ours, and removing it breaks platform conventions.
- **Dependency: `@lucide/vue` 1.67.0** (exact pin; ISC licence — permissive, compatible with Apache-2.0; ~1,500 line icons; tree-shaken, only the ~20 used are bundled; peer: Vue ≥ 3.0.1, no other dependencies). The older `lucide-vue-next` is deprecated in favour of it. Building-specific icons we need later (lintel, chase…) get drawn by us in the same 24 px / 2 px-stroke style. Alternatives rejected: own SVGs only (less consistent), icon fonts (accessibility, blurry), Material Symbols (heavier style, bigger set).
- **Menus are ours:** `MenuBar.vue` (click to open, hover switches, arrows / Enter / Esc, click outside closes). Every menu item is also reachable another way (shortcut, strip, panel) — the menu is for discoverability.

## ADR-048 — Floors: add, switch, rename, delete (Phase 5, step 1)
Status: **ACCEPTED (2026-11-18)** — owner: floors list in the layers panel (Q-141), then adding floors as its own step; "ask each time" what a new floor starts with; show the floor below faded (toggle in View).
- **Data:** nothing new — `project.levels[]` (ADR-015) with `elevation` and `defaultWallHeight`; every element already has `levelId`. Levels kept sorted by elevation. A level with `name: null` shows a generated name by its place from the bottom ("Ground floor" / "Térreo", "Floor 1" / "1º andar"…); typing a name stores it.
- **Add floor** (on top of the current one, core `addLevelCommand`, one undo step): name, **height from the floor below** (floor-to-floor, default **2.80 m** — a drawing default the user edits, not a structural value), and **start with**: empty · **the outside walls of the floor below** (default; walls facing the outside of the building, via ADR-038's `wallSides`; no doors/windows) · a full copy (walls + doors/windows/hosted items + room names; notes and protections are never copied — they're about the original). New level's wall height = the floor below's.
- **Switch:** click a floor in Layers; tools, checks, notes, compare all work on the current floor. Options bar shows "Floor: …" when there's more than one.
- **Floor below** drawn as dashed outlines above the room fill, under the walls; never pickable; View → "Show the floor below".
- **Delete floor** (asks; one undo step; the last floor can't be deleted) removes everything on it. **Rename** inline (pencil).
- **Structure:** each floor is checked on its own; "Floors on top of each other" added to *what wasn't checked* (STRUCTURAL_ANALYSIS §7). Vertical-continuity and load-accumulation rules (R-WALL-005, Phase 5) wait on the engineer (owner deferred engineering 2026-11-18).
- **Not yet:** floors below ground, stairs, voids in a slab, seeing the floor above, copying a selection to another floor.

## ADR-049 — Data pack file format (ADR-030)
Status: **ACCEPTED (2026-11-18)** — owner: "Yes, JSON like this".
- **One JSON file per pack** (no new dependency; YAML would need a parser): `format: "prumo-pack"`, `formatVersion: 1`, `id`, `parent`, `module`, `version`, `name` (per locale), `values`.
- **Ids nest by region:** `br` → `br/sp` → `br/sp/sao-paulo` (lower case, `/`-separated); `parent` = the id without its last part (null for a country). Lookups walk from the most local pack up; a child overrides its parent; missing levels are skipped.
- **Values** are keyed by dotted names inside the pack's module (`material.ceramic-block.unitWeight`) and each carries `value`, optional `unit`, **`source`** (clause reference or book + page — never the standard's text, ADR-014; or `UNSOURCED – placeholder`), **`confidence`** (low / medium / high), **`review`** (ADR-041: UNVERIFIED / VERIFIED-UNSIGNED / VERIFIED; an unsourced value can only be UNVERIFIED), optional `note`. Every value shown in the app says which pack it came from.
- **Code:** core `packs.ts` — `parsePack` (lists every problem, for pack authors), `PackSet` (`chain`, `get`, `all`, `name`); no data in core. The Structural module bundles `packs/br.json` (`BUNDLED_PACKS`, `structuralPacks()`); a broken bundled pack fails at start-up (a build error, not the user's). Project region = the country of its profile (`br-nbr/…` → `br`) until a project can say its state / city.
- **Not yet:** importing a pack from a file and a curated packs repo (Q-101), choosing a state/city per project, the Architect module's lists (room types, finishes) as packs.

## ADR-050 — Drawn slabs (ADR-045 B, Phase 3 step 3)
Status: **ACCEPTED (2026-11-18)** — owner chose "click rooms + draw".
- **Element:** core `Slab { type: "slab", levelId, outline: Vec2[], components }` — only the shape is core, so move / rotate / mirror / delete work like other elements without module hooks. **File schema 3** (migration 2 → 3 is a no-op; older Prumo opens new files read-only).
- **Level:** a slab belongs to the level whose **ceiling** it is (it rests on that level's walls).
- **Structural data** (`components["org.prumo.structural"]`): `slabKind: "solid" | "joist"`, `joists: "long" | "short"` (relative to the outline's longest edge, like rooms), `thickness` (mm, only what the user types — no default, ADR-018). Missing = don't know.
- **Tool** (strip "Slab", structure on): *Cover rooms* — click rooms (click again to drop), Enter / button → one slab per touching group; outline on the walls' centre lines, made by cancelling shared edges (no polygon-boolean library, ADR-012). *Draw outline* — click corners (snap to wall ends / slab corners, else grid; Alt free), click the first corner or Enter to close. New slabs get the type chosen in the options bar.
- **Rules:** outline must be simple with an area (`slab-invalid`, refused like other geometric impossibilities). A slab travels when selected, or when every corner sits on a moved wall (a slab over rooms moves with all their walls); mirrored outlines are made CCW again.
- **Plan:** dashed outline + light fill + a badge ("Joist slab"); the badge is what you click (the edges sit under the walls). Joist arrows like rooms. Room panel: a room covered by a drawn slab says so instead of asking "what's above".
- **Not yet:** copying slabs (duplicate/paste skip them), holes (an unselected room surrounded by picked ones is covered too), slabs in checks/loads (step 4), editing corners after drawing (redraw for now).

## ADR-051 — Load takedown per wall (Phase 3 step 4)
Status: **ACCEPTED (2026-11-18)** — owner: show numbers "rounded + range" (2 significant digits, a range from the uncertain inputs, kN + tonnes in plain words, the calculation behind a toggle, always UNVERIFIED).
- **What:** for the selected wall (structure on), kN per metre on its most loaded stretch = own weight + the slab(s) over this floor resting on it. **Information only**: no limit, no pass/fail, no finding (a capacity check needs strength values → engineer).
- **Own weight** = thickness × height × unit weight ("Built with"; not set → range over every material with a value, 13–25 kN/m³). Openings not subtracted (conservative).
- **Slab q (kN/m²)** = own weight + finishes + live load, from the Brazil pack: live 1.5 (NBR 6120:1980 T2, residential); finishes 0.5–1.5, joist-slab own weight 1.5–3.0 and solid-slab thickness 8–15 cm when unknown are **UNSOURCED placeholders** (ADR-018: allowed, shown UNVERIFIED; E-43). Solid: thickness × 25 kN/m³ (NBR 6118 8.2.2).
- **Distribution:** solid (two-way) = 45° split (NBR 6118:2014 14.7.6.1) computed as "each point goes to its nearest edge" on a fitted grid (exact for convex shapes, ~1 % on a rectangle; ties split evenly). Joist (one-way) = the area shared by the edges across the joists, in proportion to their length (exact for rectangles). Unknown type / joist direction → every possibility, range = min…max. "What's above: don't know" → low end 0.
- **Areas:** drawn slabs (ADR-050), else each room's "what's above" answer over its centre-line polygon. Load goes to the walls whose centre line the edge sits on (1 mm).
- **Not counted (listed under the numbers):** floors above (Phase 5), roofs, slab edges without a wall (balconies), concrete frames (beams/columns not drawn → slab loads skipped).
- **Code:** `module-structural/src/loads.ts` (`wallLoads`, `twoWayShares` (memoized), `oneWayShares`); UI formatting `sig2` / `wallLoadText`.

## ADR-052 — Lintel check (Phase 3 step 5)
Status: **ACCEPTED (2026-11-18)** — owner: "if the questions are not blocking (only verifying) continue; I'll confirm with the engineer later". Every value UNVERIFIED (E-44).
- **What:** select a door/window in a wall that carries (structure on) → "Lintel over this opening": kN per metre on the lintel + the span, the bending it has to take (γf·M), and — when the user enters the lintel's **height** and **bottom bars** — its bending strength and a plain-words comparison. **Information only:** no finding, no pass/fail mark (same as ADR-051); a finding can come once the engineer reviews the method.
- **Load (Q-033 default, conservative):** everything above the opening — masonry from the lintel to the wall top (unit weight of "Built with"; unknown → range up to concrete) + the lintel's own weight (25 kN/m³) + **all** the slab load on that wall (ADR-051). No arching. Listed as "can overstate".
- **Span** = opening width + bearing each side (pack `lintel.bearing` = 200 mm, UNSOURCED placeholder, E-34).
- **Mechanics:** simply supported beam, M = wL²/8, V = wL/2 (textbook). **Strength:** reinforced-concrete rectangle, NBR 6118:2014 17.2.2 stress block (αc 0.85, λ 0.8), x/d ≤ 0.45 (14.6.4.3), γc 1.4 / γs 1.15 (Tabela 12.1), γf 1.4 (Tabela 11.1), CA-50 fyk 500 (NBR 7480), cover 25 mm (Tabela 7.2, CAA I), b = wall thickness, d = h − cover − Ø/2. Concrete of an untested lintel: fck 15–25 MPa (UNSOURCED placeholder). All constants live in the Brazil pack, not in code (ADR-049).
- **Verdict words:** need ≤ strength everywhere → "strength is above the bending this weight causes" + what isn't checked; overlap → "may be more… depends on values not known yet"; need > strength everywhere → "more than this lintel can take… can overstate. Ask an engineer". Never "safe/OK" (rule 5).
- **Not checked (listed):** shear, sag (deflection), local crushing where the lintel rests (VC-004/005), arching, + what the wall load doesn't count.
- **Data (persisted names):** opening Structural data `lintelHeight` (mm) and `lintelBars: { count, diameter }` (mm). Bar list in the UI: 1–4 × Ø 5 / 6.3 / 8 / 10 / 12.5 mm (NBR 7480 sizes).
- **Code:** `module-structural/src/lintel.ts` (`lintelCheck`, `strength`, `lintelSize`, `setLintelSize`); UI `lintelText`.
