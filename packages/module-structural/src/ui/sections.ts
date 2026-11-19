/* eslint-disable vue/one-component-per-file -- small render-function sections of one module */
// Structural's panel sections (ADR-059 step 2), moved out of the app's properties panel:
//   room    → what's above (ADR-045 A) + joist direction
//   wall    → material + weight, estimated load (ADR-051), role + origin, tie beam, bonded ends, protection
//   opening → lintel + its size and estimate (ADR-052), contraverga
//   slab    → type, joists, thickness (ADR-050)
//   chase   → the chase's own panel (its element type)
// Every change is one command through `ctx.run` (one undo step). Strings are still read from the app's
// catalogue through `ctx.t` (moved in one sweep once all of Structural's screens are here).
import {
  detectRooms,
  editRoomCommand,
  inside,
  matchRoomTags,
  planGeometry,
  roomTags,
  updateCommand,
  wallLength,
  type Element,
  type Opening,
  type Slab,
  type Wall,
} from "@prumo/core";
import type { UiContext } from "@prumo/ui-api";
import { defineComponent, h, ref, type PropType, type VNode, type VNodeChild } from "vue";
import {
  ABOVE,
  aboveOf,
  BAR_COUNTS,
  BAR_DIAMETERS,
  chaseDir,
  constructionSystem,
  isChase,
  lintelSize,
  ROLE_ORIGINS,
  setAbove,
  setBonded,
  setContraverga,
  setLintel,
  setLintelSize,
  setSlabInfo,
  setTieBeam,
  setWallMaterial,
  setWallRole,
  SLAB_KINDS,
  slabInfo,
  structuralData,
  WALL_MATERIALS,
  wallMaterial,
  type Above,
  type JoistDir,
  type LintelSize,
  type RoleOrigin,
  type SlabKind,
  type WallEnd,
  type WallMaterial,
  type WallRole,
  lintelCheck,
  wallLoads,
  STRUCTURAL,
  unitWeight,
  structuralPacks,
  canCarry,
  junctionsOf,
  protectCommand,
  protectionData,
  protectionOf,
  unprotectCommand,
} from "../index";
import { lintelText, unitWeightText, wallLoadText } from "./text";

const packs = structuralPacks();

// --- small builders (the panel's own look comes from the app's `.module-section` kit) ----------------
const pick = (ev: Event) => (ev.target as HTMLSelectElement | HTMLInputElement).value;
const checked = (ev: Event) => (ev.target as HTMLInputElement).checked;
function select(value: string, options: readonly (readonly [string, string])[], onChange: (v: string) => void) {
  return h(
    "select",
    { value, onChange: (ev: Event) => onChange(pick(ev)) },
    options.map(([v, label]) => h("option", { value: v }, label)),
  );
}
const stack = (text: string, child: VNode, title?: string) => h("label", { class: "stack", title }, [text, child]);
const check = (text: string, on: boolean, onChange: (on: boolean) => void, title?: string) =>
  h("label", { class: "check", title }, [
    h("input", { type: "checkbox", checked: on, onChange: (ev: Event) => onChange(checked(ev)) }),
    " ",
    text,
  ]);
/** A cm field; empty text = "don't know" when `empty` is given; bad text reverts (rev). */
function cmField(
  ctx: UiContext,
  key: string,
  mm: number | undefined,
  rev: { value: number },
  set: (mm: number | undefined) => void,
  o: { max?: number; empty?: boolean; placeholder?: string } = {},
) {
  return h("span", { class: "field" }, [
    h("input", {
      key: `${key}/${mm ?? ""}/${rev.value}`,
      value: mm ? ctx.formatCm(mm) : "",
      placeholder: o.placeholder,
      onChange: (ev: Event) => {
        const text = pick(ev).trim();
        if (!text && o.empty) return set(undefined);
        const cm = ctx.parseNumber(text);
        if (cm === null || cm <= 0 || cm > (o.max ?? 200)) return void rev.value++;
        set(Math.round(cm * 10));
      },
    }),
    "cm",
  ]);
}
const edit = (ctx: UiContext, label: string, id: string, f: (e: Element) => Element) =>
  ctx.run(updateCommand({ key: label }, [id], f));
