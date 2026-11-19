/* eslint-disable vue/one-component-per-file -- small render-function bars of one module */
// Structural's part of the screens (ADR-059). Step 1: the chase and slab tools, with their option bars,
// hints and plan previews, come from here; the app only lists `structuralUi` among the installed modules.
// Step 2: its panel sections (room, wall, opening, slab) and the chase panel (./sections).
// The rest (checks panel, plan marks, 3D / export marks, Settings values) still lives in the app.
import { DEFAULT_SNAP } from "@prumo/core";
import type { ModuleUi, ToolContribution, UiContext, UiTool } from "@prumo/ui-api";
import { Cable, MoveHorizontal, MoveVertical, Pentagon, SquareDashed, SquareStack } from "@lucide/vue";
import { defineComponent, h, type Component, type PropType } from "vue";
import { ChaseTool } from "../chase-tool";
import { SLAB_KINDS, type ChaseDir, type SlabKind } from "../data";
import { STRUCTURAL } from "../manifest";
import { SlabTool, type SlabMode } from "../slab-tool";
import { MESSAGES } from "./messages";
import { ChasePanel, OpeningSection, RoomSection, SlabSection, WallSection } from "./sections";

/** The slab tool in the app's terms: Esc / right-click drop the picks, Enter / double-click create. */
export class SlabUiTool implements UiTool {
  constructor(readonly slab: SlabTool) {}
  get options() {
    return this.slab.options;
  }
  set options(o) {
    this.slab.options = o;
  }
  get active() {
    return this.slab.active;
  }
  get blocked() {
    return this.slab.blocked;
  }
  move(p: Parameters<SlabTool["move"]>[0]) {
    this.slab.move(p);
  }
  click(p: Parameters<SlabTool["click"]>[0]) {
    this.slab.click(p);
  }
  dblclick() {
    this.slab.finish();
  }
  commit() {
    this.slab.finish();
  }
  finish() {
    this.slab.cancel();
  }
}

const barProps = {
  ctx: { type: Object as PropType<UiContext>, required: true },
  tool: { type: Object as PropType<UiTool>, required: true },
  /** Changes whenever the tool may have changed (the app's redraw counter). */
  rev: { type: Number, default: 0 },
} as const;

const segButton = (on: boolean, title: string, icon: Component, label: string, onClick: () => void) =>
  h("button", { class: { on }, title, onClick }, [h(icon, { size: 14 }), " ", label]);

/** Chase direction: horizontal (two clicks along a wall) or vertical (one click). */
const ChaseBar = defineComponent({
  props: barProps,
  setup(props) {
    return () => {
      void props.rev;
      const { ctx } = props;
      const tool = props.tool as ChaseTool;
      const set = (dir: ChaseDir) => {
        tool.finish();
        tool.options = { ...tool.options, dir };
        ctx.refresh();
      };
      const d = tool.options.dir;
      return h("span", { class: "seg", role: "group", "aria-label": ctx.t("chaseDir.label") }, [
        segButton(
          d === "horizontal",
          ctx.t("chaseDir.horizontal.tip"),
          MoveHorizontal,
          ctx.t("chaseDir.horizontal"),
          () => set("horizontal"),
        ),
        segButton(d === "vertical", ctx.t("chaseDir.vertical.tip"), MoveVertical, ctx.t("chaseDir.vertical"), () =>
          set("vertical"),
        ),
      ]);
    };
  },
});

/** Slab: cover rooms / draw an outline, the type for new slabs, and "create" while picking rooms. */
const SlabBar = defineComponent({
  props: barProps,
  setup(props) {
    return () => {
      void props.rev;
      const { ctx } = props;
      const s = (props.tool as SlabUiTool).slab;
      const mode = s.options.mode;
      const setMode = (m: SlabMode) => {
        s.cancel();
        s.options = { ...s.options, mode: m };
        ctx.refresh();
      };
      const setKind = (k: string) => {
        const o = { ...s.options };
        delete o.kind;
        s.options = k ? { ...o, kind: k as SlabKind } : o;
        ctx.refresh();
      };
      return [
        h("span", { class: "seg", role: "group", "aria-label": ctx.t("slabMode.label") }, [
          segButton(mode === "rooms", ctx.t("slabMode.rooms.tip"), SquareDashed, ctx.t("slabMode.rooms"), () =>
            setMode("rooms"),
          ),
          segButton(mode === "outline", ctx.t("slabMode.outline.tip"), Pentagon, ctx.t("slabMode.outline"), () =>
            setMode("outline"),
          ),
        ]),
        h("label", { class: "cmp-pick" }, [
          ctx.t("props.openingStyle"),
          " ",
          h(
            "select",
            {
              value: s.options.kind ?? "",
              onChange: (e: Event) => setKind((e.target as HTMLSelectElement).value),
            },
            [
              h("option", { value: "" }, ctx.t("above.unknown")),
              ...SLAB_KINDS.map((k) => h("option", { value: k }, ctx.t(`slabKind.${k}`))),
            ],
          ),
        ]),
        mode === "rooms"
          ? h(
              "button",
              {
                disabled: !s.picked.length,
                onClick: () => {
                  s.finish();
                  ctx.refresh();
                },
              },
              ctx.t("slab.create", { count: s.picked.length }),
            )
          : null,
      ];
    };
  },
});

const chaseTool: ToolContribution = {
  id: "chase",
  icon: Cable,
  label: "tool.chase",
  tip: "tool.chase.tip",
  create: (ctx) => new ChaseTool(ctx.history, { ids: ctx.ids, levelId: ctx.level, dir: "horizontal", grid: ctx.grid }),
  hint: (ctx, tl) => {
    const c = tl as ChaseTool;
    return c.options.dir === "vertical"
      ? ctx.t("hint.chase.vertical")
      : c.active
        ? ctx.t("hint.chase.active")
        : ctx.t("hint.chase.idle");
  },
  preview: (ctx, tl) => {
    const c = tl as ChaseTool;
    return c.at && c.length ? { labels: [{ at: c.at, text: ctx.formatLength(c.length) }] } : {};
  },
  bar: ChaseBar,
};

const slabTool: ToolContribution = {
  id: "slab",
  icon: SquareStack,
  label: "tool.slab",
  tip: "tool.slab.tip",
  create: (ctx) =>
    new SlabUiTool(
      new SlabTool(ctx.history, {
        ids: ctx.ids,
        levelId: ctx.level,
        mode: "rooms",
        grid: ctx.grid,
        snapPx: DEFAULT_SNAP.endpointRadiusPx,
      }),
    ),
  hint: (ctx, tl) => {
    const s = (tl as SlabUiTool).slab;
    if (s.options.mode === "rooms")
      return s.picked.length
        ? ctx.t("hint.slab.rooms.active", { count: s.picked.length })
        : ctx.t("hint.slab.rooms.idle");
    return s.preview.length ? ctx.t("hint.slab.outline.active") : ctx.t("hint.slab.outline.idle");
  },
  preview: (_ctx, tl) => {
    const s = (tl as SlabUiTool).slab;
    return { outlines: s.preview, rooms: [...s.picked] };
  },
  bar: SlabBar,
};

export const structuralUi: ModuleUi = {
  moduleId: STRUCTURAL,
  name: "module.structural.name",
  defaultOn: true,
  messages: MESSAGES,
  tools: [chaseTool, slabTool],
  roomPanel: RoomSection,
  sections: { wall: WallSection, opening: OpeningSection, slab: SlabSection },
  elementTypes: [`${STRUCTURAL}:chase`],
  elementPanel: ChasePanel,
};
