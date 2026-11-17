<script setup lang="ts">
// Properties of the selection (ROADMAP Phase 1 "Properties panel"). Every change is ONE command
// (one undo step), applied when the field is committed (Enter / leaving it), never per keystroke.
import {
  setWallLengthCommand,
  updateCommand,
  wallLength,
  type Command,
  type Element,
  type Opening,
  type Project,
  type Wall,
} from "@prumo/core";
import { FINISHES, ROOM_PREFIX, ROOM_TYPES, architectData, roomTypeKey } from "@prumo/module-architect";
import { computed, ref } from "vue";
import { formatArea, formatCm, parseNumber, translate, type Locale, type Params } from "./i18n";

const props = defineProps<{
  project: Project;
  selection: readonly string[];
  locale: Locale;
  /** Detected rooms with their current name (for a selected room). */
  rooms: readonly { key: string; name: string; area: number; floor: string; roomType: string }[];
  /** What each side of the selected wall faces ("Sala", "outside"). */
  wallSides?: { left: string; right: string } | null;
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
}>();
const wallFinishes = FINISHES.filter((f) => f.use === "wall");
const floorFinishes = FINISHES.filter((f) => f.use === "floor");
const SIDES = ["left", "right"] as const;
const room = computed(() => {
  const id = props.selection.length === 1 ? (props.selection[0] ?? "") : "";
  return id.startsWith(ROOM_PREFIX) ? (props.rooms.find((r) => r.key === id.slice(ROOM_PREFIX.length)) ?? null) : null;
});
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
    </template>

    <template v-else-if="wall">
      <h3>{{ t("props.wall") }}</h3>
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
      <label>
        {{ t("props.kind") }}
        <select
          :value="wall.kind"
          @change="edit(wall, (e) => ({ ...e, kind: ($event.target as HTMLSelectElement).value as Wall['kind'] }))"
        >
          <option v-for="k in ['full', 'half', 'fence', 'railing']" :key="k" :value="k">
            {{ t(`wallKind.${k}`) }}
          </option>
        </select>
      </label>
      <template v-if="wallSides">
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
      <div v-if="opening.kind === 'door'" class="row">
        <button @click="edit(opening, (e) => ({ ...e, handing: e.handing === 'right' ? 'left' : 'right' }))">
          ⇋ {{ t("props.flipHanding") }}
        </button>
        <button @click="edit(opening, (e) => ({ ...e, swing: e.swing === 'out' ? 'in' : 'out' }))">
          ⇅ {{ t("props.flipSwing") }}
        </button>
      </div>
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
      <button @click="emit('duplicate')">{{ t("action.duplicate") }}</button>
      <button class="danger" @click="emit('delete')">{{ t("action.delete") }}</button>
    </div>
  </aside>
</template>

<style scoped>
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
</style>
