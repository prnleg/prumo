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
| `br-nbr` | NBR 6120 (loads), 6123 (wind), 6118 (concrete), 16868 (structural masonry), 7190 (timber), 8800 (steel), 15575 (performance) | Brazil |
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

| ID | Rule | Applies to | Severity | Notes / doubts |
|---|---|---|---|---|
| R-OPEN-001 | Opening in a bearing wall without a lintel defined | masonry, timber | warning | In RC frame + infill a lintel is still needed for the masonry above, but the severity is lower. **Spike B (s#11): implemented in `spikes/rule`** with source `UNSOURCED – placeholder`, shown UNVERIFIED; no numeric threshold (presence check only). Hand check = the case table in `spikes/rule/test/rule.test.ts`. Source + exceptions → E-06. |
| R-OPEN-002 | Lintel bearing length each side < ⟨placeholder⟩ | masonry, timber | warning | Commonly cited values exist; **must source**. |
| R-OPEN-003 | Pier between two openings narrower than ⟨placeholder⟩ (or ⟨ratio⟩ × wall thickness) | structural masonry | warning/critical | Pier stress concentration. |
| R-OPEN-004 | Opening closer than ⟨placeholder⟩ to a wall end or intersection | structural masonry | warning | |
| R-OPEN-005 | Total opening length in a wall > ⟨ratio⟩ of the wall length | masonry, timber | advisory | Proxy for loss of bracing. |
| R-OPEN-006 | Opening overlaps another opening / extends past the wall end / above the wall height | all | critical (geometry error) | This is really a **model validity** check. Should it block the edit instead? (Q) |
| R-WALL-001 | Wall slenderness (height/thickness) > ⟨placeholder⟩ | masonry | warning | Value is code- and support-dependent. |
| R-WALL-002 | Bearing wall deleted or moved → a slab edge loses support | all with slabs | critical | Needs ADR-017. |
| R-WALL-003 | Free-standing wall end (not braced by a perpendicular wall) longer than ⟨placeholder⟩ | masonry | advisory | |
| R-BRACE-001 | Bracing-wall length in direction X (or Y) < ⟨ratio⟩ of the building dimension | masonry, timber | warning | Simplified lateral check. |
| R-LOAD-001 | Upper-storey bearing wall not supported below | multi-storey | critical | Phase 5. |
| R-LOAD-002 | Opening in upper wall not aligned with the opening below (load path jog) | multi-storey masonry | advisory | Phase 5. |
| R-COL-001 | Column removed → beam/slab loses support | RC frame | critical | |
| R-SLAB-001 | Slab span > ⟨placeholder⟩ for its thickness/material | all | advisory | span/depth ratio rules exist per code. |
| R-MAT-001 | Material incompatible with the selected system | all | critical | Ties to R-20. |
| R-FOUND-001 | Ground-floor bearing wall placed off the original footprint | renovation mode | advisory | Q-020. |

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
Status: draft

VC-001b — Same formulas, second case (CLAUDE.md: ≥ 2 cases per calculator)
Input:  L = 2.00 m · w = 12.0 kN/m · b × h = 0.14 × 0.30 m · E = 25·10⁶ kN/m²
Hand:   I = 0.14 × 0.027 / 12 = 3.15·10⁻⁴ m⁴
        M = 12 × 4 / 8 = 6.00 kN·m · V = 12 × 2 / 2 = 12.0 kN
        δ = 5 × 12 × 16 / (384 × 25·10⁶ × 3.15·10⁻⁴) = 960 / 3 024 000 = 3.175·10⁻⁴ m
Expected: M = 6.00 kN·m · V = 12.0 kN · δ = 0.317 mm
Status: draft

VC-002 — One-way slab, tributary load to two parallel walls
Source: hand calc by Claude (AI), 2026-11-16. Method: one-way slab simply supported on two
        parallel walls → each wall takes half the span ("tributary width" = span / 2).
Input:  walls W-1 and W-2 parallel, 6.0 m long, 4.0 m apart (slab span L = 4.0 m, spans W-1 → W-2)
        q = 5.0 kN/m² total on the slab (given)
Hand:   line load on each wall = q × L / 2 = 5.0 × 4.0 / 2 = 10.0 kN/m
        total per wall = 10.0 × 6.0 = 60.0 kN
        check: whole slab = 5.0 × 4.0 × 6.0 = 120 kN = 60 + 60 ✔ (no load lost or created)
Expected: 10.0 kN/m on W-1 and on W-2; 0 on the two short end walls (one-way assumption)
Status: draft · ❓ the "0 on end walls" is what one-way means; two-way slabs (45° rule, §4 item 2) are a separate case.

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
Status: draft · ❓ engineer: is "own weight at the base" the convention you'd show a beginner? (E-22)

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
Status: draft · ❓ engineer: is "half to each side" acceptable as the first simplified method? (E-21)

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
Status: draft · Not included: lintel/frame weight, finishes (plaster) — a later case.
```

Still to write (later): two-way slab (45° rule), lintel with triangular/arching load (Q-033), wall with two openings + pier (VC-004 + VC-005 combined).

## 6. Unverified values register

Every placeholder threshold/material value lives here until verified.

| Key | Value | Unit | Profile | Source | Status |
|---|---|---|---|---|---|
| *(empty)* | | | | | |

## 7. Known simplifications (shown to users)

- No foundations/soil.
- No lateral analysis beyond rule-of-thumb bracing checks.
- Linear elastic assumptions; no cracking/creep.
- Walls treated as uniform; no workmanship variability.
- Connections assumed adequate.
- Openings rectangular.
