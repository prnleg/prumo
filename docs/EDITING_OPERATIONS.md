# EDITING OPERATIONS — exact semantics & edge cases

Every operation is a **command** (ADR-011): `{ label, do(model) → model, undo }`, grouped so that one user gesture = one undo step. Every operation re-runs analysis and produces a findings diff.

Each edge case below needs a test. ❓ = owner decision needed (defaults shown).

---

## Create

- **Wall:** click start → click end (chain mode continues from the last end; Esc ends). Snap to endpoints, midpoints, grid, 0/45/90°, and perpendicular.
  - Edge: start == end → reject (I-4).
  - Edge: the new wall overlaps an existing wall collinearly → ❓ merge / reject / allow with a finding? Default: **reject with message.**
  - Edge: the new wall crosses an existing wall → auto-create an X junction (no split). Do we split walls at junctions? ❓ Default: **don't split**; joins are computed.
- **Opening:** hover a wall → preview → click to place. Snaps to the wall centre, ends, and other openings.
  - Edge: doesn't fit → show red preview, refuse.
  - Edge: placed near a wall junction → allowed (but may trigger R-OPEN-004).

## Select

- Click, Shift+click (add), box-select (left→right = fully inside; right→left = touching — CAD convention ❓), Ctrl+A.
- Selecting a wall does **not** auto-select its openings, but operations on the wall carry them (see below).

## Move

- Wall moved → its openings move with it (same offset).
- Wall moved → **connected walls stretch** to keep the junction (Q-022 default). With a modifier key → detach.
  - Edge: stretching makes a connected wall shorter than its openings need → block the move and highlight the conflict (DATA_MODEL invariant doubt).
  - Edge: moving one of two walls in an L to become collinear with the other → do they merge? Default: no.
- Opening moved → slides **along its host wall only**. Dragging it onto another wall = **re-host** (a separate command, explicitly labelled "Move opening to wall W-5").
  - **Implemented (session #11):** one door/window dragged over a wall that isn't its host → `rehostCommand` preview (centred on the pointer, near edge on the grid, clamped inside the wall; Alt = free); the drag commits as ONE step labelled "move door/window to another wall" (`Gesture.commit(label)`); dragging back over its own wall in the same gesture = ordinary slide. Wall ids aren't shown to users, so the label names no wall.
- Multi-select move: walls + openings + slabs translate together. Openings whose host is also selected move with the host (don't double-apply the translation — classic bug).

## Copy / Duplicate

- **Copy** = to clipboard; **Paste** = place with the cursor. **Duplicate** = copy + paste at a fixed offset (or at the last-used offset, Figma-style ❓).
- Copying a wall copies its openings (new IDs, new host IDs remapped).
- Copying an opening alone → pasting requires a target wall; otherwise refused.
- **Implemented (session #11):** Ctrl/⌘+C / X / V, app-internal clipboard (detached deep copy; not the OS clipboard). Paste = the copied walls' bbox centre under the pointer, delta snapped to the project grid (pointer outside the plan → 50 cm down-right). Loose doors/windows → onto the wall under the pointer, first one centred there, same-wall spacing kept, groups from different walls 200 mm apart; a paste that doesn't fit is refused by the invariants. Cut = copy + delete of real elements only (like Delete, a selected room isn't expanded). Room names aren't copied.
- Copied elements get new IDs; **material references are kept** (not duplicated).
- Edge: copying a slab whose support walls aren't copied → fine geometrically; analysis will flag missing supports.
- Edge: `structuralRole` overrides copy along. ❓ Should they? Default: yes, with an info finding "copied override".

## Mirror

- Choose an axis (2 clicks, or the selection's own vertical/horizontal centre line).
- Option: **mirror in place** vs **mirror copy** (keep the original). Default: mirror copy (like CAD), with a toggle.
- Wall: start/end mirrored. ⚠️ **Alignment flips**: a wall drawn with thickness on the "left" side of its line must become "right" after mirroring, or the wall body ends up on the wrong side. *(Very common bug.)*
- Wall layers: the order of layers flips (inside ↔ outside). ❓ Is that correct for the user's intent? (Mirroring an exterior wall keeps the outside layer outside — after a mirror, the "outside" is the mirrored side, so flipping is geometrically right.) Default: flip, and test it.
- Opening offset: measured from `wall.start`, so after a mirror, recompute it so the opening is in the mirrored position.
- Doors: **handing flips** (left ↔ right) (Q-021 default). Swing in/out stays.
  - **Implemented (slice 5b):** our `handing` is stored relative to the wall start, so after mirroring start/end the hinge is already in the mirrored place; what flips in *our encoding* is `swing` (in ↔ out). Net effect = the real-world handing flip above. Proven by a property test: mirrored door symbol == mirror of the original symbol, for all 4 handing × swing combinations (mutation-checked).
- Slabs: polygon orientation reverses (CW ↔ CCW) → re-normalize to CCW (I-6).
- Span direction: angle mirrored.
- Text/labels: not mirrored (stay readable).
- Screen-vs-model Y axis (ADR-006): a mirror about a horizontal axis must be tested in model coordinates, not screen coordinates.
- Edge: mirroring across an axis that passes *through* a wall → in-place mirror of that wall is symmetric; a mirror copy creates an overlapping wall → reject or merge? Default: reject that one element with a message, mirror the rest.

## Rotate

- Around a pivot, snapping to 15°/90°. Same alignment/opening rules as move.
- Floating-point: after 4 × 90° rotations the model must equal the original within EPS (test).

## Delete

- Wall with openings → openings are deleted too, and the undo label says so (Q-023 default).
- Wall that supports a slab → allowed, but critical finding R-WALL-002 appears in the diff. ❓ Should we show a confirmation dialog for deleting bearing elements? Default: no dialog (it's a sandbox), but the findings diff is highlighted prominently.
- Material in use → block deletion; offer replace-with.

## Property edits

- Changing thickness/height/material → a command (undoable), re-analysis.
- Changing the wall length numerically → which end moves? ❓ Default: the end point moves, the start stays.

## Undo / Redo

> **Implemented (slice 2):** commands are pure `project → project`; undo restores the previous immutable snapshot (no hand-written inverses, so they can't drift). A gesture (drag) previews from its base and commits once = one undo step; cancel = no step. Blocked edits (invariants) never enter history. Property test: 60 random ops × 4 seeds → undo all = original object; redo all = final.

- Unlimited within a session (memory permitting); not persisted across reloads ❓ (default: not persisted).
- Property test: N random operations → undo N times → model deep-equals the original.
- Undo also restores selection (nice-to-have).

## Tests matrix (minimum)

For each op × {single wall, wall with 2 openings, L junction, T junction, multi-select incl. slab}: do, undo, redo, save/load round-trip after the op.
