export interface FrameStats { frames: number; p50: number; p95: number; worst: number; over20ms: number; fps: number }

/** Calls `step(t)` every animation frame for `ms`, measures frame-to-frame time. */
export function runFrames(ms: number, step: (t: number) => void): Promise<FrameStats> {
  return new Promise((resolve) => {
    const deltas: number[] = [];
    let start = -1, last = -1;
    const tick = (now: number) => {
      if (start < 0) start = now;
      else deltas.push(now - last);
      last = now;
      const t = (now - start) / ms;
      if (t >= 1) {
        const s = [...deltas].sort((a, b) => a - b);
        const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0;
        resolve({
          frames: deltas.length,
          p50: +q(0.5).toFixed(2),
          p95: +q(0.95).toFixed(2),
          worst: +(s[s.length - 1] ?? 0).toFixed(2),
          over20ms: deltas.filter((d) => d > 20).length,
          fps: +((deltas.length * 1000) / (now - start)).toFixed(1),
        });
        return;
      }
      step(t);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
