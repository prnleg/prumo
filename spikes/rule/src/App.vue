<script setup lang="ts">
// Spike B viewer. The side controls are developer chrome (English only); everything the product
// would show — cards, summary, footer — goes through i18n.
import { computed, reactive, ref, shallowRef, watch } from "vue";
import { diffFindings, runChecks, type CheckResult } from "./engine";
import { elementLabel, explain, summary, type Ctx } from "./explain";
import { t, type Locale } from "./i18n";
import { SPIKE_PROFILE, sampleModel, type Opening, type Wall } from "./model";
import { RULES } from "./rules";

const model = reactive(sampleModel());
const profile = reactive({ ...SPIKE_PROFILE });
const locale = ref<Locale>("pt-BR");
const hover = ref<string | null>(null);

// ADR-025 (proposed): nothing changes in the panel during a gesture; after the commit, wait a
// settle delay, then show. SETTLE_MS is a spike value (ADR-025 says ~1–2 s, to tune).
const SETTLE_MS = 1200;
const editing = ref(false);
const shown = shallowRef<CheckResult>(runChecks(model, profile, RULES));
const resolved = ref<string[]>([]);
const added = ref<Set<string>>(new Set());
let timer: ReturnType<typeof setTimeout> | undefined;

function commit() {
  editing.value = false;
  clearTimeout(timer);
  timer = setTimeout(() => {
    const next = runChecks(model, profile, RULES);
    const d = diffFindings(shown.value.findings, next.findings);
    const ctx = { model, profile, locale: locale.value };
    resolved.value = d.resolved.map((f) => f.elementIds.map((id) => elementLabel(id, ctx)).join(" / "));
    added.value = new Set(d.added.map((f) => f.fingerprint));
    shown.value = next;
  }, SETTLE_MS);
}
// discrete controls commit at once; sliders commit on release (@change), and mark "editing" on @input
watch(() => [model.walls.map((w) => w.bearing), model.openings.map((o) => !!o.lintel), profile.unmarkedWalls], commit, { deep: true });

const ctx = computed<Ctx>(() => ({ model, profile, locale: locale.value }));
const cards = computed(() => shown.value.findings.map((f) => explain(f, RULES.find((r) => r.id === f.ruleId)!, ctx.value)));
const flagged = computed(() => new Set(shown.value.findings.flatMap((f) => f.elementIds.slice(0, 1))));

const S = 0.1; // px per mm
const PAD = 30;
const openingsOf = (w: Wall) => model.openings.filter((o) => o.host === w.id);
function toggleLintel(o: Opening, on: boolean) {
  o.lintel = on ? { extendsEachSide: 200 } : null; // 200 mm: drawing default only, NOT a recommendation (E-10)
}
</script>

