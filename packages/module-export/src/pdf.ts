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

export interface PdfImagePage {
  /** JPEG bytes (baseline, RGB). */
  jpeg: Uint8Array;
  /** Image size, px. */
  width: number;
  height: number;
  /** Page size, mm (the image fills it). */
  pageMm: { w: number; h: number };
  title: string;
  /** "Prumo 0.1.0" */
  producer: string;
}

/** The PDF file's bytes. */
export function pdfWithImage(o: PdfImagePage): Uint8Array {
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
  push("%PDF-1.4\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(W)} ${f(H)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  );
  obj(4, [
    `<< /Type /XObject /Subtype /Image /Width ${o.width} /Height ${o.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${o.jpeg.length} >>\nstream\n`,
    o.jpeg,
    "\nendstream",
  ]);
  obj(5, `<< /Length ${enc.encode(content).length} >>\nstream\n${content}endstream`);
  obj(6, `<< /Title ${pdfString(o.title)} /Producer ${pdfString(o.producer)} >>`);
  const xref = size;
  let table = `xref\n0 7\n0000000000 65535 f \n`;
  for (let n = 1; n <= 6; n++) table += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  push(table);
  push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    const b = typeof p === "string" ? enc.encode(p) : p;
    out.set(b, at);
    at += b.length;
  }
  return out;
}
