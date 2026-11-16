# CURRENT STATE

> This file must always be **truthful**. If something is stubbed, faked, or broken, say so here.
> Last updated: 2026-11-16, session #11 (Spikes A, B, D, E done locally; Windows not measured yet). Before: session #10 (planning closed, ready to build). Previously: session #4 (owner's round-4 answers incorporated). Codename: **Prumo**.

## Summary

| Area | State |
|---|---|
| Code | **Spikes only (throwaway, `/spikes`)**: `spikes/stack` (Spike D), `spikes/modules` (Spike E, 28 tests), `spikes/joins` (Spike A, 56 tests + browser viewer), `spikes/rule` (Spike B, 21 tests + browser viewer). **No production code** (`packages/` doesn't exist). D + E + A merged to `main` (PR #1); Spike B + validation cases pushed on `spikes/d-e`, no PR yet. CI workflow `spike-stack` pushed; result not checked. |
| ACCEPTED | ADR-001/002 (Tauri 2 + Vue 3 + TS), 004 (first pack: structural masonry; 2nd pack TBD), 009 (Brazil only for v1), 014 (Apache-2.0, public, unsigned), 019 (role-based Visions), 020 (bundled internal module API), 026 (rules never block), 027 (Win + macOS), 028 (crash reports, in principle), 029 (handoff = sequential "baton", no parallel edits), 030 (data packs vs code modules), 031 (Sims-like build mode; snapping defaults; half walls close rooms; finish ≠ structure). |
| ACCEPTED (s#11, 2026-11-16) | ADR-003 (2D plan is truth), 005 (Tier 0 first, improves in later versions), 006 (float mm + tolerance, Y up), 010 (build our own; interoperability later), 012 (own geometry math; library when areas need it), 018 (no invented thresholds), 021 (i18n), 022 (namespaced components). |
| PROPOSED | ADR-024, 025, 033 (monorepo/tooling), 034 (i18n library), 035 (zip library); crash-report mechanics (028). |
| ACCEPTED (s#8) | ADR-032 (missing modules & export with module selection); ADR-008 snapshots = full copies. |
| OPEN | ADR-008 (accepted in principle), 011, 013, 015, 016 (name), 017, 023. |
| Owner answers | Rounds 1–5 answered (except leftovers with defaults). **Planning rounds closed.** All remaining questions are defaults on record. |
| Engineer | Questions batched in `ENGINEER_QUESTIONS.md`; none sent yet. |
| Phase | **Phase 0 exit criteria met** (2026-11-16): spikes A, B, D, E done (D on macOS only), required ADRs accepted, VC-001…005 drafted. Engineer review + Windows run still pending (don't block Phase 1). **Phase 1 not started**: waits on ADR-011/015/024/025/033/034/035. |

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

1. Owner: decide the Phase 1 batch — ADR-011 (undo), 015 (levels), 024 (hosting), 025 (quiet feedback), 033 (monorepo/tooling), 034 (i18n library), 035 (zip library). Leans in DECISIONS.
2. Owner: open a PR for `spikes/d-e` (Spike B + docs) when convenient; Windows run (Q-130); forward engineer batch 1 + E-06/E-07/E-22.
3. Then: Phase 1 slice 1 (skeleton) per ROADMAP "Build order".

## Older next steps

1. Owner answers round 5 (none of it is 🔴; defaults are usable).
2. Owner forwards ENGINEER_QUESTIONS batch 1 to the engineer.
3. A Claude Code session runs Spikes D (stack) and E (module boundary) in this repo.
