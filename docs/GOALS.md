# GOALS

Status: **DRAFT.** Every goal here is a proposal until the owner confirms it. Mark confirmed ones with ✅.

## Primary goals

| ID | Goal | Measurable success criterion | Confirmed? |
|---|---|---|---|
| G-1 | Edit a building layout easily | A new user can draw a 4-room single-storey plan with 3 doors and 4 windows in **< 10 min** without docs. | ☐ |
| G-2 | Full editing set: create, select, move, copy, duplicate, mirror, delete, undo/redo | Every operation in `EDITING_OPERATIONS.md` works and has tests, including the listed edge cases. | ☐ |
| G-3 | Openings are first-class and belong to walls | Moving a wall moves its openings. Deleting a wall asks what to do with its openings. An opening can never float outside a wall. | ☐ |
| G-4 | Materials are assignable and swappable | Swapping a wall's material re-runs checks and the findings change in a way that's explained. | ☐ |
| G-5 | Live structural feedback | After any edit, findings update in **< 300 ms** for a model of ≤ 200 elements (target; revisit). | ☐ |
| G-6 | Every finding is explained | 100% of findings show: rule ID, plain-language reason, elements involved, severity, confidence level, source. | ☐ |
| G-7 | Change impact | After an edit the user can see "new / resolved / unchanged" findings compared with before the edit. | ☐ |
| G-8 | Honest about limits | No UI text claims safety (enforced by a test that greps the UI strings for banned words). | ☐ |
| G-9 | Persist work | Save/load a project file; files from older versions still open (schema versioning + migrations). | ☐ |
| G-10 | AI sessions stay aligned | Every session ends with docs updated (see CLAUDE.md DoD). | ☐ |

### Added 2026-11-15 (session #1, from the owner's answers)

| ID | Goal | Measurable success criterion | Confirmed? |
|---|---|---|---|
| G-15 | Modular Visions | Architect and Structural are separate packages; Structural can be disabled, and the app still works with its data preserved. | ✅ (in principle) |
| G-16 | Easy cross-platform install | A non-technical person installs and launches it on **Windows and macOS** (Linux later, ADR-027) using only the README, in < 5 min, including the unsigned-app bypass steps. | ✅ (scope) |
| G-21 | Never nag while creating | No finding appears during an active gesture; criticals from other Visions show only as quiet markers (ADR-025). | ☐ |
| G-23 | Sims-like ease, no cage | A no-CAD user builds a 3-room house with the room tool, at non-90° angles too, without reading docs (UX_PRINCIPLES). | ✅ (direction) |
| G-24 | Handoff | An architect hands a file to an engineer, who adds notes + protections; the architect sees them on reopening (ADR-029). | ✅ (direction) |
| G-25 | Packs by anyone | A city-level data pack can be imported from a file and overrides country values, showing its source (ADR-030). | ☐ |
| G-22 | Rules never block | No rule can prevent an edit (ADR-026); a test asserts every rule is side-effect free. | ✅ |
| G-17 | Open source | Public repo, license file, CONTRIBUTING with the rules-review gate (Q-066). | ✅ (open source) / ☐ (license) |
| G-18 | Code profiles | **Brazil (NBR) only in v1**; the interface is ready for other countries as plugins. Every rule says which profile (and version) its thresholds come from. | ✅ (BR; EU deferred) |
| G-19 | Beginner-first | A first-time user completes G-1 without knowing any CAD or engineering terms (tooltips/primer links). | ☐ |
| G-20 | Bilingual | All UI in pt-BR and en. | ☐ (ADR-021 proposed) |

## Secondary goals (later)

- G-11 3D view of the model (read-only first, maybe editable later).
- G-12 Multiple storeys and vertical load paths.
- G-13 Import/export (DXF for 2D CAD, IFC for BIM, PNG/PDF for printing).
- G-14 A "learn" mode: each rule links to a short explanation in `DOMAIN_PRIMER.md`.

## Non-goals (things we're deliberately NOT doing — protect these)

- ❌ Certifying, approving, or "passing" a design against a building code.
- ❌ Detailed reinforced-concrete design (rebar sizing, detailing).
- ❌ Full 3D finite-element analysis (plates/shells/solids) — at least until Phase 6+, possibly never.
- ❌ Dynamic analysis (earthquake time-history, vibration).
- ❌ Foundations / soil mechanics (we'll assume "supported" at ground level). ⚠️ This is a big simplification; see RISKS R-05.
- ❌ MEP (plumbing, electrical, HVAC).
- ❌ Cost estimation.
- ❌ Real-time multi-user collaboration.
- ❌ Photorealistic rendering.
- ❌ (for now) Electrical or any other Vision beyond Architect + Structural. Planned, not built.
- ❌ (for now) Plugin marketplace, runtime installation of third-party modules, public stable plugin API (ADR-020).
- ❌ (for now) Mobile apps.
- ❌ (for now) Furniture/objects catalogue ("Buy mode"), pitched roofs, terrain, curved walls (Q-096/098/100).
- ❌ Real-time collaboration and automatic merging of diverged files (handoff is sequential, ADR-029).
- ❌ Usage analytics (crash reports only, opt-in — ADR-028).

> ❓ **Doubt:** Excluding foundations means a user could "move" a load-bearing wall to a place with no foundation and get no warning. Should we have at least a rule like "a load-bearing wall at ground level not aligned with the original footprint → warning: foundation may not exist here"? (Q-020)

## Anti-goals (things that would mean we failed even if features work)

- The user trusts a green panel and acts on it in the real world.
- The codebase grows a structural solver that nobody, including the AI, can verify.
- Every AI session reinvents conventions because the docs weren't kept up to date.
