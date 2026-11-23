// A well-behaved add-on on the message API: reads the project it is given, returns a panel described as
// data and a proposed command. It never sees the app, the DOM, or Tauri.
self.onmessage = (e) => {
  const m = e.data;
  if (m.type !== "project") return;
  const walls = Object.values(m.project.elements).filter((x) => x.type === "wall");
  const total = walls.reduce((s, w) => s + Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y), 0);
  self.postMessage({
    type: "panel",
    seq: m.seq,
    panel: {
      title: { key: "walls.title" },
      fields: [
        { kind: "readout", label: { key: "walls.count" }, value: walls.length },
        { kind: "readout", label: { key: "walls.length" }, value: Math.round(total), unit: "mm" },
        { kind: "number", id: "height", label: { key: "walls.height" }, value: 2700, unit: "mm", min: 2000, max: 4000 },
        { kind: "choice", id: "mode", label: { key: "walls.mode" }, value: "a", options: ["a", "b"] },
        { kind: "button", id: "apply", label: { key: "walls.apply" } },
      ],
    },
    propose: { op: "update", ids: walls.slice(0, 1).map((w) => w.id), set: { height: 2700 } },
  });
};
