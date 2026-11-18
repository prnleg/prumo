// ADR-059: the app's screens never name an optional module; it all comes through `ModuleUi`. Only the
// install list (installed-modules.ts) may name them. Guards against wiring a module straight in again.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "../src");
const SCREENS = ["App.vue", "PropertiesPanel.vue", "SettingsPanel.vue", "i18n/messages.ts"];
const OPTIONAL = [/electric/i];

describe("module boundary (ADR-059)", () => {
  it.each(SCREENS)("%s doesn't mention an optional module", (f) => {
    const text = readFileSync(join(SRC, f), "utf8");
    for (const re of OPTIONAL) expect(re.test(text), `${f} mentions ${re}`).toBe(false);
  });
});
