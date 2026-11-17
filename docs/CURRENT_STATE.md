# CURRENT STATE

> This file must always be **truthful**. If something is stubbed, faked, or broken, say so here.
> Last updated: 2026-11-16, session #11 (Spikes A, B, D, E done locally; Windows not measured yet). Before: session #10 (planning closed, ready to build). Previously: session #4 (owner's round-4 answers incorporated). Codename: **Prumo**.

## Summary

| Area | State |
|---|---|
| Code | **Phase 1 slices 1–8b done + room types** (1–8a merged via PRs #3–#12; 8b on `phase1/start`; room types + fitted labels on `phase1/room-types`, stacked on it; copy/paste on `phase1/clipboard`, stacked on that; re-host on `phase1/rehost`, stacked on that; toolbar wrap + label word-wrap on `phase1/toolbar`, stacked on that). **First runnable app** (`apps/desktop`, Tauri 2 + Vue): draw walls (chainable, 10 cm grid / 15° / endpoint snap, Alt = free, click first point closes a room, Esc/double-click/right-click stops), mitred joins + clean outline, live length label, **doors and windows** (hover a wall → preview → click; magnets: wall middle, ends, next to other openings; else 10 cm steps; clamped to fit; overlaps refused; plan symbols: cut, glass lines, door leaf + swing arc), undo/redo (buttons + Ctrl/⌘+Z, Shift+⌘+Z, Ctrl+Y), pan (scroll / middle-drag / Space-drag) + zoom (wheel / pinch), fit, pt-BR/en (ICU), light/dark, disclaimer footer. **select tool** (click, Shift+click, box select left→right inside / right→left touching, Ctrl/⌘+A), **move** by drag in 10 cm steps (joined walls stretch, Q-022; Ctrl/⌘ = detach; T stems follow; doors/windows keep their place on stretched walls; a door/window alone slides along its wall), **delete** (takes hosted doors/windows), **duplicate** (Ctrl/⌘+D, 50 cm offset), **properties panel** (wall thickness/height/alignment/type; door/window width/height/sill, flip hinge/opening side; numbers in cm typed in the UI language, ambiguous input refused). **rotate** 90° (R / Shift+R, panel; about the selection centre on the grid; joined walls stretch; exact, 4 × 90° = identity), **mirror** left↔right / up↕down (default = mirror a copy beside the selection, axis on its right/top edge, walls on the axis shared not copied; or in place about the centre; alignment flips; doors mirror exactly). **rooms**: room tool (default tool, Q; 2 clicks → rectangle of walls, sides already covered by walls are reused) + automatic room detection from closed loops of full/half walls (fences/railings don't close; T/X splits; dangling walls ignored) with floor area to the inner wall faces shown in each room. **room names** (click a room's floor to select it, type a name; stored as a small `room` tag with a seed point matched to the detected room; the name travels when the whole room is moved/rotated/mirrored; merged rooms keep both tags), selecting a room and dragging it moves its walls, **dimension labels** for selected walls and doors/windows. **finishes** (Q-090): paint/tiles per wall side, picked in the panel by the room each side faces ("Side facing Sala" / "outside"); floor finish per room; drawn as a coloured strip along the face and a floor tint; built-in list of 12 (moves to a data pack later, ADR-030); colour only, no thickness yet; mirroring swaps sides through a module hook (`component.mirror`). **files** (ADR-036): New / Open… / Save (Ctrl/⌘ + N/O/S, Shift = Save as), native dialogs via Tauri's dialog + fs plugins with access only to files the user picks; window title shows unsaved changes (•); closing or New/Open with unsaved changes asks first; damaged file → message; newer file format → "update Prumo"; newer module data → opens read-only (Save disabled, banner); modules you don't have → ADR-032 question → snapshot + undoable removal; browser dev build saves by download. Native dialogs not click-tested yet (logic unit-tested with a fake platform). **start screen** (at launch and on New): blank project, 2 examples (small house 10 × 7 m, apartment 8 × 6 m; built in code, names localized, note "not designs for a real building, not checked by an engineer"), open a file. **settings** (toolbar ⚙ or click the snap text in the status bar): grid 1/5/10/25/50 cm = the project's own value (saved in the file, undoable), angle steps 5…90°, language; angle + language are **forgotten on restart** until ADR-037. **room types** (Q-107/115: the 14 approved types, picked in the panel; an unnamed room shows its type as its label; stored in the Architect component, now **v2**, so an older build opens such files read-only instead of dropping the type). **re-host**: drag one door/window over another wall → it moves there (centred on the pointer, on the grid, clamped inside the wall; undo says "move door to another wall"); back over its own wall = ordinary slide. **copy / cut / paste** (Ctrl/⌘+C/X/V; app-internal clipboard, detached copy; walls bring their doors/windows; paste puts the copy's centre under the pointer on the grid, or 50 cm off if the pointer is outside; doors/windows copied alone paste onto the wall under the pointer keeping their spacing; names not copied; duplicate now shares this code). **Room labels fit their room** (one line → two lines → long names word-wrapped → 10 px → name only → hidden; width estimated from character count, deterministic). **Not yet:** "house with problems" example (needs Phase 2 checks), autosave/recovery (8c), remembered settings (ADR-037),  finish thickness, invisible room separator, polygon room tool, free-angle rotate gesture, user-picked mirror axis, rooms, properties, save/open dialogs (core supports save/open; UI needs the Tauri dialog/fs plugins → dependency ADR). Packages: `core` (model, persistence, history, modules, geometry: joins/outline/snap), `module-architect` (manifest, wall tool), `renderer-2d` (SVG plan). 240 tests. CI: lint/format/typecheck + tests on 3 OS; `desktop` workflow builds Windows (NSIS/MSI) + macOS (universal) installers as artifacts. macOS `.app` 3.5 MiB locally (with the plugins). |
| ACCEPTED | ADR-001/002 (Tauri 2 + Vue 3 + TS), 004 (first pack: structural masonry; 2nd pack TBD), 009 (Brazil only for v1), 014 (Apache-2.0, public, unsigned), 019 (role-based Visions), 020 (bundled internal module API), 026 (rules never block), 027 (Win + macOS), 028 (crash reports, in principle), 029 (handoff = sequential "baton", no parallel edits), 030 (data packs vs code modules), 031 (Sims-like build mode; snapping defaults; half walls close rooms; finish ≠ structure). |
| ACCEPTED (s#11, 2026-11-16) | ADR-003 (2D plan is truth), 005 (Tier 0 first, improves in later versions), 006 (float mm + tolerance, Y up), 010 (build our own; interoperability later), 012 (own geometry math; library when areas need it), 018 (no invented thresholds), 021 (i18n), 022 (namespaced components).; **Phase 1 batch:** 011 (snapshots + commands), 015 (`levels[]` day 1), 024 (generic hosting), 025 (quiet feedback, **2 s** settle), 033 (monorepo/tooling, Node ≥ 22), 034 (`intl-messageformat`), 035 (fflate). |
| PROPOSED | crash-report mechanics (028); **ADR-037** app data folder (settings + autosave/recovery). |
| ACCEPTED (s#8) | ADR-032 (missing modules & export with module selection); ADR-008 snapshots = full copies. |
| OPEN | ADR-008 (accepted in principle), 013, 016 (name), 017, 023. |
| Owner answers | Rounds 1–5 answered (except leftovers with defaults). **Planning rounds closed.** All remaining questions are defaults on record. |
| Engineer | Questions batched in `ENGINEER_QUESTIONS.md`; none sent yet. |
| Phase | **Phase 1** (started 2026-11-16). Slices 1–8b done; next 8c (autosave + crash recovery, crash log; needs ADR-037). Engineer review + Windows run pending (non-blocking). |

## Blocked items

| Blocked item | Blocked by |
|---|---|
| Final name | Trademark check before the first release (Q-109) |
| Structural rules | ENGINEER_QUESTIONS batch 1–2, ADR-017 |

## Spike results (session #11)

**Spike D — stack (`spikes/stack`)**, measured on macOS 27 / Apple Silicon, release build:
| Metric | Result |
|---|---|
| Installer (macOS, arm64) | `.app` 3.1 MiB; `.dmg` 1.7 MiB (plain UDZO via `hdiutil`; Tauri's styled DMG step **failed locally**: Finder AppleScript timed out, a local automation-permission issue) |
| Startup, process → first frame | cold 1.56 s; warm 0.52–0.61 s (5 runs) |
| Smoothness, 500 walls | 60 fps (display vsync cap), p95 ≤ 18 ms for SVG pan/zoom, SVG wall drag, and Three.js orbit; ≤ 2 frames > 20 ms per 3 s run |
| Stress, 4,920 walls | still 60 fps, ≤ 3 frames > 20 ms per run |
| JS bundle | 557 kB (150 kB gzip), mostly Three.js |
| **Windows** | **Not measured.** CI workflow builds NSIS + MSI but hasn't run. Startup/smoothness on Windows needs a real Windows machine. |

**Spike E — modules (`spikes/modules`)**: core skeleton (levels, walls, openings) + fake Architect (finishes), Structural (component + fake rule `FAKE-STRUCT-001`), Electrical (outlet element type). 28 Vitest tests prove MODULES §3 rules 1–7, ADR-032 (missing-module stop / install / remove with snapshot), MODULES §8 export with module selection, the Electrical-only install (§9), and deterministic save output. Lessons in SESSION_LOG #11.

**Spike A — wall joins (`spikes/joins`)**: own ~250 lines of TS, no geometry library. Joins computed from geometry every time (not stored). Handles L / T / X / + / Y at any angle, centre/left/right alignment, different thicknesses, gap healing (< 5 mm), miter limit with a straight bevel, and a "clean outline" (seams, T and X faces hidden) via edge classification instead of a polygon boolean. 56 tests, most with hand-calculated areas/outline lengths; 480 walls → joins + outline in ~52 ms (O(n²), no spatial index).
Known limits: (1) **different thicknesses meeting at a nearly straight angle** chop a small wedge off the thicker wall (7/30 random cases); (2) a wall **shorter than its own join** at a sharp angle overlaps its neighbour (flagged `corner-past-wall`); (3) X crossings overlap (fine for drawing, wrong for areas/quantities); (4) an end that lands on a corner node *and* another wall's body isn't handled.

**Spike B — one rule end to end (`spikes/rule`)**: hard-coded model (wall 1 marked load-bearing with a window; wall 2 not marked with a door) → rule `R-OPEN-001` ("opening in a load-bearing wall without a lintel", **`UNSOURCED – placeholder`, UNVERIFIED**, severity warning, no numeric threshold) → `Finding` (i18n key + typed params, assumptions, fingerprint) → explanation **card** with all 8 SAFETY items → pt-BR + en text → browser viewer (elevations, badges, findings panel, settle delay per ADR-025, "resolved" diff). 21 tests: rule cases, determinism, fingerprint/diff, exact card text in both languages, plurals, banned-words guard (proved to fail on a planted "safe"), catalogue key/slot parity.
Lessons: (1) identical cards repeat per opening → grouping needed (Q-135); (2) the most important assumption ("treated as load-bearing because nobody marked it") is hidden in the fold (Q-136); (3) i18n needs plural on a named param **and** gender `select` (pt-BR "a porta"/"o portão") → ICU-style messages (ADR-021 note); (4) ADR-017 kept open with a profile toggle (`assume-bearing` = option D / `skip`).
Stubbed/faked: `unmarkedWalls` toggle is a spike stand-in for ADR-017; lintel "extends 200 mm each side" is a **drawing default only**, no check reads it (R-OPEN-002 needs E-10); viewer controls are English-only developer chrome.

Stubbed/faked: `FAKE-STRUCT-001` is **not a structural rule** (no source, never to be promoted). Rule-1/2 boundary tests are crude text scans.

## Phase 0 exit checklist (session #11)

All ADRs in the checklist accepted by the owner on 2026-11-16 ("lean"); details in DECISIONS. Q-135/136 defaults accepted.

## Next immediate step

1. Owner: try the app — `pnpm install && pnpm --filter @prumo/desktop dev` (browser) or `cd apps/desktop && pnpm tauri dev`; on Windows, download the `prumo-windows-latest` artifact from the `desktop` workflow run (Q-130). Tell me what feels wrong (G-1 usability, early).
2. Owner: try Save / Open in the native app (`cd apps/desktop && pnpm tauri dev`, or the `desktop` workflow's installers) — dialogs aren't click-tested by me.
3. Owner: merge in order `phase1/start` → `phase1/room-types` → `phase1/clipboard` → `phase1/rehost` → `phase1/toolbar` (each is stacked on the previous; GitHub retargets automatically when the base is merged). Answer Q-134 (A/B/C, see OPEN_QUESTIONS) when convenient.
4. Owner: decide **ADR-037** (where Prumo keeps settings + autosave copies; lean A = app-data folder via the fs plugin we have). Then 8c: autosave + crash recovery (Q-111/126/129), remembered settings, crash log (ADR-028). Q-134 step still pending.
5. Owner (whenever): engineer batch 1 + E-06/E-07/E-22; Q-137 default ok?

## Older next steps

1. Owner answers round 5 (none of it is 🔴; defaults are usable).
2. Owner forwards ENGINEER_QUESTIONS batch 1 to the engineer.
3. A Claude Code session runs Spikes D (stack) and E (module boundary) in this repo.
