// Structural's running part (ADR-059 step 3): the checks and everything drawn from them — the checks
// panel, the plan's "!" badges, protected-wall locks / ghosts, joist arrows, drawn-slab badges, 3D
// colours and the export's numbered notes. Moved from the app.
// SAFETY_AND_LIABILITY: the panel shows what was checked AND what wasn't, never a green / "OK" state.
// Quiet while creating (ADR-025): checks re-run only after an edit settles, with a short delay.
import {
  detectRooms,
  dist,
  matchRoomTags,
  planGeometry,
  roomTags,
  wallLength,
  type Project,
  type V,
  type Wall,
} from "@prumo/core";
import type { ExportNotes, ModuleSession, PlanLayers, Severity, UiContext } from "@prumo/ui-api";
import { defineComponent, h, ref, shallowRef, watch, type VNodeChild } from "vue";
import {
  aboveOf,
  diffFindings,
  isChase,
  isProtection,
  joistDirection,
  NOT_CHECKED,
  protectCommand,
  protectionData,
  protectionsOn,
  runChecks,
  slabInfo,
  UNSOURCED,
  unprotectCommand,
  type CheckResult,
  type Finding,
  type FindingsDiff,
} from "../index";
import { cards, findingText, SEV } from "./text";

const SETTLE_MS = 1500;
/** Drawing precision (same as R-PROT-001), not a structural value. */
const SAME_MM = 1;

const fmt = (ctx: UiContext) => ({ t: ctx.t, length: ctx.formatLength });

/** Where each finding's "!" goes: on the element it's about (first id); one per element. */
export function badgePoints(p: Project, findings: readonly Finding[]) {
  const seen = new Set<string>();
  return findings.flatMap((f) => {
    const id = f.elementIds[0] ?? "";
    if (seen.has(id)) return [];
    seen.add(id);
    const e = p.elements[id];
    const along = (w: Wall | undefined, a: number) => {
      if (w?.type !== "wall") return null;
      const L = wallLength(w) || 1;
      return { x: w.start.x + ((w.end.x - w.start.x) * a) / L, y: w.start.y + ((w.end.y - w.start.y) * a) / L };
    };
    const host = (hid: string) => p.elements[hid] as Wall | undefined;
    let at: V | null = null;
    if (e?.type === "wall") at = along(e, wallLength(e) / 2);
    else if (e?.type === "opening") at = along(host(e.host.elementId), e.host.offset + e.width / 2);
    else if (isChase(e)) at = along(host(e.host.elementId), e.host.offset + (e.host.length ?? 0) / 2);
    else if (isProtection(e)) {
      const d = protectionData(e);
      at = d ? { x: (d.wall.start.x + d.wall.end.x) / 2, y: (d.wall.start.y + d.wall.end.y) / 2 } : null;
    }
    return at ? [{ at, severity: f.severity as Severity, id }] : [];
  });
}

/** Distance across a shape through `at` along ±u (to the nearest edge each way, doubled). */
export function reach(poly: readonly V[], at: V, u: V): number {
  let best = Infinity;
  for (const [i, a] of poly.entries()) {
    const b = poly[(i + 1) % poly.length] ?? a;
    const e = { x: b.x - a.x, y: b.y - a.y };
    const den = u.x * e.y - u.y * e.x;
    if (Math.abs(den) < 1e-9) continue;
    const w = { x: a.x - at.x, y: a.y - at.y };
    const t = (w.x * e.y - w.y * e.x) / den;
    const s = (w.x * u.y - w.y * u.x) / den;
    if (s >= 0 && s <= 1) best = Math.min(best, Math.abs(t));
  }
  return Number.isFinite(best) ? 2 * best : 0;
}
/** A joist arrow through `at`: 60% of the space that way, at most 2.4 m. */
const arrow = (key: string, poly: readonly V[], at: V, u: V) => {
  const half = 0.3 * Math.min(reach(poly, at, u), 4000);
  return { key, a: { x: at.x - u.x * half, y: at.y - u.y * half }, b: { x: at.x + u.x * half, y: at.y + u.y * half } };
};

