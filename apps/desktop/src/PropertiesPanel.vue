<script setup lang="ts">
// Properties of the selection (ROADMAP Phase 1 "Properties panel"). Every change is ONE command
// (one undo step), applied when the field is committed (Enter / leaving it), never per keystroke.
import {
  DOOR_STYLES,
  WINDOW_STYLES,
  openingStyle,
  setWallLengthCommand,
  updateCommand,
  wallLength,
  type Command,
  type Element,
  type Note,
  type Opening,
  type Project,
  type PackSet,
  type Slab,
  type Wall,
} from "@prumo/core";
import { FINISHES, ROOM_PREFIX, ROOM_TYPES, architectData, roomTypeKey } from "@prumo/module-architect";
import {
  ABOVE,
  BAR_COUNTS,
  BAR_DIAMETERS,
  lintelSize,
  type LintelSize,
  SLAB_KINDS,
  slabInfo,
  type SlabKind,
  STRUCTURAL,
  WALL_MATERIALS,
  unitWeight,
  wallMaterial,
  type WallMaterial,
  ROLE_ORIGINS,
  canCarry,
  chaseDir,
  isChase,
  junctionsOf,
  protectionData,
  protectionOf,
  structuralData,
  type Above,
  type JoistDir,
  type WallEnd,
  type ConstructionSystem,
  type RoleOrigin,
  type WallRole,
} from "@prumo/module-structural";
import { computed, ref } from "vue";
import { formatArea, formatCm, formatLength, parseNumber, translate, type Locale, type Params } from "./i18n";
import { paramText, unitWeightText } from "./structural-ui";

const props = defineProps<{
  project: Project;
  selection: readonly string[];
  locale: Locale;
  /** Detected rooms with their current name (for a selected room). */
  rooms: readonly {
    key: string;
    name: string;
    area: number;
    floor: string;
    roomType: string;
    above: Above | null;
    joists: JoistDir | null;
    /** A drawn slab covers it (ADR-050): the slab's own answers count. */
    coveredBySlab?: boolean;
  }[];
  /** What each side of the selected wall faces ("Sala", "outside"). */
  wallSides?: { left: string; right: string } | null;
  /** The selected wall's estimated load (ADR-051), already formatted; null = none / structure off. */
  load?: { headline: string; range: string; lines: string[]; notCounted: string[] } | null;
  /** The selected opening's lintel estimate (ADR-052), formatted; null = none / structure off. */
  lintelLoad?: {
    headline: string;
    bending: string;
    strength: string | null;
    verdict: string;
    lines: string[];
    notChecked: string[];
  } | null;
  /** Installed data packs (ADR-049): material values shown with their source. */
  packs?: PackSet | null;
  /** The project's construction system when the Structural module is on; null = module off. */
  structural?: ConstructionSystem | null;
}>();
const emit = defineEmits<{
  apply: [cmd: Command];
  delete: [];
  duplicate: [];
  rotate: [deg: number];
  mirror: [axis: "vertical" | "horizontal"];
  name: [roomKey: string, name: string];
  paintSide: [wallId: string, side: "left" | "right", finishId: string];
  paintFloor: [roomKey: string, finishId: string];
  roomType: [roomKey: string, typeId: string];
  above: [roomKey: string, above: Above | undefined, joists: JoistDir | undefined];
  role: [wallId: string, role: WallRole | undefined, origin: RoleOrigin | undefined];
  lintel: [openingId: string, has: boolean];
  lintelSize: [openingId: string, size: LintelSize];
  contraverga: [openingId: string, has: boolean];
  tieBeam: [wallId: string, has: boolean];
  protect: [wallId: string];
  unprotect: [protectionId: string];
  bonded: [wallId: string, end: WallEnd, bonded: boolean];
  material: [wallId: string, material: WallMaterial | undefined];
  slab: [slabId: string, info: { kind?: SlabKind; joists?: JoistDir; thickness?: number }];
}>();
const wallFinishes = FINISHES.filter((f) => f.use === "wall");
const floorFinishes = FINISHES.filter((f) => f.use === "floor");
const SIDES = ["left", "right"] as const;
const room = computed(() => {
  const id = props.selection.length === 1 ? (props.selection[0] ?? "") : "";
  return id.startsWith(ROOM_PREFIX) ? (props.rooms.find((r) => r.key === id.slice(ROOM_PREFIX.length)) ?? null) : null;
});
function weightOf(w: Wall) {
  const m = wallMaterial(w);
  const v = m && props.packs ? unitWeight(props.packs, props.project, m) : null;
  return v && props.packs ? unitWeightText(v, props.locale, props.packs.name(STRUCTURAL, v.pack, props.locale)) : null;
}
const keepOriginal = defineModel<boolean>("keepOriginal", { default: true });
const hasWalls = computed(() =>
  props.selection.some((id) => id.startsWith(ROOM_PREFIX) || props.project.elements[id]?.type === "wall"),
);
const t = (k: string, p?: Params) => translate(props.locale, k, p);

