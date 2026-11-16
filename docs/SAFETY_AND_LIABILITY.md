# SAFETY & LIABILITY

**Read before building any analysis UI, writing any finding text, or writing any README/marketing copy.**

> **Tone update (2026-11-15, owner):** this isn't a real-engineering product yet; "the basics will be more than enough". So: keep the wording rules and the one-line footer, keep onboarding light, and **don't** build heavy legal flows. The wording rules stay because the project is open source and strangers *will* use it for real buildings (R-28).

## Position

This app is an **educational and exploratory** tool. Its structural checks are **simplified, partial, and unverified by a licensed professional** (unless a specific rule says otherwise, with the reviewer's name and date).

Real structural decisions (removing walls, adding openings to load-bearing walls, changing materials) need a qualified professional. In Brazil that typically means an engineer/architect with an ART (CREA) or RRT (CAU); other countries have equivalents. *(Verify for the owner's country.)*

## Wording rules (enforced by tests)

**"Following the rules" (owner's goal, ADR-026):** show as *"Matches the {N} checks in profile Brazil – structural masonry (v0.3)"* / *"{k} checks not matched"*. Never "compliant", "passes", or "approved".

**Banned words/phrases in UI strings** (case-insensitive): "safe", "is safe", "approved", "certified", "compliant", "passes code", "structurally sound", "OK to build", "guaranteed", "no risk".

**Required phrasing:**
- No findings → *"No issues detected by the {N} checks implemented. These checks are simplified and don't cover {list}. They don't replace a structural engineer."*
- Finding → *"Possible issue: …"* / *"This check suggests …"*, never *"This will fail."*

**No green "pass" state.** Use neutral grey for "no findings from this check".

## Every finding must show

1. Rule ID + name
2. Severity: `critical` / `warning` / `advisory` / `info`
3. Plain-language explanation (≤ 3 sentences)
4. Elements involved (clickable)
5. **Assumptions used** (e.g. "Wall W-12 assumed load-bearing because slab S-2 spans onto it")
6. **Confidence of the check**: `rule-of-thumb` / `simplified-calc` / `analysis`
7. Source: code clause, textbook, or `UNVERIFIED`
8. "What this check does not consider"

## Persistent UI elements

- A permanent, small, non-dismissable footer: *"Learning tool, not engineering advice."*
- On first launch: a one-time explanation screen (not a wall of legal text: 5 short lines).
- Exports (PDF/PNG) carry a watermark line with the same disclaimer.

## Things the app will NOT do (even if asked later, without a new ADR + owner sign-off)

- Generate documents that look like official engineering reports, calculation memorials, or permit drawings.
- Suggest specific member sizes "to make it pass" (Q-018).
- Hide the assumptions behind a finding.

## If the owner is using this for a real building (Q-003)

The AI should say so plainly, once per relevant session, and keep helping with the tool, without nagging.
