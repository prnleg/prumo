<script setup lang="ts">
// "Recover unsaved work?" at launch (Q-111/126/129). Copies stay until recovered-and-saved or discarded;
// "Decide later" keeps them for the next start.
import { translate, type Locale, type Params } from "./i18n";
import type { RecoveryEntry } from "./recovery";

const props = defineProps<{ locale: Locale; entries: readonly RecoveryEntry[] }>();
const emit = defineEmits<{ recover: [e: RecoveryEntry]; discard: [e: RecoveryEntry]; later: [] }>();
const t = (key: string, params?: Params) => translate(props.locale, key, params);
const when = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? t("recovery.unknownTime")
    : d.toLocaleString(props.locale, { dateStyle: "medium", timeStyle: "short" });
};
</script>

<template>
  <div class="backdrop" @keydown.esc="emit('later')">
    <section class="card" role="dialog" aria-modal="true" :aria-label="t('recovery.title')">
      <h2>{{ t("recovery.title") }}</h2>
      <p class="intro">{{ t("recovery.intro") }}</p>
      <ul>
        <li v-for="e in entries" :key="e.key">
          <div class="what">
            <strong>{{ e.name }}</strong>
            <span>{{ t("recovery.savedAt", { time: when(e.savedAt) }) }}</span>
          </div>
          <button class="primary" @click="emit('recover', e)">{{ t("recovery.recover") }}</button>
          <button @click="emit('discard', e)">{{ t("recovery.discard") }}</button>
        </li>
      </ul>
      <footer>
        <button @click="emit('later')">{{ t("recovery.later") }}</button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.backdrop {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgb(0 0 0 / 35%);
  z-index: 20;
  padding: 16px;
}
.card {
  width: min(520px, 100%);
  max-height: 100%;
  overflow: auto;
  padding: 16px 20px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  box-shadow: 0 6px 30px rgb(0 0 0 / 25%);
}
h2 {
  margin: 0 0 6px;
  font-size: 18px;
}
.intro {
  margin: 0 0 10px;
  font-size: 13px;
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
  gap: 8px;
  padding: 8px 0;
  border-top: 1px solid var(--line);
}
.what {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.what strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.what span {
  font-size: 12px;
  color: var(--muted);
}
button {
  padding: 4px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  color: inherit;
  cursor: pointer;
  font: inherit;
}
button.primary {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}
footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}
</style>
