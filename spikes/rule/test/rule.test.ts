import { describe, expect, it } from "vitest";
import { diffFindings, runChecks } from "../src/engine";
import { cardText, explain, summary, type Ctx } from "../src/explain";
import { UNSOURCED, type RuleDef } from "../src/finding";
import { CATALOGUES, LOCALES, format, formatLength, leaves, slots, t, type Locale } from "../src/i18n";
import { SPIKE_PROFILE, sampleModel, type Model, type Profile } from "../src/model";
import { R_OPEN_001, RULES } from "../src/rules";

const run = (m: Model, p: Profile = SPIKE_PROFILE) => runChecks(m, p, RULES);
const cards = (m: Model, locale: Locale, p: Profile = SPIKE_PROFILE) => {
  const ctx: Ctx = { model: m, profile: p, locale };
  return run(m, p).findings.map((f) => explain(f, R_OPEN_001, ctx));
};

describe("R-OPEN-001 — opening in a bearing wall without a lintel", () => {
  // Hand check of the sample (src/model.ts):
  //   window 1 (o-a) in wall 1 (w-a): marked bearing, no lintel        → finding, assumption A-ROLE-1
  //   door 1   (o-b) in wall 2 (w-b): unmarked, profile assumes bearing → finding, assumption A-ROLE-2
  it("sample model → 2 findings with the right assumptions", () => {
    const r = run(sampleModel());
    expect(r.checksRun.map((x) => x.id)).toEqual(["R-OPEN-001"]);
    expect(r.findings.map((f) => [f.fingerprint, f.assumptions.map((a) => a.id)])).toEqual([
      ["R-OPEN-001|o-a|w-a", ["A-ROLE-1"]],
      ["R-OPEN-001|o-b|w-b", ["A-ROLE-2"]],
    ]);
    expect(r.findings.every((f) => f.severity === "warning" && f.confidence === "rule-of-thumb")).toBe(true);
  });

  it("unmarked walls are skipped when the profile toggle says so (ADR-017 stays open)", () => {
    const r = run(sampleModel(), { ...SPIKE_PROFILE, unmarkedWalls: "skip" });
    expect(r.findings.map((f) => f.fingerprint)).toEqual(["R-OPEN-001|o-a|w-a"]);
  });

  it("a drawn lintel clears the finding, whatever its length (length is not checked)", () => {
    const m = sampleModel();
    m.openings[0]!.lintel = { extendsEachSide: 0 };
    expect(run(m).findings.map((f) => f.fingerprint)).toEqual(["R-OPEN-001|o-b|w-b"]);
  });

  it("a wall marked non-bearing → no finding", () => {
    const m = sampleModel();
    m.walls[0]!.bearing = "non-bearing";
    m.walls[1]!.bearing = "non-bearing";
    expect(run(m).findings).toEqual([]);
  });

  it("an opening whose host wall is missing is ignored, not a crash", () => {
    const m = sampleModel();
    m.openings[0]!.host = "gone";
    expect(run(m).findings.map((f) => f.fingerprint)).toEqual(["R-OPEN-001|o-b|w-b"]);
  });

  it("is deterministic: input order never changes the output", () => {
    const a = sampleModel();
    const b = sampleModel();
    b.walls.reverse();
    b.openings.reverse();
    expect(JSON.stringify(run(b).findings)).toBe(JSON.stringify(run(a).findings));
  });
});

describe("fingerprint + diff (new / resolved / unchanged)", () => {
  it("moving or resizing the opening keeps the same finding", () => {
    const before = run(sampleModel()).findings;
    const m = sampleModel();
    m.openings[0]!.offset = 200;
    m.openings[0]!.width = 1800;
    const d = diffFindings(before, run(m).findings);
    expect([d.added.length, d.resolved.length, d.unchanged.length]).toEqual([0, 0, 2]);
  });

  it("adding a lintel resolves exactly that finding", () => {
    const before = run(sampleModel()).findings;
    const m = sampleModel();
    m.openings[1]!.lintel = { extendsEachSide: 200 };
    const d = diffFindings(before, run(m).findings);
    expect(d.resolved.map((f) => f.fingerprint)).toEqual(["R-OPEN-001|o-b|w-b"]);
    expect(d.added).toEqual([]);
  });
});

