import { describe, expect, it } from "vitest";
import { area, inside, type V } from "../src/geometry/vec";
import { computeJoins, faceOffsets } from "../src/geometry/joins";
import { totalLength, visibleOutline } from "../src/geometry/outline";
import { grid, PRESETS, rot, W, type WallIn } from "./geometry-presets";

const TOL = 1e-6;
const run = (ws: WallIn[]) => {
  const r = computeJoins(ws);
  return { ...r, outline: visibleOutline(r.walls), poly: (id: string) => r.walls.find((w) => w.id === id)!.polygon };
};
const sumArea = (polys: { polygon: V[] }[]) => polys.reduce((s, p) => s + area(p.polygon), 0);

/** Same point set, starting anywhere, same orientation. */
function expectPoly(actual: V[], expected: [number, number][]) {
  expect(actual).toHaveLength(expected.length);
  const k = actual.findIndex((p) => Math.abs(p.x - expected[0]![0]) < TOL && Math.abs(p.y - expected[0]![1]) < TOL);
  expect(k, `start point ${expected[0]} not found in ${JSON.stringify(actual)}`).toBeGreaterThanOrEqual(0);
  expected.forEach(([x, y], i) => {
    const p = actual[(k + i) % actual.length]!;
    expect(p.x).toBeCloseTo(x, 6);
    expect(p.y).toBeCloseTo(y, 6);
  });
}

/**
 * Sampling check (property): no point is inside two wall polygons (no overlap), and every point
 * inside a raw wall body (straight rectangle, no joins) is inside some polygon (no gaps).
 */
function coverage(ws: WallIn[], polys: { polygon: V[] }[], step = 25) {
  const raw = ws.map((w) => {
    const d = { x: w.end.x - w.start.x, y: w.end.y - w.start.y };
    const L = Math.hypot(d.x, d.y),
      u = { x: d.x / L, y: d.y / L },
      n = { x: -u.y, y: u.x };
    const { l, r } = faceOffsets(w);
    const at = (s: number, o: number) => ({ x: w.start.x + u.x * s + n.x * o, y: w.start.y + u.y * s + n.y * o });
    return [at(0, r), at(L, r), at(L, l), at(0, l)];
  });
  const all = [...raw.flat(), ...polys.flatMap((p) => p.polygon)];
  const minX = Math.min(...all.map((p) => p.x)),
    maxX = Math.max(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y)),
    maxY = Math.max(...all.map((p) => p.y));
  let overlaps = 0,
    gaps = 0;
  for (let x = minX + 0.3712; x < maxX; x += step)
    for (let y = minY + 0.1931; y < maxY; y += step) {
      const p = { x, y };
      const hits = polys.filter((q) => inside(p, q.polygon)).length;
      if (hits > 1) overlaps++;
      if (hits === 0 && raw.some((r) => inside(p, r))) gaps++;
    }
  return { overlaps, gaps };
}

describe("L 90°, t = 200, centre-aligned", () => {
  // Hand calc: faces at ±100. A along +x, B along +y, sharing (0,0).
  // Outer corner = intersection of A's right face (y = -100) and B's left face (x = -100) = (-100,-100).
  // Inner corner = A's left face (y = 100) ∩ B's right face (x = 100) = (100,100).
  const r = run(PRESETS["L 90°"]!());
  it("miter polygons", () => {
    expectPoly(r.poly("A"), [
      [1000, -100],
      [1000, 100],
      [100, 100],
      [-100, -100],
    ]);
    expectPoly(r.poly("B"), [
      [-100, 1000],
      [-100, -100],
      [100, 100],
      [100, 1000],
    ]);
  });
  it("area = L-shape area", () => {
    // A: trapezoid (1100 + 900)/2 × 200 = 200,000; B the same → 400,000 mm².
    // Check: L shape = 1100×200 (bottom bar incl. corner) + 900×200 (upright) = 400,000.
    expect(sumArea(r.walls)).toBeCloseTo(400_000, 3);
  });
  it("clean outline hides the seam", () => {
    // Perimeter of the L: outer 1100 + 1100, ends 200 + 200, inner 900 + 900 = 4,400 mm.
    expect(totalLength(r.outline)).toBeCloseTo(4400, 6);
  });
});

describe("T, t = 200", () => {
  const r = run(PRESETS["T"]!());
  it("stem is trimmed to the host's facing side (y = 100); host untouched", () => {
    expectPoly(r.poly("B"), [
      [-100, 1000],
      [-100, 100],
      [100, 100],
      [100, 1000],
    ]);
    expectPoly(r.poly("A"), [
      [-1000, -100],
      [1000, -100],
      [1000, 100],
      [-1000, 100],
    ]);
    expect(r.walls.find((w) => w.id === "B")!.startJoin).toBe("tee");
  });
  it("outline: 2000 + 200 + 200 + (2000 − 200) + 900 + 900 + 200 = 6,200 mm", () => {
    expect(totalLength(r.outline)).toBeCloseTo(6200, 6);
  });
  it("area = 2000×200 + 900×200 = 580,000 mm²", () => {
    expect(sumArea(r.walls)).toBeCloseTo(580_000, 3);
  });
});

