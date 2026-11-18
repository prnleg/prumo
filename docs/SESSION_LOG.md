# SESSION LOG (append-only — newest at the bottom)

Template:
```
## Session #N — YYYY-MM-DD — <who/what tool>
Goal:
Done:
Decisions made (ADR ids, status changes):
Decisions deliberately NOT made (and why):
Doubts / things I'm unsure about:
New questions (Q ids):
New risks (R ids):
Tests added / status:
Next step:
```

---

## Session #0 — 2026-11-15 — Planning (Claude, chat)

Goal: Create the planning doc set so future Claude Code sessions can build the project without making unwanted decisions.

Done:
- Created CLAUDE.md, README.md, and docs/: VISION, GOALS, CURRENT_STATE, ROADMAP, DECISIONS (ADR-001…018), OPEN_QUESTIONS (Q-001…042), RISKS (R-01…20), SAFETY_AND_LIABILITY, DOMAIN_PRIMER, STRUCTURAL_ANALYSIS, DATA_MODEL, EDITING_OPERATIONS, ARCHITECTURE, TESTING_STRATEGY, ALTERNATIVES, GLOSSARY.

Decisions made: **none accepted.** ADR-018 is PROPOSED (no invented thresholds).

Decisions deliberately NOT made: platform, stack, construction system, country/code. All depend on owner answers (Q-001/002/003/010/011).

Doubts:
- Whether the "live explained structural feedback for non-experts" niche is truly unserved (ALTERNATIVES not researched).
- ADR-004 (construction system) could change half the rules catalogue; I have low confidence in any default.
- Building codes, material values, and tool facts in these docs are from general knowledge and marked "verify".
- The doc set itself may be too heavy (R-16). If it slows the owner down, trim it.

Next step: owner answers the 🔴 questions; a Claude Code session converts them into ADRs and runs Spikes A and B.

---

## Session #1 — 2026-11-15 — Planning, round 2 (Claude, chat)

Goal: incorporate the owner's answers to round 1; keep asking questions (the owner explicitly wants that).

