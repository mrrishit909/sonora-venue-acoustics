// A synthetic impulse response for one listener: exact early arrivals (1 kHz band) plus an exponentially decaying noise tail scaled to the predicted late energy.
import type { Venue } from "@sonora/schemas";
import { HALL, SPEED, rt60 } from "./hall.ts";
import { EARLY_S, MAX_ORDER, makeContext, receive } from "./acoustics.ts";
import { directivity } from "./speakers.ts";
import { mulberry32 } from "./rng.ts";
export type Arrival = { t: number; e: number };
const BAND = 3;
/** Direct sound and specular image arrivals within the early window, at 1 kHz, summed over sources (no scattering split, no reflector: those appear in the tail energy through `receive`). */
export function arrivals(v: Venue, p: [number, number, number]): Arrival[] {
  const ctx = makeContext(v), out: Arrival[] = [];
  for (const src of ctx.sources) {
    const rx = p[0] + HALL.w / 2, rz = p[2] + HALL.l / 2, d0 = Math.hypot(rx - (src.x + HALL.w / 2), p[1] - src.y, rz - (src.z + HALL.l / 2));
    for (const ix of src.ix) for (const iy of src.iy) for (const iz of src.iz) {
      const order = ix.n0 + ix.n1 + iy.n0 + iy.n1 + iz.n0 + iz.n1; if (order > MAX_ORDER) continue; const dx = rx - ix.c, dy = p[1] - iy.c, dz = rz - iz.c, d = Math.hypot(dx, dy, dz) || 0.1; if (d - d0 > SPEED * EARLY_S) continue;
      const cos = (src.aim[0] * ix.flip * dx + src.aim[1] * iy.flip * dy + src.aim[2] * iz.flip * dz) / d, g = directivity(src.k, cos) / (4 * Math.PI * d * d);
      const sp = ctx.specT[0][BAND][ix.n0] * ctx.specT[1][BAND][ix.n1] * ctx.specT[2][BAND][iy.n0] * ctx.specT[3][BAND][iy.n1] * ctx.specT[4][BAND][iz.n0] * ctx.specT[5][BAND][iz.n1];
      out.push({ t: d / SPEED, e: src.p[BAND] * g * Math.exp(-ctx.air[BAND] * d) * sp });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}
export function renderIR(v: Venue, p: [number, number, number], sr = 22050, seconds?: number): Float32Array {
  const T = rt60(v)[BAND], len = Math.floor(sr * (seconds ?? Math.min(4, Math.max(1, T * 1.5 + 0.3)))), ir = new Float32Array(len), arr = arrivals(v, p), r = receive(makeContext(v), p[0], p[1], p[2]);
  const eEarly = arr.reduce((a, x) => a + x.e, 0), eLate = eEarly / Math.pow(10, r.c80[BAND] / 10), t0 = (arr[0]?.t ?? 0) + EARLY_S;
  const bin = new Float64Array(len); for (const a of arr) { const i = Math.round(a.t * sr); if (i < len) bin[i] += a.e; } for (let i = 0; i < len; i++) ir[i] = Math.sqrt(bin[i]);
  const A = Math.sqrt((eLate * 13.82) / (sr * T)), rnd = mulberry32(7);
  for (let i = Math.floor(t0 * sr); i < len; i++) { const t = i / sr - t0, gauss = (rnd() + rnd() + rnd() + rnd() - 2) * Math.sqrt(3); ir[i] += A * Math.exp((-6.91 * t) / T) * gauss; }
  return ir;
}
export const irEnergySplit = (ir: Float32Array, sr: number, t0: number) => { let early = 0, late = 0; for (let i = 0; i < ir.length; i++) (i / sr < t0 + EARLY_S ? (early += ir[i] ** 2) : (late += ir[i] ** 2)); return { early, late }; };
