// Boundary rules (CLAUDE.md golden rules 11 + 16, ADR-033) are enforced here, not by convention.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

const tauri = { group: ["@tauri-apps/*"], message: "Tauri only in the platform adapter (CLAUDE.md rule 16)." };

export default tseslint.config(
  { ignores: ["spikes/**", "**/dist/**", "**/node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  // Tests may assert presence with `!` after checking it (noUncheckedIndexedAccess is on).
  { files: ["**/test/**/*.ts"], rules: { "@typescript-eslint/no-non-null-assertion": "off" } },
  {
    files: ["packages/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            tauri,
            { group: ["vue", "vue/*", "@vue/*"], message: "core never imports a UI framework (CLAUDE.md rule 11)." },
            {
              group: ["@prumo/module-*", "@prumo/renderer-*", "@prumo/ui-*"],
              message: "core never imports modules or UI (CLAUDE.md rule 11).",
            },
          ],
        },
      ],
    },
  },
);
