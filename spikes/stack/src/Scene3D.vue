<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Wall } from "./walls";

const props = defineProps<{ walls: Wall[] }>();
const host = ref<HTMLDivElement>();
let renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, scene: THREE.Scene, controls: OrbitControls;
let raf = 0, ro: ResizeObserver;
const center = new THREE.Vector3(30, 0, -30);

onMounted(() => {
  const el = host.value!;
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  el.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdfe6ec);
  camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(30, 55, 40);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(center);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x888877, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(40, 80, 20);
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshLambertMaterial({ color: 0xc9c2b2 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.copy(center);
  scene.add(ground);
  // One mesh per wall (naive on purpose: it's what a first implementation would do).
  const mat = new THREE.MeshLambertMaterial({ color: 0xf0ede6 });
  for (const w of props.walls) {
    const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) / 1000;
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, w.height / 1000, w.thickness / 1000), mat);
    // model (x, y) → three (x, -z); Y up in three = height
    m.position.set((w.x1 + w.x2) / 2000, w.height / 2000, -(w.y1 + w.y2) / 2000);
    m.rotation.y = Math.atan2(w.y2 - w.y1, w.x2 - w.x1);
    scene.add(m);
  }
  const resize = () => {
    const { clientWidth: cw, clientHeight: ch } = el;
    renderer.setSize(cw, ch);
    camera.aspect = cw / Math.max(ch, 1);
    camera.updateProjectionMatrix();
  };
  ro = new ResizeObserver(resize);
  ro.observe(el);
  resize();
  const loop = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); };
  loop();
});
onBeforeUnmount(() => { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); });

function orbit(t: number) {
  const a = t * Math.PI * 2;
  camera.position.set(center.x + 60 * Math.cos(a), 45, center.z + 60 * Math.sin(a));
  camera.lookAt(center);
}
defineExpose({ orbit, info: () => ({ drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles }) });
</script>

<template><div ref="host" class="scene" /></template>

<style scoped>
.scene { width: 100%; height: 100%; overflow: hidden; }
</style>