describe("X: crossing walls are not split (EDITING_OPERATIONS default)", () => {
  const r = run(PRESETS["X (crossing, not split)"]!());
  it("outline: 4 arms × (900 + 900) + 4 ends × 200 = 8,000 mm", () => {
    expect(totalLength(r.outline)).toBeCloseTo(8000, 6);
  });
  it("polygons overlap in the 200×200 centre (known; area sum counts it twice)", () => {
    expect(sumArea(r.walls)).toBeCloseTo(2 * 2000 * 200, 3); // 800,000; union is 760,000
  });
});

describe("+ (4 ends meeting at one node)", () => {
  const r = run(PRESETS["+ (4 ends meet)"]!());
  it("tiles without overlap and has the same outline as the X", () => {
    // Each arm: corners (±100, ±100) + node → area = 900×200 + triangle(200 base, 100 high) = 180,000 + 10,000.
    expect(sumArea(r.walls)).toBeCloseTo(4 * 190_000, 3); // 760,000 = X's union area ✓
    expect(totalLength(r.outline)).toBeCloseTo(8000, 6);
  });
});

describe("Straight continuation (I)", () => {
  it("two collinear walls look like one 2000×200 bar", () => {
    const r = run(PRESETS["Straight continuation"]!());
    expect(totalLength(r.outline)).toBeCloseTo(2 * 2000 + 2 * 200, 6);
    expect(sumArea(r.walls)).toBeCloseTo(400_000, 3);
  });
});

describe("Single room, 4000 × 3000 centre lines, t = 200", () => {
  // Outer rectangle 4200 × 3200, inner 3800 × 2800.
  // Area = 13,440,000 − 10,640,000 = 2,800,000 mm². Outline = 2(4200+3200) + 2(3800+2800) = 28,000 mm.
  const room = () => [
    W(0, 0, 4000, 0, { id: "A" }),
    W(4000, 0, 4000, 3000, { id: "B" }),
    W(4000, 3000, 0, 3000, { id: "C" }),
    W(0, 3000, 0, 0, { id: "D" }),
  ];
  it("closed room", () => {
    const r = run(room());
    expect(sumArea(r.walls)).toBeCloseTo(2_800_000, 3);
    expect(totalLength(r.outline)).toBeCloseTo(28_000, 6);
    expect(r.nodes).toHaveLength(4);
  });
  it("a 3 mm gap is healed (< joinTol 5 mm): same topology, 4 corner nodes", () => {
    const r = run(PRESETS["Room with 3 mm gap"]!());
    expect(r.nodes).toHaveLength(4);
    expect(r.walls.every((w) => w.startJoin === "corner" && w.endJoin === "corner")).toBe(true);
    expect(totalLength(r.outline)).toBeCloseTo(28_000, 6); // faces come from each wall's own line → exact
  });
  it("a 6 mm gap is NOT healed: two free ends", () => {
    const ws = room();
    ws[1] = { ...ws[1]!, start: { x: 4000, y: 6 } };
    const r = run(ws);
    expect(r.nodes).toHaveLength(3);
  });
  it("rotation by 37° preserves area and outline length (float drift)", () => {
    const r = run(rot(37, room()));
    expect(sumArea(r.walls)).toBeCloseTo(2_800_000, 3);
    expect(totalLength(r.outline)).toBeCloseTo(28_000, 6);
  });
  it("left-aligned walls drawn CCW: body sits inside the drawn rectangle", () => {
    // Inside faces: 200 mm in from the reference lines → inner 3600 × 2600; outer = 4000 × 3000.
    // Area = 12,000,000 − 9,360,000 = 2,640,000. Outline = 14,000 + 12,400 = 26,400.
    const r = run(PRESETS["Left-aligned room"]!());
    expect(sumArea(r.walls)).toBeCloseTo(2_640_000, 3);
    expect(totalLength(r.outline)).toBeCloseTo(26_400, 6);
  });
});

describe("Different thicknesses", () => {
  it("thick (300) host + thin (100) stem T: stem cut at y = 150", () => {
    const r = run(PRESETS["Thick + thin T"]!());
    expectPoly(r.poly("B"), [
      [-50, 1000],
      [-50, 150],
      [50, 150],
      [50, 1000],
    ]);
  });
  it("thick + thin L: corners (−50, −150) and (50, 150)", () => {
    // A faces y = ±150, B faces x = ±50. Outer = A right (y=−150) ∩ B left (x=−50); inner = (50, 150).
    const r = run(PRESETS["Thick + thin L"]!());
    expectPoly(r.poly("A"), [
      [1000, -150],
      [1000, 150],
      [50, 150],
      [-50, -150],
    ]);
  });
});

