# OPEN QUESTIONS

Legend: 🔴 blocking (nothing meaningful can start) · 🟠 blocks a specific phase · 🟡 can wait
Each question has a **default**. If the owner says "I don't care", the default is used and logged as PROPOSED.
The owner **wants questions to keep coming** every session; they enrich the docs. AI sessions: add new questions as you discover them.

When answered: move to **Resolved** at the bottom with the answer, date, and the ADR it fed.

---

## Round 6 — raised in session #6

### Files & saving

**Q-111 🟠 Autosave + crash recovery?** Beginners lose work. Proposal: autosave to a recovery file every ~30 s and on Vision switch; offer "Recover unsaved work?" after a crash. Not the same as the named snapshots (Q-104). Default: yes, Phase 1.

**Q-112 🟡 Snapshot storage:** full copies (simple, files grow) or deltas (small, complex)? Default: full copies, compressed inside the zip, with a warning when the file passes ~50 MB.

**Q-113 🟡 Opening a file from a newer app version, or one that uses modules you don't have:** open read-only with a banner (default), open and risk it, or refuse?

### Beginner details

**Q-119 🟡 Starter template content:** an empty lot, a small 2-bedroom house, or an apartment? Default: one small 2-bedroom house + empty.

**Q-120 🟡 Dark mode / themes?** Default: light + dark following the OS.

### Still open from round 4

- **Q-089 🟡** 3D walls up/cutaway/down toggle? Default: yes, Phase 4.
- **Q-092 🟠** Identity = a local display name, no accounts? Default: yes.
- **Q-093 🟠** Notes on elements in Phase 2? Default: yes.
- **Q-095 🟡** v1 crash reporting = local log + "Report on GitHub"? Default: yes.
- **Q-097 🟡** Stairs/multi-floor: Phase 5.
- **Q-098 🟡** Roofs: flat roof = slab until later.
- **Q-100 🟡** Curved walls: not v1.
- **Q-101 🟡** Pack publishing: import-from-file + a curated packs repo.

### Still open from round 3

- **Q-072 🟠** Geometric impossibilities: block/clamp (default) or allow with a model-error marker?
- **Q-073 🟠** When is an element "settled" for checks? Default: gesture ended + 1.5 s idle; open chains = draft.
- **Q-075 🟡** Unofficial Linux CI build? Default: yes, build-only.
- **Q-080 🟠** Starter template + skippable guided tour in Phase 1? Default: yes.
- **Q-081 🟡** Type exact measurements while drawing? Default: yes, inline input.
- **Q-082 🟡** Setting to hide engineering alerts in the Architect Vision? Default: on for criticals only.
- **Q-084 🟡** Repo hygiene: CONTRIBUTING (done) + Code of Conduct + issue templates? Default: yes.
- **Q-086 🟡** Engineer publicly credited? → moved to ENGINEER_QUESTIONS E-30.

### Leftover from earlier rounds (with defaults)

