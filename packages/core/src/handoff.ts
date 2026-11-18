// Hand-off "baton" (ADR-029 resolved Q-091; mechanics ADR-044 slice 3): one holder at a time edits;
// everyone else can look and leave notes. Convention + visibility, not security: copies of the file
// exist and names aren't verified (Q-092).
import { changedIds, type Problem } from "./edit";
import type { Command } from "./history";
import type { Handoff, HandoffEntry, Id, Project } from "./model";

/** Is `name` allowed to edit? Solo use (no hand-off yet) → everyone. */
export const isHolder = (p: Project, name: string | null): boolean => !p.handoff || p.handoff.holder === name;

const withEntry = (p: Project, holder: string, e: HandoffEntry): Project => {
  const handoff: Handoff = { holder, log: [...(p.handoff?.log ?? []), e] };
  return { ...p, handoff };
};

/**
 * Pass the project to `to`. `from` = you (the holder, or the first holder when there's no hand-off yet).
 * Undoable like any edit; the snapshot it points at is made by the caller (snapshots aren't undo state).
 */
export function handOffCommand(a: {
  from: string;
  to: string;
  at: string;
  message?: string;
  snapshotId?: Id;
}): Command {
  const e: HandoffEntry = {
    kind: "hand",
    from: a.from,
    to: a.to,
    at: a.at,
    ...(a.message ? { message: a.message } : {}),
    ...(a.snapshotId ? { snapshotId: a.snapshotId } : {}),
  };
  return { label: { key: "cmd.handOff", params: { name: a.to } }, apply: (p) => withEntry(p, a.to, e) };
}

/** Take the project over from its holder (logged, so the holder sees it when the file comes back). */
export function takeOverCommand(name: string, at: string): Command {
  return {
    label: { key: "cmd.takeOver" },
    apply: (p) =>
      !p.handoff || p.handoff.holder === name
        ? p
        : withEntry(p, name, { kind: "take", from: p.handoff.holder, to: name, at }),
  };
}

/**
 * History guard: while someone else holds the project, only notes may be added, edited or removed.
 * Taking over is allowed (it's how you get the baton). Everything else → "not-your-turn".
 */
export function handoffGuard(me: () => string | null): (before: Project, after: Project) => Problem[] {
  return (before, after) => {
    if (isHolder(before, me())) return [];
    const { elements: be, handoff: bh, updatedAt: _bu, ...brest } = before;
    const { elements: ae, handoff: ah, updatedAt: _au, ...arest } = after;
    void _bu;
    void _au;
    const changed = changedIds(before, after);
    const restSame = JSON.stringify(brest) === JSON.stringify(arest);
    // taking over: the baton moves to you, one log entry is added, and nothing else changes
    const takeOver =
      ah?.holder === me() && ah.log.length === (bh?.log.length ?? 0) + 1 && changed.length === 0 && restSame;
    const notesOnly =
      changed.every((id) => (be[id] ?? ae[id])?.type === "note" && (!ae[id] || ae[id]?.type === "note")) &&
      restSame &&
      JSON.stringify(bh) === JSON.stringify(ah);
    return takeOver || notesOnly ? [] : [{ code: "not-your-turn", elementIds: [] }];
  };
}
