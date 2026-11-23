import { describe, expect, it } from "vitest";
import { constructionSystem, emptyProject, profileIdFor, setSystemCommand, SYSTEMS } from "../src";
import { NOW } from "./fixtures";

const proj = (profileId: string) => emptyProject({ id: "p", levelId: "l", name: "x", now: NOW, profileId });

describe("project profile: construction system (Q-143)", () => {
  it("reads the system from profileId; anything else is 'unknown'", () => {
    expect(constructionSystem(proj("br-nbr/rc-frame"))).toBe("rc-frame");
    expect(constructionSystem(proj("br-nbr/structural-masonry"))).toBe("structural-masonry");
    expect(constructionSystem(proj("br-nbr/wood"))).toBe("unknown");
    expect(constructionSystem(proj(""))).toBe("unknown");
  });

  it("builds ids for every system", () => {
    expect(SYSTEMS.map((s) => profileIdFor(s))).toEqual([
      "br-nbr/structural-masonry",
      "br-nbr/rc-frame",
      "br-nbr/unknown",
    ]);
  });

  it("set keeps the country part and is a no-op when unchanged", () => {
    const p = proj("pt-x/structural-masonry");
    expect(setSystemCommand("rc-frame").apply(p).profileId).toBe("pt-x/rc-frame");
    expect(setSystemCommand("structural-masonry").apply(p)).toBe(p);
  });
});
