// A minimal PDF writer (ADR-056): one page holding one JPEG image, plus a title. Our own (ADR-012
// spirit, no dependency): the format for this case is a handful of objects and a cross-reference table.
// PDF 1.4, ISO 32000-1 §7 (file structure), §8.9 (images, DCTDecode = JPEG as is).

const enc = new TextEncoder();

/** PDF text string: plain ASCII in (…) with escapes; anything else as UTF-16BE hex with a BOM. */
export function pdfString(s: string): string {
  if (/^[\x20-\x7e]*$/.test(s)) return `(${s.replace(/[\\()]/g, (c) => "\\" + c)})`;
  let hex = "FEFF";
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp > 0xffff) {
      const v = cp - 0x10000;
      hex += (0xd800 + (v >> 10)).toString(16).padStart(4, "0") + (0xdc00 + (v & 0x3ff)).toString(16).padStart(4, "0");
    } else hex += cp.toString(16).padStart(4, "0");
  }
  return `<${hex.toUpperCase()}>`;
}

export interface PdfImage {
  /** JPEG bytes (baseline, RGB). */
  jpeg: Uint8Array;
  /** Image size, px. */
  width: number;
  height: number;
}

export interface PdfImagePage extends PdfImage {
  /** Page size, mm (the image fills it). */
  pageMm: { w: number; h: number };
  title: string;
  /** "Prumo 0.1.0" */
  producer: string;
}

/** One page holding one image. */
export const pdfWithImage = (o: PdfImagePage): Uint8Array =>
  pdfWithImages({ pages: [o], pageMm: o.pageMm, title: o.title, producer: o.producer });

/** The PDF file's bytes: one page per image, each image filling its page (same page size). */
export function pdfWithImages(o: {
  pages: readonly PdfImage[];
  pageMm: { w: number; h: number };
  title: string;
  producer: string;
}): Uint8Array {
  const W = (o.pageMm.w / 25.4) * 72;
  const H = (o.pageMm.h / 25.4) * 72;
  const f = (x: number) => x.toFixed(2);
  const content = `q ${f(W)} 0 0 ${f(H)} 0 0 cm /Im0 Do Q\n`;
  const parts: (string | Uint8Array)[] = [];
  const offsets: number[] = [];
  let size = 0;
  const push = (x: string | Uint8Array) => {
    parts.push(x);
    size += typeof x === "string" ? enc.encode(x).length : x.length;
  };
  const obj = (n: number, body: string | (string | Uint8Array)[]) => {
    offsets[n] = size;
    push(`${n} 0 obj\n`);
    for (const b of Array.isArray(body) ? body : [body]) push(b);
    push(`\nendobj\n`);
  };
  // objects: 1 catalog, 2 pages, 3 info, then per page k: page, image, contents
  const n = o.pages.length;
  const pageObj = (k: number) => 4 + 3 * k;
  push("%PDF-1.4\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Kids [${o.pages.map((_, k) => `${pageObj(k)} 0 R`).join(" ")}] /Count ${n} >>`);
  obj(3, `<< /Title ${pdfString(o.title)} /Producer ${pdfString(o.producer)} >>`);
  o.pages.forEach((pg, k) => {
    const p = pageObj(k);
    obj(
      p,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(W)} ${f(H)}] /Resources << /XObject << /Im0 ${p + 1} 0 R >> >> /Contents ${p + 2} 0 R >>`,
    );
    obj(p + 1, [
      `<< /Type /XObject /Subtype /Image /Width ${pg.width} /Height ${pg.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.jpeg.length} >>\nstream\n`,
      pg.jpeg,
      "\nendstream",
    ]);
    obj(p + 2, `<< /Length ${enc.encode(content).length} >>\nstream\n${content}endstream`);
  });
  const total = 3 + 3 * n;
  const xref = size;
  let table = `xref\n0 ${total + 1}\n0000000000 65535 f \n`;
  for (let k = 1; k <= total; k++) table += `${String(offsets[k]).padStart(10, "0")} 00000 n \n`;
  push(table);
  push(`trailer\n<< /Size ${total + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    const b = typeof p === "string" ? enc.encode(p) : p;
    out.set(b, at);
    at += b.length;
  }
  return out;
}
