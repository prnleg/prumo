<script setup lang="ts">
// Structural checks panel (Phase 2). SAFETY_AND_LIABILITY: shows what was checked AND what wasn't, never
// a green / "OK" state; every card carries its assumptions, review level (ADR-041) and source.
// Quiet while creating (ADR-025): the parent only refreshes the result after an edit has settled.
import type { Project } from "@prumo/core";
import { NOT_CHECKED, UNSOURCED, type CheckResult, type FindingsDiff } from "@prumo/module-structural";
import { computed, ref } from "vue";
import { translate, type Locale, type Params } from "./i18n";
import { cards, findingText } from "./structural-ui";

const props = defineProps<{
  locale: Locale;
  project: Project;
  result: CheckResult;
  diff: FindingsDiff | null;
  /** When "the existing building" was marked (ISO), or null (ADR-043). */
  baseline: string | null;
}>();
const emit = defineEmits<{ select: [ids: string[]]; system: []; mark: []; clearBaseline: [] }>();
const when = (iso: string) => new Date(iso).toLocaleString(props.locale, { dateStyle: "medium", timeStyle: "short" });
const t = (key: string, params?: Params) => translate(props.locale, key, params);

const open = ref(true);
const list = computed(() => cards(props.result.checksRun, props.result.findings, props.project, props.locale));
const count = computed(() => props.result.findings.length);
</script>

<template>
  <section class="checks" :class="{ closed: !open }" :aria-label="t('checks.title')">
    <header>
      <button class="toggle" :aria-expanded="open" @click="open = !open">
        {{ open ? "▾" : "▸" }} {{ t("checks.title") }}
        <span class="count" :class="{ some: count > 0 }">{{ t("checks.count", { count }) }}</span>
      </button>
      <span v-if="diff && (diff.added.length || diff.resolved.length)" class="diff">
        <span v-if="diff.added.length">{{ t("checks.diff.added", { count: diff.added.length }) }}</span>
        <span v-if="diff.resolved.length">{{ t("checks.diff.resolved", { count: diff.resolved.length }) }}</span>
      </span>
    </header>
    <div v-if="open" class="body">
      <p class="system">
        {{ t("checks.system", { system: t(`system.${result.system}`) }) }}
        <button class="link" @click="emit('system')">{{ t("checks.system.change") }}</button>
      </p>
      <p v-if="!result.checksRun.length && !result.needBaseline.length" class="empty">
        {{ t("checks.noneForSystem") }}
      </p>
      <div v-if="result.needBaseline.length" class="baseline">
        <p>{{ t("checks.baseline.need", { count: result.needBaseline.length }) }}</p>
        <button @click="emit('mark')">{{ t("checks.baseline.mark") }}</button>
      </div>
      <div v-else-if="baseline" class="baseline">
        <p>{{ t("checks.baseline.on", { date: when(baseline) }) }}</p>
        <button @click="emit('mark')">{{ t("checks.baseline.again") }}</button>
        <button @click="emit('clearBaseline')">{{ t("checks.baseline.clear") }}</button>
      </div>
      <article v-for="c in list" :key="c.rule.id" class="card" :class="c.severity">
        <h4>
          <span class="sev">{{ t(`severity.${c.severity}`) }}</span>
          {{ t(c.rule.nameKey) }}
          <span class="rid">{{ c.rule.id }}</span>
        </h4>
        <ul>
          <li v-for="f in c.findings" :key="f.fingerprint">
            <button class="link" @click="emit('select', f.elementIds)">{{ findingText(f, project, locale) }}</button>
          </li>
        </ul>
        <p v-for="a in c.assumptions" :key="a" class="assume">{{ t("checks.assumption") }}: {{ a }}</p>
        <details>
          <summary>{{ t("checks.details") }}</summary>
          <p>{{ t(`review.${c.rule.review.level}`) }}</p>
          <p>
            {{ t("checks.source") }}:
            {{ c.rule.source === UNSOURCED ? t("checks.source.none") : c.rule.source }}
          </p>
          <p>{{ t("checks.confidence") }}: {{ t(`confidence.${c.rule.confidence}`) }}</p>
          <p>{{ t("checks.notConsidered") }}:</p>
          <ul>
            <li v-for="k in c.rule.notConsidered" :key="k">{{ t(k) }}</li>
          </ul>
        </details>
      </article>
      <details class="scope">
        <summary>{{ t("checks.scope", { count: result.checksRun.length }) }}</summary>
        <p class="h">{{ t("checks.checked") }}</p>
        <ul>
          <li v-for="r in result.checksRun" :key="r.id">{{ t(r.nameKey) }} — {{ t(`review.${r.review.level}`) }}</li>
        </ul>
        <p class="h">{{ t("checks.notChecked") }}</p>
        <ul>
          <li v-for="r in result.needBaseline" :key="r.id">{{ t(r.nameKey) }} — {{ t("checks.needsBaseline") }}</li>
          <li v-for="k in NOT_CHECKED" :key="k">{{ t(k) }}</li>
        </ul>
      </details>
      <p class="disclaimer">{{ t("checks.disclaimer") }}</p>
    </div>
  </section>
</template>

<style scoped>
.checks {
  position: absolute;
  left: 12px;
  bottom: 44px;
  width: min(360px, calc(100% - 24px));
  max-height: 55%;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 2px 12px rgb(0 0 0 / 15%);
  font-size: 13px;
  z-index: 4;
}
header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
}
.toggle {
  border: none;
  background: none;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}
.count {
  font-weight: 400;
  color: var(--muted);
  margin-left: 4px;
}
.count.some {
  color: var(--warn);
}
.diff {
  display: flex;
  gap: 6px;
  font-size: 12px;
  color: var(--muted);
}
.body {
  overflow: auto;
  padding: 0 10px 8px;
}
.system,
.empty,
.disclaimer {
  margin: 4px 0;
  color: var(--muted);
  font-size: 12px;
}
.baseline {
  margin: 6px 0;
  padding: 6px 8px;
  border: 1px dashed var(--line);
  border-radius: 6px;
  font-size: 12px;
}
.baseline p {
  margin: 0 0 6px;
}
.baseline button {
  margin-right: 6px;
  padding: 2px 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  color: inherit;
  cursor: pointer;
  font: inherit;
}
.card {
  border-left: 3px solid var(--muted);
  padding: 4px 8px;
  margin: 8px 0;
  background: var(--bg);
  border-radius: 4px;
}
.card.critical {
  border-left-color: #d64545;
}
.card.warning {
  border-left-color: var(--warn);
}
.card.advisory {
  border-left-color: #5b8bd6;
}
h4 {
  margin: 2px 0 4px;
  font-size: 13px;
}
.sev {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--muted);
  margin-right: 4px;
}
.rid {
  font-weight: 400;
  font-size: 11px;
  color: var(--muted);
  margin-left: 4px;
}
ul {
  margin: 2px 0;
  padding-left: 16px;
}
.card ul {
  list-style: none;
  padding-left: 0;
}
.card li {
  margin: 3px 0;
}
.assume {
  margin: 4px 0;
  font-size: 12px;
  color: var(--muted);
}
details {
  margin: 4px 0;
  font-size: 12px;
}
details p {
  margin: 2px 0;
}
.scope .h {
  font-weight: 600;
  margin-top: 6px;
}
button.link {
  border: none;
  background: none;
  padding: 0;
  color: inherit;
  text-align: left;
  cursor: pointer;
  text-decoration: underline dotted;
  font: inherit;
}
</style>
