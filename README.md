# Prumo (codename — final name pending, see ADR-016 / Q-109)

An **open-source, cross-platform, modular** building-plan editor for beginners. Draw rooms, walls, doors and windows in the **Architect** view, then turn on other **modules** (today: **Structural** and **Electrical**) to see, with plain explanations, what your changes might mean.

> ⚠️ **Early development.** Usable, but not released. What works and what is stubbed: `docs/CURRENT_STATE.md`.
> ⚠️ A learning/exploration tool. It does **not** replace a licensed engineer, and it never says a design is safe or approved. See `docs/SAFETY_AND_LIABILITY.md`.

## What it does today

- **Plan editor (Architect):** room and wall tools (any angle, snapping, clean wall joins), doors / windows / openings, room dividers, room names and types, finishes, multiple floors, select / move / rotate / mirror / copy / paste / duplicate, undo / redo, dimensions, north direction.
- **3D view:** side by side with the plan or on its own, with door leaves, frames and sun direction.
- **Structural module:** which walls carry load, slabs, wall chases, what's above each room, 9 simplified checks with explanation cards, load estimates down the floors, lintel check. All values are marked **UNVERIFIED** until an engineer reviews them.
- **Electrical module:** outlets, switches, ceiling lights, switch → light links, minimum counts per room, circuits with estimated loads (NBR 5410 values, UNVERIFIED).
- **Export:** PNG / PDF sheets (A4 / A3, scale, title block, north arrow, check marks, module symbols).
- **Files:** `.prumo` save / open, autosave + crash recovery, saved versions + compare view.
- Português (Brasil) and English; light / dark theme.

## Run it

Requirements: **Node ≥ 22.12**, **pnpm 9** (`corepack enable`). For the native window also **Rust** (stable) and the Tauri 2 prerequisites — on Windows: Microsoft C++ Build Tools + WebView2 (preinstalled on Windows 10/11); on macOS: Xcode command-line tools.

```sh
pnpm install
pnpm --filter @prumo/desktop dev        # browser build, fastest (no native file dialogs)
cd apps/desktop && pnpm tauri dev       # native window
cd apps/desktop && pnpm tauri build     # installers (Windows NSIS/MSI, macOS .app/.dmg)
pnpm check                              # lint + format + typecheck + tests
```

Prebuilt installers: GitHub → Actions → **desktop** → Run workflow, then download `prumo-windows-latest` / `prumo-macos-latest` from the run.

## Layout

```
apps/desktop/              Tauri 2 shell + Vue 3 app (screens, menus, panels)
packages/core/             model, geometry, commands, undo, files, module host, data packs (no UI, no modules)
packages/ui-api/           what a module may add to the screens (ADR-059)
packages/module-architect/ walls, rooms, doors/windows, finishes
packages/module-structural/ structural checks, slabs, chases, loads + its screen parts
packages/module-electrical/ outlets, switches, lights, circuits + its screen parts
packages/module-export/    PNG / PDF sheets
packages/renderer-2d/      SVG plan
packages/renderer-3d/      Three.js view
spikes/                    throwaway Phase 0 experiments (not part of the app)
docs/                      decisions, roadmap, domain notes — start with CURRENT_STATE.md
```

## Contributing

Read `CONTRIBUTING.md`. AI sessions (Claude Code) read `CLAUDE.md` first — it's the rulebook. Decisions live in `docs/DECISIONS.md` (ADRs), plans in `docs/ROADMAP.md`, open questions in `docs/OPEN_QUESTIONS.md`, ideas from other apps in `docs/COMPETITOR_FEATURES.md`.

License: Apache-2.0.
