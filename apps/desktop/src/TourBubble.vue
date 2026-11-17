<script setup lang="ts">
// Guided tour (Q-080 default: skippable, Phase 1). A bubble points at one toolbar control at a time
// (elements marked `data-tour="<id>"`). Not modal: the plan stays usable; never shown during a gesture
// (it only opens at launch / from Settings, ADR-025). Esc / Skip ends it.
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { translate, type Locale, type Params } from "./i18n";

export interface TourStep {
  /** `data-tour` value of the control to point at. */
  target: string;
  /** i18n keys */
  title: string;
  text: string;
}

const props = defineProps<{ locale: Locale; steps: readonly TourStep[] }>();
const emit = defineEmits<{ done: [] }>();
const t = (key: string, params?: Params) => translate(props.locale, key, params);

const i = ref(0);
const step = computed(() => props.steps[i.value] ?? null);
const rect = ref<DOMRect | null>(null);
const BUBBLE_W = 300;

function measure() {
  const s = step.value;
  const el = s ? document.querySelector(`[data-tour="${s.target}"]`) : null;
  rect.value = el ? el.getBoundingClientRect() : null;
}
watch(i, measure);
watch(
  () => props.locale,
  () => setTimeout(measure, 0),
); // labels change width
onMounted(() => {
  measure();
  window.addEventListener("resize", measure);
});
onBeforeUnmount(() => window.removeEventListener("resize", measure));

const pos = computed(() => {
  const r = rect.value;
  if (!r) return { left: "50%", top: "80px", transform: "translateX(-50%)" };
  const left = Math.max(8, Math.min(window.innerWidth - BUBBLE_W - 8, r.left + r.width / 2 - BUBBLE_W / 2));
  return { left: `${left}px`, top: `${r.bottom + 10}px` };
});
const ring = computed(() => {
  const r = rect.value;
  return r
    ? { left: `${r.left - 3}px`, top: `${r.top - 3}px`, width: `${r.width + 6}px`, height: `${r.height + 6}px` }
    : null;
});

function next() {
  if (i.value < props.steps.length - 1) i.value++;
  else emit("done");
}
</script>

<template>
  <div v-if="step" class="tour" @keydown.esc="emit('done')">
    <div v-if="ring" class="ring" :style="ring" aria-hidden="true" />
    <section class="bubble" :style="pos" role="dialog" :aria-label="t('tour.title')">
      <p class="count">{{ t("tour.count", { n: i + 1, total: steps.length }) }}</p>
      <h3>{{ t(step.title) }}</h3>
      <p>{{ t(step.text) }}</p>
      <footer>
        <button class="skip" @click="emit('done')">{{ t("tour.skip") }}</button>
        <span class="grow" />
        <button v-if="i > 0" @click="i--">{{ t("tour.back") }}</button>
        <button class="primary" @click="next">
          {{ i < steps.length - 1 ? t("tour.next") : t("tour.finish") }}
        </button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.ring {
  position: fixed;
  border: 2px solid var(--accent);
  border-radius: 8px;
  pointer-events: none;
  z-index: 30;
  box-shadow: 0 0 0 4px rgb(0 0 0 / 15%);
}
.bubble {
  position: fixed;
  width: 300px;
  max-width: calc(100vw - 16px);
  padding: 12px 14px;
  background: var(--panel);
  border: 1px solid var(--accent);
  border-radius: 10px;
  box-shadow: 0 6px 24px rgb(0 0 0 / 25%);
  z-index: 30;
  font-size: 13px;
}
.count {
  margin: 0;
  font-size: 11px;
  color: var(--muted);
}
h3 {
  margin: 2px 0 6px;
  font-size: 15px;
}
p {
  margin: 0 0 8px;
}
footer {
  display: flex;
  align-items: center;
  gap: 6px;
}
.grow {
  flex: 1;
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
button.skip {
  border: none;
  color: var(--muted);
  padding-left: 0;
}
</style>
