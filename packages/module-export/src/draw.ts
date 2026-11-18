// Draw a plan sheet on a 2D canvas (ADR-056): a print-style drawing — dark walls, white background,
// opening symbols, room names, overall dimensions, a scale bar and a title block with the disclaimer.
// Everything the user reads comes in already translated (`texts`); this file has no words of its own.
import type { OpeningPlan, V } from "@prumo/core";
import { scaleBar, TITLE_H, MARGIN, type SheetLayout } from "./sheet";

export interface SheetInput {
  walls: { polygon: V[]; kind: string }[];
  /** The walls' visible outline (no lines where walls join), from the plan geometry. */
  outline: { a: V; b: V }[];
  openings: OpeningPlan[];
  /** Room labels: lines of text at a point. */
  rooms: { at: V; lines: string[] }[];
  /** Structure-check marks (numbered; the numbers match the notes page). */
  marks?: { at: V; label: string; severity: Severity }[];
  /** Overall size of the plan, mm (for the dimension lines). */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  texts: {
    title: string;
    /** "Ground floor · Scale 1:100 · A4 · 18 Nov 2026" */
    subtitle: string;
    disclaimer: string;
    /** Formats a length in mm for the dimension lines ("10.00 m"). */
    length: (mm: number) => string;
    /** "0", "5 m" for the scale bar ends. */
    metres: (m: number) => string;
  };
}

const INK = "#111111";
const WALL = "#3b3b3b";
const WALL_LOW = "#9a9a9a";
const MUTED = "#555555";
export type Severity = "critical" | "warning" | "advisory" | "info";
export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "#c62828",
  warning: "#d97706",
  advisory: "#2f6fb5",
  info: "#666666",
};
const FONT = `system-ui, -apple-system, "Segoe UI", sans-serif`;