const one = computed<Element | null>(() =>
  props.selection.length === 1 ? (props.project.elements[props.selection[0] ?? ""] ?? null) : null,
);
const wall = computed(() => (one.value?.type === "wall" ? (one.value as Wall) : null));
const opening = computed(() => (one.value?.type === "opening" ? (one.value as Opening) : null));
const slab = computed(() => (one.value?.type === "slab" ? (one.value as Slab) : null));
const slabArea = computed(() => {
  const o = slab.value?.outline ?? [];
  return (
    Math.abs(
      o.reduce((a, p, i) => a + p.x * (o[(i + 1) % o.length]?.y ?? 0) - (o[(i + 1) % o.length]?.x ?? 0) * p.y, 0),
    ) / 2
  );
});
/** Change one field; the others keep their value (one undo step). */
function emitSlab(change: {
  kind?: SlabKind | undefined;
  joists?: JoistDir | undefined;
  thickness?: number | undefined;
}) {
  const s = slab.value;
  if (!s) return;
  const cur = slabInfo(s);
  const merged = {
    kind: cur.kind ?? undefined,
    joists: cur.joists ?? undefined,
    thickness: cur.thickness ?? undefined,
    ...change,
  };
  const out: { kind?: SlabKind; joists?: JoistDir; thickness?: number } = {};
  if (merged.kind) out.kind = merged.kind;
  if (merged.joists) out.joists = merged.joists;
  if (merged.thickness) out.thickness = merged.thickness;
  emit("slab", s.id, out);
}
function slabThickness(e: Event) {
  const text = (e.target as HTMLInputElement).value.trim();
  if (!text) return emitSlab({ thickness: undefined });
  const cm = parseNumber(text, props.locale);
  if (cm === null || cm <= 0 || cm > 200) {
    rev.value++;
    return;
  }
  emitSlab({ thickness: Math.round(cm * 10) });
}
function lintelHeight(o: Opening, e: Event) {
  const text = (e.target as HTMLInputElement).value.trim();
  const cur = lintelSize(o);
  if (!text) return emit("lintelSize", o.id, { ...cur, height: undefined });
  const cm = parseNumber(text, props.locale);
  if (cm === null || cm <= 0 || cm > 200) {
    rev.value++;
    return;
  }
  emit("lintelSize", o.id, { ...cur, height: Math.round(cm * 10) });
}
function lintelBars(o: Opening, e: Event) {
  const v = (e.target as HTMLSelectElement).value;
  const [n, d] = v.split("x").map(Number);
  emit("lintelSize", o.id, { ...lintelSize(o), bars: v && n && d ? { count: n, diameter: d } : undefined });
}
const barValue = (o: Opening) => {
  const b = lintelSize(o).bars;
  return b ? `${b.count}x${b.diameter}` : "";
};
const num = (x: number) => new Intl.NumberFormat(props.locale).format(x);
const BAR_OPTIONS = BAR_COUNTS.flatMap((n) => BAR_DIAMETERS.map((d) => ({ n, d, v: `${n}x${d}` })));
/** Has a side to flip (hinge / slide direction, which face): doors and side-dependent windows (ADR-046). */
const sided = (o: Opening) =>
  o.kind === "door" || (o.kind === "window" && ["sliding", "casement", "top-hung"].includes(openingStyle(o) ?? ""));
