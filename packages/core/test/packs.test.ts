// Data packs (ADR-030 / ADR-049): validation and country → state → city lookup.
import { describe, expect, it } from "vitest";
import { PACK_UNSOURCED, PackSet, parsePack, type DataPack, type PackValue } from "../src";

const M = "org.prumo.structural";
const v = (value: number, extra: Partial<PackValue> = {}): PackValue => ({
  value,
  unit: "kPa",
  source: "Test book, p. 1",
  confidence: "medium",
  review: "UNVERIFIED",
  ...extra,
});
const pack = (id: string, parent: string | null, values: Record<string, PackValue>): DataPack => ({
  format: "prumo-pack",
  formatVersion: 1,
  id,
  parent,
  module: M,
  version: "1",
  name: { en: id.toUpperCase(), "pt-BR": `pt ${id}` },
  values,
});

describe("data packs", () => {
  it("a good pack parses", () => {
    expect(parsePack(pack("br", null, { "load.live.home": v(1.5) })).ok).toBe(true);
    expect(parsePack(pack("br/sp", "br", {})).ok).toBe(true);
  });

  it("bad packs list every problem", () => {
    const bad = {
      ...pack("BR", "xx", { nokey: v(1), "a.b": { ...v(1), confidence: "sure" as never, source: "" } }),
      formatVersion: 9,
    };
    const r = parsePack(bad);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors).toEqual([
        "formatVersion 9 not supported (this app reads 1)",
        "id must look like br, br/sp or br/sp/sao-paulo",
        "parent must be null for a country, or the id without its last part",
        'values["nokey"]: key must be dotted words',
        'values["a.b"]: source is required (or "UNSOURCED – placeholder")',
        'values["a.b"]: confidence must be low, medium or high',
      ]);
    expect(parsePack(pack("br/sp/x", "br", {})).ok).toBe(false); // parent must be br/sp
    expect(parsePack(null).ok).toBe(false);
  });

  it("an unsourced value can only be UNVERIFIED", () => {
    const r = parsePack(pack("br", null, { "a.b": v(1, { source: PACK_UNSOURCED, review: "VERIFIED-UNSIGNED" }) }));
    expect(r.ok).toBe(false);
  });

  it("the most local pack wins; missing levels are skipped; each value says where it came from", () => {
    const set = new PackSet([
      pack("br", null, { "load.live.home": v(1.5), "load.live.office": v(2.5) }),
      pack("br/sp/sao-paulo", "br/sp", { "load.live.home": v(2) }),
    ]);
    expect(set.chain(M, "br/sp/sao-paulo").map((p) => p.id)).toEqual(["br/sp/sao-paulo", "br"]);
    expect(set.get(M, "br/sp/sao-paulo", "load.live.home")).toMatchObject({ value: 2, pack: "br/sp/sao-paulo" });
    expect(set.get(M, "br/sp/sao-paulo", "load.live.office")).toMatchObject({ value: 2.5, pack: "br" });
    expect(set.get(M, "br", "load.live.home")).toMatchObject({ value: 1.5, pack: "br" });
    expect(set.get(M, "pt", "load.live.home")).toBeNull();
    expect(set.get("org.other", "br", "load.live.home")).toBeNull();
    expect(set.all(M, "br/sp/sao-paulo").map((x) => [x.key, x.pack])).toEqual([
      ["load.live.home", "br/sp/sao-paulo"],
      ["load.live.office", "br"],
    ]);
    expect(set.name(M, "br", "pt-BR")).toBe("pt br");
    expect(set.name(M, "br", "fr")).toBe("BR");
  });
});
