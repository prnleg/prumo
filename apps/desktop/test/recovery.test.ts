import { describe, expect, it } from "vitest";
import { parseMeta, recoveryKey } from "../src/recovery";

describe("recovery store helpers", () => {
  it("project id → safe, stable file key (no path tricks)", () => {
    expect(recoveryKey("3f2b9c1e-0d4a-4c7e-9a51-6b1e2f3a4b5c")).toBe("3f2b9c1e-0d4a-4c7e-9a51-6b1e2f3a4b5c");
    expect(recoveryKey("../evil/x")).toBe("_2e_2e_2fevil_2fx");
    expect(recoveryKey("")).toBe("_");
  });

  it("meta: damaged → null; path optional", () => {
    expect(parseMeta(null)).toBeNull();
    expect(parseMeta("{")).toBeNull();
    expect(parseMeta('{"name":1}')).toBeNull();
    expect(parseMeta('{"v":1,"name":"a.prumo","savedAt":"t"}')).toEqual({ name: "a.prumo", path: null, savedAt: "t" });
  });
});
