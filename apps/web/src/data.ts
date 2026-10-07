import type { Hall, Material, Scenario } from "@sonora/schemas";
export type Data = { materials: Material[]; scenarios: Scenario[]; hall: Hall };
export const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export async function loadData(): Promise<Data> { const g = async <T,>(n: string) => (await fetch(`${base}/data/${n}.json`)).json() as Promise<T>; const [materials, scenarios, hall] = await Promise.all([g<Material[]>("materials"), g<Scenario[]>("scenarios"), g<Hall>("hall")]); return { materials, scenarios, hall }; }
/** Display colour of each material in the 3D hall (not a measurement). */
export const MATERIAL_COLOR: Record<string, string> = { concrete: "#6b6b6e", plaster: "#8a817a", wood: "#7a4a28", parquet: "#6b4023", slats: "#9c6a38", velvet: "#691E33", foam: "#25323d", glass: "#5f8aa0", carpet: "#3c2f33", "seat-occ": "#691E33", "seat-empty": "#5a2a34" };
/** Colour ramp for the heat maps: Acoustic Blue to Brass to Stage Amber. */
export const ramp = (t: number): [number, number, number] => { const k = Math.max(0, Math.min(1, t)), a: [number, number, number] = [58, 128, 191], b: [number, number, number] = [197, 154, 73], c: [number, number, number] = [241, 163, 65], hot: [number, number, number] = [250, 236, 200]; const mix = (p: number[], q: number[], u: number) => p.map((x, i) => Math.round(x + (q[i] - x) * u)) as [number, number, number]; return k < 0.5 ? mix(a, b, k * 2) : k < 0.85 ? mix(b, c, (k - 0.5) / 0.35) : mix(c, hot, (k - 0.85) / 0.15); };
const MIN_SPAN = { spl: 6, c80: 4, d50: 0.2 } as const;
/** Colour range for a metric: the data's own min and max (widened to a minimum span), so the map always shows structure. The legend prints the numbers. */
export function rangeOf(readings: ({ spl: number[]; c80: number[]; d50: number[] } | undefined)[], metric: "spl" | "c80" | "d50", band: number): [number, number] {
  const v = readings.filter((r) => r).map((r) => r![metric][band]); if (!v.length) return [0, 1]; let lo = Math.min(...v), hi = Math.max(...v); if (hi - lo < MIN_SPAN[metric]) { const m = (hi + lo) / 2; lo = m - MIN_SPAN[metric] / 2; hi = m + MIN_SPAN[metric] / 2; } return [lo, hi]; }
