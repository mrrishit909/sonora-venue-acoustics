# Architecture

```
model/parts.json ──> model/build.py ──Blender──> hall.glb (69 named parts, 14,424 triangles), analysis.json (bounds, 1,063 seats), poster.png
                 └─> model/validate.py (fresh-scene re-import: names, parenting, pivots, applied scale, envelope, budgets)
data/simulators/generate.ts ──> materials.json (11), scenarios.json (3 presets), hall.json (the measured analysis)
packages/domain: materials, hall (surfaces, Eyring RT60, listener grid), speakers, acoustics (image sources + late field), field (zones), rays, ir, scenarios, venue (validation)
apps/web (Next.js 16 static export): App ─ store ─ Panels (DOM + SVG plan, six views) + Scene (R3F hall, heat, rays) + Intro (GSAP) + audio (Web Audio)
apps/api (node:http): the blueprint's section 12 contract; simulate calls the same domain functions
```

**The prediction is a separate, tested module.** Early sound is an image-source sum in the shoebox (reflection orders up to 6, the 80 ms window after the direct sound), with per-wall absorption and scattering by octave band. The late field is the reverberant energy implied by the Eyring reverberation time (Barron-Lee style). Scattering moves a wall's reflected energy from the early to the late field without changing the total (a test checks this). One finite ceiling reflector cloud contributes a single first-order image where the reflection point lies on a panel. Metrics per listener and band: level, clarity C80 and definition D50.

**Progressive prediction.** The browser predicts the 225 stalls and 78 balcony listener positions in chunks of 48 so that dragging a speaker keeps the interface responsive; a new edit cancels the previous run (a token).

**The intro and the product share objects.** The wavefront radius, its six first-order wall images and the stage lights are `live` values that the same hall materials read (a patched `MeshStandardMaterial`); the conductor's first beat moves the same camera rig to the editor pose and opens the interface. Nothing fades to a separate page.

**Audio.** Samples (violin phrase, speech-like syllables, band loop) are generated in the browser, convolved with an impulse response synthesised from the same prediction (exact early arrivals plus a decaying noise tail scaled to the predicted C80), and analysed for the meter and lights.

**Not built.** PostgreSQL (JSON files plus localStorage), object storage, certified or measured coefficients, non-shoebox geometry (fan shapes, curved walls), spatial audio (HRTF), a WASM or Rust ray engine, authentication.
