// Crash log (ADR-028 v1, owner 2026-11-17: "easy and direct"): errors are written to a local log in
// Prumo's app-data folder; the user can report one on GitHub with a pre-filled issue. Nothing is sent
// automatically. Entries carry app version, OS, module versions, message and stack — never project
// content, file names or paths (scrubbed here). Framework-free, unit-tested.

export const CRASH_LOG_FILE = "crash-log.jsonl";
export const CRASH_LOG_MAX = 50; // newest kept; older lines dropped
export const ISSUES_URL = "https://github.com/prnleg/prumo/issues/new";
const MAX_TEXT = 4000;

export interface CrashEntry {
  at: string;
  kind: "error" | "rejection" | "vue";
  message: string;
  stack: string;
  version: string;
  os: string;
  modules: string[];
}

/**
 * Remove anything that could name the user or their files: absolute paths (macOS/Linux/Windows,
 * file:// URLs), `.prumo` file names, e-mail addresses. App-bundle URLs (tauri://, http://localhost)
 * stay: they point into Prumo's own code, which is what a stack trace is for.
 */
export function scrub(text: string): string {
  return text
    .replace(/file:\/\/\/?[^\s)"'`]+/gi, "<path>")
    .replace(/\b[A-Za-z]:\\[^\s)"'`]*/g, "<path>")
    .replace(/(^|[\s("'`=])\/(?:Users|home|var|private|tmp|Volumes|mnt|opt|root)\/[^\s)"'`]*/g, "$1<path>")
    .replace(/~\/[^\s)"'`]*/g, "<path>")
    .replace(/[^\s/\\"'`()]+\.prumo\b/gi, "<file>.prumo")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "<email>")
    .slice(0, MAX_TEXT);
}

export function osName(userAgent: string): string {
  if (/Windows/i.test(userAgent)) return "Windows";
  if (/Mac OS X|Macintosh/i.test(userAgent)) return "macOS";
  if (/Linux/i.test(userAgent)) return "Linux";
  return "unknown";
}

export function makeEntry(
  err: unknown,
  kind: CrashEntry["kind"],
  ctx: { now: string; version: string; os: string; modules: string[] },
): CrashEntry {
  const e = err instanceof Error ? err : null;
  const message = e ? `${e.name}: ${e.message}` : typeof err === "string" ? err : safeString(err);
  return {
    at: ctx.now,
    kind,
    message: scrub(message),
    stack: scrub(e?.stack ?? ""),
    version: ctx.version,
    os: ctx.os,
    modules: [...ctx.modules].sort(),
  };
}

function safeString(v: unknown): string {
  try {
    return JSON.stringify(v) ?? String(v);
  } catch {
    return String(v);
  }
}

/** Append one entry to the JSON-lines log, keeping the newest `max`. Unreadable lines are dropped. */
export function appendEntry(log: string | null, entry: CrashEntry, max = CRASH_LOG_MAX): string {
  const lines = (log ?? "").split("\n").filter((l) => {
    if (!l.trim()) return false;
    try {
      JSON.parse(l);
      return true;
    } catch {
      return false;
    }
  });
  lines.push(JSON.stringify(entry));
  return lines.slice(-max).join("\n") + "\n";
}

/** GitHub "new issue" link with the entry pre-filled (the user reviews it before submitting). */
export function issueUrl(entry: CrashEntry): string {
  const title = `Crash: ${entry.message}`.slice(0, 120);
  const body = [
    "**What were you doing when this happened?**",
    "",
    "<!-- e.g. dragging a wall, saving a file -->",
    "",
    "**Details** (filled in by Prumo; file names and paths removed)",
    "",
    `- Prumo ${entry.version} on ${entry.os}`,
    `- Modules: ${entry.modules.join(", ") || "none"}`,
    `- When: ${entry.at} (${entry.kind})`,
    "",
    "```",
    entry.message,
    entry.stack.slice(0, 2500),
    "```",
  ].join("\n");
  return `${ISSUES_URL}?${new URLSearchParams({ title, body }).toString()}`;
}
