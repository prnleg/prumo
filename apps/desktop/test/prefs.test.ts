import { describe, expect, it } from "vitest";
import { NAME_MAX, PREFS_VERSION, cleanName, parsePrefs, serializePrefs } from "../src/prefs";

describe("remembered preferences (ADR-037)", () => {
  it("first launch / damaged file → no preferences, never throws", () => {
    for (const text of [null, "", "{not json", "[1,2]", "42", "null"])
      expect(parsePrefs(text)).toEqual({ prefs: {}, rest: {}, v: PREFS_VERSION });
  });

  it("reads valid values and drops invalid ones one by one", () => {
    const r = parsePrefs(JSON.stringify({ v: 1, locale: "pt-BR", angleStepDeg: 15, gridSize: 50 }));
    expect(r.prefs).toEqual({ locale: "pt-BR", angleStepDeg: 15, gridSize: 50 });
    const bad = parsePrefs(JSON.stringify({ v: 1, locale: "xx", angleStepDeg: 400, gridSize: -1 }));
    expect(bad.prefs).toEqual({});
    expect(parsePrefs(JSON.stringify({ locale: "en", gridSize: "50" })).prefs).toEqual({ locale: "en" });
  });

  it("round-trips, keeping unknown keys and a newer version number", () => {
    const text = JSON.stringify({ v: 3, locale: "en", theme: "dark", future: { a: 1 } });
    const r = parsePrefs(text);
    expect(r.v).toBe(3);
    const out = JSON.parse(serializePrefs({ ...r, prefs: { ...r.prefs, angleStepDeg: 5 } }));
    expect(out).toEqual({ v: 3, locale: "en", angleStepDeg: 5, theme: "dark", future: { a: 1 } });
    expect(parsePrefs(serializePrefs(r))).toEqual(r);
  });

  it("writes the current version for a fresh file", () => {
    expect(JSON.parse(serializePrefs({ ...parsePrefs(null), prefs: { gridSize: 100 } }))).toEqual({
      v: PREFS_VERSION,
      gridSize: 100,
    });
  });
});

describe("tour flag (Q-080)", () => {
  it("only `true` counts; round-trips", () => {
    expect(parsePrefs('{"tourDone":true}').prefs).toEqual({ tourDone: true });
    expect(parsePrefs('{"tourDone":"yes"}').prefs).toEqual({});
    const r = parsePrefs('{"tourDone":true,"locale":"en"}');
    expect(parsePrefs(serializePrefs(r))).toEqual(r);
  });
});

describe("your name (ADR-044, Q-092)", () => {
  it("is trimmed, inner spaces collapsed; empty or too long is refused", () => {
    expect(cleanName("  Ana   Paula ")).toBe("Ana Paula");
    expect(cleanName("   ")).toBeNull();
    expect(cleanName(42)).toBeNull();
    expect(cleanName("x".repeat(NAME_MAX))).toHaveLength(NAME_MAX);
    expect(cleanName("x".repeat(NAME_MAX + 1))).toBeNull();
  });
  it("is remembered; a bad stored value is ignored", () => {
    expect(parsePrefs('{"name":" Ana "}').prefs).toEqual({ name: "Ana" });
    expect(parsePrefs('{"name":""}').prefs).toEqual({});
  });
});
