<script setup lang="ts">
// "Add floor" (ADR-048): name, height above the floor below, and what it starts with (owner: ask each
// time; default = the outside walls of the floor below).
import type { NewLevelStart } from "@prumo/core";
import { computed, nextTick, onMounted, ref } from "vue";
import { parseNumber, translate, type Locale, type Params } from "./i18n";

const props = defineProps<{ locale: Locale; below: string; suggested: string }>();
const emit = defineEmits<{ add: [name: string, heightMm: number, start: NewLevelStart]; cancel: [] }>();
const t = (k: string, p?: Params) => translate(props.locale, k, p);

const name = ref(props.suggested);
/** Floor-to-floor, cm. A drawing default (ADR-048), not a structural value. */
const height = ref("280");
const start = ref<NewLevelStart>("outside");
const first = ref<HTMLInputElement>();
const cm = computed(() => parseNumber(height.value, props.locale));
const ok = computed(() => cm.value !== null && cm.value >= 100 && cm.value <= 2000);
onMounted(() => nextTick(() => first.value?.select()));
function add() {
  if (ok.value && cm.value !== null) emit("add", name.value.trim(), Math.round(cm.value * 10), start.value);
}
const STARTS: readonly NewLevelStart[] = ["empty", "outside", "all"];
</script>

<template>
  <div class="backdrop" @click.self="emit('cancel')" @keydown.esc="emit('cancel')">
    <section class="card" role="dialog" aria-modal="true" :aria-label="t('floor.add.title', { below })">
      <h3>{{ t("floor.add.title", { below }) }}</h3>
      <label>
        {{ t("floor.name") }}
        <input ref="first" v-model="name" maxlength="40" @keydown.enter="add" />
      </label>
      <label :title="t('floor.height.tip')">
        {{ t("floor.height") }}
        <span class="field"><input v-model="height" inputmode="decimal" @keydown.enter="add" /> cm</span>
      </label>
      <fieldset>
        <legend>{{ t("floor.start") }}</legend>
        <label v-for="s in STARTS" :key="s" class="radio">
          <input v-model="start" type="radio" name="start" :value="s" />
          {{ t(`floor.start.${s}`) }}
        </label>
      </fieldset>
      <footer>
        <button @click="emit('cancel')">{{ t("note.cancel") }}</button>
        <button class="primary" :disabled="!ok" @click="add">{{ t("floor.add") }}</button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgb(0 0 0 / 35%);
  z-index: 40;
}
.card {
  width: min(380px, calc(100vw - 32px));
  padding: 14px 16px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgb(0 0 0 / 30%);
  font-size: 13px;
}
h3 {
  margin: 0 0 10px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 8px;
}
label.radio {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.field {
  display: flex;
  align-items: center;
  gap: 4px;
}
.field input {
  width: 80px;
}
fieldset {
  margin: 4px 0 12px;
  padding: 6px 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
}
legend {
  padding: 0 4px;
  color: var(--muted);
}
input:not([type="radio"]) {
  padding: 4px 6px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--bg);
  color: inherit;
  font: inherit;
}
footer {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
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
