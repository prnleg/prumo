<script setup lang="ts">
// Notes on this level (ADR-044): find them without hunting for pins. Open ones first (newest first),
// resolved ones behind a toggle. Click = select the note (the properties panel shows it).
import type { Note } from "@prumo/core";
import { computed, ref } from "vue";
import { translate, type Locale, type Params } from "./i18n";

const props = defineProps<{ locale: Locale; notes: readonly Note[]; selected: readonly string[] }>();
const emit = defineEmits<{ select: [id: string] }>();
const t = (k: string, p?: Params) => translate(props.locale, k, p);

const open = ref(true);
const showResolved = ref(false);
const newestFirst = (a: Note, b: Note) =>
  a.createdAt > b.createdAt ? -1 : a.createdAt < b.createdAt ? 1 : a.id < b.id ? -1 : 1;
const active = computed(() => props.notes.filter((n) => !n.resolved).sort(newestFirst));
const resolved = computed(() => props.notes.filter((n) => n.resolved).sort(newestFirst));
const excerpt = (s: string) => (s.length > 80 ? `${s.slice(0, 79)}…` : s);
</script>

<template>
  <section v-if="notes.length" class="notes" :aria-label="t('notes.title')">
    <button class="toggle" :aria-expanded="open" @click="open = !open">
      {{ open ? "▾" : "▸" }} {{ t("notes.title") }}
      <span class="count">{{ t("notes.count", { count: active.length }) }}</span>
    </button>
    <div v-if="open" class="body">
      <ul>
        <li v-for="n in active" :key="n.id" :class="{ on: selected.includes(n.id) }">
          <button @click="emit('select', n.id)">
            <strong>{{ n.author }}</strong> {{ excerpt(n.text) }}
          </button>
        </li>
      </ul>
      <template v-if="resolved.length">
        <button class="more" @click="showResolved = !showResolved">
          {{ showResolved ? "▾" : "▸" }} {{ t("notes.resolved", { count: resolved.length }) }}
        </button>
        <ul v-if="showResolved" class="done">
          <li v-for="n in resolved" :key="n.id" :class="{ on: selected.includes(n.id) }">
            <button @click="emit('select', n.id)">
              <strong>{{ n.author }}</strong> {{ excerpt(n.text) }}
            </button>
          </li>
        </ul>
      </template>
    </div>
  </section>
</template>

<style scoped>
.notes {
  position: absolute;
  right: 12px;
  bottom: 44px;
  width: min(280px, calc(100% - 24px));
  max-height: 40%;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 2px 12px rgb(0 0 0 / 15%);
  font-size: 13px;
  z-index: 4;
}
.toggle,
.more {
  border: none;
  background: none;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
  padding: 6px 8px;
}
.toggle {
  font-weight: 600;
}
.count {
  font-weight: 400;
  color: var(--muted);
  margin-left: 4px;
}
.more {
  color: var(--muted);
  font-size: 12px;
}
.body {
  overflow: auto;
  padding: 0 4px 6px;
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
li button {
  width: 100%;
  border: none;
  background: none;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
  padding: 4px 6px;
  border-radius: 6px;
}
li button:hover,
li.on button {
  background: var(--bg);
}
.done li button {
  color: var(--muted);
}
</style>
