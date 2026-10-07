// The prediction over the audience: one reading per listener position, zone summaries, and a reverberation table. `simulateRows` lets the UI compute in chunks so a dragged speaker updates progressively.
import type { Receiver, Venue, ZoneId } from "@sonora/schemas";
import { BANDS } from "./materials.ts";
import { receivers, rt60, sabine, ZONES } from "./hall.ts";
import { makeContext, receive, type Context, type Reading } from "./acoustics.ts";
export type Field = { receivers: Receiver[]; readings: Reading[] };
export const simulate = (v: Venue): Field => { const ctx = makeContext(v), rs = receivers(v); return { receivers: rs, readings: rs.map((r) => receive(ctx, r.x, r.y, r.z)) }; };
/** Compute readings for receivers [from, to) into `out`; returns the next index. */
export function simulateRows(ctx: Context, rs: Receiver[], out: Reading[], from: number, count: number): number { const to = Math.min(rs.length, from + count); for (let i = from; i < to; i++) out[i] = receive(ctx, rs[i].x, rs[i].y, rs[i].z); return to; }
export const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const MID = [2, 3];                                            // 500 Hz and 1 kHz
export type Summary = { zone: ZoneId; label: string; n: number; spl: number; c80: number; d50: number; splMin: number; splMax: number };
export function zoneSummaries(f: Field): Summary[] {
  return ZONES.map((z): Summary | null => { const ix = f.receivers.map((r, i) => (r.zone === z.id ? i : -1)).filter((i) => i >= 0); if (!ix.length) return null;
    const rd = ix.map((i) => f.readings[i]), spl = rd.map((r) => mean(MID.map((b) => r.spl[b]))), c80 = rd.map((r) => mean(MID.map((b) => r.c80[b]))), d50 = rd.map((r) => mean(MID.map((b) => r.d50[b])));
    return { zone: z.id, label: z.label, n: ix.length, spl: mean(spl), c80: mean(c80), d50: mean(d50), splMin: Math.min(...spl), splMax: Math.max(...spl) }; }).filter((x): x is Summary => !!x);
}
export const midRt = (v: Venue) => { const t = rt60(v); return (t[2] + t[3]) / 2; };
export const rtTable = (v: Venue) => { const e = rt60(v), s = sabine(v); return BANDS.map((hz, i) => ({ hz, eyring: e[i], sabine: s[i] })); };
/** Evenness of the SPL across the audience at one band: standard deviation in dB (lower is more even). */
export const spread = (f: Field, band = 3) => { const v = f.readings.map((r) => r.spl[band]), m = mean(v); return Math.sqrt(mean(v.map((x) => (x - m) ** 2))); };
