// Room types (Q-107 ✅; list Q-115 ✅, owned by the Architect module Q-114). Ids are stored in projects:
// never rename, only add. Packs may add more later (ADR-030); a free name stays the user's own label.
// A type is a label + future hook for rules (e.g. "bathroom" → ventilation checks); nothing reads it yet.
import type { RoomTag } from "@prumo/core";
import { architectData, withArchitectData } from "./finishes";

export const ROOM_TYPES = [
  "bedroom",
  "suite",
  "bathroom",
  "toilet",
  "kitchen",
  "living",
  "dining",
  "laundry",
  "garage",
  "office",
  "hallway",
  "balcony",
  "storage",
  "other",
] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

/** i18n key of a stored type id; unknown ids (from a newer pack) → null, shown as no type. */
export const roomTypeKey = (id: string | undefined) =>
  id && (ROOM_TYPES as readonly string[]).includes(id) ? `roomType.${id}` : null;

/** New room tag with a room type (undefined = remove). Other Architect data (floor finish) is kept. */
export function setRoomType(t: RoomTag, typeId: string | undefined): RoomTag {
  return withArchitectData(t, { ...architectData(t), roomType: typeId }); // undefined → dropped there
}
