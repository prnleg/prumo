# UX PRINCIPLES — "Build mode like The Sims, without the cage"

> Created session #3 (2026-11-15). Owner's reference: **The Sims build mode**. It works for people who've never used CAD, but it's too locked (45/90/180° walls, fixed sizes, many limits).
> We reference it for *interaction ideas only*. We don't copy its art, icons, names, or UI. It's a commercial game (EA/Maxis).

## 1. What to borrow (the parts that make it work for beginners)

| Sims idea | Why it works | Our version |
|---|---|---|
| **Room tool** (drag a rectangle → 4 walls) | People think in rooms | Room tool = default; shared walls merge automatically (Q-079 ✅) |
| **Wall tool** for single walls | Detail work | Wall tool, chainable |
| Doors/windows **snap into walls and cut them automatically** | No "boolean" concepts needed | Openings are hosted on walls (ADR-007/024) |
| Hover preview before placing (green = OK / red = can't) | Instant feedback without dialogs | Same, but red only means **"geometrically impossible"** (ADR-026: rules never block) |
| **Walls up / cutaway / walls down** view toggle | Lets you see inside in 3D | Phase 4 (3D); Q-089 |
| Paint floors / walls by room | Fast, visual | Finishes in the Architect Vision; ≠ structural material (Q-090) |
| Drag a wall to resize a room; objects follow | Direct manipulation | Move wall → joined walls stretch (Q-022), openings follow |
| Undo everywhere, no fear | Encourages play | Command history (ADR-011) |
| No numbers unless you want them | Low cognitive load | Dimensions shown subtly; typing exact values optional (Q-081) |

## 2. What NOT to copy (the "cage")

| Sims limitation | Our approach |
|---|---|
| Walls only at 0/45/90° | **Any angle.** By default, snap to the grid and to 15° steps; hold a modifier key for free placement (Q-087) |
| Fixed tile grid / fixed sizes | Configurable snap grid (e.g. 10 cm default ❓); exact numeric entry |
| Fixed wall heights per floor | Per-wall height, with a per-level default |
| Fixed door/window catalogue sizes | Any size (generic opening with a `kind` tag) |
| No real-world units / physics | Real units (mm) + structural Vision |
| Game logic decides what's allowed | Only geometric impossibility is prevented; everything else is a finding |

## 3. Wall kinds (owner: "walls need to be closed; half walls, fences, etc. are fine")

| Kind | Encloses a room? | Structural relevance |
|---|---|---|
| Full wall | ✅ yes | Can be bearing (Structural Vision decides) |
| Half wall / parapet | ✅ **yes** (owner, Q-088: e.g. a kitchen divider) | Usually non-bearing; still has weight |
| Fence / railing | ❌ **no** (owner, Q-106) | None (maybe a guardrail-height rule in an Architect pack) |
| Room separator (invisible boundary, e.g. an open kitchen/living room) | ✅ yes (bounds a room without a wall) — **implemented: "Divider" tool, ADR-040** | None |

**Room detection:** rooms = closed loops formed by full walls + **half walls** + room separators. An unclosed area isn't an error; it's simply "not a room yet" (draft, ADR-025). ⚠️ Doubt: what does a beginner see when a room "won't close" because of a 2 mm gap? → auto-heal gaps under the snap tolerance + a visible "open end" marker (R-34).

## 3b. Settings must be discoverable (owner, session #4)

Snapping defaults (10 cm grid, 15° steps, Alt = free) are fine, but **users must be told how to change them**:
- the status bar always shows `Grid 10 cm · Angle 15° · Alt = free`, and clicking it opens the setting;
- the guided tour mentions it once;
- the setting lives under Settings → Drawing (user default) **and** Project → Drawing (override) — **Q-108 ✅ both**.

## 4. General principles

1. **Direct manipulation first**: drag handles on the canvas, not dialogs.
2. **Preview before commit**: every tool shows the result before the click.
3. **Forgiving**: undo, auto-heal tiny gaps, snap generously.
4. **No jargon in the Architect Vision** (CLAUDE.md rule 20).
5. **Quiet feedback** (ADR-025): never interrupt creation.
6. **Progressive depth**: numbers and formulas sit behind "details".