const wallLabel = (ctx: UiContext, w: Element | undefined) =>
  w?.type === "wall" ? ctx.t("el.wall", { length: ctx.formatLength(wallLength(w)) }) : "";
/** Which end, as seen on the plan (model Y up): "top" / "bottom" for walls running up–down, else left/right. */
function endSide(w: Wall, end: WallEnd): "top" | "bottom" | "left" | "right" {
  const p = end === "start" ? w.start : w.end;
  const q = end === "start" ? w.end : w.start;
  const dx = p.x - q.x;
  const dy = p.y - q.y;
  return Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? "top" : "bottom") : dx > 0 ? "right" : "left";
}
/** Load lines name rooms, slabs and floors. */
function nameOf(ctx: UiContext) {
  return (ref: string) => {
    if (ref.startsWith("slab:")) return ctx.t("slab.badge");
    if (ref.startsWith("level:")) return ctx.levelName(ref.slice(6));
    const r = ctx.rooms.find((x) => x.key === ref.slice(5));
    return r ? r.label || ctx.formatArea(r.floorArea) : ctx.t("finish.outside");
  };
}
/** The dashed "estimate" box: headline lines, then the calculation behind "show". */
function estimateBox(
  ctx: UiContext,
  top: VNodeChild[],
  lines: readonly string[],
  notLabel: string,
  not: readonly string[],
  disclaimer: string,
) {
  return h("div", { class: "load" }, [
    ...top,
    h("details", [
      h("summary", ctx.t("load.show")),
      h(
        "ul",
        lines.map((l) => h("li", l)),
      ),
      not.length ? h("p", { class: "ro" }, notLabel) : null,
      not.length
        ? h(
            "ul",
            { class: "ro" },
            not.map((n) => h("li", n)),
          )
        : null,
      h("p", { class: "ro" }, disclaimer),
    ]),
  ]);
}
const unverified = (ctx: UiContext) => h("span", { class: "unverified" }, ctx.t("value.review.unverified"));

const elementProps = {
  ctx: { type: Object as PropType<UiContext>, required: true },
  element: { type: Object as PropType<Element>, required: true },
} as const;

// --- room: what's above ----------------------------------------------------------------------------
export const RoomSection = defineComponent({
  props: {
    ctx: { type: Object as PropType<UiContext>, required: true },
    roomKey: { type: String, required: true },
  },
  setup(props) {
    return () => {
      const { ctx, roomKey: key } = props;
      const p = ctx.project;
      const t = ctx.t;
      const rooms = detectRooms(p, ctx.level);
      const room = rooms.find((r) => r.key === key);
      if (!room) return null;
      const tag = matchRoomTags(rooms, roomTags(p, ctx.level)).get(key);
      const { above, joists } = tag ? aboveOf(tag) : { above: null, joists: null };
      const covered = planGeometry(p, ctx.level).slabs.some((g) => inside(room.labelAt, g.outline));
      const set = (a: Above | undefined, j: JoistDir | undefined) =>
        ctx.run(editRoomCommand(p, ctx.level, key, { key: "cmd.above" }, (tg) => setAbove(tg, a, j), ctx.ids));
      const out: VNodeChild[] = [h("h4", t("props.structure"))];
      if (covered) out.push(h("p", { class: "ro" }, t("above.coveredBySlab")));
      else {
        out.push(
          stack(
            t("props.above"),
            select(above ?? "", [["", t("above.unknown")], ...ABOVE.map((a) => [a, t(`above.${a}`)] as const)], (v) =>
              set((v || undefined) as Above | undefined, joists ?? undefined),
            ),
            t("above.tip"),
          ),
        );
        if (above === "joist-slab")
          out.push(
            stack(
              t("props.joists"),
              select(
                joists ?? "",
                [
                  ["", t("joists.unknown")],
                  ["long", t("joists.long")],
                  ["short", t("joists.short")],
                ],
                (v) => set("joist-slab", (v || undefined) as JoistDir | undefined),
              ),
              t("joists.tip"),
            ),
          );
      }
      return h("div", out);
    };
  },
});

