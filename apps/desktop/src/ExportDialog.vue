<script setup lang="ts">
// "Export picture or PDF" (ADR-056): format, paper, scale, with a live preview of the sheet.
import { PAPERS, SCALES, type Paper } from "@prumo/module-export";
import { nextTick, onMounted, ref, watch } from "vue";
import { translate, type Locale, type Params } from "./i18n";

export interface ExportOptions {
  format: "pdf" | "png";
  paper: Paper;
  scale: number | "fit";
  /** PDF only: this floor or every floor (one page each). */
  floors: "this" | "all";
  /** Structure-check marks on the plan (+ a notes page in a PDF). */
  marks: boolean;
}

const props = defineProps<{
  locale: Locale;
  floor: string;
  /** How many floors the project has. */
  floorCount: number;
  /** Structure checks on? (the marks option) */
  structure: boolean;
  /** Draws the sheet on `canvas` at `px` pixels per mm; returns the scale used and whether the plan fits. */
  draw: (canvas: HTMLCanvasElement, o: ExportOptions, px: number) => { scale: number; fits: boolean } | null;
}>();
const emit = defineEmits<{ export: [o: ExportOptions]; cancel: [] }>();
const t = (k: string, p?: Params) => translate(props.locale, k, p);

const format = ref<ExportOptions["format"]>("pdf");
const paper = ref<Paper>("a4");
const scale = ref<number | "fit">("fit");
const floors = ref<ExportOptions["floors"]>("this");
const marks = ref(false);
const preview = ref<HTMLCanvasElement>();
const result = ref<{ scale: number; fits: boolean } | null>(null);
const busy = ref(false);

function redraw() {
  const c = preview.value;
  if (!c) return;
  // preview: ~1.6 px per mm (A4 ≈ 475 px wide)
  const px = 460 / PAPERS[paper.value].w;
  result.value = props.draw(c, opts(), px);
}
const opts = (): ExportOptions => ({
  format: format.value,
  paper: paper.value,
  scale: scale.value,
  floors: format.value === "pdf" ? floors.value : "this",
  marks: props.structure && marks.value,
});
onMounted(() => nextTick(redraw));
watch([paper, scale, marks], redraw);

async function go() {
  busy.value = true;
  emit("export", opts());
}
</script>

<template>
  <div class="backdrop" @click.self="emit('cancel')" @keydown.esc="emit('cancel')">
    <section class="card" role="dialog" aria-modal="true" :aria-label="t('export.title')">
      <h3>{{ t("export.title") }}</h3>
      <p class="muted">{{ t("export.floor", { floor }) }}</p>
      <canvas ref="preview" class="preview" />
      <div class="row">
        <label>
          {{ t("export.format") }}
          <select v-model="format">
            <option value="pdf">PDF</option>
            <option value="png">{{ t("export.png") }}</option>
          </select>
        </label>
        <label>
          {{ t("export.paper") }}
          <select v-model="paper">
            <option value="a4">A4</option>
            <option value="a3">A3</option>
          </select>
        </label>
        <label :title="t('export.scale.tip')">
          {{ t("export.scale") }}
          <select v-model="scale">
            <option value="fit">{{ t("export.scale.fit") }}</option>
            <option v-for="n in SCALES" :key="n" :value="n">1:{{ n }}</option>
          </select>
        </label>
      </div>
      <div class="row checks">
        <label v-if="format === 'pdf' && props.floorCount > 1" class="check">
          <input v-model="floors" type="checkbox" true-value="all" false-value="this" />
          {{ t("export.allFloors", { count: props.floorCount }) }}
        </label>
        <label v-if="structure" class="check" :title="t('export.marks.tip')">
          <input v-model="marks" type="checkbox" />
          {{ t("export.marks") }}
        </label>
      </div>
      <p v-if="result" class="muted">
        {{ t("export.scaleUsed", { n: result.scale }) }}
        <span v-if="!result.fits" class="warn">· {{ t("export.noFit") }}</span>
      </p>
      <footer>
        <button @click="emit('cancel')">{{ t("note.cancel") }}</button>
        <button class="primary" :disabled="busy" @click="go">{{ t("export.save") }}</button>
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
  padding: 14px 16px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgb(0 0 0 / 30%);
  font-size: 13px;
}
h3 {
  margin: 0 0 4px;
}
.muted {
  color: var(--muted);
  margin: 4px 0 8px;
}
.warn {
  color: var(--warn);
}
.preview {
  display: block;
  max-width: 100%;
  margin: 4px auto 10px;
  border: 1px solid var(--line);
  box-shadow: 0 1px 4px rgb(0 0 0 / 15%);
}
.row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.checks {
  margin-top: 8px;
}
label.check {
  flex-direction: row;
  align-items: center;
  gap: 6px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
select {
  padding: 3px 6px;
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
  margin-top: 10px;
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
}
</style>
