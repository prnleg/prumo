<script setup lang="ts">
// Start screen (Q-119/Q-125): blank, examples, or open a file. Shown at launch and on New.
import { counterIds, type Wall } from "@prumo/core";
import { SYSTEMS, type ConstructionSystem } from "@prumo/module-structural";
import { computed, ref } from "vue";
import { EXAMPLES, type Example } from "./examples";
import { translate, type Locale, type Params } from "./i18n";

const props = defineProps<{ locale: Locale; closable: boolean }>();
const emit = defineEmits<{ blank: [system: ConstructionSystem]; example: [ex: Example]; open: []; close: [] }>();
/** Blank → first ask the construction system (engineer E-01: ask up front, with "don't know"). */
const pickSystem = ref(false);
const t = (key: string, params?: Params) => translate(props.locale, key, params);

/** Tiny wall-line thumbnails (model Y up → SVG Y down). */
const previews = computed(() =>
  EXAMPLES.map((ex) => {
    const p = ex.build({ ids: counterIds("p"), t: (k) => k, now: "", profileId: "" });
    const walls = Object.values(p.elements).filter((e): e is Wall => e.type === "wall");
    const xs = walls.flatMap((w) => [w.start.x, w.end.x]);
    const ys = walls.flatMap((w) => [w.start.y, w.end.y]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const pad = 600;
    return {
      ex,
      viewBox: `${x0 - pad} ${-y1 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`,
      lines: walls.map((w) => ({ x1: w.start.x, y1: -w.start.y, x2: w.end.x, y2: -w.end.y, id: w.id })),
    };
  }),
);
</script>

<template>
  <div class="backdrop" @keydown.esc="closable && emit('close')">
    <section class="card" role="dialog" aria-modal="true" :aria-label="t('start.title')">
      <header>
        <h2>{{ t("start.title") }}</h2>
        <button
          v-if="closable"
          class="x"
          :aria-label="t('start.close')"
          :title="t('start.close')"
          @click="emit('close')"
        >
          ×
        </button>
      </header>
      <div v-if="pickSystem" class="system">
        <h3>{{ t("start.system.title") }}</h3>
        <p class="note">{{ t("start.system.why") }}</p>
        <div class="choices">
          <button v-for="s in SYSTEMS" :key="s" class="choice" @click="emit('blank', s)">
            <strong>{{ t(`system.${s}`) }}</strong>
            <span>{{ t(`system.${s}.desc`) }}</span>
          </button>
        </div>
        <footer>
          <button @click="pickSystem = false">{{ t("start.system.back") }}</button>
        </footer>
      </div>
      <div v-else class="choices">
        <button class="choice" @click="pickSystem = true">
          <svg viewBox="0 0 100 70" class="thumb" aria-hidden="true">
            <rect x="20" y="15" width="60" height="40" rx="2" class="dash" />
            <text x="50" y="40" text-anchor="middle">+</text>
          </svg>
          <strong>{{ t("start.blank") }}</strong>
          <span>{{ t("start.blank.desc") }}</span>
        </button>
        <button v-for="pv in previews" :key="pv.ex.id" class="choice" @click="emit('example', pv.ex)">
          <svg :viewBox="pv.viewBox" class="thumb" aria-hidden="true">
            <line v-for="l in pv.lines" :key="l.id" v-bind="l" class="wall" />
          </svg>
          <strong>{{ t(pv.ex.title) }}</strong>
          <span>{{ t(pv.ex.description) }}</span>
        </button>
      </div>
      <p v-if="!pickSystem" class="note">{{ t("start.examples.note") }}</p>
      <footer v-if="!pickSystem">
        <button @click="emit('open')">{{ t("start.open") }}</button>
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
  width: min(720px, 100%);
  max-height: 100%;
  overflow: auto;
  padding: 16px 20px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  box-shadow: 0 6px 30px rgb(0 0 0 / 25%);
}
header {
  display: flex;
  align-items: center;
}
h2 {
  margin: 0;
  flex: 1;
  font-size: 18px;
}
.x {
  border: none;
  background: none;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  color: var(--muted);
}
.choices {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 12px;
  margin: 14px 0 8px;
}
.choice {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 10px;
  text-align: left;
  font: inherit;
  color: inherit;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 8px;
  cursor: pointer;
}
.choice:hover,
.choice:focus-visible {
  border-color: var(--accent);
}
.choice span {
  font-size: 12px;
  color: var(--muted);
}
.thumb {
  width: 100%;
  height: 90px;
  background: var(--plan-bg);
  border-radius: 4px;
}
.wall {
  stroke: var(--ink);
  stroke-width: 160;
  stroke-linecap: square;
}
.dash {
  fill: none;
  stroke: var(--muted);
  stroke-dasharray: 4 3;
}
.thumb text {
  fill: var(--muted);
  font-size: 20px;
}
.system h3 {
  margin: 14px 0 2px;
  font-size: 15px;
}
.note {
  font-size: 12px;
  color: var(--muted);
  margin: 4px 0 10px;
}
footer {
  display: flex;
  justify-content: flex-end;
}
footer button {
  padding: 4px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  color: inherit;
  cursor: pointer;
}
</style>
