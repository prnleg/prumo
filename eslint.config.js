// Boundary rules (CLAUDE.md golden rules 11 + 16, ADR-033) are enforced here, not by convention.
import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";

const tauri = { group: ["@tauri-apps/*"], message: "Tauri only in the platform adapter (CLAUDE.md rule 16)." };

export default tseslint.config(
  { ignores: ["spikes/**", "**/dist/**", "**/node_modules/**", "**/src-tauri/**"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...pluginVue.configs["flat/recommended"],
  // TypeScript already checks undefined names (typescript-eslint guidance).
  { files: ["**/*.ts", "**/*.vue"], rules: { "no-undef": "off" } },
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        location: "readonly",
        ResizeObserver: "readonly",
      },
    },
    // Formatting is Prettier's job (ADR-033).
    rules: {
      "vue/max-attributes-per-line": "off",
      "vue/singleline-html-element-content-newline": "off",
      "vue/html-self-closing": "off",
      "vue/html-indent": "off",
      "vue/multiline-html-element-content-newline": "off",
      "vue/html-closing-bracket-newline": "off",
    },
  },
  {
    files: ["apps/desktop/src/**/*.{ts,vue}"],
    ignores: ["apps/desktop/src/platform/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [tauri] }] },
  },
  // Tests may assert presence with `!` after checking it (noUncheckedIndexedAccess is on).
  // Geometry does modular index math on arrays checked by construction (ported from Spike A).
  {
    files: ["**/test/**/*.ts", "packages/core/src/geometry/**/*.ts"],
    rules: { "@typescript-eslint/no-non-null-assertion": "off" },
  },
  {
    files: ["packages/module-*/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            tauri,
            {
              group: ["@prumo/module-*/src/*", "@prumo/module-*/**/internal/*"],
              message: "modules use each other's public API only (CLAUDE.md rule 11).",
            },
          ],
        },
      ],
    },
  },
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
