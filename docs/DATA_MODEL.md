# DATA MODEL (proposed — depends on ADR-003, 006, 007, 008, 015, 017)

## Principles

1. **Single source of truth:** the *architectural model* (what the user edits). The *structural model* is **derived** from it and never edited directly (but user overrides, like "this wall is bearing", are stored in the architectural model as explicit fields).
2. **Stable IDs:** every element has a UUID that never changes on move/edit. Copy/duplicate/mirror-as-copy create new IDs.
3. **Immutable snapshots:** every command produces a new model (structural sharing via Immer or similar).
4. **Units:** mm, N, MPa internally (ADR-006). Field names carry no unit suffix, but the type docs state the units.
5. **Everything has a level** (`levelId`), even when there's only one (ADR-015).

## Entities (draft)

```ts
Project {
  schemaVersion: number
  id, name, createdAt, updatedAt
  profileId: string            // country code + construction system (ADR-004/009)
  levels: Level[]
  materials: Material[]        // project-local copy of library materials (so files are self-contained)
  elements: Record<Id, Element>
  settings: { gridSize, snapTolerance, displayUnits }
}

Level { id, name, elevation /*mm*/, defaultWallHeight /*mm*/ }

Wall {
  id, type: "wall", levelId
  start: Vec2, end: Vec2        // reference line, mm
  alignment: "center" | "left" | "right"   // where the thickness sits relative to the line
  thickness                      // derived from layers if layers exist? ❓ (see doubt 1)
  height, baseOffset
  layers?: WallLayer[]           // [{materialId, thickness, structural: boolean}]
  structuralRole: "auto" | "bearing" | "non-bearing"   // user override (ADR-017)
  lintels?: managed via Opening
}

Opening {
  id, type: "opening", levelId
  hostWallId                     // ADR-007
  offset                         // distance from wall.start to the opening's near edge, along the wall, mm
  width, height, sillHeight
  kind: "door" | "window" | "void" | "passage" | "custom"
  handing?: "left" | "right"     // doors. Implemented: "left" = hinge at the opening's start side (nearer wall.start)
  //   swing "in" = leaf opens to the wall's LEFT side (looking start → end); "out" = right side (s#11 convention)
  swing?: "in" | "out"
  lintel?: { materialId, depth, bearingLeft, bearingRight } | "auto" | "none"
}

Slab {
  id, type: "slab", levelId
  outline: Vec2[]                // closed polygon
  thickness, materialId
  spanDirection?: angle | "two-way" | "auto"
  loads: { live?: kPa, superimposedDead?: kPa }   // defaults from profile
}

Column { id, type: "column", levelId, position: Vec2, section: {w,d} | {diameter}, height, materialId, rotation }
Beam   { id, type: "beam", levelId, start, end, section: {w,h}, materialId, topOffset }

Material {
  id, name, system: "masonry" | "concrete" | "timber" | "steel" | "other"
  unitWeight   { value, unit:"kN/m3", source, confidence }
  compressiveStrength? { value, unit:"MPa", kind:"characteristic"|"design", source, confidence }
  tensileStrength?  {...}
  elasticModulus?   {...}
  notes
}
```

## Additions from session #3 (PROPOSED)

```ts
// Wall kinds (ADR-031, UX_PRINCIPLES §3)
Wall.kind: "full" | "half" | "fence" | "railing"
RoomSeparator { id, type:"room-separator", levelId, start, end }   // invisible room boundary

// Rooms: DERIVED from closed loops of full walls + separators (not stored),
// but room-level user data (name, floor finish) needs a stable anchor → ❓ store Room{ id, seedPoint, name, floorFinishId }
// and re-match it to the detected loop after edits. (Hard: what if an edit splits a room in two?)

// Finishes vs structure (Q-090)
Wall.core       → owned by the Structural Vision: { materialId, thickness }  (structural material)
Wall.finishes   → owned by the Architect Vision: { sideA?: FinishLayer[], sideB?: FinishLayer[] }
FinishLayer     { finishId, thickness }        // paint ≈ 0 mm, plaster 20 mm, tiles 10 mm…
// Total wall thickness = core + finishes. A beginner "paints"; they never pick a block type in the Architect Vision.
// ⚠️ Until the Structural Vision is used, core.materialId = "unspecified" (with a default thickness).

// Handoff (ADR-029)
Element.meta: { createdBy, modifiedBy, modifiedAt }        // display names, no accounts
Note { id, elementIds[], author, text, createdAt, resolved: boolean, visionId }
Protection { elementId, byVision, reason, author, createdAt }   // informs; never blocks (ADR-026)
Project.handoff: { holder: string, since, message, history: HandoffEvent[] }  // "baton" model (ADR-029, accepted)
HandoffEvent { from, to, at, message, snapshotId }
Snapshot { id, name, createdAt, author, model /* full or delta ❓ */ }        // for the compare view (Q-104)
Room { id, seedPoint, name, roomType? /* Q-107 ✅; list owner → Q-114 */, floorFinishId? }
```

Doubts:
- **Room identity across edits** (above) is a classic hard problem. Lean: a room keeps its id if its new loop contains the old seed point; on a split, the larger part keeps the id and the other gets a new one (and a note).
- **Which side is "side A"** of a wall? Tie it to the wall direction (left side of start→end). Mirror flips it (EDITING_OPERATIONS, mirror section).

## Invariants (must be enforced in code + tested)

> **Implemented (Phase 1 slice 2, `packages/core/src/edit.ts`):** I-1…I-5 plus positive sizes and level existence, checked on every command for the changed elements and their hosts/hosted; violating edits are **refused** (Q-072 default, block). Tolerance `EPS = 0.01 mm`. `MIN_WALL_LENGTH = 1 mm`. `project.modules` (usage record) is **derived at save** from the data, never an input.

- I-1 An opening's `[offset, offset + width]` lies within `[0, wallLength]` (minus a minimal edge distance?).
- I-2 An opening's `sillHeight + height ≤ wall.height`.
- I-3 Openings on the same wall don't overlap.
- I-4 Wall length > `MIN_WALL_LENGTH` (e.g. 1 mm) — no zero-length walls.
- I-5 `hostWallId` refers to an existing wall on the same level.
- I-6 Slab outline is a simple (non-self-intersecting) polygon, CCW orientation.
- I-7 All material references resolve.

❓ **When an edit would break an invariant** (e.g. shortening a wall so its window no longer fits): block it, auto-fix (clamp/delete the opening), or allow an "invalid" state with a critical finding? → Lean: **block geometric impossibilities** (I-1..I-5) with a clear message; allow structural problems (those are findings). Needs owner confirmation (add to Q list).

## Doubts

1. **Thickness vs layers:** if a wall has layers, is `thickness` derived (sum of layers) or independent? Lean: derived when layers exist, so there's one source of truth.
2. **Wall joins:** stored (explicit `joins: [{wallId, end}]`) or computed from geometry each time? Computed is simpler and can't go stale, but needs robust tolerance logic; stored is faster and preserves user intent. Lean: **computed**, revisit after Spike A. **Spike A (session #11): computed works**, deterministic regardless of input order, ~52 ms for 480 walls without any spatial index. Keep computed.
3. **Curved walls:** out of v1. The data model uses `start/end`, so curves would need a new shape type later.
4. **Rooms/spaces:** not modelled in v1. ❓ Are they needed for slab auto-generation or area-based loads? Probably later.
5. **Lintel as part of Opening vs a separate element:** lean: part of Opening (simpler); becomes separate only if users need to edit it independently.