- **Q-006 🟡** Success in 3 months / 1 year? Default: in 3 months, Architect Vision + Structural Vision (masonry, Brazil) with ~8 explained rules, on Windows + macOS.
- **Q-007 🟠** Hours per week? Solo?
- **Q-009 🟡** Delegate low-risk reversible decisions to the AI? Default: you approve everything in Phases 0–1.
- **Q-013 🟠** Opening = rectangular wall openings with a `kind` tag; slab openings later.
- **Q-014 🟠** Elements beyond walls/openings: slabs (span direction), columns, beams; roof = slab for now.
- **Q-015 🟠** Materials: swap within a system + layered walls; the system is a project-level setting.
- **Q-016 🟠** Feedback style: warnings first; utilization % in Phase 3; heatmaps later.
- **Q-017 🟡** Lateral loads: rule-of-thumb bracing only.
- **Q-018 🟡** Suggest fixes or only flag? Default: flag + generic advice.
- **Q-019 🟡** Renovation/compare mode? Default: later (maybe its own Vision).
- **Q-020 🟡** Warn when a bearing wall moves off its footprint? Default: yes.
- **Q-021 🟠** Mirror flips door handing? Default: yes.
- **Q-022 🟠** Moving a wall stretches joined walls? Default: yes.
- **Q-023 🟠** Deleting a wall deletes its openings? Default: yes.
- **Q-024 🟡** Cross-project copy/paste? Default: later.
- **Q-025 🟡** Shortcuts: Figma-like + command palette (fits the persona).
- **Q-026 🟡** Parametric constraints? Default: no.
- **Q-030 🟠** Material data sources: engineer contact + textbook values with source/confidence.
- **Q-031 🟡** Access to ABNT standards? (The engineer may have it.)
- **Q-033 🟡** Masonry arching over openings: conservative method first.
- **Q-053 🟡** Cross-module rules: architecture supports them; none until a 3rd Vision.
- **Q-059 🟡** UI term: "Vision" (default).
- **Q-060 🟡** Web build: later, maybe a demo.
- **Q-061 🟡** Languages: pt-BR + en.
- **Q-062 🟡** Imperial units: not in v1, formatter-ready.
- **Q-063 🟡** Auto-update: later.
- **Q-064 🟡** Min OS versions: whatever Tauri 2 supports for Win/macOS.
- **Q-067 🟡** Third Vision: Electrical.
- **Q-070 🟡** Which codes/systems does the engineer know best?

---

## Resolved

