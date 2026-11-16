import { describe, expect, it } from "vitest";
import { detectLocale, formatLength, formatSmall, translate } from "../src/i18n";
import { CATALOGUES, LOCALES } from "../src/i18n/messages";

describe("UI i18n (ADR-021/034)", () => {
  it("every key exists in every locale and parses as ICU", () => {
    const keys = Object.keys(CATALOGUES.en).sort();
    for (const l of LOCALES) {
      expect(Object.keys(CATALOGUES[l]).sort()).toEqual(keys);
      for (const k of keys)
        expect(() =>
          translate(l, k, { count: 2, hosted: 1, label: "x", grid: "10 cm", angle: 15, module: "m" }),
        ).not.toThrow();
    }
  });

  it("plurals and nested plurals", () => {
    expect(translate("en", "cmd.deleteWithHosted", { count: 1, hosted: 2 })).toBe(
      "delete 1 item and 2 doors or windows on them",
    );
    expect(translate("pt-BR", "cmd.deleteWithHosted", { count: 2, hosted: 1 })).toBe(
      "apagar 2 itens e 1 porta ou janela nele",
    );
    expect(translate("pt-BR", "status.walls", { count: 1 })).toBe("1 parede");
  });

  it("lengths per locale; OS language detection", () => {
    expect(formatLength(4000, "en")).toBe("4.00 m");
    expect(formatLength(4000, "pt-BR")).toBe("4,00 m");
    expect(formatSmall(100, "pt-BR")).toBe("10 cm");
    expect(detectLocale(["pt-PT", "en"])).toBe("pt-BR");
    expect(detectLocale(["de-DE", "en-GB"])).toBe("en");
    expect(detectLocale(["ja"])).toBe("en");
  });

  it("banned words never appear in UI strings (SAFETY_AND_LIABILITY)", () => {
    const banned = [
      "safe",
      "approved",
      "certified",
      "compliant",
      "structurally sound",
      "ok to build",
      "guaranteed",
      "no risk",
      "segur",
      "aprovad",
      "certificad",
      "em conformidade",
      "pode construir",
      "garantid",
      "sem risco",
    ];
    for (const l of LOCALES)
      for (const [k, s] of Object.entries(CATALOGUES[l]))
        for (const b of banned) expect(s.toLowerCase(), `${l} ${k}`).not.toContain(b);
  });

  it("unknown key renders the key instead of crashing", () => {
    expect(translate("en", "nope.key")).toBe("nope.key");
  });
});
