# VISION

> Updated 2026-11-15 (session #1) after the owner's answers. Previous version: see SESSION_LOG #0.

## One sentence

An **open-source, cross-platform, modular** building sandbox: one shared building model you can look at through different **Visions** (Architect, Civil/Structural, Electrical, …). Each Vision adds its own tools, properties, and **explained feedback**, and it's easy enough for someone who has never used a CAD tool.

## Core idea: one model, many Visions

```
                 ┌───────────────────────────────┐
                 │  Shared building model (core) │  walls, openings, levels, slabs…
                 └───────────────┬───────────────┘
        ┌──────────────┬─────────┴───────┬────────────────┐
   Architect Vision  Structural Vision  Electrical Vision  (future add-ons…)
   draw/edit layout  materials, loads,  outlets, circuits,
   (built-in)        rules, findings    rules  (later)
```

- A **Vision** (a.k.a. mode/module/add-on, final name in ADR-019) is a lens on the same model: it contributes element types, extra properties, tools, panels, overlays, and rules.
- The **Architect Vision** is the base editing experience (walls, openings, move/copy/mirror…).
- The **Structural (Civil) Vision** is the first engineering add-on: materials, bricks/blocks, loads, structural rules. **Engineering lives in modules, not in the core** (owner decision, 2026-11-15).
- Future Visions (Electrical, Plumbing, Energy/Thermal, Cost…) are possible. **None are being built now.**

## Visions are role-based (owner, session #2)

Each Vision matches a **professional role** and only shows what that role cares about. *"The architect doesn't want to know about the engineering part; that's not their job."* The Architect Vision must be fully usable with **zero engineering knowledge**. Engineering surfaces there only as quiet markers for critical issues (ADR-025).

Rules **inform, never block** (ADR-026): they help people know whether they're following the rules; they never stop anyone from creating.

## Audience

"For everyone", with progressive disclosure: simple by default, depth on demand.

**Primary v1 persona (Q-050, accepted):** *someone who has never used CAD or any schematics software.* Every UX decision is tested against this person first. Professionals are served by "show details" depth, not by a different default UI.

## Principles

1. **Beginner-first, expert-possible.** Plain language by default; formulas and numbers behind "show details".
2. **Explainability over precision.** Every finding says what, why, assumptions, source, and confidence.
3. **Honest limits.** It's a learning/exploration tool, not engineering approval. Basic disclaimers now; not overloaded (owner: "the basics will be more than enough right now").
4. **Modular by design, but not prematurely.** Modules use the same internal API that core features use. The public plugin API gets frozen only after it has proven itself (ADR-020).
5. **Open source and portable.** Easy install on Windows, macOS, Linux. Open file format.
6. **Codes as data.** Brazil (ABNT NBR) first; other countries later as installable rule packs.
7. **Windows + macOS first**, Linux later (ADR-027).

## What success looks like (first milestone)

You can draw a small house in the Architect Vision, switch on the Structural Vision (profile: Brazil), assign block types to walls, add a window, and see an explained warning that changes when you move the window or switch the material.

## Not now (see GOALS non-goals)

Real engineering approval, Electrical Vision implementation, a public plugin marketplace, full BIM, FEA.
