// Specular ray paths for the picture of sound in the hall: reflect off the six walls, decay by each wall's 1 kHz absorption, timed at the speed of sound.
import type { Venue } from "@sonora/schemas";
import { HALL, SPEED, surfaces } from "./hall.ts";
export type Ray = { points: [number, number, number][]; t: number[]; e: number[] };
const WALL_OF = ["left", "right", "floor", "ceiling", "stage", "rear"] as const;
/** Fibonacci directions over the sphere; deterministic. */
export const fibonacci = (n: number): [number, number, number][] => Array.from({ length: n }, (_, i) => { const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), a = i * Math.PI * (3 - Math.sqrt(5)); return [r * Math.cos(a), y, r * Math.sin(a)]; });
export function traceRays(v: Venue, from: [number, number, number], n = 48, maxBounces = 5): Ray[] {
  const s = surfaces(v), lo = [-HALL.w / 2, 0, -HALL.l / 2], hi = [HALL.w / 2, HALL.h, HALL.l / 2];
  return fibonacci(n).map((d0) => {
    const p = [...from], d = [...d0]; const pts: [number, number, number][] = [[p[0], p[1], p[2]]], t = [0], e = [1]; let time = 0, en = 1;
    for (let k = 0; k <= maxBounces; k++) {
      let best = Infinity, wall = -1;
      for (let a = 0; a < 3; a++) { if (Math.abs(d[a]) < 1e-9) continue; for (const [side, w] of [[lo[a], a * 2], [hi[a], a * 2 + 1]] as const) { const tt = (side - p[a]) / d[a]; if (tt > 1e-6 && tt < best) { best = tt; wall = w; } } }
      if (wall < 0 || !isFinite(best)) break;
      for (let a = 0; a < 3; a++) p[a] += d[a] * best; time += best / SPEED; const axis = wall >> 1; d[axis] = -d[axis];
      en *= 1 - s[WALL_OF[wall]].alpha[3]; pts.push([p[0], p[1], p[2]]); t.push(time); e.push(en);
    }
    return { points: pts, t, e };
  });
}
