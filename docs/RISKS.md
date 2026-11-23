# RISK REGISTER

Likelihood (L) and Impact (I): 1 (low) – 5 (high). Score = L × I. Review at the start of every phase.

| ID | Risk / flaw | L | I | Score | Mitigation | Owner/status |
|---|---|---|---|---|---|---|
| R-01 | **Nobody qualified verifies the structural logic.** The AI writes it and a non-expert reviews it. Plausible-looking wrong math will get through. | 5 | 5 | **25** | Hand-calculated test cases from textbooks; every value tagged with a source or `UNVERIFIED`; try to get one review from an engineer (Q-005); keep tiers simple (ADR-005). | Open |
| R-02 | **Wrong input classification** (bearing vs non-bearing wall, span direction). Every downstream check is then wrong while still looking authoritative. | 5 | 5 | **25** | ADR-017 option C: infer + show + flag overrides; display "assumptions used" in every finding. | Open |
| R-03 | **False sense of safety.** The user (or someone they share it with) treats "no findings" as "safe to build". | 4 | 5 | **20** | Wording rules (CLAUDE.md §5), permanent disclaimer, no green "PASS" state, banned-words test (G-8). | Open |
| R-04 | **Bad material data** (internet values, wrong units, characteristic vs design values confused). | 4 | 4 | 16 | Per-value source + confidence; unit-tagged values; explicitly distinguish characteristic vs design values and say which safety factors apply. | Open |
| R-05 | **Simplifications hide real failure modes**: no foundations, no lateral loads, no connections, no cracking, no long-term creep, no construction stages. | 5 | 3 | 15 | "What this check does NOT consider" section on every rule; a global "Out of scope" panel. | Open |
| R-06 | **Scope explosion.** "Just add roofs / 3D editing / stairs / BIM import…" | 5 | 4 | **20** | Non-goals list; phase exit criteria; the AI must push back (CLAUDE.md rule 8). | Open |
| R-07 | **Geometry edge cases eat the schedule** (wall joins, curved walls, overlapping walls, tiny segments, float drift). | 5 | 3 | 15 | Spike A; no curved walls in v1; tolerances (ADR-006); property-based tests. | Open |
| R-08 | **AI session drift**: each session makes slightly different conventions; the docs go stale; decisions get made silently. | 4 | 4 | 16 | CLAUDE.md rules; SESSION_LOG; DoD checklist; owner spot-checks DECISIONS.md. | Open |
| R-09 | **Code thresholds vary by country/system**, so a rule that's right for one place is wrong for another. | 4 | 3 | 12 | Code profiles (ADR-009); show the profile name on every finding. | Open |
| R-10 | **Copyrighted standards**: copying ABNT/ACI/Eurocode text into the repo. | 2 | 3 | 6 | Cite clause numbers only, paraphrase; never paste standard text. | Open |
| R-11 | **Alarm fatigue**: too many warnings, so users ignore them all. | 4 | 3 | 12 | Severity levels, grouping, "only show new findings from my last change" mode. | Open |
| R-12 | **False precision**: showing 4 decimals implies accuracy. | 4 | 2 | 8 | Round; show ranges/utilization bands; show the confidence level. | Open |
| R-13 | **Undo/redo corruption** from mutable state. | 3 | 4 | 12 | Immutable model + commands (ADR-011), plus a property test: random ops then undo-all gives the original model. | Open |
| R-14 | **File format lock-in / broken old files.** | 3 | 3 | 9 | `schemaVersion` + migrations + fixture files from every version kept in tests. | Open |
| R-15 | **Performance degrades** as rules multiply (every edit re-runs everything). | 3 | 3 | 9 | Pure rules, memoization per element, Web Worker, budget in G-5. | Open |
| R-16 | **Owner burnout from too many questions** (ironically, this doc set). | 3 | 4 | 12 | Defaults for every question; batches; only 🔴 ones must be answered upfront. | Open |
| R-17 | **Building something that already exists.** | 3 | 3 | 9 | ALTERNATIVES.md research + Spike C before Phase 1. | Open |
| R-18 | **Mirror/copy creating structurally different things silently** (e.g. mirroring a layout where bearing walls no longer line up with slabs). | 3 | 3 | 9 | Re-run analysis after every op (it already does); findings diff makes it visible. | Open |
| R-19 | **The AI hallucinates a library, API, or standard clause.** | 3 | 4 | 12 | No dependency without an ADR, plus verify the package exists and is maintained; clause citations marked "to verify" until checked. | Open |
| R-20 | **Swapping materials across systems** (masonry ↔ timber ↔ concrete) gives meaningless results because the rules for one system are applied to another. | 4 | 4 | 16 | Materials belong to systems; incompatible swaps are blocked or loudly flagged (Q-015). | Open |

