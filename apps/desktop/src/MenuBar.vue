<script setup lang="ts">
// In-app menu bar (ADR-047, Q-138): drawn by us so it looks the same on Windows and macOS (no
// native OS menus). Click a title to open; while one is open, hovering another title switches;
// arrows move, Enter picks, Esc or a click outside closes. Strings come in already translated.
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";

export interface MenuItem {
  id: string;
  label: string;
  /** Shown on the right, e.g. "Ctrl+S". */
  shortcut?: string;
  disabled?: boolean;
  /** A toggle: shows a tick when true. */
  checked?: boolean;
}
export interface Menu {
  id: string;
  label: string;
  items: readonly (MenuItem | "sep")[];
}

const props = defineProps<{
  menus: readonly Menu[];
  /** Dev screenshots only: a menu open at start. */ startOpen?: string | null;
}>();
const emit = defineEmits<{ pick: [id: string] }>();

const open = ref<string | null>(props.startOpen ?? null);
const root = ref<HTMLElement>();

function toggle(id: string) {
  open.value = open.value === id ? null : id;
  if (open.value) void nextTick(() => focusItem(0));
}
function hover(id: string) {
  if (open.value && open.value !== id) open.value = id;
}
function pick(it: MenuItem) {
  if (it.disabled) return;
  open.value = null;
  emit("pick", it.id);
}
function items(): HTMLButtonElement[] {
  return [...(root.value?.querySelectorAll<HTMLButtonElement>(".drop button:not(:disabled)") ?? [])];
}
function focusItem(i: number) {
  const list = items();
  if (!list.length) return;
  list[(i + list.length) % list.length]?.focus();
}
function onKey(e: KeyboardEvent) {
  if (!open.value) return;
  const list = items();
  const at = list.indexOf(document.activeElement as HTMLButtonElement);
  const idx = props.menus.findIndex((m) => m.id === open.value);
  if (e.key === "Escape") open.value = null;
  else if (e.key === "ArrowDown") focusItem(at + 1);
  else if (e.key === "ArrowUp") focusItem(at - 1);
  else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    const next = props.menus[(idx + (e.key === "ArrowRight" ? 1 : -1) + props.menus.length) % props.menus.length];
    if (next) {
      open.value = next.id;
      void nextTick(() => focusItem(0));
    }
  } else return;
  e.preventDefault();
  e.stopPropagation();
}
function outside(e: MouseEvent) {
  if (open.value && !root.value?.contains(e.target as Node)) open.value = null;
}
onMounted(() => {
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("mousedown", outside);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey, true);
  window.removeEventListener("mousedown", outside);
});
</script>

<template>
  <nav ref="root" class="menubar" role="menubar">
    <slot name="start" />
    <div v-for="m in menus" :key="m.id" class="menu">
      <button
        class="title"
        :class="{ on: open === m.id }"
        role="menuitem"
        aria-haspopup="true"
        :aria-expanded="open === m.id"
        @click="toggle(m.id)"
        @mouseenter="hover(m.id)"
      >
        {{ m.label }}
      </button>
      <div v-if="open === m.id" class="drop" role="menu">
        <template v-for="(it, k) in m.items" :key="k">
          <hr v-if="it === 'sep'" />
          <button v-else role="menuitem" :disabled="it.disabled" @click="pick(it)">
            <span class="tick">{{ it.checked ? "✓" : "" }}</span>
            <span class="label">{{ it.label }}</span>
            <span class="key">{{ it.shortcut ?? "" }}</span>
          </button>
        </template>
      </div>
    </div>
    <span class="grow" />
    <slot name="end" />
  </nav>
</template>

<style scoped>
.menubar {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 34px;
  padding: 0 8px;
  background: var(--panel);
  border-bottom: 1px solid var(--line);
  font-size: 13px;
}
.menu {
  position: relative;
}
.title {
  border: none;
  background: none;
  padding: 4px 9px;
  border-radius: 5px;
  font: inherit;
  color: var(--ink);
}
.title:hover,
.title.on {
  background: var(--accent-soft);
}
.drop {
  position: absolute;
  top: calc(100% + 3px);
  left: 0;
  z-index: 50;
  min-width: 230px;
  padding: 4px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.18);
}
.drop button {
  display: grid;
  grid-template-columns: 16px 1fr auto;
  gap: 8px;
  width: 100%;
  padding: 5px 8px;
  border: none;
  border-radius: 5px;
  background: none;
  font: inherit;
  color: var(--ink);
  text-align: left;
}
.drop button:hover:not(:disabled),
.drop button:focus-visible {
  background: var(--accent);
  color: #fff;
  outline: none;
}
.drop button:hover:not(:disabled) .key,
.drop button:focus-visible .key {
  color: inherit;
}
.drop button:disabled {
  color: var(--muted);
  opacity: 0.6;
}
.key {
  color: var(--muted);
  font-size: 12px;
}
hr {
  border: none;
  border-top: 1px solid var(--line);
  margin: 4px 2px;
}
.grow {
  flex: 1;
}
</style>