Owner answers (summary):
- For the owner, but **open source, modular, for everyone**: multiple Visions (Architect, Electrical, Civil…), add-ons later.
- Not a real-engineering product now; basics are enough.
- Senior SWE (.NET, Angular/Vue; knows Rust/C#/Python/WPF/Flutter/Tauri 2). Wants the easiest cross-platform install.
- Construction system: "I don't know / switchable"; engineering (materials, formulas, resistance) belongs in an installable module.
- Codes: Brazil + EU first.
- Knows an engineer.

Done:
- Rewrote VISION (platform of Visions), ARCHITECTURE (Tauri + Vue + TS monorepo, framework-free core, element+component model, generic hosting).
- New MODULES.md (extension points, manifest, hard rules, open problems).
- DECISIONS: ADR-001/002 → PROPOSED (Tauri 2 + Vue 3 + TS, with a comparison table); ADR-004/014 partially accepted; ADR-009 accepted; new ADR-019…024.
- OPEN_QUESTIONS: round-1 answers moved to Resolved; round 2 added (Q-050…070).
- RISKS: R-21…30 added; R-01 and R-10 rescored.
- GOALS: G-15…20 + new non-goals. ROADMAP: Spikes D (stack) and E (module boundary); Phases 1/2 reframed as modules; Phase 5b third Vision.
- CLAUDE.md: owner profile updated (senior SWE, don't over-explain code), rules 11–16 added.

Decisions deliberately NOT made: stack (proposed only; owner didn't explicitly pick), first construction system, license, EU annex.

Doubts:
- Tauri on Linux (WebKitGTK) for the future 3D Vision: plausible risk, unverified → Spike D.
- Whether "switchable construction systems" will feel like the owner imagines, given each system needs its own rule pack.
- The platform trap (R-21/22) is the thing most likely to derail a senior SWE on a hobby project.
- Tool, standard, and size facts are still from general knowledge, marked "verify".

Next step: owner answers Q-050, Q-055, Q-056 (🔴), then Spikes D + E.

---

## Session #2 — 2026-11-15 — Planning, round 3 (Claude, chat)

Owner answers (summary):
- Platform trap acknowledged; likes the bundled, internal-API approach (ADR-020 ACCEPTED).
- EU was a reflex → Brazil only for v1; countries become rule-pack plugins later. Rules must **never stop anyone creating**; they help people know whether they're following the rules (ADR-026).
- Visions are **role-based**: the architect doesn't want engineering; that's not their job.
- Linux deferred; Windows + macOS first (ADR-027). No signing for now.
- Primary persona: someone who has never used CAD or schematics software (Q-050).
- Q-054: criticals may surface as warnings in other Visions, but **not annoyingly while creating** (ADR-025 PROPOSED).
- Q-055: structural masonry first; other options too, "like grid" (interpreted as a column-grid frame system → Q-071 to confirm).
- Q-056: stack OK; Apache-2.0; public on day 1; the engineer can give as much time as needed.

Done:
- DECISIONS: 001/002/014/020/027 accepted; 004/009 updated; new 025 (feedback timing), 026 (never block), 027 (platforms).
- OPEN_QUESTIONS: round 2 resolved; round 3 added (Q-071…086), incl. rooms-vs-walls, role handoff, Architect-side rules.
- RISKS: R-25 reduced, R-26 accepted, R-31…35 added, R-01 rescored.
- CLAUDE.md rules 17–20. New CONTRIBUTING.md (rule review gate).
- VISION/MODULES/GOALS/ROADMAP/STRUCTURAL_ANALYSIS/SAFETY updated.

Interpretations made (need confirmation): "grid" = column-grid frame system (Q-071).

Doubts:
- "Settled" geometry (Q-073) is fuzzy; feedback timing will need tuning by feel.
- Beginner persona + imprecise drawing will produce messy geometry → bogus findings (R-34). The room tool + snapping is the main defence.
- Role-based Visions raise the handoff/locking question (Q-076/077), which could become big.

Next step: owner answers Q-076, Q-079, Q-083.

---

## Session #3 — 2026-11-15 — Planning, round 4 (Claude, chat)

Owner answers (summary):
- Everything engineering-related gets passed to their engineer → new ENGINEER_QUESTIONS.md.
- "Grid" meant the drawing grid (they'd read it as "scheme"). The column-grid interpretation is withdrawn.
- Inspiration: **The Sims build mode**: great for beginners, but too locked (45/90/180° walls, fixed sizes). Use it as a reference only.
- Q-079: both room and wall tools; rooms must be closed; half walls/fences are fine.
- Q-076: yes, different people hand the file back and forth.
- Q-083: no name; ideas Rustitect / Archirust.
- Q-078: yes, but as plugins (city/state/country) anyone can write; not in the core.
- Q-077: agrees with option (b).
- Q-085: no analytics now, but error/crash reporting is wanted.

Done:
- New UX_PRINCIPLES.md (borrow vs avoid from the Sims; wall kinds; rooms), ENGINEER_QUESTIONS.md (4 batches).
- DECISIONS: ADR-016 name candidates + critique; new ADR-028 (crash reports), 029 (handoff), 030 (data packs vs code modules), 031 (build mode); ADR-004 corrected.
- DATA_MODEL: wall kinds, room separator, room identity, core vs finishes, notes/protection/handoff metadata.
- OPEN_QUESTIONS round 4 (Q-087…101); RISKS R-36…43; GOALS G-23…25 + non-goals; ROADMAP Phases 1/2; MODULES §1b; CLAUDE.md rules 21–22.

Doubts:
- "Rooms must be closed" + beginner imprecision + room identity across edits: a cluster of hard geometry problems (R-34, R-39).
- ADR-030 is my attempt to reconcile "plugins for everyone" with "no premature plugin API". The owner should explicitly accept or reject it (Q-094).
- Handoff without merge relies on discipline (sequential turns). Real users will diverge anyway (R-37).

Next step: Q-090, Q-091, Q-094, codename; send engineer batch 1.

---

## Session #4 — 2026-11-15 — Planning, round 5 (Claude, chat)

Owner answers: likes **Prumo**; Q-090 accepted (finish vs structure); Q-091 → no parallel edits ("two devs on the same issue: a mess"); Q-094 yes; snapping defaults OK, but users must be told how to change them; half walls can close a room (kitchen divider); furniture to be discussed later.

Done: ADR-016 (Prumo codename + collision note), ADR-029 baton model, ADR-030 accepted, ADR-031 extended; OPEN_QUESTIONS round 5 (Q-102…109); UX_PRINCIPLES (half walls, settings discoverability); DATA_MODEL (handoff history, snapshots, Room); RISKS R-44…46; README title; CLAUDE.md status.

Finding: a quick web search (2026-11-15) found an existing commercial "Prumo" remodeling-estimating app (getprumo.com). Same broad industry → trademark check before any release.

Doubts: "keep working but not changing things done" hints at scoped holding, which brings the merge problem back. v1 says no (Q-102).

Next step: nothing 🔴 is pending from the owner. A Claude Code session can now create the public repo (codename Prumo) and run Spikes D and E; send engineer batch 1.

---

## Session #5 — 2026-11-15 — Repo created (Claude, chat)

- The owner created the public repo https://github.com/prnleg/prumo (with an Apache-2.0 LICENSE).
- The planning docs were added as the first content commit. Owner preference: **no `Co-Authored-By` trailers in commit messages** (recorded in CLAUDE.md).
- Next step: Spikes D + E; forward ENGINEER_QUESTIONS batch 1.

---

## Session #6 — 2026-11-15 — Round 5 answers (Claude, chat; edits made directly in the local clone)

Owner answers: Q-102 no (reconsidered); Q-103 the app doesn't move files; Q-104/105 `.prumo` zip with snapshots, OK (the name may change); Q-107 room types yes; Q-106 fences don't close rooms; Q-108 answer was cut off → re-asked.

Done: ADR-008 accepted in principle (zip container, format id inside); ADR-029 handoff details resolved; UX_PRINCIPLES/DATA_MODEL updated; OPEN_QUESTIONS round 6 (Q-110…120: extension vs name, autosave, snapshots, newer-version files, room-type list, number format `3,5` vs `3.5`, floor naming, image/PDF export, template, themes).

Doubts: Brazilian conventions (comma decimals, *térreo*, *área de serviço*) are easy to get wrong if defaults are US-centric. Treat pt-BR as a first-class locale, not a translation.

Next step: owner answers round 6; Spikes D + E can start in parallel (nothing 🔴 pending).

---

## Session #7 — 2026-11-15 — Round 6 answers (Claude, chat)

Owner answers: Q-108 both; Q-110 keep `.prumo`; Q-114/115 room-type list OK, grow gradually; Q-116/117 follow the UI language + customizable; Q-118 export only via a future rendering/export module. The owner didn't understand Q-111/112/113/119/120 → re-explained in plain terms in chat; still open.

Lesson for future sessions: **phrase questions in plain product terms, with a concrete example**, not internal jargon ("snapshot deltas", "newer-version files").

---

## Session #8 — 2026-11-15 — Round 6 follow-ups (Claude, chat)

Owner answers: autosave yes; snapshots = full copies (aware the file grows); a missing module stops the user (install / remove its items) and export lets you choose modules; **modules (big) vs plugins (small: languages, external compatibility)**; start blank + several example projects; themes yes.

Done: new ADR-032; MODULES §6–8 (terminology, missing-module dialog, export dialog); MODULES rule 3 + CLAUDE.md rule 13 reworded; ADR-008/019 notes; ROADMAP Phase 1 (autosave, start screen, themes); GLOSSARY (module, plugin, snapshot); RISKS R-47/48; OPEN_QUESTIONS round 7 (Q-121…126).

Doubts: "plugin" (owner) vs "data pack" (ADR-030) overlap → Q-121. "Remove items" during a handoff can destroy someone else's work → read-only option proposed (Q-122). "Install" in v1 really means "enable" because everything is bundled (Q-123).

---

## Session #9 — 2026-11-15 — Round 7 answers (Claude, chat)

Owner answers: modules = real opt-in installs (focus per role + a lighter app); snapshot growth mitigation OK; example projects incl. "perfect" ones; recovery copies not deleted after a crash by time.

Conflict found: ADR-020 said modules are bundled at build time. Proposed a staged revision (bundled-but-unloaded → real downloads after the 3rd module) that keeps the anti-platform-trap intent (Q-127). Also proposed a core "Building skeleton" vs Architect split so an Electrical-only install works (Q-128).

Wording guard: "perfect" examples → "no warnings from current checks" in the UI.

---

## Session #10 — 2026-11-15 — Planning closed (Claude, chat)

Owner answers: stages 1+2 OK; the core = the basic building (no colour/furniture); recovery reading confirmed; two words (Modules/Plugins) OK; no read-only option (install or remove).

**Owner feedback:** questions had started re-asking things that were inferable from context ("triple checks"). Action: a new questioning rule in CLAUDE.md §1 (infer → log; cheap to reverse → default; ask only new + consequential + ambiguous). Open questions converted to "defaults on record".

**Planning phase closed. Next: Spikes D and E in Claude Code.**

---

## Session #11 — 2026-11-15/16 — Spikes D and E (Claude Code, local)

**Done**
- **Spike D** (`spikes/stack`): Tauri 2.12 (wry 0.57) + Vue 3.5 + Vite 6.4 + Three.js 0.170. SVG plan with 500 walls (15×15 grid of 4 m rooms + 20 angled walls; pan, wheel zoom, drag a wall) + a Three.js scene extruding the same walls (one mesh per wall, OrbitControls). Built a release `.app` for macOS arm64. Built-in benchmark (`PRUMO_SPIKE_BENCH=<n>`): auto-pans/zooms, drags a wall, orbits 3D for 3 s each, prints frame stats and exits. Tauri imports live only in `src/platform.ts` (rule 16).
- **CI**: `.github/workflows/spike-stack.yml` builds Windows (NSIS + MSI) and macOS (universal app + DMG), writes installer sizes to the job summary, uploads artifacts. **Not run yet**: nothing committed/pushed this session.
- **Spike E** (`spikes/modules`): plain TS + Vitest, 28 tests, `tsc --strict` clean. Core = skeleton (levels, walls, openings, opaque module-owned elements); `ModuleHost` (registration, dependency + API-version checks, namespaced `ModuleContext`, rule engine with declared `reads`); persistence (canonical JSON, open → ok / missing-modules / read-only, per-module migrations, explicit removal with snapshot, export with module selection).

**Results (Spike D, macOS 27, Apple Silicon)**: `.app` 3.1 MiB, DMG 1.7 MiB; startup process→first frame cold 1.56 s, warm 0.52–0.61 s; 60 fps (vsync cap) with p95 ≤ 18 ms in all three scenarios at 500 walls, and still 60 fps at 4,920 walls. Naive Vue `v-for` re-render while dragging is fine at this scale. Details in CURRENT_STATE.

**Lessons (Spike E)**
1. MODULES rules 1–7 and ADR-032 are implementable as written. The skeleton/Architect split (Q-128) holds: an Electrical-only install builds walls and outlets, and removing Architect data leaves walls intact.
2. `save()` refuses data from an uninstalled module, so the ADR-032 dialog can't be bypassed by code paths, not only by UI.
3. "Installed but disabled" (rule 7: no dialog, data kept, no findings) and "not installed" (ADR-032 dialog) are two different states; the real app needs both.
4. **Snapshots** carry module data too: export must strip excluded modules from snapshots (done) or the copy leaks; the missing-module dialog only counts the live model; snapshot data isn't migrated on open → R-54, Q-131.
5. Module-owned hosted elements (outlet on a wall) push the generic `host` field into the core (supports ADR-024). Delete cascade not tested.
6. Write isolation between modules is convention-only in-process → R-53.
7. Dialog wording for "component-only" modules is misleading ("remove 1 item" when only finishes go) → Q-132.

**Decisions / inferences logged (no question needed)**
- Spike deps (Vue, Vite, Vitest, TypeScript, Tauri CLI/API, Three.js, @types/*) are covered by ADR-001/002 and the Spike D definition; spikes are throwaway, so no new ADR. Production deps still need ADRs.
- Vite 6 (not 7+) because local Node is 20.11 (R-55). pnpm 9.15.9 via corepack (the latest pnpm needs a newer Node).
- Placeholder app icon generated (solid colour); mobile icons deleted.
- `FAKE-STRUCT-001` is a topological fake for the module test, `severity: info`, `UNSOURCED – placeholder`, never to be promoted; not added to STRUCTURAL_ANALYSIS on purpose.
- ADR-022/024 stay PROPOSED; spike evidence noted under each.

**Not done / broken**
- Windows: no build, no measurements (Q-130, R-52).
- macOS DMG via `tauri build` failed locally (Finder AppleScript timeout, automation permission); measured with a plain `hdiutil` DMG instead. CI should build it normally.
- Measurements are rAF-based (main thread only) on a 60 Hz display: they show "no dropped frames", not headroom.
- Linux CI build (Q-075 default) not added; the user asked for Windows + macOS.

**Next step**: push → CI Windows build → measure on a real Windows PC; then Spikes A and B.

### Session #11, part 2 — Spike A (wall joins), 2026-11-16

Owner: "start spike A"; then "code through the night, stop at a milestone". Milestone chosen = Spike A done + docs + local commit.

**Done**: `spikes/joins` (Vue 3 + Vite viewer, Vitest). Own 2D math (`geom.ts`), computed joins (`joins.ts`), clean outline (`outline.ts`), 18 presets, browser viewer (drag wall ends, 10 cm snap + Alt = free, edit thickness/alignment/kind, tweak tolerances, issues list), opt-in PNG render for visual review.

**Algorithm**: endpoints within `joinTol` (5 mm) cluster into a node (gap healing). At a node, arms are sorted by angle; each arm's left face line meets the next arm's right face line → shared corner (miter). 3+ arms route caps through the node so they tile. A lone end on another wall's body = T, cut at the host's facing side. Miter limit (4 × thickness) trims only the outer spike, replacing it with a straight bevel through the midpoint of the two square ends. The clean outline splits each polygon edge where it crosses other walls and hides pieces whose outside lies inside another wall (seams, T, X), so **no polygon boolean library** is needed for drawing.

**Bugs found and fixed during the spike** (useful for Phase 1):
1. The reflex (outside) side of an L must still be mitered: an early "gap ≥ 180° → square" rule removed every outer corner.
2. Face lines must come from each wall's **own** drawn line, not from the healed node; otherwise healing a 3 mm gap shifts the faces 1.5 mm.
3. The miter limit must not trim the **inner** corner of a sharp angle (that's where the bodies really overlap); trimming it caused overlaps.

**Tests**: 56 passing. Hand-calculated: L, T, X, +, straight continuation, room, left-aligned room, 3×3 grid (area + outline length), thick/thin T and L corners, 30° miter length = 100 / sin 15°. Properties: 30 random equal-thickness junctions → no overlap and no gaps (sampling); rotation by 37° preserves area and outline length; shuffled input → byte-identical output.

**Findings / evidence**: ADR-012 → own math is enough for joins + drawing; boolean library only when areas, quantities, or opening cuts need it. DATA_MODEL doubt 2 → computed joins are fine. Known limits in CURRENT_STATE. Perf: 480 walls ≈ 52 ms per full recompute (O(n²) pairs, no spatial index) — OK for a house, would need incremental/indexed recompute for drag at 60 fps on large plans.

**Inferences/defaults logged**: `joinTol` 5 mm and `miterLimit` 4 are UNSOURCED spike values (geometry, not structural) → real values go with ADR-006/012. All wall kinds join the same way (Q-133). Viewer is browser-only (`pnpm dev`): joins are pure TS, Tauri adds nothing to this question.

**Next**: Spike B, then decide ADR-012/006.

### Session #11, part 3 — Spike B (one rule end to end), 2026-11-16

Owner: "push it and start spike B". Pushed Spike A (`48c2523`) to `spikes/d-e`. Milestone chosen = Spike B done + docs + local commit (not pushed).

**Done**: `spikes/rule` (plain TS + Vitest, Vue 3 + Vite viewer, same pinned versions as Spike A — no new kind of dependency). Model (2 walls, a window and a door) → `runChecks` (pure, sorted) → rule `R-OPEN-001` → `Finding` (i18n key + typed params, assumption ids, fingerprint) → `explain()` → card with the 8 SAFETY items → plain-text export form + browser panel. Diff new/resolved/unchanged by fingerprint. Viewer: wall elevations with badges, per-wall "load-bearing?" mark, lintel toggle, opening width slider, pt-BR/en switch, findings appear 1.2 s after a commit and never mid-drag (ADR-025, proposed).

**Rule honesty**: R-OPEN-001 has **no threshold** (presence of a lintel only), so nothing numeric was invented (ADR-018). Source `UNSOURCED – placeholder`; card shows NÃO VERIFICADA / UNVERIFIED. I did not cite an NBR clause from memory → E-06. "What this check does not consider" lists lintel size/bearing, bond beam, sill reinforcement, loads.

**Tests**: 21 passing; typecheck clean. Hand checks: the two sample findings and their assumptions; 1200/800/2550 mm → "1.20 m"/"0.80 m"/"2.55 m" and "1,20 m"/…; exact full card text (en) and message + assumption (pt-BR); plurals for 1 vs 2 checks and 1 vs 2 findings; determinism under shuffled input; resize/move keeps fingerprint, adding a lintel resolves exactly one finding. Guards: banned words (en + proposed pt-BR list) over every catalogue string and rendered card — mutation-checked (planting "safe" fails 3 tests); en/pt-BR key + slot parity.

**Lessons (explanation format)**:
1. Card content works, but **2 near-identical cards** already feel repetitive → Q-135 (group by rule), R-57.
2. The decisive fact for a beginner — *"treated as load-bearing only because nobody marked it"* — sits behind "details" → Q-136 (show default assumptions up front), E-07.
3. Putting `source`/`notConsidered` on the rule (not each finding) keeps findings small and lets a review update every card at once.
4. i18n needs nested plurals and gender select → ICU-style (ADR-021 note, R-56). pt-BR message only agrees because parede/janela/porta are feminine.
5. Three sentences is the most the message should carry; the third ("ask an engineer…") is the actionable part.

**Inferences/defaults logged**: ADR-017 kept open via a profile toggle (`assume-bearing` = option D, default in the spike; `skip`). pt-BR banned-word list added to SAFETY as *proposed* (translation of the existing rule, inferable from ADR-021 + SAFETY). Lintel drawn "200 mm each side" is a drawing default with a code comment saying it's not a recommendation. Settle delay 1.2 s inside ADR-025's 1–2 s. Bond beam [cinta] added to GLOSSARY. Viewer chrome English-only (developer UI); product text all i18n.

**Next**: owner decides ADR-012 + ADR-006; engineer batch 1 + E-06/E-07; validation cases (Phase 0 #8).

### Session #11, part 4 — push + validation cases, 2026-11-16

Owner (remote): "I can't run git push… if you can, push it; if not, continue". Pushed `8aefbb5`. Found that PR #1 (D + E + A) had already been merged to `main` and the branch deleted; the push re-created `spikes/d-e` with Spike B on top of the merged history (1 commit ahead of `main`). No PR opened (no `gh` here).

**Done**: ROADMAP Phase 0 #8 — VC-001a, VC-001b (lintel M/V/δ), VC-002 (one-way slab tributary), VC-003 (two-storey takedown + base stress), VC-004 (pier with half-each-side redistribution), VC-005 (wall self-weight minus opening; the "forgot to subtract" bug = +15.4 %). All inputs are **given test inputs** (no material values, loads, factors, or code clauses → ADR-018 untouched); arithmetic re-checked with a script. Status draft; engineer review = E-22 (now also asks about the two simplified methods).

Added a **Phase 0 exit checklist** to CURRENT_STATE: every ADR the ROADMAP needs, with spike evidence, lean, confidence, and default, so the owner can answer in one pass. No ADR status changed.

**Inferences/defaults logged**: kept the branch name `spikes/d-e` (cheap, reversible). No calculator code written: calculators are Phase 3 (golden rule 12); cases become tests when a calculator exists.

**Next**: owner answers the exit checklist → Phase 1 plan.

### Session #11, part 5 — Phase 0 exit decisions, Phase 1 plan, 2026-11-16

Owner: "Lean. Most of it is simple right now, like the ADR 005, and later on it will get better (v1.1 or v2, whatever). ADR 010 we might need to add them in the future because people will probably want to implement tools that are present in other projects. The defaults for Q-135/136 are fine."

**Decisions recorded (ACCEPTED 2026-11-16)**: ADR-003, 005, 006, 010, 012, 018, 021, 022 as leaned; owner notes added to 005 (improve in later versions) and 010 (interoperability / familiar tools from other software later, through the module API — not now). Q-135, Q-136 → Resolved with defaults. Phase 0 exit criteria met; engineer review + Windows run pending but not blocking Phase 1.

**Inference logged**: read the ADR-010 caveat as *interoperability later* (import/export, modules re-creating familiar tools), not as "extend an existing tool now".

**Phase 1 plan**: ROADMAP "Build order" (slices 0–9). New PROPOSED ADRs because they add dependencies (golden rule 4): ADR-033 (pnpm monorepo, TS strict, Vitest, ESLint boundary rules, Prettier, Node 22 pinned), ADR-034 (i18n: lean ICU `intl-messageformat` over vue-i18n, since findings are formatted outside Vue), ADR-035 (zip: lean fflate, pure JS in core). Phase 1 code waits on these + ADR-011/015/024/025.

**Next**: owner answers the Phase 1 batch → slice 1 (skeleton).

### Session #11, part 6 — Phase 1 batch accepted, slice 1 (skeleton), 2026-11-16

Owner: "Lean to them. ADR 025 I would extend it to 2s after stop. ADR 034 I agree, also it should be probably attached to the country … (but I don't know about excluding them from other countries). About ADR-033 needs Node 22, let's use then Node 22 or higher".

**Decisions recorded (ACCEPTED)**: ADR-011, 015, 024, 025 (settle **2 s**), 033 (Node ≥ 22), 034 (`intl-messageformat`), 035 (fflate). Owner's language/country idea → **Q-137** with a default (UI language = user's choice; profile suggests the default language for new projects; local terms shown in brackets; nothing excluded) — inferred, reversible, not asked again.

**Setup facts (checked on npm today)**: TypeScript **7.0** exists, but typescript-eslint 8.72 supports `<6.1` → pinned **TS 6.0.3** (R-58). Vitest 5 needs Node ^22.12 → `engines: >=22.12.0`. Node 22.23.5 downloaded from nodejs.org (SHA-256 verified) into `~/.local/node22` — user-local, no system change; owner's global Node is still 20.11. Kept pnpm 9.15.9 (pnpm 12 via corepack failed earlier this session).

**Done — slice 1**: branch `phase1/skeleton` (from `spikes/d-e`). Root workspace (`apps/*`, `packages/*`; spikes excluded), `tsconfig.base.json` (strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`), ESLint 10 flat config with **boundary rules** (core can't import Vue/Tauri/modules — proven by a planted bad file producing both errors), Prettier, `.nvmrc`, `engine-strict`. `packages/core`: model types, `emptyProject`, `modulesReferenced`, id sources (injected; random UUID in prod, counter in tests), `EPS = 0.01 mm`, canonical JSON (throws on undefined/NaN/class instances), `.prumo` save/open, file validation. CI `ci.yml`.

**Bug caught by the slice-1 exit test**: fflate stores DOS **local** time, so a fixed UTC date became 1979 in Brazil (error) and would have made bytes timezone-dependent. Fixed date now built from local components; a golden SHA-256 test, verified in UTC, Tokyo, São Paulo, and UTC+14, and CI runs tests on Linux/Windows/macOS (R-59).

**Inferences/defaults logged**: default wall height 2700 mm and grid 100 mm are drawing defaults (not structural). `@typescript-eslint/no-non-null-assertion` off in tests only. Printwidth 120. Core exports TS source (no build step) until an app needs otherwise. Thumbnails / `packs.lock.json` are carried as opaque "extra" entries for now.

**Next**: slice 2 — commands + undo (ADR-011), module host, save flow per ADR-032.

### Session #11, part 7 — Phase 1 slice 2 (commands, undo, modules, save rules), 2026-11-16

Owner: "No failure from CI, I believe we can continue". PR #3 (`phase1/skeleton`, opened by the owner) green on all jobs, no review comments. New branch `phase1/commands` on top of it.

**Done** (`packages/core`): `edit.ts` (immutable put/remove, hosted cascade, `changedIds` by reference, invariants I-1…I-5 + sizes + level), `commands.ts` (put/update/delete; delete label counts hosted items), `history.ts` (snapshot undo/redo, gestures, `change`/`commit` events, dirty tracking, optional deep-freeze), `modules.ts` (manifest, host checks, disable cascade, namespaced context, component migrations; newer component → reported), `module-data.ts` (footprint owned vs with-data for Q-132 wording, `stripModules`, undoable `removeModuleCommand`, `snapshotBefore`, `exportCopy` incl. snapshots, required modules refused), persistence: `saveProjectFile(f, host)` refuses uninstalled-module data and derives the usage record; `openWithModules` = open + migrate (newer module data → read-only).

**Tests**: 59 (19 → 59). Hand cases for each invariant (e.g. 3000 + 1200 = 4200 > 4000; 4000.005 within 0.01 mm), gesture semantics, event order, frozen-snapshot mutation throws, property test (60 random ops × 4 seeds, guarded against being vacuous), full ADR-032 end-to-end (engineer → architect without Electrical → stop → snapshot + remove → save → reopen; snapshot keeps the Electrical work per Q-131). Golden save hash unchanged.

**Bug caught**: `modulesReferenced` counted the usage record itself, so stale record entries never dropped and could trigger a "missing module, 0 items" stop. Now references come from data only; the record is derived from them.

**Inferences/defaults logged**: ADR-011 implemented as snapshot-restore undo (commands have only `apply`; EDITING_OPERATIONS' `{do, undo}` wording updated by a note). Q-072 default (block) applied in core; tools may clamp before submitting. Undo history is unlimited and not persisted (EDITING_OPERATIONS defaults). Rules/rule engine wait for Phase 2 (no rule exists to run). Missing-module files are migrated only after the user resolves the stop.

**Next**: slice 3 — desktop app + SVG renderer + wall tool + joins.

### Session #11, part 8 — Phase 1 slice 3 (first runnable app), 2026-11-16

Owner: "continue". Branch `phase1/walls` on top of `phase1/commands` (CI green on both).

**Done**:
- `core/geometry`: Spike A joins + clean outline ported (with the 3 fixes) + its 56 tests; `snap()` (Q-087: 10 cm grid, 15° steps, endpoint 12 px, Alt free; deterministic tie-break); `planGeometry(project, level)`.
- `module-architect`: manifest (required, component v1 reserved for finishes) + `WallTool` state machine (framework-free; each segment = one gesture = one undo step; `active` covers the whole chain for ADR-025).
- `renderer-2d`: `PlanView.vue` (SVG; the only Y-flip; grid; wall fill by kind; clean outline; snap cursor; labels; pan/zoom with trackpad-vs-wheel heuristic).
- `apps/desktop`: Vue shell, i18n glue over `intl-messageformat` (ICU plurals; tests for key parity, parsing, plurals, banned words), theme tokens light/dark, Tauri 2 shell (`org.prumo.desktop`, CSP set), `desktop.yml` installer workflow.
- ESLint now lints `.vue` (eslint-plugin-vue, in ADR-033's list); app may import Tauri only under `src/platform/`.

**Verified**: 132 tests; production web build 128 kB JS (46 kB gzip); `pnpm tauri build --bundles app` → `Prumo.app` 3.0 MiB in 76 s; headless screenshots in en and pt-BR of a dev-only `?demo=room` that draws an L-shaped room + T wall through the real tool (mitres, T, label "2,40 m" all correct).

**Bugs caught**: (1) snap produced `-0` and `3000.0000000000005` (cos/sin noise at 90°/180°) → results quantized to 1 nm, `-0` → 0; tests now exact. (2) Undo button disabled mid-chain (open gesture) → based on the undo stack; Undo ends the chain first. (3) Banned-word guard flagged pt "**segur**e Alt" (stem of "seguro") → reworded to "mantenha Alt apertado" rather than weakening the guard.

**Inferences/defaults logged**: wall default thickness 140 mm and height = level default (2700) are drawing defaults, editable later. Wall tool is the default tool until the room tool exists (ADR-031 says room tool default). Right-click also ends a chain. `no-non-null-assertion` off in `core/src/geometry` (ported index math) and tests. `no-undef` off for TS/Vue (TS checks it). Status bar shows snap settings (ADR-031 discoverability; click-to-change comes with Settings). No file dialogs yet: they need Tauri plugins (new deps → ADR).

**Next**: slice 4 (openings), slice 5 (selection + operations).

### Session #11, part 9 — Phase 1 slice 4 (doors and windows), 2026-11-16

Owner: "Merged" (PRs #2–#5 → `main`). Branch `phase1/openings` from `main`.

**Done**: `core/geometry/openings.ts` (`openingPlan`: cover, jambs, window glass lines, door leaf + swing arc; hand-checked points incl. a rotated left-aligned wall), `planGeometry` now returns opening symbols. `module-architect/OpeningTool` (hover → lazy gesture preview → click commits; magnets: wall middle, both ends, next to other openings on that wall, within 12 px; otherwise 10 cm steps; clamped to fit — Q-072 "clamp in the tool"; overlap still refused by core; `tooShort` when the wall is shorter than the opening; `pickWall` = inside the body ± 12 px, closest centre line, ties by id). Renderer draws symbols (cover = background fill + 3 px same-colour stroke hides the wall outline inside the opening). App: Door (D) / Window (J) tools, hints with ICU `select`, undo/redo/tool switch end any preview first.

**Verified**: 147 tests; screenshots (pt-BR + en) of the demo: windows and doors on horizontal, vertical, and T walls with correct swing sides.

**Bug caught**: initial "fit to screen" raced the first resize → the first resize now fits the drawing when there is one.

**Conventions logged (DATA_MODEL)**: handing "left" = hinge at the opening's start side; swing "in" = opens to the wall's left side (start → end). Defaults: door 800 × 2100, sill 0, handing left, swing in; window 1200 × 1200, sill 1000 — drawing defaults only, editable later. Window shortcut J (*janela*) because W is taken by walls.

**Not done**: moving/resizing/flipping openings (needs selection → slice 5); Q-134 unequal-thickness step.

**Next**: slice 5 — selection + operations.

### Session #11, part 10 — Phase 1 slice 5 (select, move, delete, duplicate, properties), 2026-11-16

Owner: "continue" (PR #6 already merged). Branch `phase1/edit` from `main`.

**Done**:
- `core/operations.ts`: `translate` (selected walls move with their openings; a lone opening slides along its host by the delta's projection, clamped; Q-022 stretch of joined ends within 5 mm; a T stem keeps its direction and re-meets the moved wall; openings on a stretched wall keep their distance from the end that didn't move; wall + its own opening never double-moved), `moveCommand`, `duplicateCommand` (walls + their openings, new ids drawn up front so redo is identical; a lone opening is skipped).
- `core/geometry/pick.ts`: `hitTest` on the drawn shapes (openings first), `boxSelect` (inside vs touching).
- `module-architect/SelectTool`: click / Shift-toggle / clear, drag threshold 4 px, drag = one gesture (10 cm steps, Alt free, Ctrl/⌘ = detach), box select, `prune`, `selectAll`.
- App: Select tool wired, Delete/Backspace, Ctrl/⌘+D, Ctrl/⌘+A, Esc clears; `PropertiesPanel.vue` (one command per committed field); refused edits show the reason (core invariants).
- i18n: `parseNumber` / `formatCm`.

**Tests**: 168 (137 core, 25 architect, 6 app). Hand cases: right wall +1 m → top/bottom walls stretch, room stays closed (4 nodes), door positions unchanged in world coordinates; lone door slides 700 (projection of (700, 300)) and clamps at 3200; T stem follows; a squeeze that would push a door off its wall is blocked; box select inside vs touching.

**Bugs caught**: (1) `parseNumber("14.5", "pt-BR")` returned **145** (dot = thousands separator in pt-BR) → group separators now only accepted in real groups of three; "14.5" in pt-BR is refused, not misread. (2) The properties panel rendered off-screen and "fit" was off-centre: the no-wrap status bar widened the grid column past the window (this, not a resize race, was the earlier "fit" glitch) → `grid-template-columns: minmax(0, 1fr)`. (3) A vacuous test assertion (compared an object with itself) replaced with a real one.

**Inferences/defaults logged**: box select direction = CAD convention (EDITING_OPERATIONS default). Duplicate offset 50 cm right/down (fixed, "last-used offset" not implemented). Detach modifier = Ctrl/⌘ (Alt is already "free"). Properties edit in cm (beginner-friendly for thickness/door sizes). Alignment wording "Wall sits: centred on / left of / right of the line". Wall kind labels pt: Parede inteira, Meia parede, Cerca, Guarda-corpo.

**Not done**: mirror, rotate (slice 5b), copy/paste with cursor, re-hosting an opening onto another wall, multi-select property edits.

**Next**: slice 5b — mirror + rotate.

### Session #11, part 11 — Phase 1 slice 5b (rotate, mirror), 2026-11-16

Owner: "continue" (PR #7 already merged). Branch `phase1/transform` from `main`.

**Done**: `operations.ts` refactor — `stretchNeighbours(…, f)` shared by move/rotate/mirror (joined ends land exactly on the transformed end; T stems re-meet). `rotator` (exact at multiples of 90°, otherwise 1 nm quantized), `reflector`, `selectionBounds`, `selectionCentre` (grid-rounded), `rotateCommand`, `mirrorCommand` (copy or in place; alignment left ↔ right; door `swing` flips; walls on the axis skipped in a copy). App: panel buttons ↺/↻ 90°, mirror ⇆/⇅, "Keep the original" (default on), R / Shift+R; notice when walls on the axis were shared.

**Tests**: 178. Hand: (0,0)→(4000,0) by 90° about (2000,0) → (2000,−2000)→(2000,2000); −30° about (4000,0): end (5500, 2598.076211); 4 × 90° = original exactly; left-aligned wall mirrored → right-aligned with faces (0, −140); door property test for all handing × swing combos, mutation-checked (flipping handing instead of swing fails 2 tests).

**Decision logged (inference, reversible)**: mirror *copy* uses the selection's right edge (⇆) / top edge (⇅) as the axis so the copy lands beside the original (edge walls shared — e.g. semi-detached twin); mirror *in place* uses the centre. A user-picked axis (2 clicks, EDITING_OPERATIONS) is a later gesture. The spec's "handing flips, swing stays" is real-world wording; in our encoding (handing relative to wall start) it is `swing` that flips — documented in EDITING_OPERATIONS.

**Bug caught**: ⟲/⟳ glyphs missing in the system font → ↺/↻.

**Next**: slice 6 — rooms.

### Session #11, part 12 — Phase 1 slice 6 (rooms), 2026-11-16

Owner: "continue". Branch `phase1/rooms` on top of `phase1/transform` (not merged yet; CI green).

**Done**: `core/geometry/rooms.ts` — `detectRooms` (centre-line planar graph: splits at T ends and X crossings, 5 mm node merging, dangling edges pruned, half-edge face tracing; floor polygon from the room-side wall faces, alignment-aware; label point = centroid or farthest-inside sample for L/U shapes; slivers < 0.01 m² dropped) and `uncoveredPieces` (collinear coverage subtraction). `module-architect/RoomTool` (2 clicks, grid/endpoint snap, Alt free, CCW walls, shared sides reused, ids stable while dragging, min side 50 cm against mis-clicks). Renderer draws room floors + labels under the walls. App: Room tool is the default (ADR-031), key Q, live "w × h" label, area labels "11,04 m²".

**Tests**: 192. Hand: 4 × 3 m, t 140 → 3860 × 2860 = 11.04 m²; clockwise drawing same; T split → 2 × 1860 × 2860; + → 4 × 1860²; L room 5860 × 2860 + 2860 × 2000; half wall closes, fence doesn't; open loop / stub; left-aligned (bodies inside) 3720 × 2720, right-aligned 4000 × 3000; order-independent; 4 mm gap closes. Room tool: 2 adjacent rooms = 7 walls (shared side not doubled). Screenshot areas re-checked by hand (11.04, 8.18, 13.90, preview 3.83).

**Inferences/defaults logged**: rooms stay derived (no stored entity) until something attaches user data (names/finishes, slice 7) — then `Room { id, seedPoint, … }` re-matched per DATA_MODEL's lean. Room tool key Q (R = rotate). Rectangle only; polygon rooms later. Room separators later. Island loops not subtracted (known limit).

**Next**: slice 7 (dimensions, finishes, room names + identity), slice 8 (save/open etc.).

### Session #11, part 13 — CI trimmed (owner request), 2026-11-16

Owner: "Is there a real necessity to run all those CIs every time I open a PR? It takes too long … might even overload my free tier."
Facts: public repo → GitHub-hosted Actions minutes are free and unlimited, so no quota risk; the cost was waiting time and duplicate runs (every branch push AND its PR ran `ci`, plus a ~10 min installer build).
**Changed** (reversible): `ci` runs on PRs (Linux only, ~1 min) and on pushes to `main` (Linux + Windows + macOS, keeps the cross-OS golden save hash); `concurrency` cancels superseded runs; docs/spikes/markdown-only changes skip CI. `desktop` installers: manual (Actions → Run workflow) or `v*` tags. `spike-stack`: manual only.

### Session #11, part 14 — Phase 1 slice 7 (room names, dimensions), 2026-11-16

Owner: "I merged, it will finish soon, so you can continue" (PRs #8, #9). Branch `phase1/details` from `main` (first commit = CI trim).

**Done**: core `RoomTag` element (`type: "room"`, seed + name; validated on open), `roomTags`, `matchRoomTags`, `nameRoomCommand` (create / rename / empty = remove; seed = room label point), seeds travel with move/rotate/mirror-in-place when all the room's walls are selected. SelectTool: clicking a room's floor selects `room:<key>`; `elementIds()` expands rooms to their walls (drag/rotate/mirror/duplicate), `realIds()` for delete (deleting a room's walls would also cut its neighbours). Panel: room name field + floor area. Plan: "Name · area" labels, selected room highlighted, length labels on selected walls and width labels on selected doors/windows.

**Tests**: 197. Name/rename/clear; merge by deleting the shared wall keeps both tags and shows the lower id, undo splits them again; move/rotate/mirror carry the name (mirror case first written so it was vacuous — symmetric room, seed unchanged — fixed with a non-symmetric axis and mutation-checked); save/open round trip; a broken room tag is refused on open.

**Inferences/defaults logged**: on a split, the part containing the seed keeps the name (DATA_MODEL leaned "larger part"; seed rule is simpler and predictable — reversible). Delete ignores selected rooms (only real elements). Copies (duplicate, mirror copy) don't copy names. Room types (Q-107/114) not yet.

**Next**: 7b finishes; 8 save/open (+ dependency ADR for Tauri plugins), start screen, settings.

### Session #11, part 15 — Phase 1 slice 7b (finishes), 2026-11-16

Owner: "I already merged. You can continue" (PR #10). No answer on ADR-036 yet → stays PROPOSED; did 7b (no new dependency). Branch `phase1/finishes` from `main`.

**Done**: core `editRoomCommand` (generic room-tag edit; tag removed only when it has no name and no module data; `nameRoomCommand` now uses it), `ComponentDecl.mirror` + `ModuleHost.mirrorComponent`, `mirrorCommand({ mirrorComponent })`. Architect: `finishes.ts` (12 built-in finishes with stable ids + plan colours; component v1 `{ sides: { left?, right? }, floor? }`; `setWallSide`, `setRoomFloor`, empty component removed; mirror rule swaps sides). App: panel pickers ("Side facing Sala" / "outside", computed by probing 20 cm off each face into the detected rooms), floor picker for rooms, faces drawn as 5 px strips clipped to each wall's joined polygon (clean corners), floor tints; room labels got a halo (were unreadable on light floors in the screenshot).

**Tests**: 202. Mirror hook runs only the owning module's rule and leaves other modules' data alone; a room tag with a floor finish survives clearing its name and disappears when emptied; painted sides swap on mirror (hand-reasoned geometry in the test); finish ids unique.

**Inferences/defaults logged**: finishes have no thickness in Phase 1 (paint ≈ 0; plaster/tile thickness changing wall geometry is later, DATA_MODEL "Total wall thickness = core + finishes"); built-in list until data packs (ADR-030); sides are named by the room they face, never "A/B" (beginner wording, CLAUDE.md rule 20); copies keep finishes (they're part of the wall), room names still aren't copied.

**Next**: ADR-036 answer → slice 8.

### Session #11, part 16 — ADR-036 accepted; Phase 1 slice 8a (New / Open / Save), 2026-11-16

Owner: "Then let's go with Option A. I already merged, you can continue" (PR #11). ADR-036 → ACCEPTED (A). Branch `phase1/files` from `main`.

**Done**: Rust `tauri-plugin-dialog` 2.8.4 + `tauri-plugin-fs` 2.7.1 (pinned, match the JS packages); capability = dialog open/save/ask/message + fs read/write **without any fs scope** — verified in the plugin source (commands.rs) that both the open and the save dialog add the picked path to the fs scope, so only user-picked files are reachable. `apps/desktop/src/platform/` (the only Tauri imports; `tauri.ts` + `web.ts` fallback for the browser dev build). `session.ts` (framework-free: New/Open/Save/Save as, unsaved-changes guard, title with •, invalid/newer-schema/newer-module/missing-module outcomes). Core `History.load()` (replace document, clear undo, not dirty). App: buttons + Ctrl/⌘+N/O/S (+Shift), close guard, read-only banner, level follows the opened project (tools re-pointed).

**Tests**: 209. Session with a scripted fake platform: first save asks, later saves don't; cancel = nothing changes; save → open round trip in a fresh session; unsaved-changes "no" keeps everything; broken file refused, current document kept; ADR-032 flow: "no" cancels, "remove" = snapshot in the saved file + ONE undoable, unsaved step. Native build OK (`Prumo.app` 3.5 MiB, +0.5 MiB for the plugins).

**Bug caught (own review)**: in the missing-module path I first migrated *after* the removal using `History.load`, which would have erased the undoable removal and marked the file saved → now migrate first, then remove as a normal edit.

**Inferences/defaults logged**: a file from a *newer app version* is refused with "update Prumo" instead of opening read-only (MODULES §7 default) — today's code can't safely display an unknown future schema; newer *module data* (valid schema) does open read-only. The browser dev build saves by download and has no close guard. Native dialogs not click-tested (no GUI access here) → owner check.

**Next**: 8b start screen + examples + settings; 8c autosave/recovery + crash log.

### Session #11, part 17 — Phase 1 slice 8b (start screen, examples, settings), 2026-11-16

Owner: "Merged" (PR #12), "continue". Branch `phase1/start` from `main`.

**Done**: `apps/desktop/src/examples.ts` (examples built in code from plain elements → always match the current model; names localized when opened; fresh ids each time): small house 10 × 7 m (living + kitchen, hall, bathroom, 2 bedrooms; 5 doors, 5 windows) and apartment 8 × 6 m (living, kitchen, bedroom, bathroom). `StartScreen.vue` (blank / examples with wall thumbnails / open a file; shown at launch and on New after the unsaved-changes question; Esc or × keeps the current document). `Session.begin(project?, name?)` (replace without asking again; never-saved, so the first Save asks where) and `open(confirmed)`. Core `setGridCommand` (project grid, Q-108 "Project → Drawing", undoable, saved). `SettingsPanel.vue` (grid 1/5/10/25/50 cm, angle steps 5–90°, language) opened from the toolbar ⚙ or by clicking the status-bar snap text (UX_PRINCIPLES 3b). Tools follow the grid/angle live. Language select moved from the toolbar into Settings. Dev paths `?demo=example-house|example-apartment|settings`.

**Tests**: 220. Per example: schema + invariants clean, every name translated, every detected room has exactly one name tag, no door/window cut into a joining wall (mutation-checked: moving a door onto a T and moving a name tag out of its room both fail), deterministic, save → open round trip. Session `begin` (no question, untitled, undo empty). Grid command undo + refusal of 0/negative/NaN/∞. Areas in the house screenshot re-checked by hand (bathroom 1.86 × 2.36 = 4.39 m², hall 4.86 × 1.06 = 5.15 m², bedroom 1 4.86 × 3.16 = 15.36 m²). First house draft had a 1.2 m bathroom whose label overflowed and a window crossing a wall (caught by the test) → redrawn with a horizontal hall.

**Inferences/defaults logged**: "house with problems" deferred to Phase 2 (no checks yet, nothing to show); the "reference example — no warnings from current checks" label is not shown yet (with 0 checks it would be empty words); the example note says "not designs for a real building, not checked by an engineer" (SAFETY). Duplicate offset stays a fixed 50 cm (EDITING_OPERATIONS), not tied to the grid. Angle step is an app preference only (the model has no project angle field; adding one = schema change, later if wanted). Settings aren't remembered across launches → **ADR-037 PROPOSED** (app-data folder for settings + autosave copies). Known cosmetic limit: labels in very narrow rooms overflow (renderer; later).

**Next**: ADR-037 answer → 8c autosave + recovery + remembered settings + crash log.

### Session #11, part 18 — room types + room labels that fit (owner away), 2026-11-16

Owner: "Go coding with default decision only if your confidence on them are high … if they're blocking each other you can stop them." Owner merging `phase1/start`; work stacked on it in `phase1/room-types`. ADR-037 (medium-high) → **not** implemented; 8c waits.

**Done**: Architect `room-types.ts` (the 14 types of Q-115, ids stable; `setRoomType`, `roomTypeKey`; unknown ids → no label, no crash). Architect component **v1 → v2** (identity migration): the bump makes an older build open files with room types read-only instead of dropping the type on save (rule 13). `withArchitectData` now keeps unknown Architect fields on edit (the old helper rebuilt the object from known fields: a latent data-drop). App: "Type" picker in the room panel; label = name, else the localized type; name placeholder shows the type; examples carry types. Renderer: `label-fit.ts` (`roomSpace` = free width/height around the label point; `fitLabel` = one line → two lines → 10 px → name only → nothing); `PlanView` rooms take label **parts**; renderer-2d got a test script.

**Tests**: 229. List = 14 unique, type + floor coexist and clear independently, unknown Architect fields survive an edit, v1 file migrates to v2 unchanged, a v1-only app opens a v2 file read-only. Label fit hand cases (18 chars × 12 px × 0.6 = 129.6 px; one px less → two lines; L-shape space). Screenshot at 640 × 480: labels stack/hide instead of overlapping walls.

**Inferences/defaults logged** (high confidence): types owned by Architect (Q-114 default, MODULES §Q-128); no type → no label text beyond area; character-count width estimate (0.6 em) instead of DOM measuring (deterministic, testable; may leave a little slack). Noticed, not fixed: toolbar overflows in narrow windows.

**Next**: copy/paste (`phase1/clipboard`).

### Session #11, part 19 — copy / cut / paste (owner away), 2026-11-16

Branch `phase1/clipboard`, stacked on `phase1/room-types`.

**Done**: core `clipboard.ts` (`copyToClipboard` → detached `{ walls, hosted, loose, anchor }`; `pasteCommand`; `pasteOpeningsCommand`; `offsetAlong`). `duplicateCommand` now = copy + paste (same ids order and label, its tests unchanged and green). App: Ctrl/⌘+C / X / V, notice "Copied N items…", paste selects the copies and switches to Select; dev `?demo=paste`.

**Tests**: 235. Copy takes hosted openings + bbox anchor; cut-then-paste restores everything moved (detached clipboard); two pastes = two independent copies; loose openings keep same-wall spacing + 200 mm group gap (hand values 1000 / 2500 / 3600); a loose paste that doesn't fit is refused and changes nothing; `offsetAlong` clamps. Screenshot: pasted house with doors/windows, no names.

**Inferences/defaults logged** (high confidence, EDITING_OPERATIONS spec): app-internal clipboard only (no other app understands walls); paste immediately at the pointer instead of a floating preview (move it after with drag; one undo step); cut = real elements only (consistent with Delete); room names not copied (consistent with duplicate). The 200 mm gap between groups of loose openings is a drawing default, not a rule.

**Next**: re-host a door/window by dragging it onto another wall (`phase1/rehost`).

### Session #11, part 20 — re-host a door/window by dragging (owner away), 2026-11-16

Branch `phase1/rehost`, stacked on `phase1/clipboard`.

**Done**: core `rehostCommand(p, openingId, wallId, offset)` (label `cmd.rehost` with the kind) and `Gesture.commit(label?)` (a drag can end as something other than what it started as). Architect `SelectTool`: one opening dragged over a wall that isn't its host → re-host preview via the opening tool's `pickWall`; commit uses the re-host label; back over its own wall → normal slide. i18n strings.

**Tests**: 239. Re-host centred on the pointer (hand: along 1500 − 400 = 1100), clamped (3000 − 800 = 2200), one undo restores the original host/offset, over-and-back = slide labelled "move"; `commit(label)` in core.

**Inferences/defaults logged** (high confidence, spec): no magnets for re-host (grid only; the opening tool's magnets could be shared later); label names no wall (ids aren't user-facing).

**Next**: Q-134 unequal-thickness step (`phase1/thickness-step`) if the geometry is clear enough; otherwise stop.

### Session #11, part 21 — Q-134 investigated (stopped), toolbar wrap, label word-wrap (owner away), 2026-11-16

Branch `phase1/toolbar`, stacked on `phase1/rehost`.

**Q-134 stopped** (owner rule: only high-confidence defaults): measured the 7/30 imperfect mixed-thickness junctions — 4 are 2-wall near-straight (5°–35° off), 3 are 3–4-wall. Square ends ("simple step") are exact only at 180°; elsewhere they overlap/notch, so the default needs an invented angle limit. Options A/B/C written in OPEN_QUESTIONS Q-134 for the owner.

**Also considered and skipped** (medium confidence, UX choices): "open end" marker for walls that almost close a room (needs an "almost" distance or marks every free wall), free-angle rotate gesture, user-picked mirror axis (2-click mode + preview), room separator (DATA_MODEL section still PROPOSED), polygon room tool.

**Done**: toolbar wraps onto a second row in narrow windows (was a horizontal scrollbar); room labels word-wrap long names (a 4.9 m living room at small zoom used to hide "Living room and kitchen" entirely). Screenshot at 640 × 480 OK.

**Tests**: 240 (+ word-wrap hand case: 146 px → floor(134 / 7.2) = 18 chars per line).

**Next (owner)**: merge the stack in order; ADR-037; Q-134. Then 8c.


### Session #11, part 22 — ADR-037 accepted, remembered settings, Q-134 owner input, 2026-11-17

Owner merged PRs #13–#17 (start → toolbar). **ADR-037 accepted (A)**. **Q-134**: owner input recorded (inside junctions may stay mismatched; outside faces should line up; maybe a setting) — follow-up asked, not implemented.

Branch `phase1/app-data`.

**Done**: `prefs.ts` (`settings.json`, `{ v: 1, locale, angleStepDeg, gridSize }`; never throws on read; invalid fields dropped one by one; unknown keys and a newer `v` kept on write). Platform `readAppText` / `writeAppText` (desktop: fs plugin + `BaseDirectory.AppData`, folder created on first write; browser: localStorage `prumo:<name>`). Capability widened to `$APPDATA/**` only. App loads prefs at launch (locale, angle step); the grid picked last becomes the default for **new blank** projects (each project still keeps its own grid). Settings note now says it's remembered.

**Tests**: 244 (+4 prefs). `cargo check` ok (capability ids valid). Native app not click-tested.

**Inferences/defaults logged**: write failures are silent (a lost preference isn't worth a popup); the grid preference applies to blank projects only, not examples (examples are fixed content); prefs are read once at launch.

**Next**: 8c autosave + recovery copies.

### Session #11, part 23 — Q-134 owner answers, menu bar idea, 2026-11-17

Owner: "outside" = the outside of each block (connected wall group), even inside another block; option A (move geometry, not only drawing); settings belong in a settings area; a menu bar (File, Toolbox, …, later Modules/Plugins) will be needed → **Q-138** (not now).

**Follow-up asked (not implemented):** today walls are drawn by their centre line, so "outer faces flush" can't be kept by alignment alone when thicknesses differ. Proposal: outside walls are anchored by their **outside face** (the line you draw = the outside face, thickness grows inward); room tool does it from the first click; free-drawn walls switch when their block closes (body shifts inward by half the thickness at that moment). Lean medium.

### Session #11, part 24 — outside walls by their outside face (ADR-038), 2026-11-17

Owner approved the proposal ("Yes. In any case we can tweak those items in the future"). Branch `phase1/outside-faces`, stacked on `phase1/app-data`.

**Done**: core `wallSides` (face tracing shared with `detectRooms`, refactored into `traceFaces`; outside = CW face loop of each block), `anchorOutsideWalls(before, after)`, `History` option `normalize` (runs on execute + previews before invariants; not on undo/redo/load), `Command.exact` (paste, duplicate, mirror copy skip it), `setOutsideFacesCommand`, `settings.outsideFaces` (validated as boolean). App: History uses it; Settings checkbox; examples set it off; strings pt-BR/en.

**Golden file hash changed on purpose**: new blank projects now carry `settings.outsideFaces: true` (persistence determinism snapshot updated).

**Tests**: 254 (+10): CCW/CW rectangles (floor (4000 − 280)·(3000 − 280) = 10.1184 m²), chain closes on the last wall (one undo reverts both), Q-134 straight 140/190 junction (both outside faces on r = 0), inside wall stays centred, deleting a neighbour moves nothing, setting turned on later moves nothing, block inside a room, fences don't close, preview = commit, paste keeps a centred block centred. Screenshot of the L-shaped demo: 21.00 m² = 24 − 22 × 0.14 + 4 × 0.14² (hand).

**Inferences/defaults logged**: a wall with outside on both sides (bridge) is left alone; a long wall partly outside is aligned as a whole; label of the setting command "change how outside walls line up".

**Next**: 8c autosave + recovery.

### Session #11, part 25 — autosave + crash recovery (8c), 2026-11-17

Branch `phase1/recovery`, stacked on `phase1/outside-faces`. Spec from ROADMAP (Q-111/126/129 resolved) + ADR-037.

**Done**: platform `readAppBytes` / `writeAppBytes` (temp file + rename) / `listAppFiles` / `removeAppFile` (desktop: fs plugin, app-data scope already granted; browser: none). `RecoveryStore` (copy + `{ v, name, path, savedAt }` sidecar, safe keys). `Session.autosave()` (only dirty, not mid-gesture, not read-only, skips an identical model; errors swallowed), copy removed on successful save and when the user agrees to discard changes (New/Open/close/recover over a dirty doc), `recover(entry)` (opens via the same path as Open → missing-module / newer-module handling unchanged; result is unsaved, Save asks where), `discardRecovery(entry)` (asks first). Core `History.markUnsaved()`. `RecoveryPanel` at launch over the start screen; 30 s timer. pt-BR/en strings. Dev `?demo=recovery`.

**Tests**: 263 (+9): copy only when dirty and once per change, not mid-drag, save clears, discard clears / cancel keeps, crash → next launch lists → recover = unsaved + copy kept until saved, damaged copy reported + kept, discard asks, safe keys, meta parsing; `markUnsaved`.

**Inferences/defaults logged** (spec-driven, high confidence): recovered work opens without a path (Save asks, suggesting the old name) so the original file isn't overwritten by surprise; the copy isn't deleted on recover (only on save/discard), so a second crash can't lose it; "Decide later" keeps copies for the next launch; macOS ⌘Q that skips the close question still leaves a copy (bonus).

**Not done**: crash log (ADR-028 details PROPOSED, Q-095 default not confirmed). Native app not click-tested.

**Next (owner)**: merge app-data → outside-faces → recovery; try a force-quit recovery; ADR-028/Q-095.

### Session #11, part 26 — crash log (ADR-028 v1), 2026-11-17

Owner accepted the v1 crash reporting default ("Yes, I like this. Easy and direct."). Branch `phase1/crash-log`, stacked on `phase1/recovery`.

**Done**: `crashlog.ts` (scrub, entry, JSON-lines log capped at 50, GitHub new-issue URL with title + body only), window `error` / `unhandledrejection` + Vue `errorHandler` → log + quiet banner (Report on GitHub / Dismiss; doesn't take focus). Same message written once per run, max 20 writes per run. Platform `appVersion()` (Tauri `getVersion`, core:app is in core:default) and `openUrl()` (browser build: `window.open`; desktop: returns false → link copied to the clipboard, until **ADR-039** (PROPOSED: `tauri-plugin-opener`)). pt-BR/en. Dev `?demo=crash`.

**Tests**: 268 (+5): scrubbing (macOS/Windows/file:// paths, `.prumo` names, e-mails; app-bundle frames kept; 4000-char cap), entries from Errors/strings/objects/cyclic values, cap + damaged lines, URL params, OS detection.

**Inferences/defaults logged**: no opt-in question since nothing leaves the computer unless the user clicks and submits on GitHub themselves; the issue body asks "what were you doing?" first.

**Next (owner)**: merge app-data → outside-faces → recovery → crash-log; ADR-039.

### Session #11, part 27 — ADR-039 accepted: open links in the browser, 2026-11-17

Owner merged app-data, outside-faces, recovery, crash-log (PRs #18–#21) and accepted ADR-039 A. Branch `phase1/opener` from main.

**Done**: `tauri-plugin-opener` 2.7.2 (JS exact, Rust locked with `cargo update --precise`; 2.7.3 was released 2026-11-10, too new), registered in `main.rs`, capability `opener:allow-open-url` limited to `https://github.com/prnleg/prumo/*`; platform `openUrl` uses it (falls back to copying the link). Cargo.lock +~500 lines (opener's platform crates).

**Tests**: 268 unchanged (platform adapter isn't unit-tested; logic is). `cargo check` ok. Not click-tested.

**Next**: see CURRENT_STATE next steps.

### Session #11, part 28 — type a wall's length, 2026-11-17

Branch `phase1/wall-length`, stacked on `phase1/opener`. Audit of EDITING_OPERATIONS against the code found three gaps: (1) wall length not editable, (2) collinear overlapping walls not refused (spec default "reject with message", but it's a ❓ and a new invariant in DATA_MODEL → asked, not done), (3) midpoint/perpendicular snapping (spec lists them; Q-087 only confirmed grid/15°/Alt → asked, not done).

**Done (1)**: core `setWallLengthCommand` (spec default: start stays, end moves; joined walls at that end follow like a move; a door that no longer fits → refused). Panel "Length" field in cm with tooltip; `cmd.wallLength` strings.

**Tests**: 273 (+5): 3-4-5 diagonal halved (hand: end = (2500, 3000)), L corner follows + neighbour door offset 3162.2777 − 2000 = 1162.2777 (hand), joined-by-end follows, door no longer fits → refused, same length = no step.

**Noticed**: in the L-shaped demo the room's area label overlaps the free-standing partition stub (label point ignores dangling walls). Logged, not fixed.

### Session #11, part 29 — fixes: overlapping walls refused (I-8), room label clear of partition stubs, 2026-11-17

Owner merged opener + wall-length and said to focus on fixes. Branch `phase1/fixes` from main.

**Done**: core invariant **I-8 `walls-overlap`** (`collinearOverlap`; same line within 1 mm = rotation noise, shared length > `MIN_WALL_LENGTH`; checked for changed walls only). Spec default from EDITING_OPERATIONS ("reject with message"); applies to draw / move / rotate / paste. Room label point: walls standing inside a room (stubs, an inner block) are obstacles; rooms without them keep the centroid (no change to existing labels).

**Tests**: 279 (+6): overlap by hand (1000 / reversed / end-to-end 0 / parallel 0 / T 0), draw refused vs continue vs T, move refused + drag keeps last valid frame, 90° rotation noise still detected; label clear of a stub by > 1 m, rectangle still centroid. An old invariants test had two walls on one line by accident → moved.

**Known side effect (logged in EDITING_OPERATIONS)**: pasting a room so one of its walls lands on a neighbour's wall is now refused (before: silently doubled walls). Merge-on-paste could come later.

**Still waiting on the owner**: midpoint/perpendicular snapping (a feature, not a fix); next Phase 1 feature (room separator / polygon rooms / module manager / tour).

### Session #11, part 30 — gentle snapping assists, 2026-11-17

Owner: midpoint/perpendicular snapping yes, "smoothly and not instantly … like an assurance, to make it close perfectly"; next feature = room divider. Branch `phase1/snap-assist` from main.

**Done**: core `snap` gets `segments` + `assistRadiusPx` (8 px, smaller than endpoints' 12 px) → `midpoint` and `perpendicular` kinds (foot of the perpendicular from the wall's fixed end, only on the wall body). Wall tool: both; room tool: midpoint. Plan view draws ▲ / ⊾ marks. Wall hint mentions them (pt-BR/en). Dev `?demo=snap`.

**Tests**: 282 (+3): midpoint within 64 mm yes / 100 mm no at 0.1 px/mm; right-angle foot on a 3-4-5 wall from (0, 5000) = (2400, 1800) (t = 15e6 / 25e6 = 0.6), dot product 0; endpoint wins; Alt free. Screenshot: 4.00 m wall square to the slanted one.

**Interpretation logged**: "not instantly" = small capture radius + lower priority than ends (no time delay; a delay would make clicks unpredictable).

### Session #11, part 31 — room divider (ADR-040), 2026-11-17

Owner chose A (wall kind "separator") + toolbar button and panel. Branch `phase1/divider`, stacked on `phase1/snap-assist`.

**Done**: core `WallKind` + `"separator"`, `isDivider`; plan geometry keeps dividers out of joins/outline and lists them (`dividers`, 1 mm pick strip; hit test + box select); room detection closes on them with 0-offset faces; label obstacles use 0 thickness; openings refused on them; outside-faces rule skips them; opening tool won't pick them. Renderer: dashed line (accent when selected). App: Divider button + L shortcut (= wall tool in divider mode), hints, panel title/note, Type list entry, body fields and paint hidden; status-bar wall count excludes dividers. Dev `?demo=divider`.

**Tests**: 287 (+5): 8 × 4 m split at 5 m → 19,029,800 + 11,309,800 = 30,339,600 mm² = the undivided floor (hand); not in joins/outline, pickable; alone / dangling = no room; door refused; outside-faces ignores it. Screenshot (new project, outside faces on): 4860 × 3720 = 18.08 m², 2860 × 3720 = 10.64 m² (hand).

### Session #11, part 32 — rooms of any shape, 2026-11-17

Owner: do the remaining Phase 1 items least-blocked first, in sequence, one branch each. Order chosen: any-shape rooms (clear defaults) → onboarding tour (Q-080 default) → module manager (depends on ADR-020 revision). Branch `phase1/room-shape`, stacked on `phase1/divider`.

**Done**: `RoomTool` option `shape: "rectangle" | "polygon"`; any-shape mode: clicks add corners (grid / endpoint / midpoint snaps + 15° from the last corner), the gesture previews the CLOSED room the whole time, closes on the first corner / `close()` (double-click, Enter, right-click), needs ≥ 3 corners and an area ≥ minSide²; crossing sides refused (`selfCrossing`, hint); normalised CCW; covered sides reused (`uncoveredPieces`); one undo step; Esc cancels. App: "▭ Rectangle | ⬠ Any shape" toggle next to Room (only while the room tool is on), hints pt-BR/en, dev `?demo=shape`.

**Tests**: 292 (+5): L shape → 6 walls, 22,479,600 mm² (hand: 24 m² − 22 m × 70 mm + 4 × 70²), one undo; clockwise = same; triangle via close() with a double-click's repeated point ignored; bow-tie refused + Esc = no step; shared side reused (4 + 2 walls).

**Defaults logged**: the shape choice isn't remembered across launches (cheap to add to prefs later); right-click closes when possible, else cancels (same spirit as the wall tool's "stop").

### Session #11, part 33 — quick tour (Q-080 default), 2026-11-17

Branch `phase1/tour`, stacked on `phase1/room-shape`.

**Done**: `TourBubble.vue` (non-modal bubble + ring around a `data-tour` control; repositions on resize/language; Skip / Back / Next; Esc ends it), 8 steps (room, wall, divider, door, select, undo, settings, save) in pt-BR/en. Opens once at launch after the start screen and any recovery question are closed; `tourDone` in settings.json (ADR-037 prefs, unknown-key-safe); Settings → Help → "Show the quick tour again". Dev `?demo=tour`.

**Tests**: 293 (+1: tourDone parsing). The i18n safety test caught "Segure Alt" (contains "segur", banned stem for "seguro") → reworded to "Mantenha Alt pressionado".

**Defaults logged**: tour not shown in dev demos; never during a gesture (it only opens at launch / from Settings, ADR-025).

### Session #11, part 34 — module manager deferred; EDITING_OPERATIONS test matrix, 2026-11-17

**Module manager (stage 1)**: not built. ADR-020 stage 1 = "shipped but not loaded unless enabled"; today the only module (Architect) is required, so a Modules page would have nothing to enable — plumbing without a feature (golden rule 12). Deferred to the start of Phase 2 with `module-structural` (ROADMAP note).

**Done instead** (Phase 1 exit criterion): `test/ops-matrix.test.ts`, branch `phase1/ops-matrix` stacked on `phase1/tour`: 9 operations × 5 cases = 45 tests (do / invariants / undo = exact snapshot / redo = exact result / save → open identical). All passed first run. ROADMAP exit criteria: undo/redo + round trip checked.

**Tests**: 338.

**Remaining for Phase 1 exit**: owner G-1 usability test; EDITING_OPERATIONS edge cases still marked ❓ in the doc (e.g. Figma-style last-offset duplicate, copied override findings — those need Phase 2 data).

### Session #11, part 35 — engineer brief (batch 1 + ADR-017), 2026-11-17

Owner merged everything through PR #29 and asked for the engineer questions to send right away. Wrote a Portuguese brief as a shared Claude doc ("Prumo — perguntas para o engenheiro (lote 1)"): how to answer (clause numbers only, no standards text), P1 = ADR-017 options A–D + E-04 + E-07, scope (E-01, E-03), candidate rules table + E-02 + E-06, simplifications (E-05), validation cases VC-001…005 (E-22). E-01…07 and E-22 marked ⏳ 2026-11-17. Answers get recorded here with date + reviewer when they come back.

### Session #11, part 36 — engineer batch 1 answered; ADR-017 accepted; ADR-041 review levels, 2026-11-17

Owner received the engineer contact's answers (a Markdown file, probably AI-assisted in the writing, reviewed by the engineer per the owner; titled "respostas simuladas"). Owner: don't name the engineer (signing would make Prumo an engineering product) → **ADR-041**: review levels UNVERIFIED → **VERIFIED-UNSIGNED** (informal, anonymous, no ART) → VERIFIED (signed; unused). Values recalled from memory or marked "check" stay UNVERIFIED. CLAUDE.md rule 17 + SAFETY updated; UI wording describes the rule, never the user's design.

**Recorded**: E-01…E-07 + E-22 answers (summaries, no standards text). **ADR-017 accepted** (D default + A recorded exception; B explains only; RC later). Q-136 confirmed (same severity). STRUCTURAL_ANALYSIS: `br-nbr` standards list (editions, "check" marks, 15961/15812 replaced, 16280 for renovations); rule catalogue reordered to the engineer's ranking with a Review column, 7 new rules (R-OPEN-NEW, R-WALL-004/005/006, R-OPEN-006 contraverga, R-JOINT-001, R-RING-001; old R-OPEN-006 → R-OPEN-007, an invariant not a finding); construction system with "não sei"; validation cases: VC-001a/b "formula test only", VC-002 = one-way joist slab + **new VC-002b** two-way (hand: 6.667 / 5.0 kN/m, Σ 120 kN), VC-003/004 premise notes; values register with 5 memory hints (UNVERIFIED); §7 simplifications rewritten (13 items). SAFETY: "no findings" = list checked AND not checked. ENGINEER_QUESTIONS batch 2b (E-30…E-38: clause numbers for what was recalled).

**My error, logged**: the batch-1 brief renumbered the validation cases (brief VC-001…005 = repo VC-001a, 001b, 002, 003, 004); the repo's VC-005 (self-weight minus an opening) was never sent → E-32. Answers mapped to repo ids.

**Next**: Phase 2 start (see CURRENT_STATE).

### Session #11, part 37 — Phase 2 slice 1: module-structural core (ADR-042), 2026-11-17

Owner: ask the system on the start screen; data-name defaults OK → **ADR-042 accepted**. Branch `phase2/structural-core`.

**Done**: new package `@prumo/module-structural` (deps: core; dev: module-architect for tests). `manifest` (`org.prumo.structural`, component v1, optional, depends on Architect). `data`: `structuralData` / `withStructuralData` (empty → removed), `setWallRole(role, origin)`, `setLintel`, `constructionSystem(profileId)`, `profileIdFor`, `rulesSystem` (unknown → masonry). `roles.bearing(wall, system)` with user-visible assumptions (A-ROLE-1 marked + origin, A-ROLE-2 masonry default, A-SYS-1 system unknown); full/half only (fences, railings, dividers never carry). `finding` (Spike B shape + ADR-041 `review`). Rules: **R-OPEN-001** (presence, no threshold; "opening up to the top" wording per E-06; review VERIFIED-UNSIGNED E-06, clause UNSOURCED → E-30) and **R-ROLE-001** (non-bearing mark in masonry, advisory, E-07). `engine.runChecks` (sorted, deterministic) + `diffFindings` + `NOT_CHECKED` (11 keys from §7).

**Tests**: 351 (+13): system parsing; unknown → masonry + A-SYS-1; RC → nothing run; R-OPEN-001 default / marked same severity (E-07) / lintel / non-bearing → R-ROLE-001 / to-top wording / fences-railings-dividers; order independence; diff resolves; save → open keeps data, also with the module disabled.

**Next**: slice 2 = UI (start-screen system choice, panel role/origin/lintel, findings panel "checked / not checked", canvas badges, Settings → Project system + Modules switch).

### Session #11, part 38 — Phase 2 slice 2: structural UI, 2026-11-17

Branch `phase2/structural-ui`, stacked on `phase2/structural-core`.

**Done**: start-screen system step (owner choice); `setSystemCommand`; Settings → This project + Modules (stage 1: `structuralOff` pref hides tools + checks, data kept — the code is bundled anyway, ADR-020 stage 1); panel Structure section (role select with the system default spelled out, origin "how do you know?", lintel checkbox; hidden for fences/railings/dividers and when the module is off); `FindingsPanel.vue` + `structural-ui.ts` (typed params → words per language; one card per rule, Q-135; assumption lines merged into "these walls …" when several); checks re-run on History `commit` + 1.5 s settle (Q-073 default), never during a gesture; diff +new / −gone (reset on New/Open); PlanView `badges`; examples get lintels; **"House with problems"** example (ROADMAP Phase 1 item, now possible). 88 new strings pt-BR/en; banned-words test passes (avoided "safety"/"segurança": they contain the banned stems).

**Tests**: 362 (+11): examples clean / problems = 2 × R-OPEN-001 + R-ROLE-001; findings text per language; one card per rule; plural assumption.

**Lost and redone**: a script truncated App.vue (opened for write before reading); restored from git, the 4 lost edits redone. No harm, logged.

**Next**: R-WALL-002 needs a baseline ("original plan") — design question (snapshot? Q-104); more presence rules need new data (contraverga flag, chases, tie beam) → small additions to ADR-042.

### Session #11, part 39 — Phase 2 slice 3: the existing building + R-WALL-002 + R-OPEN-NEW, 2026-11-17

Owner approved the baseline design → **ADR-043**. Branch `phase2/baseline`, stacked on `phase2/structural-ui`.

**Done**: core `settings.baseline` (validated string) + `setBaselineCommand`; module-structural `CheckContext.baseline`, `RuleDef.needsBaseline`, `runChecks(p, level, { rules?, baseline? })` → `needBaseline` list; **R-WALL-002** and **R-OPEN-NEW** (VERIFIED-UNSIGNED E-02, UNSOURCED); Session `markBaseline` / `clearBaseline` / `baselineProject` / `baselineDate`; checks panel: "Mark the current plan as the existing building" / "Comparing with … marked on {date}" + Mark again / Stop comparing; "Not checked" lists rules waiting for it; card severity = worst finding (R-OPEN-NEW grades new vs enlarged). Dev `?demo=renovation`.

**Tests**: 373 (+11): no baseline → listed not run; unchanged → nothing; removed (no element to point at) / moved 1 m / turned into a fence / 0.5 mm nudge ignored / was marked partition → may go; new door critical, widened warning, slid nothing, taller warning, moved to another wall = new; partition wall not this rule; session: mark → unsaved, snapshot without pointer, unaffected by later edits, survives save → open, undo clears.

**Next**: rules needing new data (contraverga flag R-OPEN-006, tie beam R-RING-001, bonding R-JOINT-001, chases R-WALL-004 — small ADR-042 additions); ghost of a removed wall on the plan; Phase 2 exit needs ≥ 8 rules (have 4).

### Session #11, part 40 — Phase 2 slice 4: contraverga, tie beam, bonded junctions, 2026-11-17

Owner approved the three data additions. Branch `phase2/more-rules` from main.

**Done**: data `contraverga`, `tieBeam`, `bonded {start,end}` + setters (empty → removed); rules **R-OPEN-006** (advisory), **R-RING-001** (warning, full walls only), **R-JOINT-001** (warning, one finding per junction; junction detection = wall end within 5 mm of another load-bearing wall's end or body, the drawing's join tolerance); `junctionsOf` for the panel. Panel: contraverga (windows), tie beam (full walls), one "bonded" box per end that meets another wall, labelled by the end's position on the plan (top/bottom/left/right) + the other wall — no start/end jargon. Examples all marked; "house with problems" = 2 × R-OPEN-001 + R-OPEN-006 + R-ROLE-001. Older tests pinned to the first four rules (`rules: FIRST`) so each test still checks one thing.

**Tests**: 385 (+12: 8 rule tests incl. L / T / three-way junctions and wrong-end marks; data cleanup).

**Noticed**: a stale dev server from an earlier run held port 5199 and served a blank page; killed by pid.

**Next**: Phase 2 exit needs ≥ 8 rules → R-WALL-004 (chases: a new element + tool, approved "later"). Threshold rules (R-OPEN-002/003/004, R-WALL-001/006) wait for batch 2b.

### Session #11, part 41 — Phase 2 slice 5: chases (R-WALL-004), 2026-11-17

Owner: "let's start it and go with the Horizontal" (horizontal = warning, vertical = advice). Branch `phase2/chases`, stacked on `phase2/more-rules` (not merged yet).

**Done**: core — `Host.length?` (extent for module items), `Hosted` / `isHosted` / `hostedExtent`; translate (slide clamped by length), stretch-from-start offset shift, setWallLength, mirror (move + copy), clipboard / duplicate now carry any hosted item; invariant `item-outside-wall` (+ host-other-level / host-not-wall for items); `PlanGeometry.items` (marker along the body centre, pick polygon; a point item gets a square pad), pick + box select. Renderer draws items (dotted run / ring, highlight when selected). module-structural — `CHASE`, `newChase`, `isChase`, `chaseDir` (unreadable → horizontal, the more serious case), `ChaseTool` (framework-free; `@prumo/module-architect` moved from dev to runtime dependency for `pickWall` — workspace package, declared in the manifest's dependsOn; no new third-party dep), **R-WALL-004**. App: toolbar Chase + Horizontal/Vertical segment, hints, length label while drawing, Esc/right-click cancel, badge at the chase's middle, panel "Horizontal chase · In the 10.00 m wall · Length", 22 strings pt-BR/en, dev `?demo=chase`. Docs: ADR-042 + ADR-024 notes, catalogue row, ROADMAP exit criterion ticked (8 rules), Q-139 (element types, owner's remark).

**Decided alone (reversible, logged)**: chases on any hosted wall may overlap doors/windows (a pipe can pass above a door); no height/depth stored; changing a chase's direction = delete + redraw (no switch in the panel); chases hidden from the toolbar when Structural is off, but kept and drawn (rule 13).

**Tests**: 394 in all (core +7, structural +10): core hosted items (ride / slide clamp / stretch / delete / duplicate + mirror copy / item-outside-wall / plan + pick); chase data; R-WALL-004 (horizontal warning, vertical advice, partition → none, half wall flagged, RC → not run, A-ROLE-2); chase tool (vertical click, horizontal backwards, clamp + zero length, Esc). Example "house with problems" now 5 findings. Screenshot checked (en).

**Next**: owner merges more-rules → chases; Q-139 (element types) design when Phase 2 closes; batch 2b to the engineer (thresholds); G-1 usability test.

### Session #11, part 42 — Phase 2 exit criteria, 2026-11-17

Owner merged more-rules + chases. Branch `phase2/exit-criteria`.

**Done**: test that the findings diff follows undo / redo (History commit events drive re-check + diff — the same path App.vue uses): add door → +R-OPEN-001, undo → −, redo → + (same fingerprint), lintel → −, undo → +, delete → −. G-8: banned-words test already covered every UI string in both languages; added the missing "passes code" from SAFETY's list. ROADMAP Phase 2: all three exit criteria ticked; GOALS G-8 ✅.

**Not done / still open in Phase 2 scope** (not exit criteria, listed in CURRENT_STATE): engineer review of the rule list (batch 2b), slabs ("what's above"), notes + protection markers + handoff banner, data pack, EU profile.

**Batch 2b brief**: shared Claude doc in Portuguese (same format as batch 1): how to answer (item numbers only, "conferir" ok, anonymous), fill-in table E-30/31/33–38 with what was said in batch 1, VC-005 hand calc (E-32), new **E-39** (confirm the detail choices of R-WALL-004, R-OPEN-006, R-RING-001, R-JOINT-001). Recorded in ENGINEER_QUESTIONS.

**Next**: owner forwards batch 2b; then threshold rules (R-OPEN-002/003/004, R-WALL-001/006). Meanwhile Phase 2 scope still open: slabs / "what's above", notes + protection markers + handoff banner (ADR-029), data pack (ADR-030), Q-139 element types.