/** Everything drawn on the plan from Structural (structure on). */
function planLayers(ctx: UiContext, result: CheckResult | null): PlanLayers {
  const p = ctx.project;
  const t = ctx.t;
  const g = planGeometry(p, ctx.level);
  const locks: { id: string; at: V; broken: boolean }[] = [];
  const ghosts: { id: string; a: V; b: V }[] = [];
  for (const pr of protectionsOn(p, ctx.level)) {
    const d = protectionData(pr);
    if (!d) continue;
    const w = p.elements[d.wallId];
    const same =
      w?.type === "wall" &&
      (w.kind === "full" || w.kind === "half") &&
      dist(w.start, d.wall.start) <= SAME_MM &&
      dist(w.end, d.wall.end) <= SAME_MM;
    locks.push({
      id: pr.id,
      at: { x: (d.wall.start.x + d.wall.end.x) / 2, y: (d.wall.start.y + d.wall.end.y) / 2 },
      broken: !same,
    });
    if (!same) ghosts.push({ id: pr.id, a: d.wall.start, b: d.wall.end });
  }
  const areas = g.slabs.map((s) => {
    const e = p.elements[s.id];
    const kind = e?.type === "slab" ? slabInfo(e).kind : null;
    return {
      id: s.id,
      outline: s.outline,
      at: s.at,
      label: kind ? t(`slabKind.${kind}.short`) : t("slab.badge"),
      selected: ctx.selection.includes(s.id),
    };
  });
  const arrows: { key: string; a: V; b: V }[] = [];
  if (result) {
    const rooms = detectRooms(p, ctx.level);
    const tags = matchRoomTags(rooms, roomTags(p, ctx.level));
    for (const r of rooms) {
      if (ctx.hiddenRooms.has(r.key)) continue;
      const tag = tags.get(r.key);
      const a = tag ? aboveOf(tag) : null;
      const u = a?.above === "joist-slab" ? joistDirection(r.floor, a.joists) : null;
      if (u) arrows.push(arrow(r.key, r.floor, r.labelAt, u));
    }
    for (const s of g.slabs) {
      const e = p.elements[s.id];
      const info = e?.type === "slab" ? slabInfo(e) : null;
      const u = info?.kind === "joist" ? joistDirection(s.outline, info.joists) : null;
      if (u) arrows.push(arrow("s" + s.id, s.outline, s.at, u));
    }
  }
  return { badges: badgePoints(p, result?.findings ?? []), locks, ghosts, arrows, areas };
}

/** Findings in 3D: worst severity per element; chases / protections light up their wall. */
function marks3d(p: Project, result: CheckResult | null): Record<string, Severity> {
  const out: Record<string, Severity> = {};
  for (const f of result?.findings ?? [])
    for (const id of f.elementIds.slice(0, 1)) {
      const e = p.elements[id];
      const target = isChase(e) ? e.host.elementId : isProtection(e) ? (protectionData(e)?.wallId ?? id) : id;
      const cur = out[target];
      if (!cur || SEV[f.severity] < SEV[cur]) out[target] = f.severity;
    }
  return out;
}

