// Simplified room acoustics for a shoebox hall. Early sound is an image-source sum (exact paths, order <= 6, 80 ms window); the late field is a statistical reverberant term
// from the Eyring reverberation time. This is design support, NOT certified acoustic engineering.
import type { SurfaceKey, Venue } from "@sonora/schemas";
import { AIR_NEPER_PER_M, material } from "./materials.ts";
import { HALL, SPEED, SURFACE_KEYS, TOTAL_AREA, rt60, surfaces } from "./hall.ts";
import { directivity, sourcesOf, type Source } from "./speakers.ts";
export const EARLY_S = 0.08, D50_S = 0.05, MAX_ORDER = 6, REF_DB = 100;
export type Reading = { spl: number[]; c80: number[]; d50: number[] };
// wall index: 0 left (x=0), 1 right (x=W), 2 floor (y=0), 3 ceiling (y=H), 4 stage (z=0), 5 rear (z=L)
const WALLS: SurfaceKey[] = ["left", "right", "floor", "ceiling", "stage", "rear"];
type Img = { c: number; n0: number; n1: number; flip: number };
const axisImages = (a: number, s: number): Img[] => { const out: Img[] = []; for (let n = -2; n <= 2; n++) for (let j = 0; j < 2; j++) out.push({ c: (1 - 2 * j) * s + 2 * n * a, n0: Math.abs(n - j), n1: Math.abs(n), flip: j ? -1 : 1 }); return out; };
export type Context = { venue: Venue; sources: (Source & { p: number[]; ix: Img[]; iy: Img[]; iz: Img[] })[]; absT: number[][][]; specT: number[][][]; late: number[]; air: number[]; reflector: null | { y: number; x: [number, number]; z: [number, number]; keep: number[]; scat: number[] } };
const pw = (x: number, n: number) => Math.pow(x, n);
export function makeContext(v: Venue): Context {
  const s = surfaces(v), T = rt60(v);
  const absT = WALLS.map((w) => s[w].alpha.map((a) => Array.from({ length: MAX_ORDER + 1 }, (_, n) => pw(1 - a, n))));
  const specT = WALLS.map((w) => s[w].alpha.map((a) => Array.from({ length: MAX_ORDER + 1 }, (_, n) => pw((1 - a) * (1 - s[w].scatter), n))));
  const late = AIR_NEPER_PER_M.map((m, b) => { const aEff = Math.min(0.999, 1 - Math.exp(-(-Math.log(1 - Math.min(0.999, SURFACE_KEYS.reduce((a, k) => a + s[k].area * s[k].alpha[b], 0) / TOTAL_AREA)) * TOTAL_AREA + 4 * m * HALL.w * HALL.l * HALL.h) / TOTAL_AREA)); return (4 * (1 - aEff)) / (TOTAL_AREA * aEff) * Math.exp((-13.82 * EARLY_S) / T[b]); });
  const refl = v.reflectors.on ? (() => { const r = material("wood"), sc = r.scattering; return { y: v.reflectors.y, x: [-8, 8] as [number, number], z: [-16, -3] as [number, number], keep: r.absorption.map((a) => (1 - a) * (1 - sc)), scat: r.absorption.map((a) => (1 - a) * sc) }; })() : null;
  const sources = sourcesOf(v).map((src) => ({ ...src, p: src.lw.map((l) => pw(10, (l - REF_DB) / 10)), ix: axisImages(HALL.w, src.x + HALL.w / 2), iy: axisImages(HALL.h, src.y), iz: axisImages(HALL.l, src.z + HALL.l / 2) }));
  return { venue: v, sources, absT, specT, late, air: AIR_NEPER_PER_M, reflector: refl };
}
const dB = (x: number) => 10 * Math.log10(Math.max(x, 1e-30));
/** Energy terms at a listener: early specular (<= 80 ms after the direct sound), the first 50 ms, and the late field. Units: power ratio per square metre, relative to 100 dB re 1 pW. */
export function receive(ctx: Context, px: number, py: number, pz: number): Reading {
  const B = 6, early = new Array(B).fill(0), e50 = new Array(B).fill(0), late = new Array(B).fill(0), rx = px + HALL.w / 2, rz = pz + HALL.l / 2, dEarly = SPEED * EARLY_S, d50 = SPEED * D50_S, c4 = 4 * Math.PI;
  for (const src of ctx.sources) {
    const sx = src.x + HALL.w / 2, sz = src.z + HALL.l / 2;
    const d0 = Math.hypot(rx - sx, py - src.y, rz - sz) || 0.1;
    for (const ix of src.ix) for (const iy of src.iy) { const o2 = ix.n0 + ix.n1 + iy.n0 + iy.n1; if (o2 > MAX_ORDER) continue; const dxy = (rx - ix.c) ** 2 + (py - iy.c) ** 2;
      for (const iz of src.iz) {
        const order = o2 + iz.n0 + iz.n1; if (order > MAX_ORDER) continue; const dx = rx - ix.c, dy = py - iy.c, dz = rz - iz.c, d = Math.sqrt(dxy + dz * dz) || 0.1, rel = d - d0; if (rel > dEarly + 1e-9) continue;
        const cos = (src.aim[0] * ix.flip * dx + src.aim[1] * iy.flip * dy + src.aim[2] * iz.flip * dz) / d, g = directivity(src.k, cos) / (c4 * d * d);
        for (let b = 0; b < B; b++) {
          const air = Math.exp(-ctx.air[b] * d), p = src.p[b] * g * air;
          if (order === 0) { early[b] += p; e50[b] += p; continue; }
          const ab = ctx.absT[0][b][ix.n0] * ctx.absT[1][b][ix.n1] * ctx.absT[2][b][iy.n0] * ctx.absT[3][b][iy.n1] * ctx.absT[4][b][iz.n0] * ctx.absT[5][b][iz.n1];
          const sp = ctx.specT[0][b][ix.n0] * ctx.specT[1][b][ix.n1] * ctx.specT[2][b][iy.n0] * ctx.specT[3][b][iy.n1] * ctx.specT[4][b][iz.n0] * ctx.specT[5][b][iz.n1];
          early[b] += p * sp; late[b] += p * (ab - sp); if (rel <= d50 + 1e-9) e50[b] += p * sp;
        }
      } }
    if (ctx.reflector && src.y < ctx.reflector.y && py < ctx.reflector.y) {         // one image in the finite ceiling reflector cloud, valid only where the reflection point lies on a panel
      const r = ctx.reflector, iy = 2 * r.y - src.y, t = (r.y - iy) / (py - iy), hx = src.x + (px - src.x) * t, hz = src.z + (pz - src.z) * t;
      if (t > 0 && t < 1 && hx >= r.x[0] && hx <= r.x[1] && hz >= r.z[0] && hz <= r.z[1]) { const d = Math.hypot(px - src.x, py - iy, pz - src.z), cos = (src.aim[0] * (px - src.x) - src.aim[1] * (py - iy) + src.aim[2] * (pz - src.z)) / d, g = directivity(src.k, cos) / (c4 * d * d);
        if (d - d0 <= dEarly) for (let b = 0; b < B; b++) { const p = src.p[b] * g * Math.exp(-ctx.air[b] * d), sp = (ctx as unknown as { reflector: { keep: number[]; scat: number[] } }).reflector.keep[b]; early[b] += p * sp; late[b] += p * (ctx.reflector as unknown as { scat: number[] }).scat[b]; if (d - d0 <= d50) e50[b] += p * sp; } }
    }
    for (let b = 0; b < B; b++) late[b] += src.p[b] * ctx.late[b];
  }
  const tot = (b: number) => early[b] + late[b];
  return { spl: early.map((_, b) => REF_DB + dB(tot(b))), c80: early.map((_, b) => dB(early[b]) - dB(late[b])), d50: early.map((_, b) => e50[b] / Math.max(tot(b), 1e-30)) };
}
