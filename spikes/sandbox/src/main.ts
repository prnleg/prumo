// Spike F host: runs the attack battery in each sandbox, a runaway add-on, and the message API round trip,
// then prints one JSON report to stdout (via the `report` command) and quits.
import { invoke } from "@tauri-apps/api/core";

type Res = Record<string, unknown>;
const out = document.getElementById("out") as HTMLElement;
const report: Res = { userAgent: navigator.userAgent, origin: location.origin };
const show = () => {
  out.textContent = JSON.stringify(report, null, 2);
  const keys = Object.keys(report);
  void invoke("report", { line: "step: " + keys[keys.length - 1], exit: false });
};
const timeout = <T>(p: Promise<T>, ms: number, what: string) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${what}: no answer in ${ms} ms`)), ms))]);

function askWorker(w: Worker, msg: unknown): Promise<Res> {
  return new Promise((res, rej) => {
    w.onmessage = (e) => res(e.data as Res);
    w.onerror = (e) => rej(new Error(`worker error: ${e.message}`));
    w.postMessage(msg);
  });
}

async function attackWorker(url: string, where: string, secretPath: string) {
  try {
    const w = new Worker(url);
    const r = await timeout(askWorker(w, { secretPath, where }), 8000, where);
    w.terminate();
    return r;
  } catch (e) {
    return { error: String(e) };
  }
}

async function attackFrame(secretPath: string): Promise<Res> {
  void invoke("report", { line: "frame: start", exit: false });
  const f = document.createElement("iframe");
  if (!(await invoke<string>("mode")).includes("nosandbox")) f.setAttribute("sandbox", "allow-scripts");
  f.src = "/frame.html";
  f.style.display = "none";
  const done = new Promise<Res>((res) => {
    window.addEventListener("message", (e) => {
      if (e.source !== f.contentWindow) return;
      if (e.data?.type === "frame-ready") {
        void invoke("report", { line: "frame ready, inventory " + JSON.stringify(e.data.inv), exit: false });
        if (new URLSearchParams(location.search).has("noattack")) res({ inventoryOnly: e.data.inv });
        else f.contentWindow?.postMessage({ type: "attack", secretPath }, "*");
      }
      if (e.data?.type === "progress") void invoke("report", { line: "frame: " + e.data.at, exit: false });
      if (e.data?.type === "attack-result") res(e.data.res as Res);
    });
  });
  document.body.appendChild(f);
  try {
    return await timeout(done, 8000, "iframe");
  } catch (e) {
    return { error: String(e) };
  } finally {
    f.remove();
  }
}

async function runaway(): Promise<Res> {
  const w = new Worker("/loop-worker.js");
  w.postMessage({ type: "go" });
  const t0 = performance.now();
  await new Promise((r) => setTimeout(r, 300));
  const late = performance.now() - t0 - 300;
  w.terminate();
  const t1 = performance.now();
  await new Promise((r) => setTimeout(r, 50));
  return { "main thread late by (ms)": Math.round(late), "after terminate, 50 ms timer took": Math.round(performance.now() - t1) };
}

function project(n: number) {
  const elements: Record<string, unknown> = {};
  for (let i = 0; i < n; i++)
    elements[`w${i}`] = {
      id: `w${i}`,
      type: "wall",
      levelId: "l1",
      start: { x: i * 1000, y: 0 },
      end: { x: i * 1000, y: 3000 },
      thickness: 140,
      height: 2700,
      alignment: "center",
      components: { "org.prumo.architect": { v: 1, data: { finishes: { left: "paint-white" } } } },
    };
  return { id: "p", levels: [{ id: "l1" }], elements };
}

async function roundTrip(n: number): Promise<Res> {
  const w = new Worker("/addon-walls.js");
  const p = project(n);
  const times: number[] = [];
  let last: Res = {};
  for (let i = 0; i < 7; i++) {
    const t0 = performance.now();
    last = await askWorker(w, { type: "project", seq: i, project: p });
    times.push(performance.now() - t0);
  }
  w.terminate();
  times.sort((a, b) => a - b);
  return { elements: n, "median ms": +(times[3] ?? 0).toFixed(2), "max ms": +(times[6] ?? 0).toFixed(2), sample: n === 200 ? last : undefined };
}

async function main() {
  const secretPath = await invoke<string>("secret_path");
  report.secretPath = secretPath;
  report.control = await invoke("canary", { from: "main-window-control" });
  show();
  report["worker (same-origin file)"] = await attackWorker("/attack-worker.js", "worker-file", secretPath);
  show();
  const blob = new Blob(
    [
      `importScripts(${JSON.stringify(location.origin + "/attacks.js")});` +
        `self.onmessage = async (e) => self.postMessage(await self.runAttacks(e.data.secretPath, e.data.where));`,
    ],
    { type: "text/javascript" },
  );
  report["worker (blob)"] = await attackWorker(URL.createObjectURL(blob), "worker-blob", secretPath);
  show();
  const mode = await invoke<string>("mode");
  if (!mode.includes("noframe")) {
    report["iframe sandbox=allow-scripts"] = await attackFrame(secretPath);
    show();
  }
  report.runaway = await runaway();
  report.roundTrip = [await roundTrip(200), await roundTrip(5000)];
  await new Promise((r) => setTimeout(r, 800));
  const count = await invoke<number>("canary_count");
  report["canary hits from add-ons (count - 1 control)"] = count - 1;
  show();
  const stay = new URLSearchParams(location.search).has("stay");
  await invoke("report", { line: "SPIKE-F-REPORT " + JSON.stringify(report), exit: !stay });
}

main().catch(async (e) => {
  report.fatal = String(e);
  show();
  await invoke("report", { line: "SPIKE-F-REPORT " + JSON.stringify(report), exit: true });
});
