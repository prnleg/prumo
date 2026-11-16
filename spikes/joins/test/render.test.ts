// Opt-in visual check: RENDER_PNG=<path> pnpm test render
// Draws every preset (fill = wall polygons, black = clean outline, red = issue) into one PNG.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { it } from "vitest";
import { inside, type V } from "../src/geom";
import { computeJoins } from "../src/joins";
import { visibleOutline } from "../src/outline";
import { PRESETS } from "../src/presets";

const out = process.env.RENDER_PNG;
it.skipIf(!out)("render presets", () => {
  const names = Object.keys(PRESETS), C = 6, cw = 300, ch = 240, W = C * cw, H = Math.ceil(names.length / C) * ch;
  const img = Buffer.alloc(W * H * 3, 255);
  const px = (x: number, y: number, c: [number, number, number]) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    img.set(c, (y * W + x) * 3);
  };
  const line = (a: V, b: V, c: [number, number, number], w = 1) => {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2);
    for (let i = 0; i <= n; i++) for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < w; dy++)
      px(a.x + ((b.x - a.x) * i) / n + dx, a.y + ((b.y - a.y) * i) / n + dy, c);
  };
  names.forEach((name, i) => {
    const r = computeJoins(PRESETS[name]!());
    const o = visibleOutline(r.walls);
    const pts = r.walls.flatMap((w) => w.polygon);
    const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y)), maxY = Math.max(...pts.map((p) => p.y));
    const k = Math.min((cw - 30) / (maxX - minX), (ch - 30) / (maxY - minY));
    const ox = (i % C) * cw + 15, oy = Math.floor(i / C) * ch + 15;
    const T = (p: V): V => ({ x: ox + (p.x - minX) * k, y: oy + (maxY - p.y) * k });
    const polys = r.walls.map((w) => w.polygon.map(T));
    for (let y = oy; y < oy + ch - 15; y++)
      for (let x = ox; x < ox + cw - 15; x++) {
        const hits = polys.filter((p) => inside({ x: x + 0.5, y: y + 0.5 }, p)).length;
        if (hits === 1) px(x, y, [205, 198, 182]);
        else if (hits > 1) px(x, y, [150, 170, 220]); // overlap = blue
      }
    for (const s of o) line(T(s.a), T(s.b), [0, 0, 0], 2);
    for (const is of r.issues) { const c = T(is.at); for (let a = 0; a < 64; a++) px(c.x + 8 * Math.cos(a / 10), c.y + 8 * Math.sin(a / 10), [220, 0, 0]); }
    line({ x: ox - 15, y: oy + ch - 15 }, { x: ox + cw - 15, y: oy + ch - 15 }, [220, 220, 220]);
  });
  const crcT = [...Array(256)].map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255]! ^ (c >>> 8); return ~c >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) img.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
  writeFileSync(out!, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
  console.log(names.map((n, i) => `${i + 1}. ${n}`).join(" | "));
});