// --- wall ------------------------------------------------------------------------------------------
export const WallSection = defineComponent({
  props: elementProps,
  setup(props) {
    return () => {
      const { ctx } = props;
      const w = props.element as Wall;
      if (w.type !== "wall" || !canCarry(w)) return null;
      const p = ctx.project;
      const t = ctx.t;
      const d = structuralData(w);
      const system = constructionSystem(p);
      const m = wallMaterial(w);
      const v = m ? unitWeight(packs, p, m) : null;
      const weight = v ? unitWeightText(v, ctx.locale, t, packs.name(STRUCTURAL, v.pack, ctx.locale)) : null;
      const L = wallLoads(p, w.levelId, packs).get(w.id);
      const load = L ? wallLoadText(L, ctx.locale, t, nameOf(ctx)) : null;
      const role = (r: WallRole | undefined, o: RoleOrigin | undefined) =>
        edit(ctx, "cmd.setRole", w.id, (e) =>
          e.type === "wall" ? setWallRole(e, r, r ? (o ?? "own-judgement") : undefined) : e,
        );
      const out: VNodeChild[] = [
        h("h4", t("props.structure")),
        stack(
          t("props.material"),
          select(
            m ?? "",
            [["", t("material.unknown")], ...WALL_MATERIALS.map((x) => [x, t(`material.${x}`)] as const)],
            (x) =>
              edit(ctx, "cmd.material", w.id, (e) =>
                e.type === "wall" ? setWallMaterial(e, (x || undefined) as WallMaterial | undefined) : e,
              ),
          ),
        ),
      ];
      if (weight)
        out.push(
          h("p", { class: "ro", title: weight.from }, [
            weight.text,
            " · ",
            h("span", { class: "unverified" }, weight.review),
          ]),
        );
      else if (m) out.push(h("p", { class: "ro" }, t("material.noValue")));
      if (m === "drywall") out.push(h("p", { class: "ro" }, t("material.drywall.note")));
      if (load)
        out.push(
          estimateBox(
            ctx,
            [
              h("p", [
                h("strong", load.headline),
                h("br"),
                h("span", { class: "ro" }, `${load.range} · `),
                unverified(ctx),
              ]),
            ],
            load.lines,
            t("load.notCounted"),
            load.notCounted,
            t("load.disclaimer"),
          ),
        );
      out.push(
        stack(
          t("props.role"),
          select(
            d.role ?? "",
            [
              ["", t(`role.default.${system}`)],
              ["bearing", t("role.bearing")],
              ["non-bearing", t("role.non-bearing")],
            ],
            (x) => role((x || undefined) as WallRole | undefined, d.origin),
          ),
          t("role.tip"),
        ),
      );
      if (d.role)
        out.push(
          stack(
            t("props.roleOrigin"),
            select(
              d.origin ?? "own-judgement",
              ROLE_ORIGINS.map((o) => [o, t(`origin.${o}`)] as const),
              (x) => role(d.role, x as RoleOrigin),
            ),
          ),
        );
      if (w.kind === "full")
        out.push(
          check(
            t("props.tieBeam"),
            !!d.tieBeam,
            (on) => edit(ctx, "cmd.setTieBeam", w.id, (e) => (e.type === "wall" ? setTieBeam(e, on) : e)),
            t("tieBeam.tip"),
          ),
        );
      for (const j of junctionsOf(p, w))
        out.push(
          check(
            t(`props.bonded.${endSide(w, j.end)}`, { other: wallLabel(ctx, j.others[0]) }),
            !!d.bonded?.[j.end],
            (on) => edit(ctx, "cmd.setBonded", w.id, (e) => (e.type === "wall" ? setBonded(e, j.end, on) : e)),
            t("bonded.tip"),
          ),
        );
      const pr = protectionOf(p, w.id);
      const pd = pr ? protectionData(pr) : null;
      if (pr && pd)
        out.push(
          h("div", { class: "protected" }, [
            h("p", `🔒 ${t("protect.on")}`),
            h(
              "p",
              { class: "ro" },
              t("protect.by", {
                name: pd.author || t("someone"),
                date: new Date(pd.createdAt).toLocaleString(ctx.locale, { dateStyle: "medium", timeStyle: "short" }),
              }),
            ),
            h("button", { onClick: () => ctx.run(unprotectCommand(pr.id)) }, t("protect.remove")),
          ]),
        );
      else
        out.push(
          h(
            "button",
            {
              class: "protect",
              title: t("protect.tip"),
              onClick: () => ctx.run(protectCommand(w, ctx.userName, ctx.now(), ctx.ids())),
            },
            `🔒 ${t("protect.add")}`,
          ),
        );
      return h("div", out);
    };
  },
});

