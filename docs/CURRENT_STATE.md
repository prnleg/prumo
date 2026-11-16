# CURRENT STATE

> This file must always be **truthful**. If something is stubbed, faked, or broken, say so here.
> Last updated: 2026-11-15, session #4 (owner's round-4 answers incorporated). Codename: **Prumo**.

## Summary

| Area | State |
|---|---|
| Code | **None.** Public repo created: https://github.com/prnleg/prumo (Apache-2.0 LICENSE + these planning docs). |
| ACCEPTED | ADR-001/002 (Tauri 2 + Vue 3 + TS), 004 (first pack: structural masonry; 2nd pack TBD), 009 (Brazil only for v1), 014 (Apache-2.0, public, unsigned), 019 (role-based Visions), 020 (bundled internal module API), 026 (rules never block), 027 (Win + macOS), 028 (crash reports, in principle), 029 (handoff = sequential "baton", no parallel edits), 030 (data packs vs code modules), 031 (Sims-like build mode; snapping defaults; half walls close rooms; finish ≠ structure). |
| PROPOSED | ADR-018, 021, 022, 024, 025; crash-report mechanics (028). |
| OPEN | ADR-003, 005, 006, 008, 010, 011, 012, 013, 015, 016 (name), 017, 023. |
| Owner answers | Rounds 1–4 answered (except leftovers with defaults). Round 5 asked (Q-102…109). |
| Engineer | Questions batched in `ENGINEER_QUESTIONS.md`; none sent yet. |
| Phase | Phase 0: decisions & spikes. |

## Blocked items

| Blocked item | Blocked by |
|---|---|
| Handoff details | Q-102 (work on unrelated parts?), Q-103 (how files travel), Q-104 (snapshots) |
| File format | Q-105 (zip container?) |
| Final name | Trademark check before the first release (Q-109) |
| Structural rules | ENGINEER_QUESTIONS batch 1–2, ADR-017 |

## Next immediate step

1. Owner answers round 5 (none of it is 🔴; defaults are usable).
2. Owner forwards ENGINEER_QUESTIONS batch 1 to the engineer.
3. A Claude Code session runs Spikes D (stack) and E (module boundary) in this repo.
