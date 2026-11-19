import { emptyProject, type Element, type Project } from "@prumo/core";
import type { ModuleUi } from "@prumo/ui-api";
import { describe, expect, it } from "vitest";
import { installedFrom, usedButNotInstalled } from "../src/module-store";

const ui = (moduleId: string, defaultOn: boolean): ModuleUi => ({
  moduleId,
  name: `module.${moduleId}.name`,
  description: `module.${moduleId}.desc`,
  defaultOn,
  messages: {},
});
const UIS = [ui("a", true), ui("b", false)];
const withItems = (): Project => {
  const p = emptyProject({ id: "p", levelId: "l-1", name: "t", now: "2026-11-19T00:00:00.000Z", profileId: "br" });
  const item = { id: "e1", type: "b:thing", ownerModule: "b", levelId: "l-1", at: { x: 0, y: 0 }, components: {} };
  return { ...p, elements: { e1: item as unknown as Element } };
};

describe("Modules screen (owner, 2026-11-19)", () => {
  it("installed = the remembered choice, else the module's default", () => {
    expect(installedFrom(UIS, undefined)).toEqual({ a: true, b: false });
    expect(installedFrom(UIS, { a: false, b: true })).toEqual({ a: false, b: true });
    expect(installedFrom(UIS, { b: true })).toEqual({ a: true, b: true });
  });

  it("a project with items of a module that isn't installed says so (they stay in the file)", () => {
    const p = withItems();
    expect(usedButNotInstalled(p, UIS, { a: true, b: false })).toEqual([
      { moduleId: "b", name: "module.b.name", count: 1 },
    ]);
    expect(usedButNotInstalled(p, UIS, { a: true, b: true })).toEqual([]);
  });
});