// --- opening: lintel ---------------------------------------------------------------------------------
const BAR_OPTIONS = BAR_COUNTS.flatMap((n) => BAR_DIAMETERS.map((d) => ({ n, d, v: `${n}x${d}` })));

export const OpeningSection = defineComponent({
  props: elementProps,
  setup(props) {
    const rev = ref(0);
    return () => {
      const { ctx } = props;
      const o = props.element as Opening;
      if (o.type !== "opening") return null;
      const p = ctx.project;
      const t = ctx.t;
      const d = structuralData(o);
      const size = lintelSize(o);
      const setSize = (s: LintelSize) =>
        edit(ctx, "cmd.setLintel", o.id, (e) => (e.type === "opening" ? setLintelSize(e, s) : e));
      const num = (x: number) => new Intl.NumberFormat(ctx.locale).format(x);
      const out: VNodeChild[] = [
        h("h4", t("props.structure")),
        check(
          t("props.lintel"),
          !!d.lintel,
          (on) => edit(ctx, "cmd.setLintel", o.id, (e) => (e.type === "opening" ? setLintel(e, on) : e)),
          t("lintel.tip"),
        ),
      ];
      if (d.lintel) {
        const bars = size.bars ? `${size.bars.count}x${size.bars.diameter}` : "";
        out.push(
          h("p", { class: "ro" }, t("lintel.size")),
          h("label", { title: t("lintel.height.tip") }, [
            t("lintel.height"),
            cmField(ctx, `${o.id}/lh`, size.height, rev, (mm) => setSize({ ...size, height: mm }), {
              empty: true,
              placeholder: t("above.unknown"),
            }),
          ]),
          stack(
            t("lintel.bars"),
            select(
              bars,
              [
                ["", t("lintel.bars.unknown")],
                ...BAR_OPTIONS.map((b) => [b.v, t("lintel.bar", { n: b.n, d: num(b.d) })] as const),
              ],
              (v) => {
                const [n, dd] = v.split("x").map(Number);
                setSize({ ...size, bars: v && n && dd ? { count: n, diameter: dd } : undefined });
              },
            ),
            t("lintel.bars.tip"),
          ),
        );
      }
      const c = lintelCheck(p, o, wallLoads(p, o.levelId, packs).get(o.host.elementId), packs);
      const L = c ? lintelText(c, ctx.locale, t, nameOf(ctx)) : null;
      if (L)
        out.push(
          estimateBox(
            ctx,
            [
              h("p", { class: "ro" }, t("lintel.load.title")),
              h("p", [
                h("strong", L.headline),
                h("br"),
                h("span", { class: "ro" }, L.bending),
                ...(L.strength ? [h("br"), h("span", { class: "ro" }, L.strength)] : []),
                " · ",
                unverified(ctx),
              ]),
              h("p", L.verdict),
            ],
            L.lines,
            t("lintel.notChecked"),
            L.notChecked,
            t("lintel.disclaimer"),
          ),
        );
      if (o.kind === "window")
        out.push(
          check(
            t("props.contraverga"),
            !!d.contraverga,
            (on) => edit(ctx, "cmd.setContraverga", o.id, (e) => (e.type === "opening" ? setContraverga(e, on) : e)),
            t("contraverga.tip"),
          ),
        );
      return h("div", out);
    };
  },
});

