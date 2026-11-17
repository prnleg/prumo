import { describe, expect, it } from "vitest";
import { CHAR_WIDTH, fitLabel, roomSpace } from "../src/label-fit";

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

describe("room label fit", () => {
  it("space = twice the nearest edge distance (label is centred)", () => {
    expect(roomSpace(rect(0, 0, 4000, 1000), { x: 2000, y: 500 })).toEqual({ w: 4000, h: 1000 });
    expect(roomSpace(rect(0, 0, 4000, 1000), { x: 1000, y: 300 })).toEqual({ w: 2000, h: 600 });
    // L shape: centre of the long arm sees the inner corner's edge
    const L = [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 1000 },
      { x: 1000, y: 1000 },
      { x: 1000, y: 3000 },
      { x: 0, y: 3000 },
    ];
    expect(roomSpace(L, { x: 500, y: 2000 })).toEqual({ w: 1000, h: 2000 });
  });

  it("hand case: 'Banheiro · 4,39 m²' = 18 chars → 18 × 12 × 0.6 = 129.6 px wide", () => {
    expect(CHAR_WIDTH).toBe(0.6);
    const parts = ["Banheiro", "4,39 m²"];
    expect(fitLabel(parts, 129.6 + 12, 40)).toEqual({ lines: ["Banheiro · 4,39 m²"], size: 12 });
    // one px less → two lines ("Banheiro" = 8 × 7.2 = 57.6 px), 2 × 15 = 30 px high
    expect(fitLabel(parts, 129.6 + 11, 40)).toEqual({ lines: ["Banheiro", "4,39 m²"], size: 12 });
    // too low for two 12 px lines (30 + 6 > 35) → one line at 10 px (18 × 6 = 108 px)
    expect(fitLabel(parts, 129.6 + 11, 35)).toEqual({ lines: ["Banheiro · 4,39 m²"], size: 10 });
  });

  it("very small room: only the name (8 × 6 = 48 px ≤ 70 − 12; 12.5 ≤ 20 − 6), then nothing", () => {
    expect(fitLabel(["Banheiro", "4,39 m²"], 70, 20)).toEqual({ lines: ["Banheiro"], size: 10 });
    expect(fitLabel(["Banheiro", "4,39 m²"], 40, 20)).toBeNull();
    expect(fitLabel(["", "4,39 m²"], 200, 40)).toEqual({ lines: ["4,39 m²"], size: 12 });
    expect(fitLabel([], 200, 40)).toBeNull();
  });
});
