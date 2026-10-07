// Sound sources: the acoustic source on stage and the elements of line-array speaker units.
import type { SpeakerUnit, Venue } from "@sonora/schemas";
export type Source = { x: number; y: number; z: number; aim: [number, number, number]; k: number; lw: number[] };
const FLAT = [0, 0, 0, 0, -1, -3], SPECTRA = { speech: [-10, -4, 0, -3, -8, -14], chamber: [-12, -6, 0, 2, -2, -8], show: [-2, 0, 0, 0, -2, -6] } as const;
export const ELEMENT_DROP = 0.36, ELEMENT_FIRST = 0.25;   // matches model/build.py: elements hang 0.25 m below the pivot and 0.36 m apart
export const DIRECTIVITY_K = 3;                              // gain = (k+1) * ((1 + cos) / 2)^k, which integrates to an omni source's power over the sphere
const deg = Math.PI / 180;
/** Directivity gain for the angle between the aim vector and the direction to the listener. */
export const directivity = (k: number, cos: number) => (k + 1) * Math.pow((1 + Math.max(-1, Math.min(1, cos))) / 2, k);
/** The elements of a unit: stacked below the hang point, the top one tilted down by tiltDeg and each next one by splayDeg more; yaw turns the whole unit about the vertical axis (0 = toward the audience, +z). */
export function elementsOf(u: SpeakerUnit): Source[] {
  if (!u.on) return [];
  return Array.from({ length: u.elements }, (_, i) => { const p = (u.tiltDeg + i * u.splayDeg) * deg, y = u.yawDeg * deg; return { x: u.x, y: u.y - ELEMENT_FIRST - i * ELEMENT_DROP, z: u.z, aim: [Math.sin(y) * Math.cos(p), -Math.sin(p), Math.cos(y) * Math.cos(p)] as [number, number, number], k: DIRECTIVITY_K, lw: FLAT.map((o) => u.levelDb + o) }; });
}
export function stageSource(v: Venue): Source { const sp = SPECTRA[v.scenario]; return { x: v.source.x, y: v.source.y, z: v.source.z, aim: [0, 0, 1], k: v.source.k, lw: sp.map((o) => v.source.lwDb + o) }; }
export const sourcesOf = (v: Venue): Source[] => [stageSource(v), ...v.speakers.flatMap(elementsOf)];
