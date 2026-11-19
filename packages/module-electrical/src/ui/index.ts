/* eslint-disable vue/one-component-per-file -- small render-function sections of one module */
// Electrical's part of the screens (ADR-059): everything the app shows for this module comes from here —
// tools, plan symbols, switch → light links, the item panel, the room panel's minimums, its strings. The
// app only lists `electricalUi` among the installed modules.
import {
  inside,
  putCommand,
  updateCommand,
  wallLength,
  type Element,
  type ModuleElement,
  type Wall,
} from "@prumo/core";
import type { ModuleUi, PlanLink, PlanMark, UiContext } from "@prumo/ui-api";
import { Lightbulb, Plug, ToggleRight, Zap } from "@lucide/vue";
import { defineComponent, h, ref, type PropType } from "vue";
import { circuits, MAX_CIRCUIT } from "../circuits";
import {
  electricalData,
  kindOf,
  newLight,
  newWallItem,
  OUTLET_PURPOSES,
  setSwitchLight,
  switchLights,
  withElectricalData,
  type ElectricalData,
  type ItemKind,
} from "../data";
import { ELECTRICAL, LIGHT, OUTLET, SWITCH } from "../manifest";
import { facePoint, roomElectrical } from "../minimums";
import { electricalSolids } from "../solids";
import { electricalPacks } from "../packs";
import { ElectricalTool, sideOf } from "../tool";
import { MESSAGES } from "./messages";

const packs = electricalPacks();

// symbols, px around the item's point
const CIRCLE = (r: number) => `M${-r},0 a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0`;
const PATHS = {
  outlet: "M0,-6 L6,5 L-6,5 Z",
  switch: CIRCLE(6.5),
  light: `${CIRCLE(7)} M-5,-5 L5,5 M5,-5 L-5,5`,
};

/** Plan symbols sit this far past the wall face, mm (drawing value: clear of the wall's outline). */
const SYMBOL_OFF = 30;

/** Where each item's symbol goes: outlets / switches just off the face they're on; lights at their point. */
function marks(ctx: UiContext): PlanMark[] {
  const p = ctx.project;
  return Object.values(p.elements).flatMap((e): PlanMark[] => {
    const k = kindOf(e);
    if (!k || e.levelId !== ctx.level) return [];
    if (k === "light") return "at" in e && e.at ? [{ id: e.id, at: e.at, path: PATHS.light }] : [];
    const w = "host" in e && e.host ? p.elements[e.host.elementId] : undefined;
    if (w?.type !== "wall" || !("host" in e) || !e.host) return [];
    const d = electricalData(e);
    const at = facePoint(w, e.host.offset, d.face ?? "left", SYMBOL_OFF);
    return k === "switch"
      ? [{ id: e.id, at, path: PATHS.switch, text: "S" }]
      : [{ id: e.id, at, path: PATHS.outlet, filled: d.purpose === "dedicated" }];
  });
}

/** The selected switch's lights (or a selected light's switches): dashed lines. */
function links(ctx: UiContext): PlanLink[] {
  if (ctx.selection.length !== 1) return [];
  const p = ctx.project;
  const id = ctx.selection[0] ?? "";
  const pos = new Map(marks(ctx).map((m) => [m.id, m.at]));
  const sel = p.elements[id];
  const pairs: [string, string][] =
    kindOf(sel) === "switch" && sel
      ? switchLights(p, sel).map((l) => [id, l])
      : kindOf(sel) === "light"
        ? Object.values(p.elements)
            .filter((e) => kindOf(e) === "switch" && switchLights(p, e).includes(id))
            .map((e) => [e.id, id])
        : [];
  return pairs.flatMap(([a, b]) => {
    const pa = pos.get(a);
    const pb = pos.get(b);
    return pa && pb ? [{ key: `${a}-${b}`, a: pa, b: pb }] : [];
  });
}

function edit(ctx: UiContext, id: string, f: (e: ModuleElement, d: ElectricalData) => ModuleElement) {
  ctx.run(
    updateCommand({ key: "cmd.editElectrical" }, [id], (e) =>
      e.type === OUTLET || e.type === SWITCH || e.type === LIGHT ? f(e as ModuleElement, electricalData(e)) : e,
    ),
  );
}

/**
 * Circuit part of a light / outlet panel (ADR-061): which circuit, the appliance's power for a
 * one-appliance outlet, and what's on that circuit with its estimated load and notes. Information only.
 */
