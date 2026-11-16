# Spikes (throwaway)

Phase 0 experiments. **Not production code** (ROADMAP Phase 0 exit rule): nothing here gets imported by `packages/`, and it gets deleted or frozen once the lessons are in `docs/SESSION_LOG.md`.

| Spike | Folder | Question | Run |
|---|---|---|---|
| D — stack | `stack/` | Is Tauri 2 + Vue 3 + SVG + Three.js small, fast to start, and smooth? | `pnpm install && pnpm tauri dev` · bench: `PRUMO_SPIKE_BENCH=15 <app binary>` (15 → 500 walls, 49 → 4,920) |
| E — modules | `modules/` | Do MODULES.md rules 1–7 + ADR-032 hold in code? | `pnpm install && pnpm test` |
