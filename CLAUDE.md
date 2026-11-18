# CLAUDE.md — Rules for any AI coding session on this project

> Read this file completely before doing anything. It overrides your defaults.
> If anything here conflicts with a user request, **say so** and ask before acting.

## 0. Project status (keep this line updated)

**Phase:** Phase 0 (spikes). **Phase 1** (started 2026-11-16): slices 1–8b done (core, undo, modules, wall/room/door/window/select tools, finishes, files, start screen, settings (remembered, ADR-037), autosave + recovery, crash log; app in `apps/desktop`); spikes A, B, D, E in `/spikes` (throwaway). Toolchain: Node ≥ 22.12, pnpm 9, TS 6.0 (ADR-033). Repo: https://github.com/prnleg/prumo
**Phase 2** (structural, started 2026-11-17): 9 checks (8 Tier-0 + R-PROT-001), exit criteria ticked; ADR-044 notes / protection / hand-off done; compare view + saved versions; file schema 2. What's above per room (ADR-045 A), door/window/wall types (ADR-046), in-app menu bar + tool strip with Lucide icons (ADR-047), layers panel (Q-141), floors (ADR-048, Phase 5 step 1). Phase 3 groundwork: data packs (ADR-049), material weights, drawn slabs (ADR-050, schema 3), wall loads (ADR-051), lintel check (ADR-052). **Phase 4** (started 2026-11-18): 3D view (ADR-053, Three.js, switch + side by side), wall modes + surfaces (ADR-054). **Phase 5**: loads down the storeys + R-LOAD-001/002 (ADR-055). **Phase 5c**: PNG/PDF export (ADR-056) + all floors / check marks. **Phase 4 polish**: frames, door leaves, sun (ADR-057). **Phase 5b**: Electrical slice 1 (ADR-058). Waiting on: engineer (deferred by the owner, 2026-11-18).
**Commit messages:** don't add `Co-Authored-By` trailers (owner's preference).
**Accepted so far:** Tauri 2 + Vue 3 + TypeScript (ADR-001/002); Windows + macOS first, Linux later (ADR-027); open source, Apache-2.0, public repo from day 1 (ADR-014); modular, role-based Visions (ADR-019) with a bundled, internal module API (ADR-020); Brazil-only profile for v1 (ADR-009); first structural rule pack = structural masonry (ADR-004); rules inform and never block (ADR-026); **session #11:** 2D plan is truth (003), Tier 0 first (005), float mm + tolerance, Y up (006), build our own (010), own geometry math (012), no invented thresholds (018), i18n (021), namespaced components (022). **Proposed:** quiet-while-creating feedback (ADR-025). **2026-11-17:** ADR-017 accepted (masonry: all walls load-bearing by default, recorded exceptions); ADR-041 review levels (VERIFIED-UNSIGNED = anonymous engineer review). **Session #4:** codename **Prumo** (final name pending a trademark check); ADR-030 accepted; handoff = sequential "baton", no parallel edits; half walls close rooms; finishes ≠ structural materials. **Session #3:** Sims-like build mode with room + wall tools and any angle (ADR-031); architect↔engineer handoff (ADR-029); opt-in crash reports (ADR-028); data packs vs code modules (ADR-030, proposed).
Source of truth for status: `docs/CURRENT_STATE.md`.

## 1. Who you are working with

