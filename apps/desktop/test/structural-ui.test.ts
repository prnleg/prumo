import { emptyProject, putElements, type Opening, type Wall } from "@prumo/core";
import { RULES, runChecks } from "@prumo/module-structural";
import { describe, expect, it } from "vitest";
import { cards, findingText, paramText } from "../src/structural-ui";

const wall: Wall = {
  id: "w",
  type: "wall",
  levelId: "l",
  start: { x: 0, y: 0 },
  end: { x: 4000, y: 0 },
  alignment: "center",
  kind: "full",
  thickness: 140,
  height: 2700,
  baseOffset: 0,
  components: {},
};
const win = (id: string, offset: number): Opening => ({
  id,
  type: "opening",
  levelId: "l",
  host: { elementId: "w", offset },
  width: 1200,
  height: 1200,
  sillHeight: 1000,
  kind: "window",
  components: {},
});
const p = putElements(
  emptyProject({ id: "p", levelId: "l", name: "t", now: "", profileId: "br-nbr/structural-masonry" }),
  [wall, win("a", 200), win("b", 2200)],
);

describe("structural findings in words", () => {
  it("elements are described by kind and size, formatted per language", () => {
    expect(paramText({ kind: "element", id: "a" }, p, "pt-BR")).toBe("a janela (1,20 m)");
    expect(paramText({ kind: "element", id: "w" }, p, "en")).toBe("the 4.00 m wall");
    const f = runChecks(p, "l").findings[0]!;
    expect(findingText(f, p, "pt-BR")).toBe(
      "Possível problema: a janela (1,20 m), na parede de 4,00 m, não tem verga marcada.",
    );
  });

  it("one card per rule listing every element (Q-135), assumptions deduplicated", () => {
    const c = cards(RULES, runChecks(p, "l").findings, p, "en");
    expect(c.map((x) => [x.rule.id, x.findings.length])).toEqual([["R-OPEN-001", 2]]);
    expect(c[0]!.assumptions).toEqual([
      "the 4.00 m wall counts as load-bearing: in structural masonry every wall does unless marked otherwise",
    ]); // one wall, two windows → one line
    const w2 = { ...wall, id: "w2", start: { x: 0, y: 3000 }, end: { x: 4000, y: 3000 } };
    const q = putElements(p, [w2, { ...win("c", 200), host: { elementId: "w2", offset: 200 } }]);
    expect(cards(RULES, runChecks(q, "l").findings, q, "en")[0]!.assumptions).toEqual([
      "these walls count as load-bearing: in structural masonry every wall does unless marked otherwise",
    ]);
  });
});
