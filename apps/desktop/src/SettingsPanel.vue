<script setup lang="ts">
// Settings (UX_PRINCIPLES 3b: discoverable; opened from the toolbar or by clicking the status bar).
// Grid = this project's value (saved with it, undoable; Q-108 "Project → Drawing").
// Angle step + language = app preferences, remembered across launches (ADR-037, prefs.ts).
import { SYSTEMS, type ConstructionSystem } from "@prumo/module-structural";
import { computed } from "vue";
import { formatSmall, translate, type Locale, type Params } from "./i18n";
import { ANGLE_CHOICES, GRID_CHOICES } from "./settings";
import { NAME_MAX, cleanName } from "./prefs";

const props = defineProps<{
  locale: Locale;
  grid: number;
  angle: number;
  outsideFaces: boolean;
  system: ConstructionSystem;
  structural: boolean;
  /** Your name on notes (ADR-044), or null when not set yet. */
  name: string | null;
}>();
const emit = defineEmits<{
  grid: [mm: number];
  angle: [deg: number];
  outsideFaces: [on: boolean];
  system: [s: ConstructionSystem];
  structural: [on: boolean];
  name: [name: string];
  locale: [l: Locale];
  tour: [];
  close: [];
}>();
const t = (key: string, params?: Params) => translate(props.locale, key, params);
/** Keep an odd grid from an opened file selectable. */
const grids = computed(() => [...new Set([...GRID_CHOICES, props.grid])].sort((a, b) => a - b));
function onName(ev: Event) {
  const n = cleanName((ev.target as HTMLInputElement).value);
  if (n) emit("name", n);
}
</script>

<template>
  <div class="backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
    <section class="card" role="dialog" aria-modal="true" :aria-label="t('settings.title')">
      <h2>{{ t("settings.title") }}</h2>
      <h3>{{ t("settings.drawing") }}</h3>
      <label :title="t('settings.grid.tip')">
        <span>{{ t("settings.grid") }}</span>
        <select :value="grid" @change="emit('grid', Number(($event.target as HTMLSelectElement).value))">
          <option v-for="g in grids" :key="g" :value="g">{{ formatSmall(g, locale) }}</option>
        </select>
      </label>
      <p class="tip">{{ t("settings.grid.tip") }}</p>
      <label :title="t('settings.angle.tip')">
        <span>{{ t("settings.angle") }}</span>
        <select :value="angle" @change="emit('angle', Number(($event.target as HTMLSelectElement).value))">
          <option v-for="a in ANGLE_CHOICES" :key="a" :value="a">{{ a }}°</option>
        </select>
      </label>
      <p class="tip">{{ t("settings.angle.tip") }}</p>
      <label class="check">
        <input
          type="checkbox"
          :checked="outsideFaces"
          @change="emit('outsideFaces', ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ t("settings.outsideFaces") }}</span>
      </label>
      <p class="tip">{{ t("settings.outsideFaces.tip") }}</p>
      <h3>{{ t("settings.project") }}</h3>
      <label>
        <span>{{ t("settings.system") }}</span>
        <select
          :value="system"
          @change="emit('system', ($event.target as HTMLSelectElement).value as ConstructionSystem)"
        >
          <option v-for="s in SYSTEMS" :key="s" :value="s">{{ t(`system.${s}`) }}</option>
        </select>
      </label>
      <p class="tip">{{ t("settings.system.tip") }}</p>
      <h3>{{ t("settings.modules") }}</h3>
      <label class="check">
        <input type="checkbox" checked disabled />
        <span>{{ t("module.architect.name") }} · {{ t("settings.modules.required") }}</span>
      </label>
      <label class="check">
        <input
          type="checkbox"
          :checked="structural"
          @change="emit('structural', ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ t("module.structural.name") }}</span>
      </label>
      <p class="tip">{{ t("settings.modules.tip") }}</p>
      <h3>{{ t("settings.you") }}</h3>
      <label :title="t('note.yourName.tip')">
        {{ t("note.yourName") }}
        <input
          :value="name ?? ''"
          :maxlength="NAME_MAX"
          :placeholder="t('note.yourName.placeholder')"
          @change="onName"
        />
      </label>
      <h3>{{ t("settings.language") }}</h3>
      <label>
        <span>{{ t("settings.language") }}</span>
        <select
          :value="locale"
          aria-label="Language"
          @change="emit('locale', ($event.target as HTMLSelectElement).value as Locale)"
        >
          <option value="pt-BR">Português (Brasil)</option>
          <option value="en">English</option>
        </select>
      </label>
      <p class="tip">{{ t("settings.remembered") }}</p>
      <h3>{{ t("settings.help") }}</h3>
      <button class="plain" @click="emit('tour')">{{ t("settings.tour") }}</button>
      <footer>
        <button @click="emit('close')">{{ t("settings.close") }}</button>
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
  background: rgb(0 0 0 / 25%);
  z-index: 10;
  padding: 16px;
}
.card {
  width: min(380px, 100%);
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
h3 {
  margin: 14px 0 4px;
  font-size: 13px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin: 6px 0 2px;
}
label.check {
  justify-content: flex-start;
}
select {
  font: inherit;
  color: inherit;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 2px 4px;
}
.tip {
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--muted);
}
button.plain {
  padding: 3px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--bg);
  color: inherit;
  cursor: pointer;
  font: inherit;
}
footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
footer button {
  padding: 4px 14px;
  border: 1px solid var(--accent);
  border-radius: 6px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
}
</style>
