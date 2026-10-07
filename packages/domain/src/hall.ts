// The hall envelope and the surfaces of the shoebox model. Sizes come from model/parts.json via analysis.json (a test checks they still agree).
import type { Receiver, SurfaceKey, Venue } from "@sonora/schemas";
import { material, mixMaterials, AIR_NEPER_PER_M } from "./materials.ts";
export const HALL = { w: 24, l: 36, h: 13 };
export const VOLUME = HALL.w * HALL.l * HALL.h;
export const SURFACE_KEYS: SurfaceKey[] = ["left", "right", "stage", "rear", "floor", "ceiling"];
export const AREA: Record<SurfaceKey, number> = { left: HALL.l * HALL.h, right: HALL.l * HALL.h, stage: HALL.w * HALL.h, rear: HALL.w * HALL.h, floor: HALL.w * HALL.l, ceiling: HALL.w * HALL.l };
export const TOTAL_AREA = SURFACE_KEYS.reduce((a, k) => a + AREA[k], 0);
export const SPEED = 343;
/** Area taken by the three stalls seat blocks and by the balcony seat block, from the model's measured bounds (rounded, see analysis.json). */
export const STALLS_SEAT_AREA = 3 * 6.6 * 21 * 1.05, BALCONY_SEAT_AREA = 20.8 * 10 * 1.05;
export type SurfaceAcoustics = { alpha: number[]; scatter: number; area: number };
/** Effective absorption and scattering of each of the six surfaces. Occupied seats are folded into the floor; balcony seats into the ceiling (a deliberate simplification). */
export function surfaces(v: Venue): Record<SurfaceKey, SurfaceAcoustics> {
  const out = {} as Record<SurfaceKey, SurfaceAcoustics>;
  for (const k of SURFACE_KEYS) { const s = v.surfaces[k], m = mixMaterials(material(s.base), s.treat ? material(s.treat) : null, s.cover); out[k] = { alpha: m.absorption, scatter: m.scattering, area: AREA[k] }; }
  const occ = Math.max(0, Math.min(1, v.occupancy)), aud = (id: string) => mixMaterials(material("seat-empty"), material("seat-occ"), occ);
  const fold = (key: SurfaceKey, seatArea: number) => { const a = aud(key), f = seatArea / AREA[key], o = out[key]; out[key] = { alpha: o.alpha.map((x, i) => (1 - f) * x + f * a.absorption[i]), scatter: (1 - f) * o.scatter + f * a.scattering, area: o.area }; };
  fold("floor", STALLS_SEAT_AREA); if (v.balcony) fold("ceiling", BALCONY_SEAT_AREA);
  return out;
}
export const meanAlpha = (s: Record<SurfaceKey, SurfaceAcoustics>, b: number) => SURFACE_KEYS.reduce((a, k) => a + s[k].area * s[k].alpha[b], 0) / TOTAL_AREA;
/** Eyring reverberation time per band, with air absorption. */
export function rt60(v: Venue): number[] {
  const s = surfaces(v); return AIR_NEPER_PER_M.map((m, b) => { const a = Math.min(0.999, meanAlpha(s, b)); return (0.161 * VOLUME) / (-TOTAL_AREA * Math.log(1 - a) + 4 * m * VOLUME); });
}
export const sabine = (v: Venue) => { const s = surfaces(v); return AIR_NEPER_PER_M.map((m, b) => (0.161 * VOLUME) / (TOTAL_AREA * meanAlpha(s, b) + 4 * m * VOLUME)); };
/** Listener positions: stalls on a 1.5 m grid at ear height, and (with a balcony) a balcony grid. Zones are front/rear of the stalls, the side seats, and the balcony. */
export function receivers(v: Venue): Receiver[] {
  const out: Receiver[] = [];
  for (let zi = 0; zi < 15; zi++) for (let xi = 0; xi < 15; xi++) { const x = -10.5 + xi * 1.5, z = -5.5 + zi * 1.5; out.push({ id: `s${zi}-${xi}`, x, y: 1.2, z, zone: Math.abs(x) > 6.6 ? "sides" : z < 2 ? "front" : "rear" }); }
  if (v.balcony) for (let zi = 0; zi < 6; zi++) for (let xi = 0; xi < 13; xi++) out.push({ id: `b${zi}-${xi}`, x: -9 + xi * 1.5, y: 6.5, z: 8 + zi * 1.5, zone: "balcony" });
  return out;
}
export const ZONES = [{ id: "front", label: "Front stalls" }, { id: "rear", label: "Rear stalls" }, { id: "sides", label: "Side seats" }, { id: "balcony", label: "Balcony" }] as const;