- **Q-001** — For the owner first, but **open source, modular, beginner-friendly, for everyone**; multiple Visions. — 2026-11-15 — VISION, ADR-019, ADR-014
- **Q-002** — Senior SWE (.NET, Angular/Vue; Rust/C#/Python/WPF/Flutter/Tauri 2). Easiest cross-platform install. — 2026-11-15 — ADR-001/002
- **Q-003** — Not real engineering now; basics are enough. — 2026-11-15 — SAFETY tone
- **Q-004** — Open source. — 2026-11-15 — ADR-014
- **Q-005** — Knows an engineer. — 2026-11-15 — R-01
- **Q-010** — Switchable; engineering in a module. — 2026-11-15 — ADR-004
- **Q-011** — Brazil + EU → *revised in session #2:* Brazil only for v1; EU and other countries later as rule-pack plugins. — ADR-009
- **Q-050** — Primary v1 user: **someone who has never used CAD or any schematics software.** — 2026-11-15 — VISION, ADR-025, Q-079
- **Q-054** — Not needed in general, but **critical** issues should surface as a warning in other Visions, and it must not be annoying while you're still creating (e.g. mid-way through connecting walls). — 2026-11-15 — ADR-025 (PROPOSED)
- **Q-055** — Structural masonry first; other systems welcome later (owner mentioned "grid" → Q-071). — 2026-11-15 — ADR-004
- **Q-056** — Stack OK (Tauri 2 + Vue 3 + TS). Prefer anything that works everywhere; open to a better framework. — 2026-11-15 — ADR-001/002 ACCEPTED
- **Q-057** — No signing for now; sign later when possible. — 2026-11-15 — ADR-014, R-26 accepted
- **Q-058** — Apache-2.0. — 2026-11-15 — ADR-014
- **Q-065** — Public repo from day 1. — 2026-11-15 — ADR-014, CONTRIBUTING.md
- **Q-066** — Yes (owner agreed 100%): community rules need source + validation case + review. — 2026-11-15 — CONTRIBUTING.md
- **Q-068** — The engineer can give as much time as needed. *(Why it was asked: to decide how many mandatory review gates to plan. With unlimited availability, **engineer review becomes mandatory for every rule above "info" severity**.)* — 2026-11-15 — CLAUDE.md rule 17
- **Q-051** — Parked: EU deferred. — 2026-11-15 — ADR-009
- **Linux** — Deferred; v1 = Windows + macOS. — 2026-11-15 — ADR-027
- **Q-071** — "Grid" meant the **drawing/snapping grid** (the owner had understood "scheme"), not a construction system. — 2026-11-15 — ADR-031, ADR-004
- **Q-079** — **Both** room tool and wall tool, Sims-inspired; rooms must be closed; half walls, fences, etc. are fine unclosed. The Sims is a reference, but without its limits (fixed angles/sizes). — 2026-11-15 — ADR-031, UX_PRINCIPLES
- **Q-076** — **Different people hand the file back and forth** (architect ↔ engineer). — 2026-11-15 — ADR-029
- **Q-077** — Option (b): allowed, leaves a critical marker. — 2026-11-15 — ADR-029
- **Q-078** — Yes, Architect-side rules exist, but **not in the core**: as plugins anyone can write (city, state, country). — 2026-11-15 — ADR-030
- **Q-083** — No name yet; ideas: Rustitect, Archirust. — 2026-11-15 — ADR-016, Q-099
- **Q-085** — Telemetry not needed now, but error/crash reporting is wanted. — 2026-11-15 — ADR-028
- **Engineering doubts** — Everything engineering-related gets passed to the owner's engineer contact. — 2026-11-15 — ENGINEER_QUESTIONS.md
- **Q-090** — Accepted: wall = structural **core** (Structural Vision) + **finish** layers (Architect Vision). — 2026-11-15 — DATA_MODEL, ADR-031
- **Q-091** — **No parallel edits.** "Like two devs on the same issue: a mess." Sequential "baton" model. — 2026-11-15 — ADR-029. Follow-up Q-102
- **Q-094** — Yes: data packs (open early) vs code modules (internal until 3 modules). — 2026-11-15 — ADR-030 ACCEPTED
- **Q-087** — Snapping defaults OK (10 cm, 15°, Alt = free), but users must be told clearly how to change them. — 2026-11-15 — ADR-031, Q-108
- **Q-088** — Half walls **can** close a room (e.g. a kitchen divider). — 2026-11-15 — UX_PRINCIPLES. Follow-up Q-106
- **Q-099** — Name: owner likes **Prumo**. — 2026-11-15 — ADR-016 (codename; collision → Q-109)
- **Q-102** — No. The non-holder can't keep working during a handoff. (The owner reconsidered the earlier nuance.) — 2026-11-15 — ADR-029
- **Q-103** — The app does nothing about transport; the file travels however people like. Build features later if needed. — 2026-11-15 — ADR-029
- **Q-104** — Named snapshots inside the project file: yes. — 2026-11-15 — DATA_MODEL
- **Q-105** — Single zip-container file, `.prumo` for now; the extension may change with the name. — 2026-11-15 — ADR-008, Q-110
- **Q-107** — Room types: yes. — 2026-11-15 — DATA_MODEL, Q-114/115
- **Q-106** — Fences/railings do **not** close rooms. — 2026-11-15 — UX_PRINCIPLES
- **Q-108** — Both: a user default + a per-project override. — 2026-11-15 — UX_PRINCIPLES §3b
- **Q-110** — Keep `.prumo` even if the name changes. — 2026-11-15 — ADR-008
- **Q-114/115** — The default room-type list is OK; add more gradually (packs/users can extend). — 2026-11-15 — DATA_MODEL
- **Q-116** — Numbers follow the **UI language's format**, for display *and* input (pt-BR: `3,50`; en: `3.50`). Side benefit: no ambiguity for `1.000` (one thousand in pt-BR, one in en). — 2026-11-15 — ADR-021
- **Q-117** — Floor names follow the UI language by default and are customizable. Same principle for every locale-dependent default (room-type names, units display). — 2026-11-15 — ADR-021
- **Q-118** — Image/PDF export only through a dedicated **rendering/export module**, not in the core. To refine later. Not in Phase 1. — 2026-11-15 — ADR-019, ROADMAP

