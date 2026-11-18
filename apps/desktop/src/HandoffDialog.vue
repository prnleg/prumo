<script setup lang="ts">
// "Hand to…" (ADR-044 slice 3): pass the project to the next person. They get the file however you
// send it (Q-103: email, Drive…); when they open it they can edit, and you can only look + leave notes.
import { computed, nextTick, onMounted, ref } from "vue";
import { translate, type Locale, type Params } from "./i18n";
import { NAME_MAX, cleanName } from "./prefs";

const props = defineProps<{ locale: Locale; name: string | null }>();
const emit = defineEmits<{ send: [from: string, to: string, message: string]; cancel: [] }>();
const t = (k: string, p?: Params) => translate(props.locale, k, p);

const me = ref(props.name ?? "");
const to = ref("");
const message = ref("");
const first = ref<HTMLInputElement>();
const ok = computed(() => {
  const a = cleanName(me.value);
  const b = cleanName(to.value);
  return !!a && !!b && a !== b;
});
onMounted(() => nextTick(() => first.value?.focus()));
function send() {
  const a = cleanName(me.value);
  const b = cleanName(to.value);
  if (a && b && a !== b) emit("send", a, b, message.value.trim());
}
</script>

<template>
  <div class="backdrop" @click.self="emit('cancel')" @keydown.esc="emit('cancel')">
    <section class="card" role="dialog" aria-modal="true" :aria-label="t('handoff.title')">
      <h3>{{ t("handoff.title") }}</h3>
      <p class="lead">{{ t("handoff.lead") }}</p>
      <label v-if="!name">
        {{ t("note.yourName") }}
        <input v-model="me" :maxlength="NAME_MAX" :placeholder="t('note.yourName.placeholder')" />
      </label>
      <label>
        {{ t("handoff.to") }}
        <input ref="first" v-model="to" :maxlength="NAME_MAX" :placeholder="t('handoff.to.placeholder')" />
      </label>
      <label>
        {{ t("handoff.message") }}
        <textarea v-model="message" rows="3" :placeholder="t('handoff.message.placeholder')" />
      </label>
      <p class="after">{{ t("handoff.after") }}</p>
      <footer>
        <button @click="emit('cancel')">{{ t("note.cancel") }}</button>
        <button class="primary" :disabled="!ok" @click="send">{{ t("handoff.send") }}</button>
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
  width: min(380px, calc(100vw - 32px));
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
.lead,
.after {
  margin: 0 0 10px;
  color: var(--muted);
  font-size: 12px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 8px;
}
input,
textarea {
  padding: 4px 6px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--bg);
  color: inherit;
  font: inherit;
  resize: vertical;
}
footer {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
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
  cursor: default;
}
</style>
