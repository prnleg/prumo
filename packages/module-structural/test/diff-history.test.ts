// ROADMAP Phase 2 exit: "Findings diff works on undo/redo too". The app re-runs the checks on every
// History `commit` event (execute, undo and redo all emit one) and diffs against the previous result;
// this test drives the same sequence without the UI.
import { History, deleteCommand, emptyProject, putCommand, putElements, type Opening, type Wall } from "@prumo/core";
import { describe, expect, it } from "vitest";
import { diffFindings, runChecks, setBonded, setLintel, setTieBeam, type CheckResult } from "../src";

const wall: Wall = setBonded(
  setBonded(
    setTieBeam(
      {
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
      },
      true,
    ),
    "start",
    true,
  ),
  "end",
  true,
);
const door: Opening = {
  id: "d",
  type: "opening",
  levelId: "l",
  host: { elementId: "w", offset: 1000 },
  width: 800,
  height: 2100,
  sillHeight: 0,
  kind: "door",
  handing: "left",
  swing: "in",
  components: {},
};

describe("findings diff across undo / redo", () => {
  it("add a door without a lintel → +1; undo → −1; redo → +1 again (same finding); lintel → −1", () => {
    const p0 = putElements(
      emptyProject({ id: "p", levelId: "l", name: "t", now: "", profileId: "br-nbr/structural-masonry" }),
      [wall],
    );
    const h = new History(p0);
    const steps: string[] = [];
    let last: CheckResult = runChecks(h.current, "l");
    h.subscribe((e) => {
      if (e.type !== "commit") return;
      const next = runChecks(e.project, "l");
      const d = diffFindings(last.findings, next.findings);
      steps.push(`+${d.added.map((f) => f.ruleId).join(",")} -${d.resolved.map((f) => f.ruleId).join(",")}`);
      last = next;
    });
    expect(last.findings).toEqual([]);

    h.execute(putCommand({ key: "cmd.addDoor" }, [door]));
    h.undo();
    h.redo();
    h.execute(putCommand({ key: "cmd.edit" }, [setLintel(door, true)]));
    h.undo();
    h.execute(deleteCommand(h.current, ["d"]));
    expect(steps).toEqual([
      "+R-OPEN-001 -", // door added
      "+ -R-OPEN-001", // undo
      "+R-OPEN-001 -", // redo: the same finding back
      "+ -R-OPEN-001", // lintel marked
      "+R-OPEN-001 -", // undo the lintel
      "+ -R-OPEN-001", // door deleted
    ]);
  });
});
