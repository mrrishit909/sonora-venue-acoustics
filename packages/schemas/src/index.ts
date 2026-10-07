export type MaterialId = string;
export type SurfaceKey = "left" | "right" | "stage" | "rear" | "floor" | "ceiling";
export type ScenarioId = "speech" | "chamber" | "show";
export type Material = { id: MaterialId; label: string; absorption: number[]; scattering: number; note: string };
export type SurfaceSpec = { base: MaterialId; treat: MaterialId | null; cover: number };
export type SpeakerUnit = { id: string; label: string; x: number; z: number; y: number; elements: number; splayDeg: number; tiltDeg: number; yawDeg: number; levelDb: number; on: boolean };
export type Venue = {
  id: string; name: string; scenario: ScenarioId; balcony: boolean; occupancy: number; reflectors: { on: boolean; y: number };
  surfaces: Record<SurfaceKey, SurfaceSpec>; speakers: SpeakerUnit[]; source: { x: number; z: number; y: number; lwDb: number; k: number };
};
export type Scenario = { id: ScenarioId; label: string; blurb: string; rtTarget: [number, number]; sample: "speech" | "violin" | "band"; venue: Venue };
export type Hall = { w: number; l: number; h: number; stage: { x: [number, number]; z: [number, number]; top: number }; balcony: { deckY: number; z: [number, number]; rows: number }; seats: { center: number; left: number; right: number; balcony: number; total: number; rowPitch: number }; blocks: Record<string, [number[], number[]]>; reflectors: { y: number; x: [number, number]; z: [number, number] }; hang: Record<string, number[]> };
export type Receiver = { id: string; x: number; y: number; z: number; zone: ZoneId };
export type ZoneId = "front" | "rear" | "sides" | "balcony";
export type SavedScenario = { id: string; name: string; at: string; venue: Venue };
