self.addEventListener("message", async (e) => {
  if (!e.data || e.data.type !== "attack") return;
  const res = await self.runAttacks(e.data.secretPath, "iframe");
  parent.postMessage({ type: "attack-result", res }, "*");
});
parent.postMessage(
  {
    type: "frame-ready",
    inv: {
      origin: String(self.origin),
      internals: typeof self.__TAURI_INTERNALS__,
      webkit: typeof (self.webkit && self.webkit.messageHandlers),
      chrome: typeof (self.chrome && self.chrome.webview),
    },
  },
  "*",
);
