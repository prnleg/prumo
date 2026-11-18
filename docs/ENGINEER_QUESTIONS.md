# QUESTIONS FOR THE ENGINEER

> The owner hands everything engineering-related to their engineer contact (session #3). This file batches those questions so each review session is efficient.
> AI sessions: **add structural doubts here** instead of guessing (CLAUDE.md rule 17). Record answers with the date, and **never paste text copied from standards** into this repo (cite clause numbers).

Status legend: ☐ not asked · ⏳ asked · ✅ answered

> **Batch 1 answered 2026-11-17** by the owner's engineer contact — **anonymous, informal, unsigned** (ADR-041 `VERIFIED-UNSIGNED`). Values given from memory or marked "check" ([CONFERIR]) stay `UNVERIFIED`. The full answer stays with the owner; summaries below (no standards text).

## Batch 1 — scope sanity check (before Phase 2)

| # | Question | Status | Answer |
|---|---|---|---|
| E-01 | Is **structural masonry** a good first system for a learning tool aimed at beginners in Brazil? Would you start somewhere else? | ✅ 2026-11-17 (VERIFIED-UNSIGNED) | Good first system **to teach** (rules are mostly geometric). But most Brazilian single-storey houses are RC frame + ceramic infill, often self-built → ask the system up front with "não sei" (→ masonry rules, conservative, stated). Old solid-brick houses ≠ standardized structural masonry. Masonry fits Prumo's main real case: residents renovating social-housing units. |
| E-02 | Which ~8–10 rules would you implement first, in order of "most common real-world mistakes when people add/move openings or remove walls"? (Our candidate list: `STRUCTURAL_ANALYSIS.md` §3) | ✅ 2026-11-17 (VERIFIED-UNSIGNED) | Order: R-WALL-002 · R-OPEN-NEW (opening added/widened vs original) · R-WALL-004 (chases for pipes/wiring, esp. horizontal) · R-OPEN-001 · R-OPEN-006 (no contraverga) · R-OPEN-002 · R-OPEN-003 · R-OPEN-004 · R-WALL-005 (no vertical continuity) · R-WALL-001. Later: R-WALL-003, R-BRACE-001, R-OPEN-005, R-WALL-006 (min thickness), R-JOINT-001 (unbonded junction), R-RING-001 (no top tie beam). Bracing last: rarely the problem in a single-storey house with walls both ways. |
| E-03 | Which current NBR editions/clauses apply (loads: NBR 6120; masonry: NBR 16868; others?). Are there common simplified methods for houses that you'd recommend instead? | ✅ 2026-11-17 (VERIFIED-UNSIGNED) | Add NBR 8681, 6123, 6118 (lintels/tie beams/slabs), 6136, 15270-1, 6122 (out of scope, cite as limit), 15575, **16280** (renovation — Prumo's main use). NBR 15961/15812 were replaced by 16868: don't use. No Brazilian normative simplified method for houses known; EN 1996-3 = inspiration only. Editions in STRUCTURAL_ANALYSIS (several marked check). |
| E-04 | How should a simple tool decide whether a wall is **load-bearing**? In structural masonry, is "all walls are structural" a reasonable default? (ADR-017) | ✅ 2026-11-17 (VERIFIED-UNSIGNED) | Yes: in structural masonry "all walls structural" is the right default. **D default + A as explicit, recorded exception**; B only to explain, never to decide (under-counts: walls also brace and share load). C not for masonry. RC frame later: partition default is not safe for self-built houses. → ADR-017 accepted. |
| E-05 | Is our list of simplifications (`STRUCTURAL_ANALYSIS.md` §7) honest? What's missing that could make findings dangerously misleading? | ✅ 2026-11-17 (VERIFIED-UNSIGNED) | Honest but incomplete; two phrases dangerous: "connections assumed adequate" (reads as checked → "doesn't check connections") and "no issues detected" (reads as approved → list what was and wasn't checked, no green). Missing: materials, drawing ≠ real building, existing damage (cracks, damp, settlement, corrosion), new loads from the renovation, roof thrust, point loads + wall interaction, construction sequence/shoring. "Linear elastic" → "textbook estimates, no code safety factors". |
| E-06 | Rule R-OPEN-001 says: *"an opening (door or window) in a load-bearing wall needs a lintel (verga)"*. Is that right as a general rule for Brazilian structural masonry? Which NBR clause should we cite? Exceptions (very small openings; an opening that reaches right up to a bond beam (cinta) or slab)? | ✅ 2026-11-17 (VERIFIED-UNSIGNED) | **Yes, general rule in practice**: every opening in a structural wall needs an element spanning it (lintel, precast lintel, or the tie beam/slab when the opening reaches it — then that element *is* the lintel and must be designed for it). No size exception without a source. Arching may reduce the lintel's load but never removes the lintel. Clause number: not recalled (check NBR 16868-1, flexural elements / detailing). |
| E-07 | When we only *assume* a wall is load-bearing (nobody marked it), should a finding on it be as severe as one on a wall the user marked? (Q-136) | ✅ 2026-11-17 (VERIFIED-UNSIGNED) | **Same severity.** Severity = consequence; the assumption is a separate tag ("treated as structural: system default"). A wall marked non-bearing in a masonry project gets its own warning. |