### Added in session #1 (after the modular / open-source / BR+EU answers)

| ID | Risk / flaw | L | I | Score | Mitigation | Owner/status |
|---|---|---|---|---|---|---|
| R-21 | **Premature plugin API**: designing a public module API before real modules exist leads to the wrong abstractions and breaking changes for contributors. | 5 | 4 | **20** | ADR-020: internal API, bundled modules, public only after 3 modules. Architect is built *as* a module. **2026-11-23:** condition met (3 modules on the same hooks); owner made it public (ADR-020 revision 2), versioned 1.0 from publication. | Open |
| R-22 | **"Platform" scope trap**: building module infrastructure (registry, marketplace, sandbox) instead of features. | 4 | 4 | 16 | Phase exit criteria are user-visible features, never "infrastructure done". No marketplace/sandbox before ADR-020 says so. | Open |
| R-23 | **"EU" isn't one ruleset**: National Annexes differ per country. | 5 | 3 | 15 | Label the profile "EN recommended values"; Q-051. | Open |
| R-24 | **Code profile abstraction biased to one code style** (BR vs EN load combinations and material classes differ). | 4 | 3 | 12 | Design the profile interface against both from day 1; write one validation case per profile. | Open |
| R-25 | **Three WebView engines** (WebView2 / WKWebView / WebKitGTK): rendering and performance differences, especially Linux + 3D. | 4 | 3 | 12 | Spike D on all 3 OS; CI builds for all 3; platform adapter so Electron stays a fallback. | Open |
| R-26 | **Unsigned installers** scare beginners ("for everyone" fails at install). | 4 | 3 | 12 | Q-057; clear install docs; signing before public release. | Open |
| R-27 | **Community-contributed rules are wrong** but look official. | 3 | 5 | 15 | Q-066 gate: source + validation case + review; a `community/unreviewed` badge in the UI. | Open |
| R-28 | **Open source raises liability visibility**: strangers will use it for real buildings regardless of intent. | 3 | 4 | 12 | Apache-2.0 "AS IS" clause, in-app disclaimer, no "pass" states (SAFETY doc). | Open |
| R-29 | **Cross-module data loss**: opening a project without a module drops its data on save. | 3 | 4 | 12 | MODULES rule 3 (preserve unknown components) + a round-trip test with a fake unknown module. | Open |
| R-30 | **Hobby-project sustainability**: a large modular vision vs limited free time. | 4 | 4 | 16 | Q-007; small vertical slices; every phase ends with something usable and shareable. | Open |

### Added / changed in session #2

