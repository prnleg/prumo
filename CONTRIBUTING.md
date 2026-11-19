# Contributing (DRAFT — repo is public from day 1, ADR-014)

Thanks for your interest! The project is in **early development**. Read `README.md` and `docs/CURRENT_STATE.md` first.

## Ground rules

- License: **Apache-2.0**. By contributing you agree your contribution is licensed under it.
- Read `docs/DECISIONS.md` before proposing large changes. Decisions marked `ACCEPTED` aren't changed casually; open an issue proposing a superseding ADR.
- Big ideas → open an issue (or a draft ADR) first, before writing code.

## Code

- TypeScript strict, Vue 3, pnpm workspaces (ADR-002).
- `packages/core` must not import Vue, the DOM, Tauri, or any module (CLAUDE.md rule 11).
- No user-facing hard-coded strings: use i18n keys (pt-BR + en).
- Tests required for domain, geometry, and command code.

## Dev setup

- **Node ≥ 22.12** (`.nvmrc` = 22) and **pnpm 9** (`corepack enable`, or install pnpm 9).
- `pnpm install` then `pnpm check` (= lint + format check + typecheck + tests). `pnpm format` fixes formatting.
- **Run the app:** `pnpm --filter @prumo/desktop dev` (browser, fastest) or `cd apps/desktop && pnpm tauri dev` (native window; needs Rust, `~/.cargo/bin` on PATH). Installers: `pnpm tauri build`, or run the `desktop` GitHub workflow by hand (Actions → desktop → Run workflow; also runs on `v*` tags) and download the artifacts.
- **CI:** PRs run lint/format/typecheck + tests on Linux only (fast). Pushes to `main` also run the tests on Windows and macOS (cross-OS save-hash check).
- Boundary rules are lint errors: `packages/core` can't import Vue, Tauri, or modules.
- `/spikes` are throwaway experiments with their own lockfiles; they aren't workspace members.

## Structural / code rules — stricter gate ⚠️

Rules can mislead people about real buildings, so a PR adding or changing a rule needs:
1. A stable rule ID and an entry in `docs/STRUCTURAL_ANALYSIS.md`.
2. A **source** (code clause or textbook + page). **Never paste text from standards** (ABNT/EN are copyrighted); cite clause numbers and paraphrase.
3. At least one **hand-calculated** validation test (arithmetic visible in the test).
4. Wording that never claims safety or compliance (`docs/SAFETY_AND_LIABILITY.md`).
5. Maintainer review **and** engineer review for any rule above `info` severity. Until both happen, the rule ships with the `UNVERIFIED` badge.

## Using AI assistants

AI-assisted contributions are welcome, but you're responsible for them. If you used one, follow `CLAUDE.md`: it applies to any AI agent working in this repo.
