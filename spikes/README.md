# Spikes (throwaway)

Phase 0 experiments. **Not production code** (ROADMAP Phase 0 exit rule): nothing here gets imported by `packages/`, and it gets deleted or frozen once the lessons are in `docs/SESSION_LOG.md`.

| Spike | Folder | Question | Run |
|---|---|---|---|
| D — stack | `stack/` | Is Tauri 2 + Vue 3 + SVG + Three.js small, fast to start, and smooth? | `pnpm install && pnpm tauri dev` (dev build; needs `~/.cargo/bin` on PATH) · bench: `PRUMO_SPIKE_BENCH=15 <app binary>` (15 → 500 walls, 49 → 4,920) |
| A — wall joins | `joins/` | Can we clean up L/T/X/Y joins at any angle without a geometry library? | `pnpm install && pnpm dev` (browser viewer) · `pnpm test` · `RENDER_PNG=out.png pnpm test render` |
| B — one rule | `rule/` | Does one structural rule work end to end, and is the explanation (card) format honest and readable in pt-BR + en? | `pnpm install && pnpm dev` (browser viewer) · `pnpm test` |
| E — modules | `modules/` | Do MODULES.md rules 1–7 + ADR-032 hold in code? | `pnpm install && pnpm test` |
| F — add-on sandbox | `sandbox/` | Can an installed add-on run where it can't reach Tauri, the user's files or the network, and still talk to the app through messages? (ADR-023) | `pnpm install --ignore-workspace && pnpm build && pnpm tauri build --debug --no-bundle`, then run `src-tauri/target/debug/spike-sandbox` (`SPIKE_MODE=noframe` skips the iframe); prints `SPIKE-F-REPORT {json}`. CI: `spike-sandbox` workflow (Windows + macOS). |
