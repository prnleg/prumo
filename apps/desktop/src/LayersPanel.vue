<script setup lang="ts">
// Layers (Q-141): the floors (click = edit that floor; add / rename / delete, ADR-048) and the rooms on this
// floor — eye = hide/show (view only, not saved), bin = remove the walls only this room uses.
// Hiding never hides a structure finding: checks still run on everything.
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "@lucide/vue";
import { nextTick, ref } from "vue";
import { translate, type Locale, type Params } from "./i18n";

const props = defineProps<{
  locale: Locale;
  /** Top floor first (like the building). */
  levels: readonly { id: string; name: string }[];
  level: string;
  rooms: readonly { key: string; label: string; hidden: boolean; canRemove: boolean }[];
}>();
const emit = defineEmits<{
  toggle: [key: string];
  remove: [key: string];
  select: [key: string];
  close: [];
  pickLevel: [id: string];
  addLevel: [];
  renameLevel: [id: string, name: string];
  deleteLevel: [id: string];
}>();
const t = (key: string, params?: Params) => translate(props.locale, key, params);
const editing = ref<string | null>(null);
const input = ref<HTMLInputElement[]>();
function rename(id: string) {
  editing.value = id;
  void nextTick(() => input.value?.[0]?.select());
}
function commit(id: string, e: Event) {
  if (editing.value !== id) return;
  editing.value = null;
  emit("renameLevel", id, (e.target as HTMLInputElement).value);
}
</script>

<template>
  <aside class="layers" :aria-label="t('layers.title')">
    <header>
      <h3>{{ t("layers.title") }}</h3>
      <button class="x" :aria-label="t('layers.close')" @click="emit('close')">×</button>
    </header>
    <h4>{{ t("layers.floors") }}</h4>
    <ul>
      <li v-for="l in levels" :key="l.id" :class="{ on: l.id === level }">
        <span class="dot">{{ l.id === level ? "◉" : "○" }}</span>
        <input
          v-if="editing === l.id"
          ref="input"
          class="rename"
          :value="l.name"
          maxlength="40"
          @keydown.enter="commit(l.id, $event)"
          @keydown.esc="editing = null"
          @blur="commit(l.id, $event)"
        />
        <button v-else class="name link" :title="t('layers.pickFloor')" @click="emit('pickLevel', l.id)">
          {{ l.name }}
        </button>
        <button
          class="icon"
          :title="t('layers.renameFloor')"
          :aria-label="t('layers.renameFloor')"
          @click="rename(l.id)"
        >
          <Pencil :size="14" />
        </button>
        <button
          class="icon"
          :disabled="levels.length < 2"
          :title="levels.length < 2 ? t('layers.deleteFloor.last') : t('layers.deleteFloor')"
          :aria-label="t('layers.deleteFloor')"
          @click="emit('deleteLevel', l.id)"
        >
          <Trash2 :size="14" />
        </button>
      </li>
      <li>
        <button class="add link" @click="emit('addLevel')">
          <Plus :size="14" />
          {{ t("layers.addFloor") }}
        </button>
      </li>
    </ul>
    <h4>{{ t("layers.rooms") }}</h4>
    <p v-if="!rooms.length" class="muted">{{ t("layers.noRooms") }}</p>
    <ul>
      <li v-for="r in rooms" :key="r.key" :class="{ off: r.hidden }">
        <button
          class="icon"
          :title="r.hidden ? t('layers.show') : t('layers.hide')"
          :aria-label="r.hidden ? t('layers.show') : t('layers.hide')"
          @click="emit('toggle', r.key)"
        >
          <EyeOff v-if="r.hidden" :size="15" />
          <Eye v-else :size="15" />
        </button>
        <button class="name link" :disabled="r.hidden" @click="emit('select', r.key)">
          {{ r.hidden ? `${r.label} ${t("layers.hidden")}` : r.label }}
        </button>
        <button
          class="icon"
          :disabled="!r.canRemove"
          :title="r.canRemove ? t('layers.remove.tip') : t('layers.remove.shared')"
          :aria-label="t('layers.remove')"
          @click="emit('remove', r.key)"
        >
          <Trash2 :size="15" />
        </button>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.layers {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 5;
  width: 250px;
  max-height: calc(55% - 24px);
  overflow-y: auto;
  padding: 8px 10px 10px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.12);
  font-size: 13px;
}
header {
  display: flex;
  align-items: center;
}
h3 {
  flex: 1;
  margin: 0;
  font-size: 14px;
}
h4 {
  margin: 10px 0 4px;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
li {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 28px;
}
li.on .name {
  font-weight: 600;
}
li.off .name {
  color: var(--muted);
}
.add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--accent);
}
.rename {
  flex: 1;
  min-width: 0;
  padding: 2px 4px;
  border: 1px solid var(--accent);
  border-radius: 4px;
  background: var(--bg);
  color: inherit;
  font: inherit;
}
.dot {
  width: 22px;
  text-align: center;
}
.name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}
button.link {
  border: none;
  background: none;
  padding: 2px 4px;
  font: inherit;
  color: inherit;
}
button.link:hover:not(:disabled) {
  text-decoration: underline;
}
button.icon {
  display: inline-flex;
  padding: 4px 5px;
  border: 1px solid transparent;
  background: none;
}
button.icon:hover:not(:disabled) {
  background: var(--accent-soft);
}
button.x {
  border: none;
  background: none;
  font-size: 18px;
  line-height: 1;
  padding: 0 4px;
}
.muted {
  color: var(--muted);
  margin: 2px 0;
}
</style>