function circuitPart(ctx: UiContext, e: Element, d: ElectricalData, rev: { value: number }) {
  const t = ctx.t;
  const all = circuits(ctx.project, packs);
  const used = all.list.map((c) => c.n);
  const top = Math.min(MAX_CIRCUIT, Math.max(0, ...used) + 1);
  const nums = [...new Set([...used, top, ...(d.circuit ? [d.circuit] : [])])].sort((a, b) => a - b);
  const num = (x: number) => new Intl.NumberFormat(ctx.locale, { maximumFractionDigits: 0 }).format(x);
  const out = [
    h("h4", t("elec.circuits")),
    h("label", { title: t("elec.circuit.tip") }, [
      t("elec.circuit"),
      h(
        "select",
        {
          value: d.circuit ? String(d.circuit) : "",
          onChange: (ev: Event) => {
            const v = Number((ev.target as HTMLSelectElement).value);
            edit(ctx, e.id, (x, dd) => withElectricalData(x, { ...dd, circuit: v || undefined }));
          },
        },
        [
          h("option", { value: "" }, t("elec.circuit.none")),
          ...nums.map((n) => h("option", { value: String(n) }, String(n))),
        ],
      ),
    ]),
  ];
  if (kindOf(e) === "outlet" && d.purpose === "dedicated")
    out.push(
      h("label", { title: t("elec.power.tip") }, [
        t("elec.power"),
        h("span", { class: "field" }, [
          h("input", {
            key: `${e.id}/p/${d.power ?? ""}/${rev.value}`,
            value: d.power ? num(d.power) : "",
            placeholder: "?",
            onChange: (ev: Event) => {
              const text = (ev.target as HTMLInputElement).value.trim();
              const va = text ? ctx.parseNumber(text) : null;
              if (text && (va === null || va <= 0 || va > 100000)) return void rev.value++;
              edit(ctx, e.id, (x, dd) => withElectricalData(x, { ...dd, power: va ? Math.round(va) : undefined }));
            },
          }),
          "VA",
        ]),
      ]),
    );
  const c = all.list.find((x) => x.n === d.circuit);
  if (c) {
    out.push(
      h("p", t("elec.circuit.items", { n: c.n, lights: c.lights, outlets: c.outlets, dedicated: c.dedicated })),
      h("p", [
        t("elec.circuit.load", { va: num(c.va) }),
        " · ",
        h("span", { class: "unverified" }, t("elec.unverified")),
      ]),
    );
    if (c.unknown) out.push(h("p", { class: "ro" }, t("elec.circuit.unknown", { count: c.unknown })));
    for (const note of c.notes) out.push(h("p", { class: "warn" }, t(`elec.circuit.${note}`)));
  }
  if (all.unassigned) out.push(h("p", { class: "ro" }, t("elec.circuit.unassigned", { count: all.unassigned })));
  out.push(h("p", { class: "ro", title: t("elec.loads.source.tip") }, t("elec.loads.source")));
  return out;
}

/** The selected item's panel: height, use (outlet), which lights a switch turns on. */
const ElementPanel = defineComponent({
  props: {
    ctx: { type: Object as PropType<UiContext>, required: true },
    element: { type: Object as PropType<Element>, required: true },
  },
  setup(props) {
    const rev = ref(0);
    return () => {
      const { ctx, element: e } = props;
      const k = kindOf(e) as ItemKind;
      const d = electricalData(e);
      const t = ctx.t;
      const out = [h("h3", t(`elec.item.${k}`))];
      if (k !== "light")
        out.push(
          h("label", { title: t("elec.height.tip") }, [
            t("elec.height"),
            h("span", { class: "field" }, [
              h("input", {
                key: `${e.id}/${d.height ?? ""}/${rev.value}`,
                value: ctx.formatCm(d.height ?? 0),
                onChange: (ev: Event) => {
                  const cm = ctx.parseNumber((ev.target as HTMLInputElement).value);
                  if (cm === null || cm < 0 || cm > 500) return void rev.value++;
                  edit(ctx, e.id, (x, dd) => withElectricalData(x, { ...dd, height: Math.round(cm * 10) }));
                },
              }),
              "cm",
            ]),
          ]),
        );
      if (k === "outlet")
        out.push(
          h("label", { class: "stack", title: t("elec.purpose.tip") }, [
            t("elec.purpose"),
            h(
              "select",
              {
                value: d.purpose ?? "general",
                onChange: (ev: Event) => {
                  const v = (ev.target as HTMLSelectElement).value;
                  edit(ctx, e.id, (x, dd) =>
                    withElectricalData(x, { ...dd, purpose: v === "dedicated" ? "dedicated" : undefined }),
                  );
                },
              },
              OUTLET_PURPOSES.map((pu) => h("option", { value: pu }, t(`elec.purpose.${pu}`))),
            ),
          ]),
        );
      if (k === "switch") {
        const lights = floorLights(ctx);
        out.push(h("p", { class: "ro" }, t("elec.turnsOn")));
        if (!lights.length) out.push(h("p", { class: "ro" }, t("elec.noLights")));
        for (const l of lights)
          out.push(
            h("label", { class: "check" }, [
              h("input", {
                type: "checkbox",
                checked: (d.lights ?? []).includes(l.id),
                onChange: (ev: Event) =>
                  edit(ctx, e.id, (x) => setSwitchLight(x, l.id, (ev.target as HTMLInputElement).checked)),
              }),
              l.label,
            ]),
          );
      }
      if (k === "light") out.push(h("p", { class: "ro" }, t("elec.light.note")));
      if (k !== "switch") out.push(...circuitPart(ctx, e, d, rev));
      return h("div", out);
    };
  },
});