const chase = computed(() => {
  const e = one.value ?? undefined;
  return isChase(e) ? e : null;
});
const note = computed(() => (one.value?.type === "note" ? (one.value as Note) : null));
/** What the note is about, in words; a deleted target reads "something that was removed". */
const noteAbout = computed(() =>
  (note.value?.targets ?? []).map((id) =>
    props.project.elements[id]
      ? paramText({ kind: "element", id }, props.project, props.locale)
      : t("note.removedTarget"),
  ),
);
const noteDate = (iso: string) =>
  new Date(iso).toLocaleString(props.locale, { dateStyle: "medium", timeStyle: "short" });
function commitNoteText(n: Note, ev: Event) {
  const v = (ev.target as HTMLTextAreaElement).value.trim();
  if (!v || v === n.text) {
    rev.value++;
    return;
  }
  edit(n, (e) => ({ ...e, text: v }));
}
/** "Load-bearing, don't remove" marker on the selected wall (ADR-044 slice 2). */
const protection = computed(() => {
  const pr = wall.value ? protectionOf(props.project, wall.value.id) : null;
  const d = pr ? protectionData(pr) : null;
  return pr && d ? { id: pr.id, ...d } : null;
});
const chaseWall = computed(() => {
  const h = chase.value ? props.project.elements[chase.value.host.elementId] : undefined;
  return h?.type === "wall" ? h : undefined;
});
const bad = ref<string | null>(null);
const rev = ref(0); // bump to re-render fields (reverts refused text)

function edit<T extends Element>(el: T, change: (e: T) => T) {
  emit(
    "apply",
    updateCommand({ key: "cmd.edit" }, [el.id], (e) => change(e as T)),
  );
}

/** A length field in cm. Invalid text is refused (field reverts) — never guessed (ADR-021). */
function commitCm<T extends Element>(el: T, field: string, ev: Event, set: (e: T, mm: number) => T) {
  const v = parseNumber((ev.target as HTMLInputElement).value, props.locale);
  if (v === null) {
    bad.value = field;
    rev.value++;
    return;
  }
  bad.value = null;
  edit(el, (e) => set(e, v * 10));
}

/** Which end, as seen on the plan (model Y up): "top" / "bottom" for walls running up–down, else left/right. */
function endSide(w: Wall, end: "start" | "end"): "top" | "bottom" | "left" | "right" {
  const p = end === "start" ? w.start : w.end;
  const q = end === "start" ? w.end : w.start;
  const dx = p.x - q.x,
    dy = p.y - q.y;
  return Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? "top" : "bottom") : dx > 0 ? "right" : "left";
}

/** "the 3,00 m wall" for the bonded boxes (no start/end jargon). */
const wallLabel = (w: Wall | undefined) =>
  w ? t("el.wall", { length: formatLength(wallLength(w), props.locale) }) : "";

/** Length: the start stays, the end moves; walls joined there follow (core setWallLengthCommand). */
function commitLength(w: Wall, ev: Event) {
  const v = parseNumber((ev.target as HTMLInputElement).value, props.locale);
  if (v === null || !(v > 0)) {
    bad.value = "length";
    rev.value++;
    return;
  }
  bad.value = null;
  emit("apply", setWallLengthCommand(w.id, v * 10));
  rev.value++; // a refused edit (a door wouldn't fit) shows the old length again
}
</script>

