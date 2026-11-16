# Prumo (codename — final name pending, see ADR-016)

An **open-source, cross-platform, modular** building sandbox. Draw and edit walls, openings (doors/windows/voids), and other elements in the **Architect Vision**, then switch to other **Visions** (first: **Structural**) to see, with explanations, what your changes might do.

> ⚠️ **Status: planning only. No code.** See `docs/CURRENT_STATE.md`.
> ⚠️ A learning/exploration tool. It does **not** replace a licensed engineer. See `docs/SAFETY_AND_LIABILITY.md`.

## Start here

1. Owner: answer the 🔴 questions in `docs/OPEN_QUESTIONS.md` (currently Q-050, Q-055, Q-056).
2. AI session (Claude Code): read `CLAUDE.md`. It's the rulebook.
3. No production code until Phase 0 in `docs/ROADMAP.md` is done (Spikes A, B, D, E).

## Suggested first prompt for a Claude Code session

```
Read CLAUDE.md and every file in docs/. Don't write code yet.
1) Summarize back, in plain language, what we're building and what's decided vs proposed vs open.
2) Ask me every 🔴 question in OPEN_QUESTIONS.md I haven't answered, in batches, using the format in CLAUDE.md §4.
3) After I answer, update DECISIONS.md (ACCEPTED only when I explicitly agree), OPEN_QUESTIONS.md, CURRENT_STATE.md, and SESSION_LOG.md.
4) Add any new questions you think of, then tell me the riskiest thing in the plan.
5) Only then propose the plan for Spike D (stack) and Spike E (module boundary).
```

## Planned layout (not created yet)

```
CLAUDE.md, README.md, docs/
apps/desktop/          Tauri 2 shell + Vue 3 front end   (PROPOSED)
packages/core/         framework-free model, geometry, commands, module host, rules
packages/module-architect/
packages/module-structural/
spikes/
```
