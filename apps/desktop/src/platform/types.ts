/** Everything the app needs from the OS (CLAUDE.md rule 16: Tauri is imported only in this folder). */
export interface OpenedFile {
  name: string;
  bytes: Uint8Array;
  /** Where to save back; null in the browser build (no file paths there). */
  path: string | null;
}

export interface Platform {
  readonly kind: "desktop" | "web";
  /** Ask where to save. Desktop: native dialog, returns a path or null (cancelled). */
  pickSavePath(suggestedName: string): Promise<string | null>;
  pickOpenFile(): Promise<OpenedFile | null>;
  writeFile(path: string, bytes: Uint8Array): Promise<void>;
  /** Yes/No question; resolves true for the affirmative button. */
  ask(message: string, opts: { title: string; ok: string; cancel: string }): Promise<boolean>;
  setTitle(title: string): Promise<void>;
  /** `allow()` resolves false to keep the window open (e.g. unsaved changes). */
  onCloseRequested(allow: () => Promise<boolean>): void;
}

export const PRUMO_EXT = "prumo";
export const baseName = (p: string) => p.split(/[\\/]/).pop() ?? p;
