# QUESTIONS FOR THE ENGINEER

> The owner hands everything engineering-related to their engineer contact (session #3). This file batches those questions so each review session is efficient.
> AI sessions: **add structural doubts here** instead of guessing (CLAUDE.md rule 17). Record answers with the date, and **never paste text copied from standards** into this repo (cite clause numbers).

Status legend: ☐ not asked · ⏳ asked · ✅ answered

## Batch 1 — scope sanity check (before Phase 2)

| # | Question | Status | Answer |
|---|---|---|---|
| E-01 | Is **structural masonry** a good first system for a learning tool aimed at beginners in Brazil? Would you start somewhere else? | ☐ | |
| E-02 | Which ~8–10 rules would you implement first, in order of "most common real-world mistakes when people add/move openings or remove walls"? (Our candidate list: `STRUCTURAL_ANALYSIS.md` §3) | ☐ | |
| E-03 | Which current NBR editions/clauses apply (loads: NBR 6120; masonry: NBR 16868; others?). Are there common simplified methods for houses that you'd recommend instead? | ☐ | |
| E-04 | How should a simple tool decide whether a wall is **load-bearing**? In structural masonry, is "all walls are structural" a reasonable default? (ADR-017) | ☐ | |
| E-05 | Is our list of simplifications (`STRUCTURAL_ANALYSIS.md` §7) honest? What's missing that could make findings dangerously misleading? | ☐ | |

## Batch 2 — thresholds (before each rule ships)

| # | Question | Status | Answer |
|---|---|---|---|
| E-10 | Lintel (*verga*) minimum bearing length each side; when is a sill reinforcement (*contraverga*) required? | ☐ | |
| E-11 | Minimum pier width between openings, and between an opening and a wall end/intersection, for structural masonry. | ☐ | |
| E-12 | Wall slenderness limits (effective height/thickness) for typical blocks (14 cm, 19 cm…). | ☐ | |
| E-13 | Rule of thumb for a "too much opening" ratio in a wall line / bracing in each direction. | ☐ | |
| E-14 | Default residential loads to show (dead/live per area; roof; water tank). | ☐ | |

## Batch 3 — materials & calculations (before Phase 3)

| # | Question | Status | Answer |
|---|---|---|---|
| E-20 | Typical Brazilian block types to ship in the material pack (ceramic/concrete, structural vs sealing), and unit weights/strengths, with sources. | ☐ | |
| E-21 | How to treat arching action over openings in a simplified way (Q-033). | ☐ | |
| E-22 | Review the hand-calculated validation cases VC-001…005. | ☐ | |
| E-23 | Characteristic vs design values: which should the UI show to a beginner? | ☐ | |

## Batch 4 — product & credit

| # | Question | Status | Answer |
|---|---|---|---|
| E-30 | Are you OK being credited publicly as a reviewer (name/handle/none)? We'll always say "reviewed", never "certified". (Q-069/086) | ☐ | |
| E-31 | Would you use the Structural Vision yourself? What would make it useful for a professional at an early design stage? | ☐ | |
| E-32 | For the handoff workflow (architect → engineer → architect), what would you want to mark or annotate on an architect's model? (Q-076, ADR-029) | ☐ | |
