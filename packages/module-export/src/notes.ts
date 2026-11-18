// The notes pages of an exported PDF (ADR-056 extras): the structure-check findings behind the numbered
// marks, floor by floor, wrapped to the page and split over as many pages as needed. Words come in
// translated; this file only lays out and draws.
import { MARGIN } from "./sheet";
import { SEVERITY_COLOR, type Severity } from "./draw";

export interface NotesInput {
  title: string;
  /** Under the title: what this list is. */
  intro: string;
  sections: {
    heading: string;
    items: { label: string; severity: Severity; tag: string; text: string }[];
    empty: string;
  }[];
  /** Always at the bottom of every notes page. */
  disclaimer: string;
}

type Line =
  | { kind: "title" | "intro" | "heading" | "empty" | "footer"; text: string }
  | { kind: "item"; text: string; label?: string; severity?: Severity; tag?: string };

const SIZES = { title: 4.2, intro: 2.6, heading: 3.4, item: 2.7, empty: 2.7, footer: 2.4 } as const;
const LEAD = 1.45; // line height / font size
const INDENT = 28; // mm: text column after the number + severity word
const FONT = `system-ui, -apple-system, "Segoe UI", sans-serif`;

/** Split `n` into pages of lines. `measure` returns a text's width in mm at `size` mm. */
export function layoutNotes(
  n: NotesInput,
  page: { w: number; h: number },
  measure: (text: string, sizeMm: number, bold: boolean) => number,
): Line[][] {
  const width = page.w - 2 * MARGIN - 8;
  const wrap = (text: string, size: number, w: number): string[] => {
    const out: string[] = [];
    let cur = "";
    for (const word of text.split(/\s+/)) {
      const next = cur ? `${cur} ${word}` : word;
      if (cur && measure(next, size, false) > w) {
        out.push(cur);
        cur = word;
      } else cur = next;
    }
    if (cur) out.push(cur);
    return out;
  };
  const lines: Line[] = [{ kind: "title", text: n.title }];
  for (const t of wrap(n.intro, SIZES.intro, width)) lines.push({ kind: "intro", text: t });
  for (const s of n.sections) {
    lines.push({ kind: "heading", text: s.heading });
    if (!s.items.length) for (const t of wrap(s.empty, SIZES.empty, width)) lines.push({ kind: "empty", text: t });
    for (const it of s.items)
      wrap(it.text, SIZES.item, width - INDENT).forEach((t, i) =>
        lines.push(
          i
            ? { kind: "item", text: t }
            : { kind: "item", text: t, label: it.label, severity: it.severity, tag: it.tag },
        ),
      );
  }
  // paginate: usable height minus the footer
  const usable = page.h - 2 * MARGIN - 8 - 10;
  const pages: Line[][] = [];
  let cur: Line[] = [];
  let h = 0;
  for (const l of lines) {
    const lh = SIZES[l.kind] * LEAD + (l.kind === "heading" ? 3 : 0);
    if (h + lh > usable && cur.length) {
      pages.push(cur);
      cur = [];
      h = 0;
    }
    cur.push(l);
    h += lh;
  }
  if (cur.length) pages.push(cur);
  return pages.map((p) => [...p, { kind: "footer", text: n.disclaimer }]);
}

/** Draw one notes page (from `layoutNotes`) at `px` pixels per mm. */
export function drawNotesPage(g: CanvasRenderingContext2D, lines: Line[], page: { w: number; h: number }, px: number) {
  const mm = (x: number) => x * px;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, mm(page.w), mm(page.h));
  g.strokeStyle = "#111111";
  g.lineWidth = mm(0.35);
  g.strokeRect(mm(MARGIN), mm(MARGIN), mm(page.w - 2 * MARGIN), mm(page.h - 2 * MARGIN));
  const x = MARGIN + 4;
  let y = MARGIN + 6;
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  for (const l of lines) {
    const size = SIZES[l.kind];
    if (l.kind === "footer") {
      g.fillStyle = "#555555";
      g.font = `${mm(size)}px ${FONT}`;
      g.fillText(l.text, mm(x), mm(page.h - MARGIN - 4));
      continue;
    }
    if (l.kind === "heading") y += 3;
    y += size * LEAD;
    const bold = l.kind === "title" || l.kind === "heading";
    g.font = `${bold ? "600 " : ""}${mm(size)}px ${FONT}`;
    g.fillStyle = l.kind === "intro" || l.kind === "empty" ? "#555555" : "#111111";
    if (l.kind === "item" && l.label && l.severity) {
      // the number in its coloured disc + the severity word
      g.font = `600 ${mm(2.3)}px ${FONT}`;
      const w = Math.max(mm(4.2), g.measureText(l.label).width + mm(2));
      g.fillStyle = SEVERITY_COLOR[l.severity];
      g.beginPath();
      g.roundRect(mm(x), mm(y - 3.2), w, mm(4.2), mm(2.1));
      g.fill();
      g.fillStyle = "#ffffff";
      g.textAlign = "center";
      g.fillText(l.label, mm(x) + w / 2, mm(y - 0.3));
      g.textAlign = "left";
      g.fillStyle = SEVERITY_COLOR[l.severity];
      g.font = `600 ${mm(2.2)}px ${FONT}`;
      g.fillText(l.tag ?? "", mm(x + 5.5), mm(y - 0.3));
      g.fillStyle = "#111111";
      g.font = `${mm(size)}px ${FONT}`;
    }
    g.fillText(l.text, mm(l.kind === "item" ? x + INDENT : x), mm(y));
  }
}
