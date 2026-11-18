<script setup lang="ts">
// Write a note at a spot on the plan (ADR-044). Asks for your name the first time (Q-092: a local
// display name, remembered in settings.json). Not modal: Esc or Cancel drops it.
import { computed, nextTick, onMounted, ref } from "vue";
import { translate, type Locale, type Params } from "./i18n";
import { NAME_MAX, cleanName } from "./prefs";

const props = defineProps<{
  locale: Locale;
  /** Screen position inside the canvas, px. */
  left: number;
  top: number;
  /** null = we don't know your name yet. */
  name: string | null;
  /** What the note will be about ("the 4.00 m wall"), or null for a free spot. */
  about: string | null;
}>();
const emit = defineEmits<{ add: [text: string, name: string]; cancel: [] }>();
const t = (k: string, p?: Params) => translate(props.locale, k, p);

const text = ref("");
const who = ref(props.name ?? "");
const box = ref<HTMLTextAreaElement>();
const nameBox = ref<HTMLInputElement>();
const ok = computed(() => text.value.trim().length > 0 && cleanName(who.value) !== null);
onMounted(() => nextTick(() => (props.name ? box.value : nameBox.value)?.focus()));

function add() {
  const n = cleanName(who.value);
  if (!n || !text.value.trim()) return;
  emit("add", text.value.trim(), n);
}
</script>

<template>
  <section
    class="pop"
    :style="{ left: `${left}px`, top: `${top}px` }"
    role="dialog"
    :aria-label="t('note.new')"
    @keydown.esc.stop="emit('cancel')"
    @keydown.enter.meta.prevent="add"
    @keydown.enter.ctrl.prevent="add"
  >
    <h4>{{ t("note.new") }}</h4>
    <p class="about">{{ about ? t("note.about", { what: about }) : t("note.aboutSpot") }}</p>
    <label v-if="!name" class="name">
      {{ t("note.yourName") }}
      <input ref="nameBox" v-model="who" :maxlength="NAME_MAX" :placeholder="t('note.yourName.placeholder')" />
      <small>{{ t("note.yourName.tip") }}</small>
    </label>
    <textarea ref="box" v-model="text" rows="3" :placeholder="t('note.placeholder')" />
    <footer>
      <button @click="emit('cancel')">{{ t("note.cancel") }}</button>
      <button class="primary" :disabled="!ok" @click="add">{{ t("note.add") }}</button>
    </footer>
  </section>
</template>

<style scoped>
.pop {
  position: absolute;
  width: 260px;
  max-width: calc(100% - 16px);
  padding: 10px 12px;
  background: var(--panel);
  border: 1px solid var(--accent);
  border-radius: 8px;
  box-shadow: 0 6px 24px rgb(0 0 0 / 25%);
  z-index: 20;
  font-size: 13px;
}
h4 {
  margin: 0 0 4px;
  font-size: 13px;
}
.about {
  margin: 0 0 8px;
  color: var(--muted);
  font-size: 12px;
}
.name {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 8px;
}
.name small {
  color: var(--muted);
  font-size: 11px;
}
input,
textarea {
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
footer {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 8px;
}
button {
  padding: 3px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  color: inherit;
  cursor: pointer;
  font: inherit;
}
button.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
