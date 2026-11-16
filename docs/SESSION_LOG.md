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