<template>
  <aside v-if="selection.length" class="panel">
    <template v-if="room">
      <h3>{{ t("props.room") }}</h3>
      <p class="ro">{{ t("props.area") }}: {{ formatArea(room.area, locale) }}</p>
      <label class="stack">
        {{ t("props.name") }}
        <input
          :key="room.key + room.name"
          class="text"
          :value="room.name"
          :placeholder="roomTypeKey(room.roomType) ? t(roomTypeKey(room.roomType)!) : t('props.namePlaceholder')"
          @change="emit('name', room.key, ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label>
        {{ t("props.roomType") }}
        <select :value="room.roomType" @change="emit('roomType', room.key, ($event.target as HTMLSelectElement).value)">
          <option value="">{{ t("finish.none") }}</option>
          <option v-for="rt in ROOM_TYPES" :key="rt" :value="rt">{{ t(`roomType.${rt}`) }}</option>
        </select>
      </label>
      <label>
        {{ t("finish.floor") }}
        <select :value="room.floor" @change="emit('paintFloor', room.key, ($event.target as HTMLSelectElement).value)">
          <option value="">{{ t("finish.none") }}</option>
          <option v-for="f in floorFinishes" :key="f.id" :value="f.id">{{ t(`finish.${f.id}`) }}</option>
        </select>
      </label>
      <!-- What's above (ADR-045 A): one answer per room; "don't know" is a real answer -->
      <template v-if="structural">
        <h4>{{ t("props.structure") }}</h4>
        <p v-if="room.coveredBySlab" class="ro">{{ t("above.coveredBySlab") }}</p>
        <label v-else class="stack" :title="t('above.tip')">
          {{ t("props.above") }}
          <select
            :value="room.above ?? ''"
            @change="
              emit(
                'above',
                room.key,
                (($event.target as HTMLSelectElement).value || undefined) as Above | undefined,
                room.joists ?? undefined,
              )
            "
          >
            <option value="">{{ t("above.unknown") }}</option>
            <option v-for="a in ABOVE" :key="a" :value="a">{{ t(`above.${a}`) }}</option>
          </select>
        </label>
        <label v-if="!room.coveredBySlab && room.above === 'joist-slab'" class="stack" :title="t('joists.tip')">
          {{ t("props.joists") }}
          <select
            :value="room.joists ?? ''"
            @change="
              emit(
                'above',
                room.key,
                'joist-slab',
                (($event.target as HTMLSelectElement).value || undefined) as JoistDir | undefined,
              )
            "
          >
            <option value="">{{ t("joists.unknown") }}</option>
            <option value="long">{{ t("joists.long") }}</option>
            <option value="short">{{ t("joists.short") }}</option>
          </select>
        </label>
      </template>
    </template>

    <template v-else-if="slab">
      <h3>{{ t("props.slab") }}</h3>
      <p class="ro">{{ t("slab.area", { area: formatArea(slabArea, locale) }) }}</p>
      <label class="stack">
        {{ t("props.openingStyle") }}
        <select
          :value="slabInfo(slab).kind ?? ''"
          @change="
            emitSlab({ kind: (($event.target as HTMLSelectElement).value || undefined) as SlabKind | undefined })
          "
        >
          <option value="">{{ t("above.unknown") }}</option>
          <option v-for="k in SLAB_KINDS" :key="k" :value="k">{{ t(`slabKind.${k}`) }}</option>
        </select>
      </label>
      <label v-if="slabInfo(slab).kind === 'joist'" class="stack" :title="t('joists.tip')">
        {{ t("props.joists") }}
        <select
          :value="slabInfo(slab).joists ?? ''"
          @change="
            emitSlab({ joists: (($event.target as HTMLSelectElement).value || undefined) as JoistDir | undefined })
          "
        >
          <option value="">{{ t("joists.unknown") }}</option>
          <option value="long">{{ t("joists.long") }}</option>
          <option value="short">{{ t("joists.short") }}</option>
        </select>
      </label>
      <label :title="t('slab.thickness.tip')">
        {{ t("props.thickness") }}
        <span class="field">
          <input
            :key="slab.id + (slabInfo(slab).thickness ?? '') + '/' + rev"
            :value="slabInfo(slab).thickness ? formatCm(slabInfo(slab).thickness!, locale) : ''"
            :placeholder="t('above.unknown')"
            @change="slabThickness($event)"
          />cm
        </span>
      </label>
      <p class="ro">{{ t("slab.note") }}</p>
    </template>

    <template v-else-if="wall">
      <h3>{{ wall.kind === "separator" ? t("props.divider") : t("props.wall") }}</h3>
      <p v-if="wall.kind === 'separator'" class="ro">{{ t("props.divider.note") }}</p>
      <label :class="{ bad: bad === 'length' }" :title="t('props.length.tip')">
        {{ t("props.length") }}
        <span class="field">
          <input
            :key="wall.id + wallLength(wall) + '/' + rev"
            :value="formatCm(wallLength(wall), locale)"
            @change="commitLength(wall, $event)"
          />cm
        </span>
      </label>
      <!-- a room divider has no body (ADR-040): no thickness/height/alignment/paint -->
      <template v-if="wall.kind !== 'separator'">
        <label :class="{ bad: bad === 'thickness' }">
          {{ t("props.thickness") }}
          <span class="field">
            <input
              :key="wall.id + wall.thickness + '/' + rev"
              :value="formatCm(wall.thickness, locale)"
              @change="commitCm(wall, 'thickness', $event, (e, mm) => ({ ...e, thickness: mm }))"
            />cm
          </span>
        </label>
        <label :class="{ bad: bad === 'height' }">
          {{ t("props.height") }}
          <span class="field">
            <input
              :key="wall.id + wall.height + '/' + rev"
              :value="formatCm(wall.height, locale)"
              @change="commitCm(wall, 'height', $event, (e, mm) => ({ ...e, height: mm }))"
            />cm
          </span>
        </label>
        <label>
          {{ t("props.alignment") }}
          <select
            :value="wall.alignment"
            @change="
              edit(wall, (e) => ({ ...e, alignment: ($event.target as HTMLSelectElement).value as Wall['alignment'] }))
            "
          >
            <option v-for="a in ['center', 'left', 'right']" :key="a" :value="a">{{ t(`align.${a}`) }}</option>
          </select>
        </label>
      </template>
      <label>
        {{ t("props.kind") }}
        <select
          :value="wall.kind"
          @change="edit(wall, (e) => ({ ...e, kind: ($event.target as HTMLSelectElement).value as Wall['kind'] }))"
        >
          <option v-for="k in ['full', 'half', 'fence', 'railing', 'separator']" :key="k" :value="k">
            {{ t(`wallKind.${k}`) }}
          </option>
        </select>
      </label>
      <template v-if="wallSides && wall.kind !== 'separator'">
        <label v-for="side in SIDES" :key="side" class="stack">
          {{ t("finish.side", { room: wallSides[side] }) }}
          <select
            :value="architectData(wall).sides?.[side] ?? ''"
            @change="emit('paintSide', wall.id, side, ($event.target as HTMLSelectElement).value)"
          >
            <option value="">{{ t("finish.none") }}</option>
            <option v-for="f in wallFinishes" :key="f.id" :value="f.id">{{ t(`finish.${f.id}`) }}</option>
          </select>
        </label>
      </template>
      <!-- Structure (Phase 2, ADR-017/042): role + where the mark came from -->
      <template v-if="structural && canCarry(wall)">
        <h4>{{ t("props.structure") }}</h4>
        <label class="stack">
          {{ t("props.material") }}
          <select
            :value="wallMaterial(wall) ?? ''"
            @change="
              emit(
                'material',
                wall.id,
                (($event.target as HTMLSelectElement).value || undefined) as WallMaterial | undefined,
              )
            "
          >
            <option value="">{{ t("material.unknown") }}</option>
            <option v-for="m in WALL_MATERIALS" :key="m" :value="m">{{ t(`material.${m}`) }}</option>
          </select>
        </label>
        <p v-if="weightOf(wall)" class="ro" :title="weightOf(wall)?.from">
          {{ weightOf(wall)?.text }} · <span class="unverified">{{ weightOf(wall)?.review }}</span>
        </p>
        <p v-else-if="wallMaterial(wall)" class="ro">{{ t("material.noValue") }}</p>
        <p v-if="wallMaterial(wall) === 'drywall'" class="ro">{{ t("material.drywall.note") }}</p>
        <div v-if="load" class="load">
          <p>
            <strong>{{ load.headline }}</strong><br />
            <span class="ro">{{ load.range }} · </span
            ><span class="unverified">{{ t("value.review.unverified") }}</span>
          </p>
          <details>
            <summary>{{ t("load.show") }}</summary>
            <ul>
              <li v-for="(l, k) in load.lines" :key="k">{{ l }}</li>
            </ul>
            <p v-if="load.notCounted.length" class="ro">{{ t("load.notCounted") }}</p>
            <ul v-if="load.notCounted.length" class="ro">
              <li v-for="(n, k) in load.notCounted" :key="k">{{ n }}</li>
            </ul>
            <p class="ro">{{ t("load.disclaimer") }}</p>
          </details>
        </div>
        <label class="stack" :title="t('role.tip')">
          {{ t("props.role") }}
          <select
            :value="structuralData(wall).role ?? ''"
            @change="
              emit(
                'role',
                wall.id,
                (($event.target as HTMLSelectElement).value || undefined) as WallRole | undefined,
                structuralData(wall).origin,
              )
            "
          >
            <option value="">{{ t(`role.default.${structural}`) }}</option>
            <option value="bearing">{{ t("role.bearing") }}</option>
            <option value="non-bearing">{{ t("role.non-bearing") }}</option>
          </select>
        </label>
        <label v-if="structuralData(wall).role" class="stack">
          {{ t("props.roleOrigin") }}
          <select
            :value="structuralData(wall).origin ?? 'own-judgement'"
            @change="
              emit('role', wall.id, structuralData(wall).role, ($event.target as HTMLSelectElement).value as RoleOrigin)
            "
          >
            <option v-for="o in ROLE_ORIGINS" :key="o" :value="o">{{ t(`origin.${o}`) }}</option>
          </select>
        </label>
        <label v-if="wall.kind === 'full'" class="check" :title="t('tieBeam.tip')">
          <input
            type="checkbox"
            :checked="!!structuralData(wall).tieBeam"
            @change="emit('tieBeam', wall.id, ($event.target as HTMLInputElement).checked)"
          />
          {{ t("props.tieBeam") }}
        </label>
        <label v-for="j in junctionsOf(project, wall)" :key="j.end" class="check" :title="t('bonded.tip')">
          <input
            type="checkbox"
            :checked="!!structuralData(wall).bonded?.[j.end]"
            @change="emit('bonded', wall.id, j.end, ($event.target as HTMLInputElement).checked)"
          />
          {{ t(`props.bonded.${endSide(wall, j.end)}`, { other: wallLabel(j.others[0]) }) }}
        </label>
        <div v-if="protection" class="protected">
          <p>🔒 {{ t("protect.on") }}</p>
          <p class="ro">
            {{
              t("protect.by", {
                name: protection.author || t("someone"),
                date: noteDate(protection.createdAt),
              })
            }}
          </p>
          <button @click="emit('unprotect', protection.id)">{{ t("protect.remove") }}</button>
        </div>
        <button v-else class="protect" :title="t('protect.tip')" @click="emit('protect', wall.id)">
          🔒 {{ t("protect.add") }}
        </button>
      </template>
    </template>

    <template v-else-if="opening">
      <h3>{{ t(`openingKind.${opening.kind}`) }}</h3>
      <label :class="{ bad: bad === 'width' }">
        {{ t("props.width") }}
        <span class="field">
          <input
            :key="opening.id + opening.width + '/' + rev"
            :value="formatCm(opening.width, locale)"
            @change="commitCm(opening, 'width', $event, (e, mm) => ({ ...e, width: mm }))"
          />cm
        </span>
      </label>
      <label :class="{ bad: bad === 'oheight' }">
        {{ t("props.height") }}
        <span class="field">
          <input
            :key="opening.id + opening.height + '/' + rev"
            :value="formatCm(opening.height, locale)"
            @change="commitCm(opening, 'oheight', $event, (e, mm) => ({ ...e, height: mm }))"
          />cm
        </span>
      </label>
      <label :class="{ bad: bad === 'sill' }">
        {{ t("props.sill") }}
        <span class="field">
          <input
            :key="opening.id + opening.sillHeight + '/' + rev"
            :value="formatCm(opening.sillHeight, locale)"
            @change="commitCm(opening, 'sill', $event, (e, mm) => ({ ...e, sillHeight: mm }))"
          />cm
        </span>
      </label>
      <label v-if="opening.kind !== 'void'">
        {{ t("props.openingStyle") }}
        <select
          :value="openingStyle(opening) ?? ''"
          @change="
            edit(opening, (e) => {
              const v = ($event.target as HTMLSelectElement).value;
              const { style: _old, ...rest } = e as Opening;
              return v ? { ...rest, style: v } : rest;
            })
          "
        >
          <option v-if="opening.kind === 'window'" value="">{{ t("windowStyle.plain") }}</option>
          <option v-for="st in opening.kind === 'door' ? DOOR_STYLES : WINDOW_STYLES" :key="st" :value="st">
            {{ t(`${opening.kind}Style.${st}`) }}
          </option>
        </select>
      </label>
      <div v-if="sided(opening)" class="row">
        <button @click="edit(opening, (e) => ({ ...e, handing: e.handing === 'right' ? 'left' : 'right' }))">
          ⇋ {{ t("props.flipHanding") }}
        </button>
        <button @click="edit(opening, (e) => ({ ...e, swing: e.swing === 'out' ? 'in' : 'out' }))">
          ⇅ {{ t("props.flipSwing") }}
        </button>
      </div>
      <template v-if="structural">
        <h4>{{ t("props.structure") }}</h4>
        <label class="check" :title="t('lintel.tip')">
          <input
            type="checkbox"
            :checked="!!structuralData(opening).lintel"
            @change="emit('lintel', opening.id, ($event.target as HTMLInputElement).checked)"
          />
          {{ t("props.lintel") }}
        </label>
        <template v-if="structuralData(opening).lintel">
          <p class="ro">{{ t("lintel.size") }}</p>
          <label :title="t('lintel.height.tip')">
            {{ t("lintel.height") }}
            <span class="field">
              <input
                :key="opening.id + (lintelSize(opening).height ?? '') + '/' + rev"
                :value="lintelSize(opening).height ? formatCm(lintelSize(opening).height ?? 0, locale) : ''"
                :placeholder="t('above.unknown')"
                @change="lintelHeight(opening, $event)"
              />cm
            </span>
          </label>
          <label class="stack" :title="t('lintel.bars.tip')">
            {{ t("lintel.bars") }}
            <select :value="barValue(opening)" @change="lintelBars(opening, $event)">
              <option value="">{{ t("lintel.bars.unknown") }}</option>
              <option v-for="b in BAR_OPTIONS" :key="b.v" :value="b.v">
                {{ t("lintel.bar", { n: b.n, d: num(b.d) }) }}
              </option>
            </select>
          </label>
        </template>
        <div v-if="lintelLoad" class="load">
          <p class="ro">{{ t("lintel.load.title") }}</p>
          <p>
            <strong>{{ lintelLoad.headline }}</strong><br />
            <span class="ro">{{ lintelLoad.bending }}</span>
            <template v-if="lintelLoad.strength"
              ><br /><span class="ro">{{ lintelLoad.strength }}</span></template
            >
            · <span class="unverified">{{ t("value.review.unverified") }}</span>
          </p>
          <p>{{ lintelLoad.verdict }}</p>
          <details>
            <summary>{{ t("load.show") }}</summary>
            <ul>
              <li v-for="(l, k) in lintelLoad.lines" :key="k">{{ l }}</li>
            </ul>
            <p class="ro">{{ t("lintel.notChecked") }}</p>
            <ul class="ro">
              <li v-for="(n, k) in lintelLoad.notChecked" :key="k">{{ n }}</li>
            </ul>
            <p class="ro">{{ t("lintel.disclaimer") }}</p>
          </details>
        </div>
        <label v-if="opening.kind === 'window'" class="check" :title="t('contraverga.tip')">
          <input
            type="checkbox"
            :checked="!!structuralData(opening).contraverga"
            @change="emit('contraverga', opening.id, ($event.target as HTMLInputElement).checked)"
          />
          {{ t("props.contraverga") }}
        </label>
      </template>
    </template>

    <template v-else-if="note">
      <h3>{{ note.resolved ? t("note.titleResolved") : t("note.title") }}</h3>
      <p class="ro">{{ t("note.by", { name: note.author, date: noteDate(note.createdAt) }) }}</p>
      <p class="ro">
        {{ noteAbout.length ? t("note.about", { what: noteAbout.join(", ") }) : t("note.aboutSpot") }}
      </p>
      <textarea
        :key="note.id + note.text + '/' + rev"
        class="note-text"
        rows="4"
        :value="note.text"
        :aria-label="t('note.text')"
        @change="commitNoteText(note, $event)"
      />
      <div class="row">
        <button
          v-if="!note.resolved"
          :title="t('note.resolve.tip')"
          @click="edit(note, (e) => ({ ...e, resolved: true }))"
        >
          ✓ {{ t("note.resolve") }}
        </button>
        <button
          v-else
          @click="
            edit(note, (e) => {
              const { resolved: _r, ...rest } = e;
              return rest;
            })
          "
        >
          {{ t("note.reopen") }}
        </button>
      </div>
    </template>

    <template v-else-if="chase">
      <h3>{{ t(`chase.${chaseDir(chase)}`) }}</h3>
      <p class="ro">{{ t("chase.on", { wall: wallLabel(chaseWall) }) }}</p>
      <label v-if="chaseDir(chase) === 'horizontal'" :class="{ bad: bad === 'clength' }">
        {{ t("props.length") }}
        <span class="field">
          <input
            :key="chase.id + (chase.host.length ?? 0) + '/' + rev"
            :value="formatCm(chase.host.length ?? 0, locale)"
            @change="commitCm(chase, 'clength', $event, (e, mm) => ({ ...e, host: { ...e.host, length: mm } }))"
          />cm
        </span>
      </label>
      <p class="ro">{{ t("chase.note") }}</p>
    </template>

    <template v-else>
      <h3>{{ t("props.selected", { count: selection.length }) }}</h3>
    </template>

    <div v-if="hasWalls" class="row">
      <button :title="t('action.rotateLeft.tip')" @click="emit('rotate', 90)">↺ 90°</button>
      <button :title="t('action.rotateRight.tip')" @click="emit('rotate', -90)">↻ 90°</button>
      <button :title="t('action.mirrorX.tip')" @click="emit('mirror', 'vertical')">⇆ {{ t("action.mirror") }}</button>
      <button :title="t('action.mirrorY.tip')" @click="emit('mirror', 'horizontal')">⇅ {{ t("action.mirror") }}</button>
      <label class="check"><input v-model="keepOriginal" type="checkbox" /> {{ t("props.keepOriginal") }}</label>
    </div>
    <p v-if="bad" class="warn">{{ t("props.badNumber", { example: formatCm(145, locale) }) }}</p>
    <div class="row">
      <button v-if="!note" @click="emit('duplicate')">{{ t("action.duplicate") }}</button>
      <button class="danger" @click="emit('delete')">{{ t("action.delete") }}</button>
    </div>
  </aside>
