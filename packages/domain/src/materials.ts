// Simplified octave-band absorption coefficients of the order found in textbook tables. A design-support library for the demo, NOT certified acoustic data.
import type { Material } from "@sonora/schemas";
export const BANDS = [125, 250, 500, 1000, 2000, 4000] as const;
export const AIR_NEPER_PER_M = [0.00002, 0.00007, 0.00023, 0.00085, 0.0022, 0.0076];   // energy attenuation of air at about 20 C and 50 percent humidity, per octave band (typical values)
export const MATERIALS: Material[] = [
  { id: "concrete", label: "Painted concrete", absorption: [0.01, 0.01, 0.02, 0.02, 0.02, 0.03], scattering: 0.05, note: "Hard and smooth: reflects almost everything." },
  { id: "plaster", label: "Smooth plaster", absorption: [0.02, 0.02, 0.03, 0.04, 0.05, 0.05], scattering: 0.05, note: "Plaster on masonry." },
  { id: "wood", label: "Wood panelling", absorption: [0.28, 0.2, 0.1, 0.08, 0.06, 0.06], scattering: 0.15, note: "Thin panel on a frame: absorbs a little low frequency." },
  { id: "parquet", label: "Hardwood floor", absorption: [0.04, 0.04, 0.07, 0.06, 0.06, 0.07], scattering: 0.1, note: "Parquet on joists." },
  { id: "slats", label: "Diffusing wood slats", absorption: [0.2, 0.3, 0.35, 0.3, 0.3, 0.3], scattering: 0.8, note: "Scatters instead of mirroring." },
  { id: "velvet", label: "Heavy velvet curtain", absorption: [0.07, 0.31, 0.49, 0.75, 0.7, 0.6], scattering: 0.2, note: "Draped, with an air gap." },
  { id: "foam", label: "Acoustic foam, 50 mm", absorption: [0.11, 0.3, 0.75, 0.9, 0.95, 0.95], scattering: 0.1, note: "Absorbs mid and high frequency." },
  { id: "glass", label: "Large glass pane", absorption: [0.35, 0.25, 0.18, 0.12, 0.07, 0.04], scattering: 0.05, note: "Reflective above 500 Hz." },
  { id: "carpet", label: "Carpet on concrete", absorption: [0.02, 0.06, 0.14, 0.37, 0.6, 0.65], scattering: 0.2, note: "Takes the high end." },
  { id: "seat-occ", label: "Seats, occupied", absorption: [0.6, 0.74, 0.88, 0.96, 0.93, 0.85], scattering: 0.5, note: "Upholstered seats with people: very absorbent." },
  { id: "seat-empty", label: "Seats, empty", absorption: [0.36, 0.44, 0.31, 0.29, 0.3, 0.25], scattering: 0.4, note: "Upholstered seats, nobody in them." },
];
export const material = (id: string): Material => { const m = MATERIALS.find((x) => x.id === id); if (!m) throw new RangeError(`unknown material "${id}"`); return m; };
export const mixMaterials = (a: Material, b: Material | null, cover: number) => { const c = b ? Math.max(0, Math.min(1, cover)) : 0; return { absorption: a.absorption.map((x, i) => (1 - c) * x + c * (b ? b.absorption[i] : 0)), scattering: (1 - c) * a.scattering + c * (b ? b.scattering : 0) }; };
