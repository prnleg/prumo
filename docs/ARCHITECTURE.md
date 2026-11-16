# ARCHITECTURE (TENTATIVE — depends on ADR-001/002 PROPOSED: Tauri 2 + Vue 3 + TypeScript)

> Rewritten 2026-11-15 (session #1) for the modular "Visions" design. Don't code against it until ADR-001/002/019/022 are ACCEPTED.

## Big picture

```
┌──────────────────────────── Desktop shell: Tauri 2 (Rust) ─────────────────────────────┐
│ file dialogs, file I/O, app updates, (later) heavy compute via Rust commands          │
│ ┌──────────────────────── WebView: Vue 3 + TypeScript ─────────────────────────────┐   │
│ │ App shell UI: Vision switcher, layout, panels host, i18n, settings               │   │
│ │ ───────────────────────────────────────────────────────────────────────────────  │   │
│ │ Modules (each is a package):                                                     │   │
│ │   architect/   structural/   (electrical/ later)                                 │   │
│ │ ───────────────────────────────────────────────────────────────────────────────  │   │
│ │ Core (framework-free TS — NO Vue, NO DOM, NO Tauri imports):                     │   │
│ │   model kernel (elements + components) │ geometry │ commands/history │           │   │
│ │   module host (registry, manifests)    │ rule engine │ persistence/migrations    │   │
│ └──────────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

Why the core is framework-free: it stays testable in Node, a **web build** (no Tauri) stays possible, and a future port isn't blocked.

## Monorepo (proposed, pnpm workspaces)

```
apps/
  desktop/            Tauri app (src-tauri/ + Vue front end)
  web/                (optional, later) same front end without Tauri
packages/
  core/               model, geometry, commands, module-host, rule-engine, persistence
  ui-kit/             shared Vue components (panels, inputs, canvas host)
  renderer-2d/        plan rendering (SVG first — ADR-002)
  module-architect/   walls, openings, slabs, editing tools
  module-structural/  materials, profiles (br-nbr, eu-en), rules, calculators
  data-profiles/      code profiles + material packs as JSON (could live inside structural)
tests/fixtures/       project files per schema version
spikes/               throwaway
docs/
```

## Model kernel: elements + components

```ts
Element {
  id: UUID
  type: "wall" | "opening" | "slab" | ... | `${moduleId}:${string}`
  levelId
  geometry: ...                       // owned by core / architect
  host?: { elementId, offset }        // generic hosting (openings now; outlets later)
  components: Record<ModuleId, unknown>   // module data, namespaced, versioned
}
```

- **Generic hosting** from day 1: openings are the first hosted kind; electrical outlets and switches will reuse it.
- Unknown components are preserved byte-for-byte (MODULES.md rule 3).

## Edit → feedback loop

1. Tool → command → history → new immutable snapshot.
2. Renderer redraws the changed elements.
3. Rule engine runs the rules of enabled modules (main thread first, Web Worker if measured slow).
4. Findings diff (new / resolved / unchanged) → panels.

## Cross-platform packaging (to verify in Spike D)

- Windows: WebView2 (preinstalled on Win 10/11; installer can bootstrap it). MSI/NSIS.
- macOS: WKWebView. DMG; **code signing + notarization needed** to avoid scary warnings (needs an Apple developer account — cost!). → Q-057
- Linux: WebKitGTK. AppImage / .deb / .rpm / Flatpak. ⚠️ WebKitGTK has historically lagged in WebGL/canvas performance and rendering quirks, which matters for the 3D Vision later. Must test.
- Three different web engines means the UI must be tested on all three. That's the price of Tauri's small installers.

## Doubts

- If Linux WebKitGTK proves bad for 3D (Phase 4), the fallback is Electron (ships its own Chromium; ~100 MB+ installers but consistent rendering). Since the front end is plain Vue/TS, switching shells is **painful but not fatal**, as long as Tauri APIs stay behind an adapter (`platform/` interface). **Rule: no direct Tauri imports outside `apps/desktop/src/platform/`.**
- Where heavy compute goes (Tier 2 solver): TS / Rust via Tauri command / Rust→WASM (works on web too). ADR-013, later.
