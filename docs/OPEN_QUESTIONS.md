# OPEN QUESTIONS

Legend: 🔴 blocking (nothing meaningful can start) · 🟠 blocks a specific phase · 🟡 can wait
Each question has a **default**. If the owner says "I don't care", the default is used and logged as PROPOSED.
The owner **wants questions to keep coming** every session; they enrich the docs. AI sessions: add new questions as you discover them.

When answered: move to **Resolved** at the bottom with the answer, date, and the ADR it fed.

---

## ⚙️ Status after session #10: no more question rounds before building

The owner asked when building can start. Answer: **now.** Every remaining question below has a default, and **the default is applied** unless the owner objects. They're no longer "asked"; they're **defaults on record**. Future sessions: follow the questioning rule in CLAUDE.md §1, and only add a question here if it's new, consequential, and genuinely ambiguous.

### New in session #11 (from the spikes)

- **Q-130 🟠** Who can run the Windows build on a real Windows PC to measure startup + smoothness? (Blocks closing Spike D for Windows.) Default: the owner, on any Windows machine they can borrow.
- **Q-131 🟡** Snapshots containing a removed/uninstalled module's data: default = keep them untouched (they're the recovery path) and don't count them in the missing-module dialog; export strips them per module selection. Reversible.
- **Q-132 🟡** Missing-module dialog wording when a module only *adds data* to walls (Architect finishes): "Remove 42 items" sounds like walls get deleted. Default: "Remove Architect data from 42 items (the walls stay)". Reversible.

- **Q-133 🟡** When a half wall (or fence) touches a full wall, should the plan draw them as **one merged shape** (no line between them) or keep a line to show they're different? Default (Spike A): merged outline, different fill colour per kind. Reversible.
- **Q-134 ✅ (outside: ADR-038; inside: left as is)** Two walls of **different thickness** meeting almost in a straight line: today the corner cuts a small wedge off the thicker wall. Default for Phase 1: show a simple step (thick wall ends square, thin wall continues), implemented when the real editor is built. Reversible.
  - **Update 2026-11-16 (not implemented, confidence too low to do it alone):** measured with the seeded property test: 7/30 random mixed-thickness junctions lose a little wall area at the corner, and only 4 of them are 2-wall "nearly straight" (5°–35° off straight); 3 are 3–4-wall junctions. Square ends for both walls are exact only at exactly 180°; at any other angle they overlap on the inside of the bend and leave a notch outside, so "a simple step" needs an angle limit we'd have to invent. Options: **A)** step only for exactly-straight (±1°) continuations, keep miters elsewhere — tiny, safe; **B)** a general fix (clip each wall polygon by its neighbours — a real polygon boolean) — correct everywhere, bigger, maybe a library (ADR-012 says "library when areas need it"); **C)** leave as is (visual only; room areas use inner faces, unaffected). Lean: A now, B when quantities (Phase 3+) need exact wall areas. Confidence: medium.
  - **Owner input 2026-11-17:** junctions **inside** the building (e.g. a divider, drywall/premade wall) may stay mismatched — that's fine visually (structure aside). Junctions on the **outside** should line up the **outside faces**, so the wall end shows no gap/step on the outside. And it could be a **setting** so the user decides. Note: walls already have `alignment` (centre / left face / right face), so "outer faces flush" can be expressed in today's model. Still to settle (asked): how "outside" is known (the side that faces no room — only known once rooms close), whether lining up **moves** the thinner wall (changes the inner face → room area) or only changes how the corner is drawn, and whether the setting is per project or per app. **Owner 2026-11-17:** "outside" = the outside of a **block** (a connected group of walls), even when that block sits inside another one — i.e. the outer boundary of each connected wall group; **option A** (real geometry, not only the drawing); setting lives in a settings area. Mechanism still being confirmed (how the outer face is kept: see the follow-up in SESSION_LOG part 23).