/** Draw at `px` pixels per page mm. The canvas must be page.w × px by page.h × px. */
export function drawSheet(g: CanvasRenderingContext2D, s: SheetInput, L: SheetLayout, px: number) {
  const P = (q: V) => {
    const p = L.toPage(q);
    return { x: p.x * px, y: p.y * px };
  };
  const mm = (x: number) => x * px;
  const path = (pts: V[], close: boolean) => {
    g.beginPath();
    pts.forEach((q, i) => {
      const p = P(q);
      if (i) g.lineTo(p.x, p.y);
      else g.moveTo(p.x, p.y);
    });
    if (close) g.closePath();
  };
  const seg = ([a, b]: [V, V]) => path([a, b], false);

  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, mm(L.page.w), mm(L.page.h));
  g.lineJoin = "miter";
  g.lineCap = "butt";

  // walls
  for (const w of s.walls) {
    path(w.polygon, true);
    g.fillStyle = w.kind === "full" ? WALL : WALL_LOW;
    g.fill();
    // same colour stroke closes hairline gaps between joined walls
    g.strokeStyle = g.fillStyle;
    g.lineWidth = mm(0.05);
    g.stroke();
  }
  g.strokeStyle = INK;
  g.lineWidth = mm(0.25);
  for (const e of s.outline) {
    seg([e.a, e.b]);
    g.stroke();
  }
  // openings: cut the wall, then the symbol
  for (const o of s.openings) {
    path(o.cover, true);
    g.fillStyle = "#ffffff";
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = mm(0.25);
    for (const j of o.jambs) {
      seg(j);
      g.stroke();
    }
    g.lineWidth = mm(0.18);
    for (const l of [...o.glass, ...o.leaves]) {
      seg(l);
      g.stroke();
    }
    for (const f of o.folds) {
      path(f, false);
      g.stroke();
    }
    g.setLineDash([mm(0.8), mm(0.6)]);
    g.lineWidth = mm(0.13);
    for (const a of o.arcs) {
      path(a, false);
      g.stroke();
    }
    for (const d of o.dashed) {
      seg(d);
      g.stroke();
    }
    g.setLineDash([]);
  }
  // room labels
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (const r of s.rooms) {
    const p = P(r.at);
    r.lines.forEach((line, i) => {
      g.font = `${i ? "" : "600 "}${mm(i ? 2.6 : 3)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      g.fillStyle = i ? MUTED : INK;
      g.fillText(line, p.x, p.y + (i - (r.lines.length - 1) / 2) * mm(3.8));
    });
  }
  // structure marks: a coloured disc with the finding number(s)
  for (const m of s.marks ?? []) {
    const p = P(m.at);
    g.font = `600 ${mm(2.4)}px ${FONT}`;
    const w = Math.max(mm(4.2), g.measureText(m.label).width + mm(2));
    g.fillStyle = SEVERITY_COLOR[m.severity];
    g.beginPath();
    g.roundRect(p.x - w / 2, p.y - mm(2.1), w, mm(4.2), mm(2.1));
    g.fill();
    g.strokeStyle = "#ffffff";
    g.lineWidth = mm(0.3);
    g.stroke();
    g.fillStyle = "#ffffff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(m.label, p.x, p.y + mm(0.1));
  }
  // overall dimensions: below and to the left of the plan
  const b = s.bounds;
  const off = 5; // mm on paper
  g.strokeStyle = INK;
  g.fillStyle = INK;
  g.lineWidth = mm(0.13);
  const bl = P({ x: b.minX, y: b.minY });
  const br = P({ x: b.maxX, y: b.minY });
  const tl = P({ x: b.minX, y: b.maxY });
  const dim = (a: V, c: V, text: string, vertical: boolean) => {
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(c.x, c.y);
    g.stroke();
    for (const e of [a, c]) {
      // 45° ticks
      g.beginPath();
      g.moveTo(e.x - mm(1), e.y + mm(1));
      g.lineTo(e.x + mm(1), e.y - mm(1));
      g.stroke();
    }
    g.save();
    g.translate((a.x + c.x) / 2, (a.y + c.y) / 2);
    if (vertical) g.rotate(-Math.PI / 2);
    g.font = `${mm(2.6)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    g.textBaseline = "bottom";
    g.fillText(text, 0, -mm(0.6));
    g.restore();
  };
  dim({ x: bl.x, y: bl.y + mm(off) }, { x: br.x, y: br.y + mm(off) }, s.texts.length(b.maxX - b.minX), false);
  dim({ x: bl.x - mm(off), y: bl.y }, { x: tl.x - mm(off), y: tl.y }, s.texts.length(b.maxY - b.minY), true);

  // frame + title block
  g.lineWidth = mm(0.35);
  g.strokeStyle = INK;
  g.strokeRect(mm(MARGIN), mm(MARGIN), mm(L.page.w - 2 * MARGIN), mm(L.page.h - 2 * MARGIN));
  const ty = L.page.h - MARGIN - TITLE_H;
  g.beginPath();
  g.moveTo(mm(MARGIN), mm(ty));
  g.lineTo(mm(L.page.w - MARGIN), mm(ty));
  g.stroke();
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  g.fillStyle = INK;
  g.font = `600 ${mm(4.2)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  g.fillText(s.texts.title, mm(MARGIN + 4), mm(ty + 7));
  g.font = `${mm(2.8)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  g.fillText(s.texts.subtitle, mm(MARGIN + 4), mm(ty + 12.5));
  g.fillStyle = MUTED;
  g.font = `${mm(2.4)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  g.fillText(s.texts.disclaimer, mm(MARGIN + 4), mm(ty + 17.5));

  // scale bar, right of the title block
  const sb = scaleBar(L.scale);
  const x0 = L.page.w - MARGIN - 6 - sb.mm;
  const y0 = ty + 9;
  for (let i = 0; i < sb.segments; i++) {
    g.fillStyle = i % 2 ? "#ffffff" : INK;
    g.fillRect(mm(x0 + (i * sb.mm) / sb.segments), mm(y0), mm(sb.mm / sb.segments), mm(1.6));
  }
  g.strokeStyle = INK;
  g.lineWidth = mm(0.18);
  g.strokeRect(mm(x0), mm(y0), mm(sb.mm), mm(1.6));
  g.fillStyle = INK;
  g.font = `${mm(2.4)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  g.textAlign = "center";
  g.fillText(s.texts.metres(0), mm(x0), mm(y0 + 5));
  g.fillText(s.texts.metres(sb.metres), mm(x0 + sb.mm), mm(y0 + 5));
  g.fillText(`1:${L.scale}`, mm(x0 + sb.mm / 2), mm(y0 - 1.5));
}