describe("Angles", () => {
  it("L 135°: no overlap, no gaps", () => {
    const ws = PRESETS["L 135°"]!();
    const c = coverage(ws, run(ws).walls);
    expect(c).toEqual({ overlaps: 0, gaps: 0 });
  });
  it("L 30°: miter length = (t/2) / sin(15°) = 386.37 mm from the node", () => {
    const r = run(PRESETS["L 30° (acute)"]!());
    const far = Math.max(...r.poly("A").map((p) => Math.hypot(p.x, p.y)));
    // Outer corner sits on the bisector at distance 100 / sin(15°) = 386.370 mm.
    expect(far).toBeLessThan(1001 * 1.01); // sanity; far end of the wall dominates
    const corners = r.poly("A").filter((p) => Math.hypot(p.x, p.y) < 500);
    expect(Math.max(...corners.map((p) => Math.hypot(p.x, p.y)))).toBeCloseTo(100 / Math.sin((15 * Math.PI) / 180), 6);
    expect(r.issues).toEqual([]);
  });
  it("L 10°: miter would be 100 / sin(5°) = 1147 mm > 4 × 200 → square caps + issue", () => {
    const r = run(PRESETS["L 10° (miter limit)"]!());
    expect(r.issues.map((i) => i.code)).toContain("miter-limited");
  });
  it("short wall at an acute angle: inner corner falls past the wall's far end → flagged", () => {
    // Inner corner along the bisector... along each wall: 100 / tan(10°) = 567 mm > 300 mm wall.
    const r = run(PRESETS["Short wall, acute"]!());
    expect(r.issues.map((i) => i.code)).toContain("corner-past-wall");
  });
  it("Y 120°: three arms tile the node", () => {
    const ws = PRESETS["Y 120°"]!();
    expect(coverage(ws, run(ws).walls)).toEqual({ overlaps: 0, gaps: 0 });
  });
});

function randomJunctions(seed0: number, mixed: boolean) {
  let seed = seed0;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  const cases: { name: string; ws: WallIn[]; arms: number }[] = [];
  for (let k = 0; cases.length < 30; k++) {
    const arms = 2 + Math.floor(rnd() * 3);
    const angles = Array.from({ length: arms }, () => rnd() * 360).sort((a, b) => a - b);
    // keep gaps ≥ 35° so no miter-limit / short-wall cases (tested above)
    const ok = angles.every((a, i) => ((angles[(i + 1) % arms]! - a + 360) % 360 || 360) >= 35);
    const ts = angles.map(() => (mixed ? 100 + Math.round(rnd() * 200) : 200));
    if (!ok) continue;
    const ws = angles.map((a, i) => rot(a, [W(0, 0, 1200, 0, { id: `a${i}`, thickness: ts[i]! })])[0]!);
    cases.push({ name: `${arms} arms at ${angles.map((a) => a.toFixed(0)).join("/")}° t=${ts.join("/")}`, ws, arms });
  }
  return cases;
}

describe("Property: random junctions, equal thickness (seeded)", () => {
  for (const c of randomJunctions(12345, false))
    it(c.name, () => {
      expect(coverage(c.ws, run(c.ws).walls, 20)).toEqual({ overlaps: 0, gaps: 0 });
    });
});

describe("Property: random junctions, MIXED thickness (seeded) — known limitation, measured not asserted", () => {
  it("reports how many cases chop a wall (gaps) or overlap", () => {
    const rows = randomJunctions(777, true).map((c) => ({ ...c, ...coverage(c.ws, run(c.ws).walls, 20) }));
    const bad = rows.filter((r) => r.gaps || r.overlaps);
    console.log(
      `mixed thickness: ${bad.length}/${rows.length} cases imperfect\n` +
        bad.map((b) => `  ${b.name}: gaps ${b.gaps}, overlaps ${b.overlaps}`).join("\n"),
    );
    expect(rows).toHaveLength(30);
  });
});

describe("Determinism (rule 10)", () => {
  it("shuffled input order → identical output", () => {
    const ws = grid(3, 4000);
    const a = JSON.stringify(computeJoins(ws));
    const b = JSON.stringify(computeJoins([...ws].reverse()));
    expect(b).toBe(a);
  });
});

describe("Grid of rooms", () => {
  it("3×3 rooms: area + outline by hand", () => {
    // Centre lines 12,000 × 12,000, 24 walls. Outer square 12,200²; 9 rooms of 3,800² inside.
    // Area = 148,840,000 − 9 × 14,440,000 = 18,880,000. Outline = 4×12,200 + 9 × 4×3,800 = 48,800 + 136,800 = 185,600.
    const ws = grid(3, 4000);
    const r = run(ws);
    expect(sumArea(r.walls)).toBeCloseTo(18_880_000, 2);
    expect(totalLength(r.outline)).toBeCloseTo(185_600, 4);
  });
  it("perf: 15×15 grid (480 walls) joins + outline", () => {
    const ws = grid(15, 4000);
    const t0 = performance.now();
    const r = run(ws);
    const ms = performance.now() - t0;
    console.log(`480 walls: joins + outline ${ms.toFixed(1)} ms`);
    expect(r.walls).toHaveLength(480);
  });
});