/** This floor's lights, named by the room they're in ("Light in Bedroom 1"). */
function floorLights(ctx: UiContext) {
  return Object.values(ctx.project.elements)
    .filter((e) => e.type === LIGHT && e.levelId === ctx.level)
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((e, i) => {
      const at = "at" in e && e.at ? e.at : null;
      const room = at ? ctx.rooms.find((r) => inside(at, r.floor)) : undefined;
      return {
        id: e.id,
        label: room
          ? ctx.t("elec.lightIn", { room: room.label || ctx.formatArea(room.floorArea) })
          : ctx.t("elec.lightN", { n: i + 1 }),
      };
    });
}

/** Room panel: ceiling lights and general outlets vs the NBR 5410 minimums (information, UNVERIFIED). */
const RoomPanel = defineComponent({
  props: {
    ctx: { type: Object as PropType<UiContext>, required: true },
    roomKey: { type: String, required: true },
  },
  setup(props) {
    return () => {
      const { ctx } = props;
      const r = roomElectrical(ctx.project, ctx.level, packs).get(props.roomKey);
      if (!r) return null;
      const t = ctx.t;
      const short = (n: number, min: number | null) => (min !== null && n < min ? "warn" : undefined);
      return h("div", [
        h("h4", t("props.electrical")),
        h("p", { class: short(r.lights, r.lightsMin) }, t("elec.lights", { n: r.lights, min: r.lightsMin ?? "?" })),
        h(
          "p",
          { class: short(r.outlets, r.outletsMin) },
          t(`elec.outlets.${r.rule}`, {
            n: r.outlets,
            min: r.outletsMin ?? "?",
            perimeter: ctx.formatLength(r.perimeter * 1000),
          }),
        ),
        r.typed ? null : h("p", { class: "ro" }, t("elec.noType")),
        h("p", { class: "ro", title: r.values.map((v) => v.source).join("\n") }, [
          t("elec.source"),
          " · ",
          h("span", { class: "unverified" }, t("elec.unverified")),
        ]),
      ]);
    };
  },
});

const tool = (id: ItemKind, icon: typeof Plug) => ({
  id,
  icon,
  label: `tool.${id}`,
  tip: `tool.${id}.tip`,
  hint: (ctx: UiContext) => ctx.t(`hint.${id}`),
  create: (ctx: UiContext) =>
    new ElectricalTool(ctx.history, { ids: ctx.ids, levelId: ctx.level, kind: id, grid: ctx.grid }),
});

/** Dev only: a bedroom with two outlets, a ceiling light and a switch that turns it on. */
function demo(ctx: UiContext): { item: string; room: string; alt?: string } | null {
  const r = [...ctx.rooms].sort((a, b) => b.floorArea - a.floorArea)[1];
  if (!r) return null;
  const roomWalls = Object.values(ctx.project.elements).filter(
    (e): e is Wall => e.type === "wall" && e.levelId === ctx.level,
  );
  // walls along the room's edge, nearest first
  const near = (w: Wall) => {
    const L = wallLength(w) || 1;
    const t =
      ((r.labelAt.x - w.start.x) * (w.end.x - w.start.x) + (r.labelAt.y - w.start.y) * (w.end.y - w.start.y)) / L;
    return {
      w,
      t,
      d: Math.hypot(
        w.start.x + ((w.end.x - w.start.x) * t) / L - r.labelAt.x,
        w.start.y + ((w.end.y - w.start.y) * t) / L - r.labelAt.y,
      ),
    };
  };
  const ws = roomWalls
    .map(near)
    .filter((x) => x.t > 0 && x.t < wallLength(x.w))
    .sort((a, b) => a.d - b.d);
  // circuits (ADR-061): the light on 1, the outlets on 2 — and the second outlet also on 1 (a "mixed" note)
  const items: Element[] = [
    withElectricalData(newLight("demo-light", ctx.level, { x: r.labelAt.x, y: r.labelAt.y - 600 }), { circuit: 1 }),
  ];
  ws.slice(0, 2).forEach((x, i) => {
    const o = newWallItem(`demo-outlet-${i}`, "outlet", x.w, x.t, sideOf(x.w, r.labelAt));
    items.push(withElectricalData(o, { ...electricalData(o), circuit: i ? 1 : 2 }));
  });
  const s = ws[2];
  if (s)
    items.push(
      setSwitchLight(newWallItem("demo-switch", "switch", s.w, s.t + 800, sideOf(s.w, r.labelAt)), "demo-light", true),
    );
  ctx.run(putCommand({ key: "cmd.add.light" }, items));
  return { item: "demo-switch", room: r.key, alt: "demo-outlet-1" };
}

export const electricalUi: ModuleUi = {
  demo,
  moduleId: ELECTRICAL,
  name: "module.electrical.name",
  description: "module.electrical.desc",
  icon: Zap,
  defaultOn: false,
  messages: MESSAGES,
  tools: [tool("outlet", Plug), tool("switch", ToggleRight), tool("light", Lightbulb)],
  marks,
  links,
  solids3d: (ctx) => electricalSolids(ctx.project),
  elementTypes: [OUTLET, SWITCH, LIGHT],
  elementPanel: ElementPanel,
  roomPanel: RoomPanel,
};
