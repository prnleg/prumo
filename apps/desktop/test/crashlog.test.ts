import { describe, expect, it } from "vitest";
import { appendEntry, issueUrl, makeEntry, osName, scrub } from "../src/crashlog";

const ctx = { now: "2026-11-17T12:00:00.000Z", version: "0.1.0", os: "macOS", modules: ["org.prumo.architect@0.1.0"] };

describe("crash log (ADR-028 v1)", () => {
  it("scrubs paths, file names and e-mails; keeps app-bundle stack frames", () => {
    expect(scrub("failed: /Users/ana/Projetos/casa praia.prumo")).toBe("failed: <path> <file>.prumo");
    expect(scrub("open C:\\Users\\Ana\\Desktop\\x.prumo failed")).toBe("open <path> failed");
    expect(scrub("at file:///home/joe/app.js:1:2")).toBe("at <path>");
    expect(scrub("saved casa.prumo ok")).toBe("saved <file>.prumo ok");
    expect(scrub("by ana.silva@example.com")).toBe("by <email>");
    expect(scrub("at move (tauri://localhost/assets/index-ab12.js:10:5)")).toBe(
      "at move (tauri://localhost/assets/index-ab12.js:10:5)",
    );
    expect(scrub("x".repeat(5000))).toHaveLength(4000);
  });

  it("entries from Errors, strings and odd values", () => {
    const e = makeEntry(new TypeError("bad /Users/ana/x.prumo"), "error", ctx);
    expect(e.message).toBe("TypeError: bad <path>");
    expect(e.stack).not.toContain("/Users/ana");
    expect(makeEntry("boom", "rejection", ctx).message).toBe("boom");
    expect(makeEntry({ a: 1 }, "rejection", ctx).message).toBe('{"a":1}');
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(makeEntry(cyclic, "rejection", ctx).message).toBe("[object Object]");
  });

  it("log keeps the newest N lines and drops damaged ones", () => {
    let log: string | null = "not json\n";
    for (let i = 0; i < 5; i++) log = appendEntry(log, makeEntry(`e${i}`, "error", ctx), 3);
    const lines = log!
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l).message);
    expect(lines).toEqual(["e2", "e3", "e4"]);
  });

  it("GitHub link: pre-filled title + body, nothing else", () => {
    const u = new URL(issueUrl(makeEntry(new Error("x"), "vue", ctx)));
    expect(u.origin + u.pathname).toBe("https://github.com/prnleg/prumo/issues/new");
    expect(u.searchParams.get("title")).toBe("Crash: Error: x");
    expect(u.searchParams.get("body")).toContain("Prumo 0.1.0 on macOS");
    expect([...u.searchParams.keys()]).toEqual(["title", "body"]);
  });

  it("OS from the user agent", () => {
    expect(osName("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("macOS");
    expect(osName("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("Windows");
    expect(osName("Mozilla/5.0 (X11; Linux x86_64)")).toBe("Linux");
  });
});