describe("explanation format", () => {
  // Hand: 1200 mm = 1.20 m; 800 mm = 0.80 m; 2550 mm = 2.55 m. pt-BR uses a decimal comma.
  it("formats lengths per locale", () => {
    expect([1200, 800, 2550].map((mm) => formatLength(mm, "en"))).toEqual(["1.20 m", "0.80 m", "2.55 m"]);
    expect([1200, 800, 2550].map((mm) => formatLength(mm, "pt-BR"))).toEqual(["1,20 m", "0,80 m", "2,55 m"]);
  });

  it("full card text, en (exact)", () => {
    expect(cardText(cards(sampleModel(), "en")[0]!, "en")).toBe(
      [
        "[Warning] R-OPEN-001 — Opening in a load-bearing wall without a lintel",
        "Possible issue: window 1 (1.20 m wide) is in wall 1, which this check treats as load-bearing, and no lintel is drawn over it. A lintel is a small beam over an opening that carries the wall above it. If this wall really is load-bearing, ask an engineer about a lintel for this opening.",
        "Elements: window 1, wall 1",
        "Assumptions used:",
        "  A-ROLE-1: You marked wall 1 as load-bearing.",
        "How this was checked: Rule of thumb: a quick check, no calculation.",
        "Source: UNVERIFIED: no source recorded yet, and not reviewed by an engineer.",
        "What this check does not consider:",
        "  - Whether a drawn lintel is long or strong enough (a separate check, not built yet).",
        "  - Whether a concrete band along the wall just above the opening (a bond beam) can replace the lintel.",
        "  - Whether a window also needs reinforcement below it (sill reinforcement).",
        "  - How much weight the wall actually carries.",
        "Terms:",
        "  - Load-bearing wall: a wall that holds up the floor or roof above it.",
        "  - Lintel: a small beam over a door or window opening.",
        "Learning tool, not engineering advice.",
      ].join("\n"),
    );
  });

  it("pt-BR message + default-role assumption (door in an unmarked wall)", () => {
    const c = cards(sampleModel(), "pt-BR")[1]!;
    expect(c.message).toBe(
      "Possível problema: a porta 1 (0,80 m de largura) está na parede 2, que esta verificação trata como portante, e não há verga desenhada sobre ela. " +
        "A verga é uma pequena viga sobre a abertura que sustenta a parede acima dela. " +
        "Se esta parede for mesmo portante, consulte um engenheiro sobre a verga desta abertura.",
    );
    expect(c.assumptions).toEqual([
      { id: "A-ROLE-2", text: "Ninguém marcou se a parede 2 é portante, e o perfil Brasil – alvenaria estrutural (0.0-spike) trata paredes sem marcação como portantes." },
    ]);
    expect(c.severityLabel).toBe("Atenção");
  });

  for (const L of LOCALES)
    it(`every card has all 8 required items, ≤ 3 sentences, "possible issue" phrasing (${L})`, () => {
      for (const c of cards(sampleModel(), L)) {
        expect(c.ruleId && c.name && c.severityLabel && c.message && c.confidence && c.source).toBeTruthy();
        expect(c.elements.length).toBeGreaterThan(0);
        expect(c.assumptions.length).toBeGreaterThan(0);
        expect(c.notConsidered.length).toBeGreaterThan(0);
        expect(c.message.match(/[.!?](\s|$)/g)!.length).toBeLessThanOrEqual(3);
        expect(c.message.startsWith(L === "en" ? "Possible issue:" : "Possível problema:")).toBe(true);
        expect(c.verified).toBe(false);
      }
    });

  it("source: UNSOURCED → UNVERIFIED; source without review → still UNVERIFIED; reviewed → named", () => {
    expect(R_OPEN_001.source).toBe("UNSOURCED – placeholder");
    const ctx: Ctx = { model: sampleModel(), profile: SPIKE_PROFILE, locale: "en" };
    const f = run(sampleModel()).findings[0]!;
    const sourced: RuleDef = { ...R_OPEN_001, source: "Fake book, p. 1" };
    expect(explain(f, sourced, ctx).source).toBe("Source: Fake book, p. 1. Not reviewed by an engineer yet (UNVERIFIED).");
    expect(explain(f, sourced, ctx).verified).toBe(false);
    const reviewed: RuleDef = { ...sourced, review: { by: "Test Reviewer", date: "2026-01-01" } };
    expect(explain(f, reviewed, ctx).source).toBe("Source: Fake book, p. 1. Reviewed by Test Reviewer on 2026-01-01.");
    expect(explain(f, reviewed, ctx).verified).toBe(true);
    expect(UNSOURCED).toBe("UNSOURCED – placeholder");
  });
});

