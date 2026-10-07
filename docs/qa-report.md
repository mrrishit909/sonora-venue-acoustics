# QA report

Apple M3 Pro, Chrome stable, Playwright 1.63, WebGL through SwiftShader. Last full runs: 25 e2e passed three times in a row after the final fix; 31 unit and API tests passed.

| Matrix row (blueprint 18) | Covered by | Result |
|---|---|---|
| Intro first load, skip, refresh mid-sequence | demo walk (asserts HUD opacity 1 and the reveal switched off), refresh test, choices during the last fade kept, wavefront test | pass |
| Input: click, keyboard, drag | demo walk (keyboard on the plan), a pointer drag of a speaker, keyboard navigation of the views | pass |
| Input: touch | phone layout only | not tested |
| Responsive | phone 390 px: rail becomes a strip, panel below, no sideways overflow | pass at one phone size |
| Motion: reduced | static story, same planner | pass |
| Graphics: success, failure, context loss | `?gfx=off` journey through speakers, seats and compare; lost-context event | pass |
| Audio: unavailable | the Web Audio constructors are removed; the page says so | pass |
| Acoustics | RT60 targets per preset, 6 dB per distance doubling, 3 dB for two sources, mirror symmetry, scattering conserves energy, reflectors raise clarity, ray reflection law and timing, IR energy split matches C80 | pass (31 unit and API tests) |
| Persistence | saved scenarios survive a reload, load and delete | pass |
| Modules | removing the balcony drops its seats, zone and triangles | pass |
| Visual regression | six views against the poster fallback | pass |
| Performance | budgets in tests/e2e/performance.spec.ts | pass |

**Not validated against the real world.** The predictions are checked against the physics they implement, not against measurements of any real hall.

Defects found during the build: the validator caught two wall panels poking through the end wall and a lights group dropped by the export's selection; the orbit camera started outside the closed wall slabs and saw only a dark exterior; the ceiling slab hid the plan-from-above camera until it was hidden by camera height; the audience camera sat under the balcony and could not see the ceiling; a keyboard move read a stale position and moved only once per render (fixed by reading the current state); a drag test grabbed the label instead of the unit.
