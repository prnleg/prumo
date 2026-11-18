/** Everything the app needs from the OS (CLAUDE.md rule 16: Tauri is imported only in this folder). */
export interface OpenedFile {
  name: string;
  bytes: Uint8Array;
  /** Where to save back; null in the browser build (no file paths there). */
  path: string | null;
}

export interface Platform {
  readonly kind: "desktop" | "web";
  /**
   * Ask where to save. Desktop: native dialog, returns a path or null (cancelled). `type` = the file
   * kind (default: a Prumo project); the extension is added if missing.
   */
  pickSavePath(suggestedName: string, type?: FileType): Promise<string | null>;
  pickOpenFile(): Promise<OpenedFile | null>;
  writeFile(path: string, bytes: Uint8Array): Promise<void>;
  /** Yes/No question; resolves true for the affirmative button. */
  ask(message: string, opts: { title: string; ok: string; cancel: string }): Promise<boolean>;
  setTitle(title: string): Promise<void>;
  /** `allow()` resolves false to keep the window open (e.g. unsaved changes). */
  onCloseRequested(allow: () => Promise<boolean>): void;
  /**
   * Prumo's own small files (ADR-037): desktop = the OS app-data folder, browser = localStorage.
   * `name` is a plain relative name like "settings.json". Missing → null. Never throws on read.
   */
  readAppText(name: string): Promise<string | null>;
  writeAppText(name: string, text: string): Promise<void>;
  /** Recovery copies (ADR-037). Desktop only; the browser build has none (reads null/[], writes nothing). */
  readAppBytes(name: string): Promise<Uint8Array | null>;
  /** Written to a temporary name first and renamed, so a crash mid-write never leaves half a file. */
  writeAppBytes(name: string, bytes: Uint8Array): Promise<void>;
  /** File names directly inside `dir` (relative to the app-data folder); [] if it doesn't exist. */
  listAppFiles(dir: string): Promise<string[]>;
  removeAppFile(name: string): Promise<void>;
  /** e.g. "0.1.0"; "dev" in the browser build. */
  appVersion(): Promise<string>;
  /** Open a web link in the user's browser (ADR-039). false = couldn't: the caller copies the link. */
  openUrl(url: string): Promise<boolean>;
}

export const PRUMO_EXT = "prumo";
/** A kind of file to save: dialog filter label + extension (no dot). */
export interface FileType {
  label: string;
  ext: string;
}
export const PRUMO_FILE: FileType = { label: "Prumo", ext: PRUMO_EXT };
const MIME: Record<string, string> = { png: "image/png", pdf: "application/pdf" };
/** Media type for a file name (downloads in the browser build); projects are zip files. */
export const mimeOf = (name: string) => MIME[name.split(".").pop()?.toLowerCase() ?? ""] ?? "application/zip";
export const withExt = (name: string, ext: string) =>
  name.toLowerCase().endsWith(`.${ext}`) ? name : `${name}.${ext}`;
export const baseName = (p: string) => p.split(/[\\/]/).pop() ?? p;