describe("summary (no green pass state; plurals)", () => {
  const fakeRule = (id: string): RuleDef => ({ ...R_OPEN_001, id, run: () => [] });

  it("no findings, 1 check / 2 checks", () => {
    const m = sampleModel();
    m.openings.forEach((o) => (o.lintel = { extendsEachSide: 200 }));
    const one = runChecks(m, SPIKE_PROFILE, RULES);
    expect(summary(one, "en")).toBe(
      "No issues detected by the 1 check implemented. It is simplified and doesn't cover lintel sizes, actual loads, foundations or soil, and wind or other sideways forces. It doesn't replace a structural engineer.",
    );
    const two = runChecks(m, SPIKE_PROFILE, [...RULES, fakeRule("R-FAKE-002")]);
    expect(summary(two, "pt-BR")).toBe(
      "Nenhum problema detectado pelas 2 verificações implementadas. Essas verificações são simplificadas e não cobrem tamanho de vergas, cargas reais, fundações ou solo, e vento ou outras forças laterais. Não substituem um engenheiro estrutural.",
    );
  });

  it("findings: k and n pluralise independently", () => {
    const r = run(sampleModel());
    expect(summary(r, "en")).toBe("2 possible issues found by the 1 check implemented.");
    expect(summary(r, "pt-BR")).toBe("2 possíveis problemas encontrados pela 1 verificação implementada.");
    const m = sampleModel();
    m.openings[0]!.lintel = { extendsEachSide: 200 };
    expect(summary(run(m), "en")).toBe("1 possible issue found by the 1 check implemented.");
  });
});

describe("wording guard (SAFETY_AND_LIABILITY — banned words)", () => {
  const BANNED_EN = ["safe", "approved", "certified", "compliant", "passes code", "structurally sound", "ok to build", "guaranteed", "no risk"];
  // pt-BR equivalents (proposed in session #11; SAFETY lists only English).
  const BANNED_PT = ["segur", "aprovad", "certificad", "em conformidade", "estruturalmente sólid", "pode construir", "garantid", "sem risco"];
  const all = [...BANNED_EN, ...BANNED_PT];

  it("no catalogue string contains a banned word (both locales)", () => {
    for (const L of LOCALES)
      for (const [k, msg] of Object.entries(CATALOGUES[L]))
        for (const s of leaves(msg)) for (const b of all) expect(s.toLowerCase(), `${L} ${k}`).not.toContain(b);
  });

  it("no rendered card or summary contains a banned word", () => {
    for (const L of LOCALES) {
      const text = [...cards(sampleModel(), L).map((c) => cardText(c, L)), summary(run(sampleModel()), L)].join("\n").toLowerCase();
      for (const b of all) expect(text).not.toContain(b);
    }
  });
});

describe("i18n catalogue", () => {
  it("en and pt-BR have the same keys and the same {slots}", () => {
    const en = CATALOGUES.en, pt = CATALOGUES["pt-BR"];
    expect(Object.keys(pt).sort()).toEqual(Object.keys(en).sort());
    for (const k of Object.keys(en)) expect(slots(pt[k]!), k).toEqual(slots(en[k]!));
  });

  it("every key a rule references exists", () => {
    for (const r of RULES)
      for (const k of [r.nameKey, ...r.notConsidered, ...r.terms, `sev.${r.severity}`, `conf.${r.confidence}`])
        for (const L of LOCALES) expect(() => t(L, k), `${L} ${k}`).not.toThrow();
  });

  it("a missing param throws instead of rendering '{width}'", () => {
    expect(() => format("{width} wide", "en", {})).toThrow("missing param {width}");
  });
});