- The owner is a **senior software engineer** (.NET, Angular/Vue; also knows Rust, C#, Python, WPF, Flutter, Tauri 2).
  → **Don't over-explain code or software architecture.** Talk to them as a peer about software.
- The owner is **not** an architect, structural engineer, or civil engineer. This domain is outside their area.
  - **Explain every domain term** the first time you use it in a session (link to `docs/GLOSSARY.md` / `docs/DOMAIN_PRIMER.md`).
  - **The owner can't check whether structural math is correct.** You can't count on them to catch engineering mistakes, so you need to be *more* careful, not less. They know an engineer who can review (Q-068); route structural doubts there.
  - Never assume the owner "probably meant" something technical. Ask.
- The owner explicitly asked for you to be **critical and insecure** about decisions: surface doubts, flaws, and alternatives *before* implementing, not after.
- **How to ask questions (owner feedback, session #10):** the owner wants questions, but **not re-asks or confirmations of things you can infer from context**. Before asking:
  1. Is it already answered in DECISIONS/OPEN_QUESTIONS "Resolved", or inferable from a related answer? → **don't ask; apply it and log your inference** in SESSION_LOG.
  2. Is it cheap to reverse? → **use the default, log it**, and mention it in one line at the end of your report.
  3. Ask only when it's **new, consequential, and genuinely ambiguous**. One question, plain words, a concrete example, a default.
  Never ask the same thing twice in different words.
- The project is **open source, modular, and for everyone** (beginner-first UX). See `docs/VISION.md` and `docs/MODULES.md`.

## 2. Golden rules (non-negotiable)

1. **Read first.** At the start of every session read, in order:
   `docs/CURRENT_STATE.md` → `docs/DECISIONS.md` → `docs/OPEN_QUESTIONS.md` → `docs/ROADMAP.md` → the last entry of `docs/SESSION_LOG.md`.
2. **Never silently decide.** If a task touches a decision marked `OPEN` or `PROPOSED` in `docs/DECISIONS.md`, **stop and ask**. Give the options, the trade-offs, your lean, and **how confident you are (low/medium/high) and why**.
3. **New decisions become ADRs.** Anything not already covered (a library, file format, algorithm, unit convention, coordinate system, naming scheme for persisted data, a structural rule or threshold) → add an ADR with status `PROPOSED` → ask → implement only after it's `ACCEPTED`.
   - *Exempt (you may decide alone, but log it in SESSION_LOG):* private function/variable names, internal file organization within an accepted module, test helper code, formatting.
4. **No new dependency without an ADR.** That includes "small" npm/pip packages.
5. **Structural honesty.** The app must **never** say a design is "safe", "approved", "OK to build", or "structurally sound". Allowed wording: *"No issues detected by the N checks currently implemented. These checks are simplified and do not replace a licensed engineer."* See `docs/SAFETY_AND_LIABILITY.md`.
6. **Every structural rule, formula, or threshold must have:**
   - a stable rule ID (e.g. `R-OPEN-003`),
   - a cited source (code clause, textbook + page, or explicitly marked `UNSOURCED – placeholder`),
   - at least one unit test with a **hand-calculated** expected value, with the hand calculation written in the test or in `docs/STRUCTURAL_ANALYSIS.md`.
   An unsourced threshold must show as `UNVERIFIED` in the UI.
7. **Update the docs at the end of every session** (definition of done, below). If the session ran out of time, update the docs *first* and code second.
8. **Push back.** If a request contradicts `docs/GOALS.md` non-goals, expands scope, or adds risk listed in `docs/RISKS.md`, say so *before* doing it, and point to the doc.
9. **Small vertical slices.** Prefer a tiny feature that works end to end (model → command → view → test) over broad scaffolding.
10. **Determinism.** Analysis must give identical output for identical model input. No randomness, no reliance on object iteration order, no floating-point comparisons without tolerance.
11. **Module boundaries.** `packages/core` never imports a module or a UI framework. Modules never reach into another module's internals; they use declared dependencies. Built-in features (Architect) go through the same module API. See `docs/MODULES.md`.
12. **No platform plumbing ahead of features.** Don't build a plugin marketplace, runtime installer, sandbox, or public API before ADR-020 allows it. If you catch yourself building infrastructure no user-visible feature needs yet, stop and ask.
13. **Never drop unknown data silently.** Data from modules that aren't installed is only removed when the user explicitly chooses "remove" (ADR-032); until then it must survive save/load untouched.
14. **i18n from day 1.** No hard-coded user-facing strings; pt-BR + en (ADR-021 proposed).
15. **No standards text in the repo.** Code profiles store values + clause references only (ADR-014).
16. **Platform isolation.** No Tauri imports outside the platform adapter (ARCHITECTURE "Doubts").
17. **Engineer review gate.** Any structural rule above `info` severity stays `UNVERIFIED` until the owner's engineer contact has reviewed it; then it becomes `VERIFIED-UNSIGNED` (ADR-041: anonymous, informal, no ART — record "owner's engineer contact (anonymous, unsigned)" + date + question id in STRUCTURAL_ANALYSIS.md). A value the engineer gave from memory or marked "check" stays `UNVERIFIED`. Batch the review requests; don't block other work on them.
18. **Rules never block edits** (ADR-026). Only geometric impossibilities may be prevented or clamped (pending Q-072).
19. **Don't nag while the user is creating** (ADR-025). Never pop up, focus-steal, or show findings during an active gesture.
20. **Beginner-first wording.** Every user-visible term must be understandable by someone who has never used CAD (Q-050). Jargon goes behind "details" or a tooltip.
21. **Engineering doubts go to `docs/ENGINEER_QUESTIONS.md`**, not to the owner (they forward everything engineering-related to their engineer). Ask the owner only about product/UX/software.
22. **Sims as a reference, never a copy** (UX_PRINCIPLES.md): interaction ideas only; no assets, names, or UI copied.

## 3. Definition of done (for any task)

- [ ] Code works and has tests (domain + analysis logic: unit tests are mandatory; UI: at least a smoke test or a manual test script).
- [ ] No `OPEN` decision was implicitly decided.
- [ ] `docs/CURRENT_STATE.md` updated (what exists, what's broken, what's stubbed).
- [ ] `docs/SESSION_LOG.md` gets a new entry (what was done, decisions made, doubts raised, next step).
- [ ] New questions added to `docs/OPEN_QUESTIONS.md`; answered ones moved to "Resolved" with the answer.
- [ ] New risks added to `docs/RISKS.md`.
- [ ] If you made a structural rule: rule ID, source, hand-calc test, entry in `docs/STRUCTURAL_ANALYSIS.md`.

## 4. How to ask the owner a question

Use this format so the owner (a non-expert) can answer quickly:

```
DECISION NEEDED: <short title>  (blocks: <task>)
Context (plain language): ...
Options:
  A) ... — good: ... / bad: ...
  B) ... — good: ... / bad: ...
My lean: B. Confidence: medium. What would change my mind: ...
If you don't care, I'll use: <default>, and log it as PROPOSED (reversible).
```

## 5. Doc map

| File | What it holds |
|---|---|
| `docs/VISION.md` | What we're building and why. The "north star". |
| `docs/GOALS.md` | Goals, **non-goals**, measurable success criteria. |
| `docs/CURRENT_STATE.md` | What exists right now. Always truthful. |
| `docs/ROADMAP.md` | Phases, exit criteria, what could go wrong in each. |
| `docs/DECISIONS.md` | Decision log (ADRs). OPEN / PROPOSED / ACCEPTED / SUPERSEDED. |
| `docs/OPEN_QUESTIONS.md` | Every unanswered question and what it blocks. |
| `docs/RISKS.md` | Risk register: known flaws and threats to the project. |
| `docs/SAFETY_AND_LIABILITY.md` | What the app may and may not claim. Read before any analysis UI. |
| `docs/DOMAIN_PRIMER.md` | Structural engineering basics for a non-expert. |
| `docs/STRUCTURAL_ANALYSIS.md` | Analysis tiers, rule catalogue, formulas, validation cases. |
| `docs/DATA_MODEL.md` | Entities (Wall, Opening, Material…), invariants, IDs, units. |
| `docs/EDITING_OPERATIONS.md` | Exact meaning of move/copy/duplicate/mirror/delete, plus edge cases. |
| `docs/ARCHITECTURE.md` | Proposed technical architecture (TENTATIVE until ADRs are accepted). |
| `docs/UX_PRINCIPLES.md` | Sims-inspired build mode: what to borrow, what not; wall kinds; rooms. |
| `docs/ENGINEER_QUESTIONS.md` | Batched questions for the owner's engineer contact, with answers. |
| `docs/MODULES.md` | The Visions/modules system: extension points, manifest, rules, open problems. |
| `docs/TESTING_STRATEGY.md` | How we know things are correct. |
| `docs/ALTERNATIVES.md` | Existing tools. Build vs extend. |
| `docs/GLOSSARY.md` | Terms. |
| `docs/SESSION_LOG.md` | Append-only log of every work session. |
