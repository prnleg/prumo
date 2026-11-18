# STRUCTURAL ANALYSIS — tiers, rule catalogue, validation

> Status: **design draft.** No rule here is implemented or verified. All thresholds are placeholders until a source is recorded (ADR-018).

## 1. Architecture of analysis (proposed)

```
Model snapshot (immutable)
   │
   ├─► Derivation step: build the "structural model" from the architectural model
   │      - classify walls (bearing / non-bearing / unknown) → ADR-017
   │      - find supports, spans, piers, junctions
   │      - record ASSUMPTIONS (each with an id)
   │
   ├─► Rule engine (Tier 0): pure functions  rule(structModel, profile) → Finding[]
   ├─► Calculators (Tier 1): pure functions → results + calculation trace
   │
   └─► Findings diff vs previous snapshot → "new / resolved / unchanged"
```

- **Profile** = country code + construction system (ADR-004/009). Holds thresholds, default loads, safety factors.
- **Lives in `module-structural`** (ADR-019), not in the core.

### Code profiles (ADR-009 accepted: BR + EU)

| Profile id | Codes (*verify editions*) | Notes |
|---|---|---|
| `br-nbr` | NBR 16868-1/-2/-3:2020 (structural masonry: design / execution / tests), 6120:2019 (actions), 8681:2003 (actions & safety), 6123 (wind — check revision), 6118:2023 (concrete: lintels, tie beams, slabs), 6136 (concrete blocks — check), 15270-1 (ceramic blocks — check), 6122:2019 (foundations — out of scope, cited as a limit), 15575 (performance — check), **16280 (renovations — Prumo's main use case; useful for "talk to a professional")**, 7190 (timber), 8800 (steel). ⚠️ NBR 15961 / 15812 were **replaced** by 16868: never cite them. Editions per the engineer contact (E-03, 2026-11-17); "check" = to confirm. No Brazilian normative simplified method for houses known; EN 1996-3 = inspiration only. | Brazil |
| `eu-en-rec` | EN 1990 (basis), EN 1991 (actions), EN 1992 (concrete), EN 1996 (masonry), EN 1995 (timber), EN 1993 (steel) | **DEFERRED (session #2).** Later, as an installable rule-pack plugin. |

v1 = `br-nbr` only. Packs: **structural masonry first**, then (likely) a column-grid frame system (Q-071).

### Rule packs (one per construction system — ADR-004)

`rulePack = { system: "structural-masonry" | "rc-frame-infill" | "timber-frame" | ..., rules: RuleId[] }`
A rule's thresholds come from `profile × system`. v1 ships **one** pack (Q-055; default: structural masonry).

Profile interface must handle both:
- different load-combination formats and partial factors,
- different material class naming (EN `C20/25` vs NBR `fck = 20 MPa`; masonry unit classes differ too),
- values that are "national choice" in EN.
- All analysis is **pure and deterministic**, so it can run in a Web Worker and be cached per snapshot.

### Finding shape (proposed)

```ts
type Finding = {
  ruleId: string;            // "R-OPEN-001"
  severity: "critical" | "warning" | "advisory" | "info";
  confidence: "rule-of-thumb" | "simplified-calc" | "analysis";
  elementIds: string[];
  message: string;           // plain language, ≤ 3 sentences
  assumptions: string[];     // assumption ids, shown to the user
  source: string | "UNSOURCED";
  notConsidered: string[];
  trace?: CalcTrace;         // Tier 1: formula, inputs, outputs with units
  fingerprint: string;       // stable hash (ruleId + sorted elementIds + key params) for diffing
};
```

**Spike B adjustments (session #11):** `message` → `messageKey` + typed `params` (ADR-021; lengths formatted per locale at display time, element labels generated); `source`, `notConsidered`, `terms` live on the **rule definition**, not copied into every finding; the UI shows UNVERIFIED unless the rule has a source **and** a recorded engineer review (CLAUDE.md rules 6 + 17). Fingerprint = `ruleId|elementIds` (no params), so moving/resizing an opening keeps the "same" finding; adding a lintel resolves it.

❓ Doubt: the **fingerprint** decides whether a finding is "the same" across edits. If an element's ID changes on copy/mirror, the diff will show a resolved + new pair instead of "unchanged". Acceptable? (Lean: yes, but IDs must stay stable on *move*.)

## 2. Tiers

| Tier | What | Confidence label | Phase |
|---|---|---|---|
| 0 | Geometric/topological rules | rule-of-thumb | 2 |
| 1 | Hand-calc formulas (load takedown, lintel, wall stress) | simplified-calc | 3 |
| 2 | 2D frame stiffness analysis (beams/columns) | analysis | 6+ (optional) |
| 3 | FEA (plates/shells/solids) | — | **Non-goal** |

## 3. Tier 0 rule catalogue (candidates — need owner + source)

Thresholds shown as `⟨placeholder⟩` are **not** real values.

Order = engineer contact's ranking (E-02, 2026-11-17: "most common real-world mistakes when residents renovate"). Review levels per ADR-041. "Engineer hint" = a value recalled from memory or marked check: **not a source**, stays `UNSOURCED – placeholder` until a clause is confirmed.

| # | ID | Rule | Applies to | Severity | Review | Notes / engineer hints |
|---|---|---|---|---|---|---|
| 1 | R-WALL-002 | Load-bearing wall deleted or moved | masonry (all walls by default, ADR-017) | critical | rule: VERIFIED-UNSIGNED (E-02) | "Error no. 1 in renovations." **Implemented** (ADR-043 baseline): removed / moved or resized (> 1 mm) / no longer full or half → critical. |
| 2 | R-OPEN-NEW | New or widened opening in a load-bearing wall, vs the original plan | masonry | critical / warning | rule: VERIFIED-UNSIGNED (E-02) | **New.** "Most real problems start with 'I only widened the door'." **Implemented** (ADR-043): new → critical, wider / taller / lower sill → warning, slid → nothing. |
| 3 | R-WALL-004 | Chase cut in a load-bearing wall for pipes/wiring, esp. horizontal | masonry | warning (horizontal) / advisory (vertical) | rule: VERIFIED-UNSIGNED (E-02); clause: UNVERIFIED (E-33) | **New. Implemented**: one finding per chase on a load-bearing wall (full or half, not marked partition). Horizontal → warning ("esp. horizontal", E-02), vertical → advisory. Presence only — no depth/length limit until E-33; height and depth not stored. Reduces the resisting section. |
| 4 | R-OPEN-001 | Opening in a load-bearing wall without a lintel (or without an element designed to span it) | masonry | warning | rule: VERIFIED-UNSIGNED (E-06); clause: UNVERIFIED (E-30) | **Implemented** (Phase 2). Presence check, no threshold. Opening reaching the tie beam/slab: that element **is** the lintel — text: "the element above the opening must have been designed to span it". **No small-opening exception** without a source. Arching may reduce the lintel's load, never removes it. |
| 5 | R-OPEN-006 | Window without a sill reinforcement (contraverga) | masonry | advisory | rule: VERIFIED-UNSIGNED (E-02) | **New. Implemented** (windows in load-bearing walls without `contraverga`). Classic 45° crack at the lower window corner. Good practice → advisory. |
| 6 | R-OPEN-002 | Lintel bearing length each side < ⟨placeholder⟩ | masonry | warning | UNVERIFIED | Engineer hint: common practice 20 cm (NBR 8545 for partitions, check); in modular masonry "half a block to one block" each side → **cm or modules?** (E-34). |
| 7 | R-OPEN-003 | Pier between two openings narrower than ⟨placeholder⟩ | structural masonry | warning / critical | UNVERIFIED | Local bearing at lintel supports governs narrow piers (VC-004 note). |
| 8 | R-OPEN-004 | Opening closer than ⟨placeholder⟩ to a wall end or junction | structural masonry | warning | UNVERIFIED | |
| 9 | R-WALL-005 | Load-bearing wall without vertical continuity (standing on a slab or over an opening) | masonry, multi-storey / extensions | critical | rule: VERIFIED-UNSIGNED (E-02) | **New.** Typical of extensions ("puxadinho") and added upper floors. Phase 5 for full multi-storey. |
| 10 | R-WALL-001 | Wall slenderness (effective height / effective thickness) > ⟨placeholder⟩ | masonry | warning | UNVERIFIED | Engineer hint (memory, check): λ limit 24 unreinforced / 30 reinforced; reduction R = 1 − (λ/40)³ — item number → E-35. |
| — | R-WALL-003 | Free-standing wall end longer than ⟨placeholder⟩ | masonry | advisory | UNVERIFIED | Later. |
| — | R-BRACE-001 | Bracing length in X (or Y) < ⟨ratio⟩ of the building dimension | masonry | warning | UNVERIFIED | Later: "rarely the problem in a single-storey house with walls both ways". |
| — | R-OPEN-005 | Total opening length > ⟨ratio⟩ of the wall length | masonry | advisory | UNVERIFIED | Later. |
| — | R-WALL-006 | Load-bearing wall thinner than ⟨placeholder⟩ | structural masonry | warning | UNVERIFIED | **New.** Engineer hint (memory, check): 14 cm, with an exception for low buildings → E-36. |
| — | R-PROT-001 | A wall someone marked "load-bearing, don't remove" was removed, moved/resized (> 1 mm) or is no longer a full/half wall | all systems | critical | UNVERIFIED (not an engineering rule: it reports a person's own marker, ADR-029 / Q-077 b) | **Implemented** (ADR-044 slice 2). Stays until the marker is removed or renewed ("protect it where it is now"). |
| — | R-JOINT-001 | Wall junction without bonding (no interlocking, no ties or grout) | structural masonry | warning | rule: VERIFIED-UNSIGNED (E-02) | **New. Implemented**: one finding per junction of load-bearing walls with no wall end marked `bonded` there. Was hidden behind "connections assumed adequate" (removed, §7). |
| — | R-RING-001 | No top tie beam (cinta de respaldo) under the slab/roof | structural masonry | warning | rule: VERIFIED-UNSIGNED (E-02) | **New. Implemented**: full load-bearing walls without `tieBeam` (half walls carry no slab). |
| — | R-OPEN-007 | Opening overlaps another / passes the wall end / above the wall height | all | — | — | Was R-OPEN-006 (renumbered: 006 is now the contraverga rule). Not a finding: the editor already refuses these edits (invariants I-1…I-3). |
| — | R-LOAD-001 | Upper-storey bearing wall not supported below | multi-storey | critical | UNVERIFIED | Phase 5 (overlaps R-WALL-005). |
| — | R-LOAD-002 | Upper opening not aligned with the one below | multi-storey masonry | advisory | UNVERIFIED | Phase 5. |
| — | R-COL-001 | Column removed → beam/slab loses support | RC frame | critical | UNVERIFIED | RC pack (later). |
| — | R-SLAB-001 | Slab span > ⟨placeholder⟩ for its thickness | all | advisory | UNVERIFIED | |
| — | R-MAT-001 | Material incompatible with the selected system | all | critical | UNVERIFIED | Ties to R-20. |
| — | R-FOUND-001 | Ground-floor bearing wall off the original footprint | renovation | advisory | UNVERIFIED | Q-020. |

**Construction system (E-01, 2026-11-17):** the project asks for it up front — structural masonry · reinforced-concrete frame + infill · **"não sei" (don't know)** → apply the masonry rules (conservative) and say that this is the assumption. Old solid-brick houses without columns ("alvenaria resistente") are **not** standardized structural masonry: say so, don't apply the masonry pack silently. The RC pack comes later (its rules need columns/beams the beginner can't model yet).

## 4. Tier 1 calculators (candidates)

1. **Self-weight** of each element (volume × unit weight).
2. **Slab load distribution** (one-way: half-span to each support; two-way: 45° yield-line approximation — *simplified; document clearly*).
3. **Load takedown** per wall per storey (kN/m).
4. **Wall compressive stress** σ = N/(t·1 m) vs allowable (from profile), with the slenderness reduction factor (code-dependent).
5. **Lintel check**: M = wL²/8, V = wL/2, δ = 5wL⁴/(384EI) vs allowable, and bearing stress at the ends.
   - ❓ Load on the lintel: everything above (conservative) vs triangular "arching" load (more realistic for masonry). Q-033.
6. **Pier stress**: the load that would've gone through the opening is redistributed to the adjacent piers (simplified).

Each result carries a **trace**:
```
Lintel L-3 over opening O-7
 span L = 1.20 m (opening width 1.00 + ...)       ← assumption A-14
 w = 8.4 kN/m (wall above 2.1 kN/m + slab 6.3 kN/m)
 M = w·L²/8 = 8.4 × 1.44 / 8 = 1.51 kN·m
 ...
```

## 5. Validation cases (must exist before any calculator ships)

Every calculator needs **≥ 2 hand-calculated cases** written here *and* as tests. Template:

```
VC-xxx — <name>
Source: <textbook, page> or "hand calc by <who>, <date>"
Input: ...
Expected: ... (with units, tolerance)
Status: draft | verified-by-<name>
```

**First five cases (session #11, 2026-11-16).** Status of all: **draft — hand calc by Claude (AI), arithmetic re-checked with a script; NOT reviewed by an engineer (E-22).**
Rules for these cases:
- Every input is a **given test input**, chosen for easy arithmetic. None is a material value, default load, or recommendation (ADR-018). E.g. "γ = 14 kN/m³" below is *not* "the unit weight of a Brazilian block".
- Only textbook mechanics (statics, simply supported beam formulas, σ = N/A). No code clauses, no safety factors, no allowable values: these test the *calculator*, not a code check.
- Units: kN, m, kN/m, kN/m² (kPa), MPa = 1000 kPa. (ADR-006 still open; cases are unit-explicit so they survive whatever it decides.)
- Tolerance: relative 1e-6 on the calculator output (exact arithmetic), unless stated.

```
VC-001a — Simply supported lintel, uniform load (UDL)
Source: hand calc by Claude (AI), 2026-11-16. Formulas: standard simply supported beam
        (M = wL²/8, V = wL/2, δ = 5wL⁴/(384EI)); any mechanics textbook.
Input:  span L = 1.20 m (GIVEN; how L follows from opening + bearing is R-OPEN-002/E-10, not tested here)
        w = 8.0 kN/m (total, given)
        section b × h = 0.14 m × 0.20 m, rectangular → I = b·h³/12
        E = 25 000 MPa = 25·10⁶ kN/m² (given test input)
Hand:   I  = 0.14 × 0.20³ / 12 = 0.14 × 0.008 / 12 = 9.3333·10⁻⁵ m⁴
        M  = 8.0 × 1.20² / 8 = 8.0 × 1.44 / 8 = 1.44 kN·m   (at midspan)
        V  = 8.0 × 1.20 / 2 = 4.80 kN                      (at each support = each reaction)
        δ  = 5 × 8.0 × 1.20⁴ / (384 × 25·10⁶ × 9.3333·10⁻⁵)
           = 5 × 8.0 × 2.0736 / (384 × 2333.33) = 82.944 / 896 000 = 9.257·10⁻⁵ m
Expected: M = 1.44 kN·m · V = 4.80 kN · reactions 4.80 + 4.80 = 9.60 kN = w·L ✔ · δ = 0.0926 mm
Status: draft · Review (E-22, 2026-11-17): arithmetic ✅ VERIFIED-UNSIGNED (ADR-041; brief numbered it VC-001).
        ⚠️ FORMULA TEST ONLY: E = 25 000 MPa is a concrete modulus (a grouted masonry lintel is far
        softer) and δ uses the uncracked gross section — a real RC lintel works cracked, deflecting
        several times more. Never show this δ to users as realistic.

VC-001b — Same formulas, second case (CLAUDE.md: ≥ 2 cases per calculator)
Input:  L = 2.00 m · w = 12.0 kN/m · b × h = 0.14 × 0.30 m · E = 25·10⁶ kN/m²
Hand:   I = 0.14 × 0.027 / 12 = 3.15·10⁻⁴ m⁴
        M = 12 × 4 / 8 = 6.00 kN·m · V = 12 × 2 / 2 = 12.0 kN
        δ = 5 × 12 × 16 / (384 × 25·10⁶ × 3.15·10⁻⁴) = 960 / 3 024 000 = 3.175·10⁻⁴ m
Expected: M = 6.00 kN·m · V = 12.0 kN · δ = 0.317 mm
Status: draft · Review (E-22, 2026-11-17): arithmetic ✅ VERIFIED-UNSIGNED (ADR-041; brief numbered it VC-002). Same ⚠️ as VC-001a: formula test only.

VC-002 — One-way slab (precast joist slab, joists spanning 4 m), tributary load to two parallel walls
Source: hand calc by Claude (AI), 2026-11-16. Method: one-way slab simply supported on two
        parallel walls → each wall takes half the span ("tributary width" = span / 2).
        ⚠️ One-way BY CONSTRUCTION (joists, "laje de vigota"), not by proportion: a solid slab of
        4 × 6 m (ratio 1.5 < 2) spans both ways → VC-002b (engineer, E-22).
Input:  walls W-1 and W-2 parallel, 6.0 m long, 4.0 m apart (slab span L = 4.0 m, spans W-1 → W-2)
        q = 5.0 kN/m² total on the slab (given)
Hand:   line load on each wall = q × L / 2 = 5.0 × 4.0 / 2 = 10.0 kN/m
        total per wall = 10.0 × 6.0 = 60.0 kN
        check: whole slab = 5.0 × 4.0 × 6.0 = 120 kN = 60 + 60 ✔ (no load lost or created)
Expected: 10.0 kN/m on W-1 and on W-2; 0 on the two short end walls (one-way assumption)
Status: draft · Review (E-22, 2026-11-17): arithmetic ✅ VERIFIED-UNSIGNED (ADR-041; brief numbered it VC-003). Premise corrected as above.

VC-002b — Two-way solid slab on four walls, 45° yield-line (envelope) split
Source: hand calc by Claude (AI), 2026-11-17, method suggested by the engineer contact (E-22;
        reference: support reactions of slabs in NBR 6118 — item number to check, E-30).
Input:  same slab 4.0 × 6.0 m, q = 5.0 kN/m², supported on all four walls
Hand:   lines at 45° from each corner split the slab into 2 triangles (short sides) + 2 trapezoids
        triangle on a 4 m wall: base 4.0, height 2.0 → area = 4.0 × 2.0 / 2 = 4.0 m² → 20.0 kN
            → 20.0 / 4.0 = 5.0 kN/m
        trapezoid on a 6 m wall: (24.0 − 2 × 4.0) / 2 = 8.0 m² → 40.0 kN → 40.0 / 6.0 = 6.667 kN/m
        check: 20 + 20 + 40 + 40 = 120 kN = 5.0 × 4.0 × 6.0 ✔
Expected: 6.667 kN/m on each 6 m wall · 5.0 kN/m on each 4 m wall (vs 10.0 / 0 one-way, VC-002)
Status: draft (new; not yet reviewed)

VC-003 — Two-storey load takedown on one wall
Source: hand calc by Claude (AI), 2026-11-16. Method: add loads from top to bottom; a wall's
        own weight counts at its base.
Input:  same wall line on both storeys, t = 0.14 m, storey wall height h = 2.70 m
        γ = 14 kN/m³ (given test input) → wall self-weight per storey = t × h × γ
        roof slab onto the upper wall: 6.0 kN/m (given)
        floor slab onto the ground wall: 10.0 kN/m (given; = VC-002 result)
Hand:   self-weight per storey = 0.14 × 2.70 × 14 = 5.292 kN/m
        top of upper wall      = 6.000
        base of upper wall     = 6.000 + 5.292           = 11.292 kN/m
        top of ground wall     = 11.292 + 10.000          = 21.292 kN/m
        base of ground wall    = 21.292 + 5.292           = 26.584 kN/m
        stress at base, per 1 m of wall: σ = N / (t × 1 m) = 26.584 / 0.14 = 189.9 kN/m² = 0.190 MPa
Expected: N = 26.584 kN/m · σ = 0.1899 MPa (no slenderness reduction, no safety factors)
Status: draft · Review (E-22, 2026-11-17): arithmetic ✅ VERIFIED-UNSIGNED (ADR-041; brief numbered it VC-004). "Own weight at the base" OK as a first method for
        compression, not as a complete check (buckling/slenderness uses a reduction factor). Ignores
        load sharing between bonded walls (spread at ~45°). Gross area is consistent with NBR 16868.
        γ = 14 kN/m³ plausible for hollow concrete block without grout — still a given test input.

VC-004 — Pier between two openings, redistributed load
Source: hand calc by Claude (AI), 2026-11-16. Method (simplified, §4 item 6): the load that would
        sit over each opening goes half to each side; arching ignored (conservative per Q-033).
Input:  line load at lintel level w = 20.0 kN/m (given) · wall t = 0.14 m
        opening A 1.00 m wide · pier 0.80 m · opening B 1.20 m wide (A | pier | B)
Hand:   pier's own share       = 0.80 × 20 = 16.0 kN
        half of A              = 0.5 × 1.00 × 20 = 10.0 kN
        half of B              = 0.5 × 1.20 × 20 = 12.0 kN
        pier load P = 38.0 kN
        pier stress σ = P / (0.80 × 0.14) = 38.0 / 0.112 = 339.3 kN/m² = 0.339 MPa
        cross-check: without the openings the same 0.80 m would carry 16 kN → ×2.375
Expected: P = 38.0 kN · σ = 0.3393 MPa
Status: draft · Review (E-22, 2026-11-17): arithmetic ✅ VERIFIED-UNSIGNED (ADR-041; brief numbered it VC-005). "Half to each side" OK for the TOTAL reaching each side;
        wrong as a picture of how it reaches the pier: it arrives concentrated at the lintel bearings
        (pier edges), so the local bearing stress is much higher than 0.339 MPa — that check governs
        narrow piers (future case; clause → E-31).

VC-005 — Self-weight of a wall with one opening (subtract the opening!)
Source: hand calc by Claude (AI), 2026-11-16.
Input:  wall 4.00 m × 2.70 m, t = 0.14 m, γ = 14 kN/m³ (given test input)
        one window 1.20 m × 1.20 m (fully inside the wall)
Hand:   gross face area = 4.00 × 2.70 = 10.80 m²
        opening area    = 1.20 × 1.20 = 1.44 m²
        net area        = 9.36 m² → volume 9.36 × 0.14 = 1.3104 m³
        weight          = 1.3104 × 14 = 18.346 kN
        the classic bug (no subtraction): 10.80 × 0.14 × 14 = 21.168 kN → +15.4 % too high
Expected: 18.346 kN (and a test that FAILS if the opening isn't subtracted)
Status: draft · Not included: lintel/frame weight, finishes (plaster) — a later case. Not in the
        batch-1 brief (not reviewed) → E-32.
```

Still to write (later): two-way slab (45° rule), lintel with triangular/arching load (Q-033), wall with two openings + pier (VC-004 + VC-005 combined).

## 6. Unverified values register

Every placeholder threshold/material value lives here until verified.

| Key | Value | Unit | Profile | Source | Status |
|---|---|---|---|---|---|
| r-wall-001.lambda-max | 24 unreinforced / 30 reinforced (memory) | — | br-nbr masonry | UNSOURCED – placeholder (engineer hint, E-35) | UNVERIFIED |
| r-wall-001.reduction | R = 1 − (λ/40)³ (memory) | — | br-nbr masonry | UNSOURCED – placeholder (engineer hint, E-35) | UNVERIFIED |
| r-wall-006.t-min | 140 (memory; exception for low buildings) | mm | br-nbr masonry | UNSOURCED – placeholder (engineer hint, E-36) | UNVERIFIED |
| r-open-002.bearing-min | 200 (common practice) or ½–1 block (modular) | mm / modules | br-nbr masonry | UNSOURCED – placeholder (engineer hint, E-34) | UNVERIFIED |
| masonry.E | ≈ 800·f_pk (concrete block) / 600·f_pk (ceramic) (memory) | MPa | br-nbr masonry | UNSOURCED – placeholder (engineer hint, E-37) | UNVERIFIED |

## 7. Known simplifications (shown to users)

Revised with the engineer contact (E-05, 2026-11-17). Shown as part of "what was NOT checked" (SAFETY: no single "no issues" sentence, no green).

- Doesn't consider foundations or soil (including extra load on an existing foundation).
- No lateral analysis (wind) beyond rule-of-thumb bracing checks.
- **Calculations are textbook estimates, without the code's safety factors** (was "linear elastic; no cracking/creep" — technically odd: NBR 16868 designs at the ultimate limit state).
- **Doesn't check connections** (wall–wall bonding, wall–slab, wall–roof) (was "connections assumed adequate", which reads as "checked and OK").
- Doesn't check material strength (block, prism, mortar, grout) or whether the block used is the designed one.
- Doesn't know whether the drawing matches the real building (a wall drawn as block may be something else; an opening may already have been cut).
- Doesn't consider existing damage: cracks, damp, settlement, corroded lintel reinforcement — **a cracked wall can show no findings**.
- Doesn't consider new loads from the renovation: water tank, new slab, a second floor, a heavier roof, planters.
- Doesn't consider roof thrust (unbraced trusses/rafters pushing the top of the wall).
- Doesn't consider point loads or load sharing between walls (spread at ~45°, wall groups).
- Doesn't consider construction sequence or shoring: opening a wall without propping is dangerous even if the final layout is fine.
- Walls treated as uniform; no workmanship variability.
- Openings rectangular.
