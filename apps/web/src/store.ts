import { useSyncExternalStore } from "react";
import type { Receiver, SavedScenario, SurfaceKey, Venue } from "@sonora/schemas";
import { makeContext, presetVenue, receivers, simulateRows, type Reading } from "@sonora/domain";
export type View = "venue" | "speakers" | "field" | "seats" | "compare" | "listen";
export const VIEWS: { id: View; label: string; blurb: string }[] = [
  { id: "venue", label: "Venue", blurb: "Modules and surfaces" }, { id: "speakers", label: "Speakers", blurb: "Array designer" }, { id: "field", label: "Field", blurb: "Rays and heat" },
  { id: "seats", label: "Seats", blurb: "Zone by zone" }, { id: "compare", label: "Materials", blurb: "A against B" }, { id: "listen", label: "Listen", blurb: "Hear it, save it" },
];
export type Metric = "spl" | "c80" | "d50"; export type Cam = "auto" | "audience" | "stage" | "ceiling" | "orbit";
export type FieldState = { recv: Receiver[]; readings: (Reading | undefined)[]; done: boolean; progress: number };
export type State = {
  view: View; venue: Venue; field: FieldState; selSpeaker: string; band: number; metric: Metric; plane: "stalls" | "balcony"; listener: { x: number; z: number; y: number }; cam: Cam;
  compare: { surface: SurfaceKey; a: string; b: string }; saved: SavedScenario[]; audio: "idle" | "playing" | "unavailable"; hearRoom: boolean; flash: string;
  introDone: boolean; introFx: boolean; introStep: number; reduced: boolean; pauseMotion: boolean; gfx: "webgl" | "poster";
};
export const state: State = { view: "venue", venue: presetVenue("chamber"), field: { recv: [], readings: [], done: false, progress: 0 }, selSpeaker: "arrayL", band: 3, metric: "spl", plane: "stalls", listener: { x: 0, z: 6, y: 1.2 }, cam: "auto", compare: { surface: "rear", a: "plaster", b: "foam" }, saved: [], audio: "idle", hearRoom: true, flash: "", introDone: false, introFx: false, introStep: 0, reduced: false, pauseMotion: false, gfx: "webgl" };
/** Per-frame values the intro and the canvas read; not reactive. */
export const live = { wave: 0, revealOn: 0, lights: [0, 0, 0, 0, 0, 0], house: 0, arm: 0, beat: 0, level: 0, camBlend: 0, raysT: 0, cinema: 1 };
let snap = { ...state }; const subs = new Set<() => void>();
export function set(p: Partial<State>) { Object.assign(state, p); snap = { ...state }; subs.forEach((f) => f()); }
export const useStore = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => snap, () => snap);
let token = 0;
/** Predict the field in chunks so the interface stays responsive while a speaker is dragged. */
export function scheduleField() {
  const my = ++token, v = state.venue, ctx = makeContext(v), rs = receivers(v), readings: Reading[] = []; let i = 0;
  set({ field: { recv: rs, readings: [], done: false, progress: 0 } });
  const step = () => { if (my !== token) return; i = simulateRows(ctx, rs, readings, i, state.reduced ? rs.length : 48); if (my !== token) return; set({ field: { recv: rs, readings: readings.slice(), done: i >= rs.length, progress: i / rs.length } }); if (i < rs.length) setTimeout(step, 0); };
  setTimeout(step, 0);
}
export function edit(fn: (v: Venue) => void) { const v: Venue = JSON.parse(JSON.stringify(state.venue)); fn(v); set({ venue: v, flash: "" }); scheduleField(); }
export const STORE_KEY = "sonora:v1";
export const persist = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify({ saved: state.saved })); } catch { /* storage may be blocked */ } };
