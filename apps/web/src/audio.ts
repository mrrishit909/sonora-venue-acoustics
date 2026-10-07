// Web Audio: procedural samples (no audio files), an optional convolution with the predicted impulse response, and an analyser for the reactive visuals.
import { live } from "./store";
const SR = 22050;
type AC = typeof AudioContext;
const Ctor = (): AC | null => (typeof window === "undefined" ? null : window.AudioContext ?? (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext ?? null);
export const audioAvailable = () => !!Ctor();
let ctx: AudioContext | null = null, src: AudioBufferSourceNode | null = null, analyser: AnalyserNode | null = null, buf: Uint8Array<ArrayBuffer> | null = null, endTimer = 0;
const rnd = (() => { let a = 12345; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
const env = (t: number, a: number, d: number, s: number, len: number) => (t < a ? t / a : t < a + d ? 1 - (1 - s) * ((t - a) / d) : t < len - 0.25 ? s : Math.max(0, s * (len - t) / 0.25));
function violin(sr: number): Float32Array {
  const out = new Float32Array(sr * 4), notes = [[440, 0, 1.3], [554.37, 1.2, 1.3], [659.25, 2.3, 1.6]];
  for (const [f, t0, len] of notes) for (let i = 0; i < len * sr; i++) { const t = i / sr, vib = 1 + 0.004 * Math.sin(2 * Math.PI * 5.6 * t) * Math.min(1, t * 2); let s = 0; for (let h = 1; h <= 9; h++) s += Math.sin(2 * Math.PI * f * h * vib * t) / h; const k = Math.floor((t0 + t) * sr); if (k < out.length) out[k] += 0.22 * s * env(t, 0.12, 0.15, 0.8, len); }
  return out;
}
function speech(sr: number): Float32Array {
  const out = new Float32Array(sr * 4), vowels = [[700, 1200], [500, 1800], [300, 2300], [450, 900], [600, 1500]];
  for (let n = 0; n < 11; n++) { const t0 = 0.1 + n * 0.34, [f1, f2] = vowels[n % vowels.length], f0 = 110 + 14 * Math.sin(n), len = 0.2; for (let i = 0; i < len * sr; i++) { const t = i / sr; let s = 0; for (let h = 1; h <= 30; h++) { const f = f0 * h, g = Math.exp(-((f - f1) ** 2) / (2 * 120 ** 2)) + 0.6 * Math.exp(-((f - f2) ** 2) / (2 * 200 ** 2)) + 0.05; s += g * Math.sin(2 * Math.PI * f * t); } const k = Math.floor((t0 + t) * sr); if (k < out.length) out[k] += 0.05 * s * Math.sin((Math.PI * t) / len) ** 0.7 + (t < 0.025 ? (rnd() - 0.5) * 0.3 : 0); } }
  return out;
}
function band(sr: number): Float32Array {
  const out = new Float32Array(sr * 4), beat = 0.5;
  for (let b = 0; b < 8; b++) { const t0 = b * beat;
    if (b % 2 === 0) for (let i = 0; i < 0.3 * sr; i++) { const t = i / sr, f = 45 + 90 * Math.exp(-t * 22); const k = Math.floor((t0 + t) * sr); if (k < out.length) out[k] += 0.8 * Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 9); }
    else for (let i = 0; i < 0.22 * sr; i++) { const t = i / sr, k = Math.floor((t0 + t) * sr); if (k < out.length) out[k] += 0.35 * (rnd() - 0.5) * Math.exp(-t * 18) + 0.2 * Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 20); }
    const note = [110, 110, 146.8, 164.8][b % 4]; for (let i = 0; i < 0.45 * sr; i++) { const t = i / sr, k = Math.floor((t0 + t) * sr); if (k < out.length) { let s = 0; for (let h = 1; h <= 5; h++) s += Math.sin(2 * Math.PI * note * h * t) / h; out[k] += 0.22 * s * Math.exp(-t * 3); } } }
  return out;
}
export const SAMPLES = { speech, violin, band } as const;
export type SampleKind = keyof typeof SAMPLES;
export function stop() { try { src?.stop(); } catch { /* already stopped */ } src = null; clearTimeout(endTimer); live.level = 0; }
function chain(c: AudioContext) { analyser = c.createAnalyser(); analyser.fftSize = 512; buf = new Uint8Array(new ArrayBuffer(analyser.fftSize)); analyser.connect(c.destination); }
/** Plays a sample, through the impulse response when one is given. Resolves true when sound started, false when audio is unavailable. */
export async function play(kind: SampleKind, ir: Float32Array | null, onEnd: () => void): Promise<boolean> {
  const C = Ctor(); if (!C) return false; stop();
  try {
    ctx ??= new C(); if (ctx.state === "suspended") await ctx.resume(); if (!analyser) chain(ctx);
    const data = SAMPLES[kind](SR), b = ctx.createBuffer(1, data.length, SR); b.copyToChannel(data as Float32Array<ArrayBuffer>, 0); src = ctx.createBufferSource(); src.buffer = b;
    if (ir) { const conv = ctx.createConvolver(), ib = ctx.createBuffer(1, ir.length, SR); ib.copyToChannel(ir as Float32Array<ArrayBuffer>, 0); conv.buffer = ib; conv.normalize = true; const g = ctx.createGain(); g.gain.value = 0.9; src.connect(conv); conv.connect(g); g.connect(analyser!); } else { const g = ctx.createGain(); g.gain.value = 0.5; src.connect(g); g.connect(analyser!); }
    src.start(); const secs = data.length / SR + (ir ? ir.length / SR * 0.6 : 0.2); endTimer = window.setTimeout(() => { stop(); onEnd(); }, secs * 1000); return true;
  } catch { return false; }
}
/** A single violin note for the intro, only after the visitor asks for sound (browsers block autoplay). */
export async function tone(): Promise<boolean> { const C = Ctor(); if (!C) return false; try { ctx ??= new C(); if (ctx.state === "suspended") await ctx.resume(); if (!analyser) chain(ctx); const d = violin(SR).subarray(0, SR * 2), b = ctx.createBuffer(1, d.length, SR); b.copyToChannel(d as Float32Array<ArrayBuffer>, 0); const s = ctx.createBufferSource(); s.buffer = b; const g = ctx.createGain(); g.gain.value = 0.7; s.connect(g); g.connect(analyser!); s.start(); return true; } catch { return false; } }
/** Smoothed 0..1 level from the analyser, written to live.level each frame. */
export function pump() { if (!analyser || !buf) { live.level *= 0.9; return; } analyser.getByteTimeDomainData(buf); let s = 0; for (const v of buf) s += ((v - 128) / 128) ** 2; const r = Math.min(1, Math.sqrt(s / buf.length) * 3.2); live.level += (r - live.level) * 0.35; }
export const waveform = (): Uint8Array | null => { if (!analyser || !buf) return null; analyser.getByteTimeDomainData(buf); return buf; };