## Batch 2 — thresholds (before each rule ships)

| # | Question | Status | Answer |
|---|---|---|---|
| E-10 | Lintel (*verga*) minimum bearing length each side; when is a sill reinforcement (*contraverga*) required? | ☐ | |
| E-11 | Minimum pier width between openings, and between an opening and a wall end/intersection, for structural masonry. | ☐ | |
| E-12 | Wall slenderness limits (effective height/thickness) for typical blocks (14 cm, 19 cm…). | ☐ | |
| E-13 | Rule of thumb for a "too much opening" ratio in a wall line / bracing in each direction. | ☐ | |
| E-14 | Default residential loads to show (dead/live per area; roof; water tank). | ☐ | |

## Batch 2b — follow-ups from batch 1 (clause numbers for what was recalled from memory)

> Brief written 2026-11-17 as a shared Claude doc in Portuguese ("Prumo — perguntas para o engenheiro (lote 2b)"): E-30, E-31, E-33…E-38 as a fill-in table, VC-005 hand calc (E-32), E-39 implementation check. Waiting for the owner to forward it.

| # | Question | Status | Answer |
|---|---|---|---|
| E-30 | Clause in NBR 16868-1 for "every opening in a structural wall needs a lintel" (and for arching over openings); NBR 6118 item for slab support reactions (45° split, VC-002b). | ☐ | |
| E-31 | Clause for the concentrated-load / local bearing check at lintel supports (narrow piers, VC-004). | ☐ | |
| E-32 | Review VC-005 (self-weight of a wall with one opening) — it wasn't in the batch-1 brief. | ☐ | |
| E-33 | Clause restricting embedded pipes / chases in structural walls (R-WALL-004); is horizontal vs vertical the key distinction? | ☐ | |
| E-34 | Lintel bearing (R-OPEN-002): a minimum in cm, or in block modules? Source? | ☐ | |
| E-35 | Slenderness limits (24 / 30) and the reduction factor — item numbers in NBR 16868-1. | ☐ | |
| E-36 | Minimum thickness of a structural wall (14 cm?) and the low-building exception — item number. | ☐ | |
| E-37 | Masonry modulus E (≈ 800·f_pk / 600·f_pk) — item number; needed before any deflection is shown. | ☐ | |
| E-38 | Small-opening exception for R-OPEN-001: is there a sourced size below which it's only advisory? | ☐ | |
| E-39 | Confirm implementation details of the 4 rules built since batch 1: R-WALL-004 (horizontal warning / vertical advisory; half walls flagged), R-OPEN-006 (windows only), R-RING-001 (full walls only), R-JOINT-001 (one finding per junction; at a T the stem's mark decides). | ☐ | |

## Batch 3 — materials & calculations (before Phase 3)

| # | Question | Status | Answer |
|---|---|---|---|
| E-20 | Typical Brazilian block types to ship in the material pack (ceramic/concrete, structural vs sealing), and unit weights/strengths, with sources. | ☐ | |
| E-21 | How to treat arching action over openings in a simplified way (Q-033). | ☐ | |
| E-22 | Review the hand-calculated validation cases VC-001…005 (`STRUCTURAL_ANALYSIS.md` §5, drafted 2026-11-16 with given test inputs; also: is "wall's own weight counts at its base" and "load over an opening goes half to each side" fine as the first simplified methods?). | ✅ 2026-11-17 (VERIFIED-UNSIGNED) | Arithmetic of all five correct. Premises: VC-001/002 E is concrete's and the section is uncracked → formula test only, never a realistic deflection; VC-003 4 × 6 m (ratio 1.5) is two-way for a solid slab → state "one-way joist slab" and add VC-003b (two-way); VC-004 ignores wall interaction, gross area is consistent with NBR 16868; VC-005 the load arrives concentrated at lintel bearings (local check governs narrow piers). "Self-weight at the base" and "half each side" OK as first methods, not as complete checks. |
| E-23 | Characteristic vs design values: which should the UI show to a beginner? | ☐ | |

## Batch 4 — product & credit

| # | Question | Status | Answer |
|---|---|---|---|
| E-30 | Are you OK being credited publicly as a reviewer (name/handle/none)? We'll always say "reviewed", never "certified". (Q-069/086) | ☐ | |
| E-31 | Would you use the Structural Vision yourself? What would make it useful for a professional at an early design stage? | ☐ | |
| E-32 | For the handoff workflow (architect → engineer → architect), what would you want to mark or annotate on an architect's model? (Q-076, ADR-029) | ☐ | |
