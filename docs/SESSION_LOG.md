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
