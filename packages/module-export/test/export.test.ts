import { describe, expect, it } from "vitest";
import { layoutNotes, layoutSheet, pdfString, pdfWithImage, pdfWithImages, scaleBar } from "../src";

const dec = new TextDecoder("latin1");

describe("sheet layout (ADR-056)", () => {
  // A4 landscape: drawing area 277 × 170 mm, minus 8 mm padding each side → 261 × 154 mm
  const house = { minX: 0, minY: 0, maxX: 10000, maxY: 7000 };
  it("fit picks the largest drawing that fits: a 10 × 7 m house on A4 → 1:50 (200 × 140 mm)", () => {
    const L = layoutSheet(house, "a4", "fit");
    expect(L.scale).toBe(50);
    expect(L.fits).toBe(true);
  });
  it("a fixed scale that doesn't fit says so", () => {
    expect(layoutSheet(house, "a4", 25).fits).toBe(false);
  });
  it("model Y up → page Y down, centred in the drawing area", () => {
    const L = layoutSheet(house, "a4", 100);
    const c = L.toPage({ x: 5000, y: 3500 });
    expect(c.x).toBeCloseTo(10 + 277 / 2);
    expect(c.y).toBeCloseTo(10 + 170 / 2);
    expect(L.toPage({ x: 5000, y: 4500 }).y).toBeCloseTo(c.y - 10); // 1 m up = 10 mm up the page at 1:100
  });
  it("scale bar: a round length 30 mm or more", () => {
    expect(scaleBar(100)).toEqual({ metres: 5, mm: 50, segments: 5 });
    expect(scaleBar(50)).toEqual({ metres: 2, mm: 40, segments: 5 });
  });
});

describe("PDF writer (ADR-056)", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const bytes = pdfWithImage({
    jpeg,
    width: 10,
    height: 7,
    pageMm: { w: 297, h: 210 },
    title: "Casa da Ana",
    producer: "Prumo",
  });
  const text = dec.decode(bytes);
  it("starts and ends like a PDF", () => {
    expect(text.startsWith("%PDF-1.4\n")).toBe(true);
    expect(text.endsWith("%%EOF\n")).toBe(true);
  });
  it("every cross-reference offset points at its object; startxref points at the table", () => {
    const xref = Number(/startxref\n(\d+)/.exec(text)?.[1]);
    expect(text.slice(xref, xref + 4)).toBe("xref");
    const rows = text.slice(xref).split("\n").slice(3, 9);
    rows.forEach((r, i) =>
      expect(text.slice(Number(r.slice(0, 10)), Number(r.slice(0, 10)) + 7)).toBe(`${i + 1} 0 obj`),
    );
  });
  it("A4 landscape page in points; the JPEG is embedded as is", () => {
    expect(text).toContain("/MediaBox [0 0 841.89 595.28]");
    expect(text).toContain("/Filter /DCTDecode /Length 4");
  });
  it("several pages: one page object per image, all listed in Pages, xref still exact", () => {
    const b = dec.decode(
      pdfWithImages({
        pages: [
          { jpeg, width: 1, height: 1 },
          { jpeg, width: 1, height: 1 },
        ],
        pageMm: { w: 297, h: 210 },
        title: "x",
        producer: "p",
      }),
    );
    expect(b).toContain("/Kids [4 0 R 7 0 R] /Count 2");
    const xref = Number(/startxref\n(\d+)/.exec(b)?.[1]);
    const rows = b.slice(xref).split("\n").slice(3, 12);
    rows.forEach((r, i) => expect(b.slice(Number(r.slice(0, 10)), Number(r.slice(0, 10)) + 7)).toBe(`${i + 1} 0 obj`));
  });

  it("titles: ASCII escaped, accents as UTF-16BE", () => {
    expect(pdfString("a (b) \\")).toBe("(a \\(b\\) \\\\)");
    expect(pdfString("Térreo")).toBe("<FEFF005400E9007200720065006F>");
  });
});

describe("notes pages", () => {
  // every character 1 mm wide: easy to reason about wrapping
  const measure = (t: string) => t.length;
  const page = { w: 297, h: 210 };
  it("wraps long findings and repeats the disclaimer at the foot of every page", () => {
    const items = Array.from({ length: 60 }, (_, i) => ({
      label: String(i + 1),
      severity: "warning" as const,
      tag: "Warning",
      text: "word ".repeat(80).trim(),
    }));
    const pages = layoutNotes(
      { title: "T", intro: "I", sections: [{ heading: "Ground", items, empty: "" }], disclaimer: "D" },
      page,
      measure,
    );
    expect(pages.length).toBeGreaterThan(1);
    for (const p of pages) expect(p[p.length - 1]).toEqual({ kind: "footer", text: "D" });
    const first = pages[0]?.find((l) => l.kind === "item");
    expect(first && "label" in first ? first.label : null).toBe("1");
    // text column: 297 − 20 − 8 − 28 = 241 mm → at most 241 characters a line (+ slack)
    for (const p of pages) for (const l of p) expect(l.text.length).toBeLessThanOrEqual(259);
  });
  it("a floor with no findings shows its 'empty' text", () => {
    const [p] = layoutNotes(
      { title: "T", intro: "I", sections: [{ heading: "Ground", items: [], empty: "None" }], disclaimer: "D" },
      page,
      measure,
    );
    expect(p?.some((l) => l.kind === "empty" && l.text === "None")).toBe(true);
  });
});