- **Q-138 🟡** App menu bar (owner 2026-11-17: "like every single app": File, Tools/Toolbox, Settings, later Modules/Plugins). Not now; needed before module install exists (ADR-020 still bundles modules). Default: native OS menu (macOS top bar / Windows window menu) via Tauri's menu API when it comes, mirrored by the toolbar for beginners. Reversible.
- **Q-137 🟡** Language vs country (ADR-034): construction words are local (*verga*, *cinta*), so should a project's country profile drive the language? Default: **UI language = user's choice** (any shipped language works with any profile); the profile **suggests** the default language for new projects; when UI language ≠ profile language, local terms appear in brackets ("lintel (verga)"). Nothing is excluded. Reversible.

### Defaults on record (from earlier rounds)

- **Q-089 🟡** 3D walls up/cutaway/down toggle? Default: yes, Phase 4.
- **Q-092 🟠** Identity = a local display name, no accounts? Default: yes.
- **Q-093 🟠** Notes on elements in Phase 2? Default: yes.
- **Q-097 🟡** Stairs/multi-floor: Phase 5.
- **Q-098 🟡** Roofs: flat roof = slab until later.
- **Q-100 🟡** Curved walls: not v1.
- **Q-101 🟡** Pack publishing: import-from-file + a curated packs repo.

### Defaults on record (round 3)

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

- **Q-095** — v1 crash reporting = local log + "Report on GitHub" (owner: "easy and direct"). Implemented; browser opening waits for ADR-039. — 2026-11-17

- **Q-134** — Outside junctions: outside walls are drawn by their outside face (ADR-038, project setting, on for new projects). Inside junctions: mismatch is fine (owner). — 2026-11-17

- **Q-135** — Same check on many elements → **one card per rule listing the elements** (expandable per element); badges stay on each element. — 2026-11-16 (owner: defaults fine) — R-57
- **Q-136** — Default assumptions (e.g. wall treated as load-bearing because unmarked) → **shown up front on the card**, same severity, plus a one-click "mark this wall" action. Severity question still goes to the engineer (E-07). — 2026-11-16 (owner: defaults fine)
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
- **Q-111** — Autosave: yes. — 2026-11-15 — ROADMAP Phase 1
- **Q-112** — Snapshots as full copies (option A); the owner notes the file will keep growing → Q-124. — 2026-11-15 — ADR-008
- **Q-113** — A missing module **stops the user**: install it, or remove that module's items. When exporting, show the modules used and allow removing them from the copy. Modules = big, install-if-you-want; plugins = smaller (languages, external compatibility). — 2026-11-15 — ADR-032, MODULES §6–8
- **Q-119** — Start blank, plus **several pre-made example projects** to see and work with. — 2026-11-15 — ROADMAP, Q-125
- **Q-120** — Light/dark themes following the OS: yes. — 2026-11-15 — ROADMAP
- **Q-123** — Modules must be **real optional installs**: each role only gets what its work needs (an electrical engineer doesn't need wall colours), and the app gets lighter. — 2026-11-15 — ADR-020 revision (PROPOSED, staged → Q-127), MODULES §9
- **Q-124** — OK: warning + manual deletion + "export a clean copy" + optional "keep last N". — 2026-11-15 — ADR-008
- **Q-125** — House, apartment, "house with problems", **plus clean ("perfect") reference examples**. — 2026-11-15 — ROADMAP (wording: "no warnings from current checks", never "perfect/safe")
- **Q-126** — Don't delete recovery copies after a crash by time; only when that change is resolved. — 2026-11-15 — ROADMAP; confirm → Q-129
- **Q-127** — Staged optional modules (stage 1: bundled but not loaded; stage 2: real downloads): yes. — 2026-11-15 — ADR-020 revision ACCEPTED
- **Q-128** — Same core for everyone: the basic building (blueprint/walls/floor…), no colours, no furniture. — 2026-11-15 — MODULES §9
- **Q-129** — Yes: recovery copies are removed only when resolved (recovered/saved/discarded). — 2026-11-15 — ROADMAP
- **Q-121** — Yes: users see only "Modules" and "Plugins". — 2026-11-15 — MODULES §6
- **Q-122** — No read-only option: install the module or remove its items. — 2026-11-15 — ADR-032