<template>
  <div class="app">
    <aside>
      <h1>Spike B — one rule end to end</h1>
      <label>Language
        <select v-model="locale"><option value="pt-BR">Português (Brasil)</option><option value="en">English</option></select>
      </label>
      <label>Unmarked walls (ADR-017 open — spike toggle)
        <select v-model="profile.unmarkedWalls"><option value="assume-bearing">assume load-bearing (option D)</option><option value="skip">skip them</option></select>
      </label>
      <fieldset v-for="w in model.walls" :key="w.id">
        <legend>{{ elementLabel(w.id, ctx) }}</legend>
        <label>Load-bearing?
          <select v-model="w.bearing"><option value="bearing">yes (marked)</option><option value="non-bearing">no (marked)</option><option value="unmarked">not marked</option></select>
        </label>
        <template v-for="o in openingsOf(w)" :key="o.id">
          <label><input type="checkbox" :checked="!!o.lintel" @change="toggleLintel(o, ($event.target as HTMLInputElement).checked)" /> lintel over {{ elementLabel(o.id, ctx) }}</label>
          <label>{{ elementLabel(o.id, ctx) }} width {{ o.width }} mm
            <input type="range" min="400" :max="w.length - o.offset - 100" step="100" v-model.number="o.width" @input="editing = true" @change="commit" />
          </label>
        </template>
      </fieldset>
      <p class="hint">Findings update {{ SETTLE_MS / 1000 }} s after you stop editing (ADR-025). Dragging a slider never changes the panel mid-gesture.</p>
    </aside>

    <main>
      <section class="elev">
        <svg v-for="w in model.walls" :key="w.id" :width="w.length * S + 2 * PAD" :height="w.height * S + 2 * PAD">
          <g :transform="`translate(${PAD},${PAD})`">
            <rect :width="w.length * S" :height="w.height * S" :class="['wall', w.bearing, { hi: hover === w.id }]" />
            <line x1="-20" :x2="w.length * S + 20" :y1="w.height * S" :y2="w.height * S" class="ground" />
            <g v-for="o in openingsOf(w)" :key="o.id">
              <rect :x="o.offset * S" :y="(w.height - o.sill - o.height) * S" :width="o.width * S" :height="o.height * S" :class="['opening', o.kind, { hi: hover === o.id }]" />
              <rect v-if="o.lintel" class="lintel" :x="(o.offset - o.lintel.extendsEachSide) * S" :y="(w.height - o.sill - o.height - 100) * S" :width="(o.width + 2 * o.lintel.extendsEachSide) * S" :height="100 * S" />
              <g v-if="flagged.has(o.id)" class="badge" :transform="`translate(${(o.offset + o.width) * S},${(w.height - o.sill - o.height) * S})`">
                <circle r="9" /><text y="4">!</text>
              </g>
            </g>
            <text x="4" y="-8" class="cap">{{ elementLabel(w.id, ctx) }} · {{ w.bearing }}</text>
          </g>
        </svg>
      </section>

      <section class="panel" :class="{ dim: editing }">
        <p class="summary">{{ summary(shown, locale) }}</p>
        <p v-for="r in resolved" :key="r" class="resolved">✓ {{ r }}</p>
        <article v-for="c in cards" :key="c.fingerprint" class="card" :class="[c.severity, { fresh: added.has(c.fingerprint) }]">
          <header>
            <span class="sev">{{ c.severityLabel }}</span>
            <b>{{ c.name }}</b>
            <code>{{ c.ruleId }}</code>
            <span v-if="!c.verified" class="unverified">{{ t(locale, "badge.unverified") }}</span>
          </header>
          <p>{{ c.message }}</p>
          <p class="els">{{ t(locale, "card.elements") }}:
            <a v-for="e in c.elements" :key="e.id" href="#" @mouseenter="hover = e.id" @mouseleave="hover = null" @click.prevent>{{ e.label }}</a>
          </p>
          <details>
            <summary>{{ t(locale, "card.assumptions") }} · {{ t(locale, "card.source") }} · {{ t(locale, "card.notConsidered") }}</summary>
            <h4>{{ t(locale, "card.assumptions") }}</h4>
            <ul><li v-for="a in c.assumptions" :key="a.id"><code>{{ a.id }}</code> {{ a.text }}</li></ul>
            <h4>{{ t(locale, "card.confidence") }}</h4>
            <p>{{ c.confidence }}</p>
            <h4>{{ t(locale, "card.source") }}</h4>
            <p>{{ c.source }}</p>
            <h4>{{ t(locale, "card.notConsidered") }}</h4>
            <ul><li v-for="x in c.notConsidered" :key="x">{{ x }}</li></ul>
            <h4>{{ t(locale, "card.terms") }}</h4>
            <ul><li v-for="x in c.terms" :key="x">{{ x }}</li></ul>
          </details>
        </article>
      </section>
    </main>
    <footer>{{ t(locale, "footer") }}</footer>
  </div>
</template>

<style>
html, body, #app { margin: 0; height: 100%; font: 13px system-ui, sans-serif; color: #222; }
.app { display: grid; grid-template: 1fr auto / 300px 1fr; height: 100%; }
aside { padding: 10px; border-right: 1px solid #ccc; overflow: auto; }
aside h1 { font-size: 15px; margin: 0 0 8px; }
aside label { display: block; margin: 6px 0; }
fieldset { margin: 8px 0; }
.hint { color: #555; }
main { overflow: auto; padding: 10px 16px; display: flex; flex-direction: column; gap: 12px; }
.elev { display: flex; flex-wrap: wrap; gap: 8px; }
.elev svg { background: #f7f5f0; }
.wall { fill: #c9c3b6; stroke: #555; }
.wall.non-bearing { fill: #e3dccb; }
.wall.unmarked { fill: #d6d0c4; stroke-dasharray: 4 3; }
.hi { stroke: #2a6fdb !important; stroke-width: 3 !important; }
.opening.window { fill: #dbe8f3; stroke: #555; }
.opening.door { fill: #f7f5f0; stroke: #555; }
.lintel { fill: #8a7f6a; }
.ground { stroke: #555; stroke-width: 2; }
.cap { font-size: 11px; fill: #555; }
.badge circle { fill: #e0a100; }
.badge text { fill: #fff; font-weight: bold; text-anchor: middle; font-size: 12px; }
.panel { max-width: 720px; transition: opacity 0.2s; }
.panel.dim { opacity: 0.55; }
/* no green anywhere: zero findings is neutral grey text (SAFETY) */
.summary { color: #555; }
.resolved { color: #555; margin: 2px 0; }
.card { border: 1px solid #ccc; border-left: 4px solid #999; border-radius: 4px; padding: 8px 12px; margin: 8px 0; background: #fff; }
.card.warning { border-left-color: #e0a100; }
.card.critical { border-left-color: #c43c00; }
.card.fresh { box-shadow: 0 0 0 2px #e0a10055; }
.card header { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.sev { font-weight: 600; color: #8a6200; }
.unverified { font-size: 11px; padding: 1px 5px; border: 1px solid #b35c00; color: #b35c00; border-radius: 3px; }
.els a { margin-right: 8px; }
details h4 { margin: 8px 0 2px; font-size: 12px; }
details ul { margin: 2px 0; padding-left: 18px; }
footer { grid-column: 1 / -1; padding: 4px 10px; font-size: 11px; color: #555; border-top: 1px solid #ddd; }
</style>