| ID | Risk / flaw | L | I | Score | Mitigation | Status |
|---|---|---|---|---|---|---|
| R-25 | (rescored) WebView differences | 3 | 2 | 6 | Linux deferred (ADR-027); only WebView2 + WKWebView for v1. | Reduced |
| R-26 | Unsigned installers | — | — | — | **Accepted by owner** for now. README must explain the "unidentified developer" / SmartScreen bypass steps for beginners. | Accepted |
| R-31 | **Public on day 1 with unreviewed rules**: early visitors see `UNVERIFIED` structural claims. | 3 | 3 | 9 | UNVERIFIED badges, a README banner, CONTRIBUTING gate. | Open |
| R-32 | **"Am I following the rules?" read as compliance**, especially once country packs exist. | 4 | 4 | 16 | Wording: "matches N checks in profile X (v.Y)"; never "compliant". Profile version shown. | Open |
| R-33 | **Feedback timing gets it wrong**: either nags while drawing (owner's concern) or hides problems too long. | 4 | 3 | 12 | ADR-025; tune settle delay with real use; quick setting. | Open |
| R-34 | **Beginner persona vs. CAD precision**: a no-CAD user can't draw accurately → messy geometry (tiny gaps, near-overlaps) → bogus findings. | 4 | 4 | 16 | Aggressive snapping, room tool (Q-079), auto-heal small gaps with a tolerance, "draft" state. | Open |
| R-35 | **Municipal-level codes** (Architect rules, Q-078) multiply profiles: country → state → city. | 3 | 3 | 9 | Hierarchical profiles with inheritance; out of v1. | Open |

### Added in session #3

| ID | Risk / flaw | L | I | Score | Mitigation | Status |
|---|---|---|---|---|---|---|
| R-36 | **Sims-like scope creep**: furniture, roofs, stairs, terrain, paint catalogues… each "small" Sims feature is big. | 5 | 4 | **20** | Non-goals + Q-096/097/098 defaults; Phase 1 = rooms, walls, openings, finishes only. | Open |
| R-37 | **Handoff divergence**: architect and engineer edit separate copies → conflicting files, lost work. | 4 | 4 | 16 | Sequential turns + handoff banner + compare view (ADR-029, Q-091). | Open |
| R-38 | **Finish vs structural material confusion** (Q-090) in UI or data. | 4 | 3 | 12 | Separate fields and owners; the Architect Vision never shows structural materials. | Open |
| R-39 | **Room identity across edits** (splits/merges lose room names and finishes). | 4 | 2 | 8 | Seed-point matching (DATA_MODEL); tests for split/merge. | Open |
| R-40 | **Crash reports leak project data** (file paths, element names). | 2 | 4 | 8 | Opt-in, scrubbing, a test with a fake path in the stack. | Open |
| R-41 | **Name/trademark collision** after going public. | 3 | 2 | 6 | Availability check before choosing (ADR-016). | Open |
| R-42 | **Pack ecosystem quality**: city/state packs written by anyone with wrong values. | 4 | 4 | 16 | Packs show their author + review status; curated repo with the review gate; values shown with their source pack. | Open |
| R-43 | **UX inspired by a commercial game**: legal trouble if visual assets, names, or UI are copied. | 2 | 3 | 6 | Interaction ideas only; own art/icons/names (UX_PRINCIPLES header). | Open |

### Added in session #4

| ID | Risk / flaw | L | I | Score | Mitigation | Status |
|---|---|---|---|---|---|---|
| R-44 | **Name collision: an existing commercial "Prumo" construction app** (remodeling estimating). Same industry. | 4 | 3 | 12 | Codename only; trademark check before release (Q-109). | Open |
| R-45 | **The "baton" is only a convention**: copies of the file can still diverge. | 3 | 3 | 9 | Holder banner, "Take over" logged, compare view to spot divergence. | Open |
| R-46 | **Project files grow large** with embedded snapshots. | 3 | 2 | 6 | Delta snapshots or pruning (Q-104). | Open |

| R-47 | **Receiver deletes another person's module data** ("remove items" on a missing module) and sends the file back. | 3 | 4 | 12 | Second confirmation, item list, automatic snapshot, read-only option (Q-122). | Open |
| R-48 | **Terminology drift**: module / plugin / data pack / Vision used inconsistently in UI, code, and docs. | 4 | 2 | 8 | GLOSSARY as the single source; resolve Q-121. | Open |

| R-49 | **Optional downloadable modules = platform plumbing** (dynamic loading, integrity, version matching), the R-22 trap through another door. | 4 | 4 | 16 | Staged: Stage 1 = bundled but not loaded; Stage 2 only after a 3rd module (Q-127). | Open |
| R-50 | **Skeleton vs Architect split wrong**: if core vs Architect is drawn wrong, other modules depend on Architect anyway. | 3 | 4 | 12 | Q-128; test "Electrical-only install" as a scenario in Spike E. | Open |
| R-51 | **Recovery copies pile up forever** (never deleted by time). | 2 | 2 | 4 | Show them on the start screen with a discard button. | Open |

### Added in session #11 (spikes)

| ID | Risk / flaw | L | I | Score | Mitigation | Status |
|---|---|---|---|---|---|---|
| R-52 | **Windows performance unknown.** All Spike D numbers come from a fast Apple Silicon Mac; WebView2 on a low-end Windows laptop could be much slower. | 3 | 4 | 12 | Run the CI-built installer + bench on a real (ideally modest) Windows PC before Phase 1. | Open |
| R-53 | **Module write isolation is convention only.** A first-party module can mutate another module's namespace by hand; TS can't stop it in-process. | 3 | 3 | 9 | Module context API + lint/boundary checks + review; real isolation only with ADR-023 sandboxing. | Open |
| R-54 | **Snapshots hold data from removed/uninstalled modules.** The missing-module dialog counts only the live model, so old snapshots silently carry (and on export, could leak) another module's data. Snapshots are also not migrated on open. | 3 | 3 | 9 | Export strips excluded modules from snapshots too (done in spike); compare view migrates snapshot data lazily; Q-131. | Open |
| R-56 | **i18n grammar agreement**: messages with element-name params read wrong when gender/number changes (pt-BR "a porta" vs "o portão"). Spike B works only because parede/janela/porta are all feminine. | 4 | 2 | 8 | ICU-style `select` on element gender, or one key per element kind; catalogue parity test covers slots, add a gender test. ADR-021 note. | Open |
| R-57 | **Finding noise**: one card per element repeats near-identical text (Spike B: 2 cards, real house: dozens). Beginners stop reading (ties to ADR-025). | 4 | 3 | 12 | Group by rule (Q-135); summary line first; badges on elements. | Open |
| R-55 | **Local toolchain drift**: Node 20.11 here caps Vite at 6.x (Vite 7+ needs ≥ 20.19). | 3 | 2 | 6 | Pin Node in `.nvmrc`/CI when the real monorepo starts. **Done s#11**: `.nvmrc` 22, `engines` ≥ 22.12, `engine-strict`; Node 22.23.5 installed user-locally. Owner's global Node still 20.11. | Mitigated |
| R-58 | **TypeScript 7 lag**: TS 7 (native compiler) is out but typescript-eslint supports `<6.1`, so we're on TS 6.0. Staying behind too long makes the jump bigger. | 3 | 2 | 6 | Re-check each Phase; upgrade when typescript-eslint and vue-tsc support TS 7. | Open |
| R-59 | **Zip timestamps are local time**: fflate writes DOS local time, which would make saved bytes depend on the machine's timezone. | 2 | 3 | 6 | Fixed date built from local components + golden SHA-256 test run on Linux/Windows/macOS in CI; verified locally in 4 timezones. | Mitigated |
| R-60 | **Add-on code reaching the computer**: an installed add-on (approved or not) running inside the app's webview could call Tauri's file / dialog commands and read or change the user's files. | 5 | 3 | 15 | ADR-023: every installed add-on runs sandboxed with messages only; Spike F (2026-11-23): blob Web Worker shown to reach no IPC, files or network on WebView2 + WKWebView; a worker served from the app's origin is NOT safe, so add-on code is only ever loaded as a blob. A test in CI keeps re-checking this when Tauri or the policy changes (to add with the real loader). Approval tag is per version + hash. | Open |

R-07 (geometry eats the schedule) → **reduced by Spike A**: L/T/X/Y joins at any angle work in ~250 lines; L 5 → 4 (score 12). The remaining traps are listed in CURRENT_STATE (unequal thickness near-straight, short walls, X overlap).

R-50 (skeleton vs Architect split) → **reduced**: Spike E's Electrical-only scenario works with no Architect module (L 3 → 2).

R-46 (file growth) → owner confirmed the concern; mitigation in Q-124 (accepted).
R-37 (handoff divergence) → reduced by the owner's no-parallel-edits decision: L 4 → 3.

**Update to R-01** (2026-11-15, session #2): the engineer has unlimited availability, so review is mandatory for rules above "info". Likelihood 4 → 3. Score 15.

**Update to R-01** (2026-11-15): the owner knows an engineer (Q-005), so likelihood drops from 5 to 4 **if** the reviews actually happen (Q-068). Score 20.
**Update to R-10** (2026-11-15): open source makes copying standards text a public problem. Impact 3 → 4.

## Things I'm most worried about (planning session's honest ranking)

1. **R-01 + R-02 together.** The core promise ("know the flaws") depends on modelling the structure correctly *and* computing correctly, and neither the owner nor the AI is a qualified checker. This doesn't kill the project, but it means the app has to be a *learning tool with explicit assumptions*, never an oracle.
2. **R-06 scope.** The request ("walls, doors, windows, materials, structural integrity, mirror, copy…") is already the size of a commercial product. The roadmap only works if each phase actually ends.
3. **R-07 geometry.** Unglamorous, but it's where CAD-like projects quietly die.
4. **(session #1) R-21/R-22, the platform trap.** "Modular, for everyone, many Visions" makes it very tempting to build the plugin framework first. For a senior SWE this is the *fun* part, which is exactly why it's dangerous. Ship the Architect + Structural Visions with a boring internal API first.
