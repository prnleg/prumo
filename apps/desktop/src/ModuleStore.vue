<script setup lang="ts">
// Modules (owner, 2026-11-19: install modules from a "store", not on/off switches). Stage 1 (ADR-020):
// the official modules that ship with Prumo. Modules by other people wait for the trust model (ADR-023).
import type { ModuleUi } from "@prumo/ui-api";
import { Blocks, Check, PencilRuler } from "@lucide/vue";
import { translate, type Locale, type Params } from "./i18n";

const props = defineProps<{
  locale: Locale;
  modules: readonly ModuleUi[];
  installed: Readonly<Record<string, boolean>>;
}>();
const emit = defineEmits<{ install: [id: string]; remove: [id: string]; close: [] }>();
const t = (k: string, p?: Params) => translate(props.locale, k, p);
</script>

<template>
  <div class="backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
    <section class="card" role="dialog" aria-modal="true" :aria-label="t('store.title')">
      <h3><Blocks :size="18" /> {{ t("store.title") }}</h3>
      <p class="intro">{{ t("store.intro") }}</p>
      <ul>
        <li>
          <PencilRuler class="icon" :size="22" :stroke-width="1.75" />
          <div class="text">
            <strong>{{ t("module.architect.name") }}</strong>
            <span class="by">{{ t("store.official") }}</span>
            <p>{{ t("module.architect.desc") }}</p>
          </div>
          <span class="state"><Check :size="14" /> {{ t("store.required") }}</span>
        </li>
        <li v-for="m in modules" :key="m.moduleId">
          <component :is="m.icon ?? Blocks" class="icon" :size="22" :stroke-width="1.75" />
          <div class="text">
            <strong>{{ t(m.name) }}</strong>
            <span class="by">{{ t("store.official") }}</span>
            <p>{{ t(m.description) }}</p>
          </div>
          <span v-if="installed[m.moduleId]" class="state">
            <span><Check :size="14" /> {{ t("store.installed") }}</span>
            <button class="plain" :title="t('store.remove.tip')" @click="emit('remove', m.moduleId)">
              {{ t("store.remove") }}
            </button>
          </span>
          <button v-else class="primary" @click="emit('install', m.moduleId)">{{ t("store.install") }}</button>
        </li>
      </ul>
      <p class="tip">{{ t("store.keep") }}</p>
      <p class="tip">{{ t("store.others") }}</p>
      <footer>
        <button class="primary" @click="emit('close')">{{ t("settings.close") }}</button>
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
  width: min(520px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  overflow: auto;
  padding: 14px 16px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgb(0 0 0 / 30%);
  font-size: 13px;
}
h3 {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 4px;
}
.intro {
  margin: 0 0 10px;
  color: var(--muted);
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
li {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: start;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
}
.icon {
  color: var(--accent);
  margin-top: 2px;
}
.text p {
  margin: 4px 0 0;
}
.by {
  margin-left: 6px;
  color: var(--muted);
  font-size: 12px;
}
.state {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  color: var(--muted);
  white-space: nowrap;
}
.state > span {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.tip {
  margin: 10px 0 0;
  color: var(--muted);
  font-size: 12px;
}
footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
button {
  padding: 3px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  color: inherit;
  cursor: pointer;
  font: inherit;
  white-space: nowrap;
}
button.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
button.plain {
  border-color: transparent;
  background: none;
  color: var(--muted);
  text-decoration: underline;
  padding: 0;
}
</style>
