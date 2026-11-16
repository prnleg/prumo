<script setup lang="ts">
import { nextTick, onMounted, reactive, ref } from "vue";
import PlanView from "./PlanView.vue";
import Scene3D from "./Scene3D.vue";
import { makeWalls } from "./walls";
import { runFrames, type FrameStats } from "./bench";
import { benchMode, report } from "./platform";

const walls = reactive(makeWalls());
const ready = ref(true);
const plan = ref<InstanceType<typeof PlanView>>();
const scene = ref<InstanceType<typeof Scene3D>>();
const status = ref("");
const results = reactive<Record<string, FrameStats | number | string | object>>({});

async function bench() {
  status.value = "running…";
  const p = plan.value!, s = scene.value!;
  results.panZoom = await runFrames(3000, (t) => p.setView(-2000 + 20000 * t, 62000 - 10000 * t, 0.012 * (1 + 3 * Math.sin(t * Math.PI))));
  p.setView(-2000, 62000, 0.012);
  const w = walls[7]!, ox = w.x1, oy = w.y1;
  p.select(7);
  let prev = 0;
  results.dragWall = await runFrames(3000, (t) => {
    const d = 8000 * Math.sin(t * Math.PI * 2);
    p.moveWall(7, 0, d - prev);
    prev = d;
  });
  p.moveWall(7, ox - w.x1, oy - w.y1);
  results.orbit3D = await runFrames(3000, (t) => s.orbit(t));
  results.three = s.info();
  status.value = "done";
}

async function runBench() {
  await bench();
  await report("BENCH " + JSON.stringify(results));
}

onMounted(() => {
  requestAnimationFrame(async () => {
    const t0 = (window as unknown as { __t0: number }).__t0;
    results.webviewNavToFirstFrameMs = Math.round(performance.now());
    results.scriptToFirstFrameMs = Math.round(performance.now() - t0);
    await report("READY " + JSON.stringify(results));
    const n = await benchMode();
    if (n !== null) {
      if (n !== 15) {
        ready.value = false;
        await nextTick();
        walls.splice(0, walls.length, ...makeWalls(n));
        ready.value = true;
        await nextTick();
      }
      results.walls = walls.length;
      await new Promise((r) => setTimeout(r, 500));
      await bench();
      await report("BENCH " + JSON.stringify(results), true);
    }
  });
});
</script>

<template>
  <header>
    <b>Prumo — Spike D</b> · {{ walls.length }} walls · drag background = pan · wheel = zoom · drag a wall = move it
    <button @click="runBench">Run benchmark</button> <span>{{ status }}</span>
  </header>
  <main>
    <section v-if="ready"><PlanView ref="plan" :walls="walls" /></section>
    <section v-if="ready"><Scene3D ref="scene" :walls="walls" /></section>
  </main>
  <pre v-if="Object.keys(results).length">{{ JSON.stringify(results) }}</pre>
</template>

<style>
html, body, #app { margin: 0; height: 100%; font: 13px system-ui, sans-serif; }
#app { display: flex; flex-direction: column; }
header { padding: 6px 10px; border-bottom: 1px solid #ccc; }
main { flex: 1; display: flex; min-height: 0; }
main section { flex: 1; min-width: 0; border-right: 1px solid #ccc; }
pre { margin: 0; padding: 4px 10px; font-size: 11px; white-space: pre-wrap; max-height: 80px; overflow: auto; }
</style>
