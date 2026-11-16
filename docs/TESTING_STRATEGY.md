# TESTING STRATEGY

The project's core problem: **the owner can't verify structural correctness by eye**. So tests aren't a nicety; they're the only verification we have.

## Layers

| Layer | What | Tool (if web) | Mandatory? |
|---|---|---|---|
| Geometry unit tests | intersections, offsets, joins, mirror/rotate round-trips | Vitest | ✅ |
| Property-based tests | random ops → invariants hold; undo-all = original; 4×90° rotate = identity | fast-check (needs an ADR) | ✅ from Phase 1 |
| Command tests | each op × fixtures × do/undo/redo | Vitest | ✅ |
| Rule tests | each rule: a triggering case, a non-triggering case, and a boundary case | Vitest | ✅ |
| Validation cases | VC-xxx hand calcs (STRUCTURAL_ANALYSIS §5) | Vitest | ✅ for every calculator |
| Golden files | fixture project → findings JSON snapshot | Vitest snapshots | ✅ Phase 2+ |
| Persistence | save/load round-trip; old fixture files still load | Vitest | ✅ |
| Wording test | grep UI strings for banned words (SAFETY doc) | script | ✅ |
| UI smoke | app loads, draw a wall, place a window, undo | Playwright (ADR) | Phase 1 end |
| Manual usability | G-1 task with the owner | checklist | Each phase end |

## Rules for the AI writing tests

- **Never** generate the expected value of a structural test by running the code under test. Expected values come from a hand calculation written in the test (comments showing the arithmetic) or from a cited source.
- Tolerances must be explicit and justified (`toBeCloseTo(x, 2)` with a comment saying why 2 decimals).
- If a test fails, don't "fix" it by changing the expected value without explaining why the old value was wrong in SESSION_LOG.