export function startStructural(ctx: () => UiContext): ModuleSession {
  const result = shallowRef<CheckResult | null>(null);
  const diff = shallowRef<FindingsDiff | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;
  const run = (keepDiff: boolean) => {
    const c = ctx();
    const next = runChecks(c.history.current, c.level, { baseline: c.baseline.project() });
    diff.value = keepDiff && result.value ? diffFindings(result.value.findings, next.findings) : null;
    result.value = next;
  };
  const schedule = (keepDiff: boolean) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function fire() {
      if (ctx().history.inGesture) timer = setTimeout(fire, SETTLE_MS);
      else run(keepDiff);
    }, SETTLE_MS);
  };
  const off = ctx().history.subscribe((e) => {
    if (e.type === "commit") schedule(e.label.key !== "cmd.open");
  });
  const stopLevel = watch(
    () => ctx().level,
    () => run(false),
  );
  run(false);

  const Panel = defineComponent({
    setup() {
      const open = ref(true);
      return () => {
        const r = result.value;
        if (!r) return null;
        const c = ctx();
        const t = c.t;
        const p = c.project;
        const d = diff.value;
        const count = r.findings.length;
        const when = (iso: string) =>
          new Date(iso).toLocaleString(c.locale, { dateStyle: "medium", timeStyle: "short" });
        const base = c.baseline.date();
        const head = h("header", [
          h("button", { class: "toggle", "aria-expanded": open.value, onClick: () => (open.value = !open.value) }, [
            `${open.value ? "▾" : "▸"} ${t("checks.title")}`,
            h("span", { class: ["count", { some: count > 0 }] }, t("checks.count", { count })),
          ]),
          d && (d.added.length || d.resolved.length)
            ? h("span", { class: "diff" }, [
                d.added.length ? h("span", t("checks.diff.added", { count: d.added.length })) : null,
                d.resolved.length ? h("span", t("checks.diff.resolved", { count: d.resolved.length })) : null,
              ])
            : null,
        ]);
        if (!open.value) return h("div", { class: "closed" }, [head]);
        const body: VNodeChild[] = [
          h("p", { class: "system" }, [
            t("checks.system", { system: t(`system.${r.system}`) }),
            " ",
            h("button", { class: "link", onClick: () => c.openSettings() }, t("checks.system.change")),
          ]),
        ];
        if (!r.checksRun.length && !r.needBaseline.length)
          body.push(h("p", { class: "empty" }, t("checks.noneForSystem")));
        if (r.needBaseline.length)
          body.push(
            h("div", { class: "baseline" }, [
              h("p", t("checks.baseline.need", { count: r.needBaseline.length })),
              h("button", { onClick: () => c.baseline.mark() }, t("checks.baseline.mark")),
            ]),
          );
        else if (base)
          body.push(
            h("div", { class: "baseline" }, [
              h("p", t("checks.baseline.on", { date: when(base) })),
              h("button", { onClick: () => c.baseline.mark() }, t("checks.baseline.again")),
              h("button", { onClick: () => c.baseline.clear() }, t("checks.baseline.clear")),
            ]),
          );
        for (const card of cards(r.checksRun, r.findings, p, fmt(c)))
          body.push(
            h("article", { key: card.rule.id, class: ["card", card.severity] }, [
              h("h4", [
                h("span", { class: "sev" }, t(`severity.${card.severity}`)),
                ` ${t(card.rule.nameKey)} `,
                h("span", { class: "rid" }, card.rule.id),
              ]),
              h(
                "ul",
                card.findings.map((f) =>
                  h("li", { key: f.fingerprint }, [
                    h("button", { class: "link", onClick: () => c.select(f.elementIds) }, findingText(f, p, fmt(c))),
                    f.ruleId === "R-PROT-001"
                      ? h("span", { class: "actions" }, [
                          f.elementIds.length > 1
                            ? h(
                                "button",
                                { onClick: () => protectAgain(c, f.elementIds.at(-1) ?? "") },
                                t("protect.again"),
                              )
                            : null,
                          h(
                            "button",
                            { onClick: () => c.run(unprotectCommand(f.elementIds.at(-1) ?? "")) },
                            t("protect.remove"),
                          ),
                        ])
                      : null,
                  ]),
                ),
              ),
              ...card.assumptions.map((a) => h("p", { class: "assume" }, `${t("checks.assumption")}: ${a}`)),
              h("details", [
                h("summary", t("checks.details")),
                h("p", t(`review.${card.rule.review.level}`)),
                h(
                  "p",
                  `${t("checks.source")}: ${card.rule.source === UNSOURCED ? t("checks.source.none") : card.rule.source}`,
                ),
                h("p", `${t("checks.confidence")}: ${t(`confidence.${card.rule.confidence}`)}`),
                h("p", `${t("checks.notConsidered")}:`),
                h(
                  "ul",
                  card.rule.notConsidered.map((k) => h("li", t(k))),
                ),
              ]),
            ]),
          );
        body.push(
          h("details", { class: "scope" }, [
            h("summary", t("checks.scope", { count: r.checksRun.length })),
            h("p", { class: "h" }, t("checks.checked")),
            h(
              "ul",
              r.checksRun.map((x) => h("li", `${t(x.nameKey)} — ${t(`review.${x.review.level}`)}`)),
            ),
            h("p", { class: "h" }, t("checks.notChecked")),
            h("ul", [
              ...r.needBaseline.map((x) => h("li", `${t(x.nameKey)} — ${t("checks.needsBaseline")}`)),
              ...NOT_CHECKED.map((k) => h("li", t(k))),
            ]),
          ]),
          h("p", { class: "disclaimer" }, t("checks.disclaimer")),
        );
        return h("div", { class: "open" }, [head, h("div", { class: "body" }, body)]);
      };
    },
  });

  return {
    stop() {
      off();
      stopLevel();
      if (timer) clearTimeout(timer);
      result.value = null;
    },
    refresh: () => run(false),
    overlay: Panel,
    plan: (c) => planLayers(c, result.value),
    marks3d: (c) => marks3d(c.project, result.value),
    exportNotes(c, levelId): ExportNotes {
      const r = runChecks(c.history.current, levelId, { baseline: c.baseline.project() });
      const at = new Map(badgePoints(c.project, r.findings).map((b) => [b.id, b.at]));
      return {
        items: r.findings.map((f) => {
          const id = f.elementIds[0] ?? "";
          return {
            elementId: id,
            at: at.get(id) ?? null,
            severity: f.severity,
            text: findingText(f, c.project, fmt(c)),
          };
        }),
        checksRun: r.checksRun.length,
        disclaimer: c.t("checks.disclaimer"),
      };
    },
  };
}

/** R-PROT-001: renew the marker where the wall is now (author = you). */
function protectAgain(c: UiContext, protectionId: string) {
  const pr = c.project.elements[protectionId];
  const d = isProtection(pr) ? protectionData(pr) : null;
  const w = d ? c.project.elements[d.wallId] : undefined;
  if (w?.type === "wall") c.run(protectCommand(w, c.userName, c.now(), c.ids()));
}
