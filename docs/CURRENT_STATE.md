# CURRENT STATE

> This file must always be **truthful**. If something is stubbed, faked, or broken, say so here.
> Last updated: 2026-11-15, session #11 (Spikes D + E done locally; Windows CI build not run yet). Before: session #10 (planning closed, ready to build). Previously: session #4 (owner's round-4 answers incorporated). Codename: **Prumo**.

## Summary

| Area | State |
|---|---|
| Code | **Spikes only (throwaway, `/spikes`)**: `spikes/stack` (Spike D, Tauri 2 + Vue 3 + SVG + Three.js) and `spikes/modules` (Spike E, plain TS + Vitest, 28 tests passing). **No production code** (`packages/` doesn't exist). CI workflow `.github/workflows/spike-stack.yml` written but **never run** (not committed/pushed yet). |
| ACCEPTED | ADR-001/002 (Tauri 2 + Vue 3 + TS), 004 (first pack: structural masonry; 2nd pack TBD), 009 (Brazil only for v1), 014 (Apache-2.0, public, unsigned), 019 (role-based Visions), 020 (bundled internal module API), 026 (rules never block), 027 (Win + macOS), 028 (crash reports, in principle), 029 (handoff = sequential "baton", no parallel edits), 030 (data packs vs code modules), 031 (Sims-like build mode; snapping defaults; half walls close rooms; finish ≠ structure). |
| PROPOSED | ADR-018, 021, 022, 024, 025; crash-report mechanics (028). |
| ACCEPTED (s#8) | ADR-032 (missing modules & export with module selection); ADR-008 snapshots = full copies. |
| OPEN | ADR-003, 005, 006, 008, 010, 011, 012, 013, 015, 016 (name), 017, 023. |
| Owner answers | Rounds 1–5 answered (except leftovers with defaults). **Planning rounds closed.** All remaining questions are defaults on record. |
| Engineer | Questions batched in `ENGINEER_QUESTIONS.md`; none sent yet. |
| Phase | Phase 0: decisions & spikes. D + E done on macOS; A + B not started. |

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

Stubbed/faked: `FAKE-STRUCT-001` is **not a structural rule** (no source, never to be promoted). Rule-1/2 boundary tests are crude text scans.

## Next immediate step

1. Owner: commit + push (or allow me to) so `spike-stack` CI builds the Windows installers; record sizes from the job summary.
2. Someone runs the Windows installer on a real PC and records startup + smoothness (bench: `PRUMO_SPIKE_BENCH=15`).
3. Spikes A (wall joins) and B (one rule end to end).

## Older next steps

1. Owner answers round 5 (none of it is 🔴; defaults are usable).
2. Owner forwards ENGINEER_QUESTIONS batch 1 to the engineer.
3. A Claude Code session runs Spikes D (stack) and E (module boundary) in this repo.
