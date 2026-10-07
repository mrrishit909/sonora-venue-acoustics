// Validation and summaries of venue configurations (what the API accepts and what is saved).
import type { SpeakerUnit, SurfaceKey, Venue } from "@sonora/schemas";
import { material } from "./materials.ts";
import { SURFACE_KEYS } from "./hall.ts";
import { midRt } from "./field.ts";
const num = (x: unknown, lo: number, hi: number) => typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi;
export function validateSpeaker(u: Partial<SpeakerUnit>): string | null {
  if (typeof u.id !== "string" || !u.id) return "a speaker unit needs an id"; if (!num(u.x, -11.5, 11.5)) return `${u.id}: x must be within the hall, -11.5 to 11.5 m`; if (!num(u.z, -17.8, 17.8)) return `${u.id}: z must be within the hall, -17.8 to 17.8 m`; if (!num(u.y, 1, 12.5)) return `${u.id}: hang height 1 to 12.5 m`;
  if (!Number.isInteger(u.elements) || (u.elements as number) < 1 || (u.elements as number) > 8) return `${u.id}: 1 to 8 elements`; if (!num(u.splayDeg, 0, 15)) return `${u.id}: splay 0 to 15 degrees`; if (!num(u.tiltDeg, -10, 40)) return `${u.id}: tilt -10 to 40 degrees`; if (!num(u.yawDeg, -45, 45)) return `${u.id}: yaw -45 to 45 degrees`; if (!num(u.levelDb, 60, 130)) return `${u.id}: level 60 to 130 dB`; if (typeof u.on !== "boolean") return `${u.id}: on must be true or false`; return null;
}
export function validateVenue(v: Partial<Venue>): string | null {
  if (typeof v.name !== "string" || !v.name.trim() || v.name.length > 60) return "name is required (up to 60 characters)"; if (!["speech", "chamber", "show"].includes(v.scenario as string)) return "scenario must be speech, chamber or show"; if (typeof v.balcony !== "boolean") return "balcony must be true or false"; if (!num(v.occupancy, 0, 1)) return "occupancy must be 0 to 1";
  if (!v.reflectors || typeof v.reflectors.on !== "boolean" || !num(v.reflectors.y, 6, 11.5)) return "reflectors need on and a height of 6 to 11.5 m"; if (!v.surfaces) return "surfaces are required";
  for (const k of SURFACE_KEYS) { const s = v.surfaces[k as SurfaceKey]; if (!s) return `surface ${k} is required`; try { material(s.base); if (s.treat) material(s.treat); } catch { return `surface ${k}: unknown material`; } if (!num(s.cover, 0, 1)) return `surface ${k}: cover must be 0 to 1`; }
  if (!Array.isArray(v.speakers) || v.speakers.length > 8) return "up to 8 speaker units"; for (const u of v.speakers) { const e = validateSpeaker(u); if (e) return e; }
  const s = v.source; if (!s || !num(s.x, -9, 9) || !num(s.z, -17, -8.5) || !num(s.y, 0.5, 3) || !num(s.lwDb, 40, 120) || !num(s.k, 0, 6)) return "source must be on the stage (x -9 to 9, z -17 to -8.5, y 0.5 to 3) with level 40 to 120 dB and directivity 0 to 6"; return null;
}
export const venueSummary = (v: Venue) => ({ midRt60: Math.round(midRt(v) * 100) / 100, speakers: v.speakers.filter((u) => u.on).length, balcony: v.balcony, occupancy: v.occupancy });
