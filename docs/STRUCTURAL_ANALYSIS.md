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

- VC-001 — Simply supported lintel, UDL. *(to write)*
- VC-002 — One-way slab, tributary load to two parallel walls. *(to write)*
- VC-003 — Two-storey load takedown on a single wall. *(to write)*
- VC-004 — Pier between two openings, redistributed load. *(to write)*
- VC-005 — Self-weight of a wall with one opening (subtract the opening area!). *(to write; classic bug: forgetting to subtract openings)*

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