// --- slab: type, joists, thickness ---------------------------------------------------------------------
export const SlabSection = defineComponent({
  props: elementProps,
  setup(props) {
    const rev = ref(0);
    return () => {
      const { ctx } = props;
      const s = props.element as Slab;
      if (s.type !== "slab") return null;
      const t = ctx.t;
      const cur = slabInfo(s);
      /** Change one field; the others keep their value (one undo step). */
      const set = (change: {
        kind?: SlabKind | undefined;
        joists?: JoistDir | undefined;
        thickness?: number | undefined;
      }) => {
        const m = {
          kind: cur.kind ?? undefined,
          joists: cur.joists ?? undefined,
          thickness: cur.thickness ?? undefined,
          ...change,
        };
        const info: { kind?: SlabKind; joists?: JoistDir; thickness?: number } = {};
        if (m.kind) info.kind = m.kind;
        if (m.joists) info.joists = m.joists;
        if (m.thickness) info.thickness = m.thickness;
        edit(ctx, "cmd.editSlab", s.id, (e) => (e.type === "slab" ? setSlabInfo(e, info) : e));
      };
      const out: VNodeChild[] = [
        stack(
          t("props.openingStyle"),
          select(
            cur.kind ?? "",
            [["", t("above.unknown")], ...SLAB_KINDS.map((k) => [k, t(`slabKind.${k}`)] as const)],
            (v) => set({ kind: (v || undefined) as SlabKind | undefined }),
          ),
        ),
      ];
      if (cur.kind === "joist")
        out.push(
          stack(
            t("props.joists"),
            select(
              cur.joists ?? "",
              [
                ["", t("joists.unknown")],
                ["long", t("joists.long")],
                ["short", t("joists.short")],
              ],
              (v) => set({ joists: (v || undefined) as JoistDir | undefined }),
            ),
            t("joists.tip"),
          ),
        );
      out.push(
        h("label", { title: t("slab.thickness.tip") }, [
          t("props.thickness"),
          cmField(ctx, `${s.id}/th`, cur.thickness ?? undefined, rev, (mm) => set({ thickness: mm }), {
            empty: true,
            placeholder: t("above.unknown"),
          }),
        ]),
        h("p", { class: "ro" }, t("slab.note")),
      );
      return h("div", out);
    };
  },
});

// --- chase: its own panel ------------------------------------------------------------------------------
export const ChasePanel = defineComponent({
  props: elementProps,
  setup(props) {
    const rev = ref(0);
    return () => {
      const { ctx, element: e } = props;
      if (!isChase(e)) return null;
      const t = ctx.t;
      const dir = chaseDir(e);
      const out: VNodeChild[] = [
        h("h3", t(`chase.${dir}`)),
        h("p", { class: "ro" }, t("chase.on", { wall: wallLabel(ctx, ctx.project.elements[e.host.elementId]) })),
      ];
      if (dir === "horizontal")
        out.push(
          h("label", [
            t("props.length"),
            cmField(
              ctx,
              `${e.id}/len`,
              e.host.length ?? 0,
              rev,
              (mm) =>
                edit(ctx, "cmd.edit", e.id, (x) => (isChase(x) && mm ? { ...x, host: { ...x.host, length: mm } } : x)),
              { max: 100000 },
            ),
          ]),
        );
      out.push(h("p", { class: "ro" }, t("chase.note")));
      return h("div", out);
    };
  },
});