</template>

<style scoped>
.protected {
  margin: 6px 0;
  padding: 6px 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
}
.protected p {
  margin: 0 0 4px;
}
.protect {
  margin-top: 6px;
}
.note-text {
  width: 100%;
  box-sizing: border-box;
  padding: 4px 6px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--bg);
  color: inherit;
  font: inherit;
  resize: vertical;
}
.panel {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 230px;
  padding: 10px 12px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 2px 10px rgb(0 0 0 / 15%);
}
h4 {
  margin: 12px 0 4px;
  font-size: 12px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
h3 {
  margin: 0 0 8px;
  font-size: 14px;
}
label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin: 6px 0;
}
.field {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--muted);
}
input {
  width: 64px;
  text-align: right;
  font: inherit;
  color: inherit;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 2px 4px;
}
select {
  font: inherit;
  max-width: 130px;
}
label.bad input {
  border-color: var(--warn);
}
.ro {
  margin: 0 0 6px;
  color: var(--muted);
}
.row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 10px;
}
button {
  padding: 3px 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  cursor: pointer;
}
.stack {
  flex-direction: column;
  align-items: stretch;
}
input.text {
  width: auto;
  text-align: left;
}
.check {
  justify-content: flex-start;
  margin: 0;
  font-size: 12px;
}
.check input {
  width: auto;
}
.danger {
  color: var(--warn);
}
.warn {
  color: var(--warn);
  margin: 6px 0 0;
}
.unverified {
  color: var(--warn);
}
.load {
  margin: 6px 0;
  padding: 6px 8px;
  border: 1px dashed var(--line);
  border-radius: 6px;
  font-size: 12px;
}
.load p {
  margin: 0 0 4px;
}
.load ul {
  margin: 2px 0 6px;
  padding-left: 16px;
}
.load summary {
  cursor: pointer;
  color: var(--accent);
}
</style>
