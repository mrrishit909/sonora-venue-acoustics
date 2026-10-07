# SONORA: a spatial music venue and acoustic designer

Darkness, one tone. A wavefront spreads through empty space and where it reflects, a concert hall appears: seats, a balcony, wall panels, reflectors. Stage lights power up one by one. A conductor raises a hand, and **the first beat** turns the hall into the planner.

Then the planner: a venue builder with modules and materials, a speaker array designer where you drag units on a plan while the prediction fills in behind them, an acoustic field with rays and a heat map, a seat-zone comparison, a two-material comparison, and a listening room that plays a sample through the predicted impulse response of the seat you chose.

Built from blueprint 07 of the *Advanced Engineering Build Book, Volume VII* as a **vertical slice**. **The venue, the coefficients and the speakers are synthetic, and the prediction is simplified design support, not certified acoustic engineering**; it is checked against the physics it implements, not against measurements of a real hall.

- Live: https://mrrishit909.github.io/projects/sonora-venue-acoustics/demo/
- Case study: https://mrrishit909.github.io/projects/sonora-venue-acoustics/

## Run it
```bash
npm ci
npm run seed                      # materials, presets, hall analysis
npm run model                     # Blender 4.5: build.py then validate.py (the GLB is committed, so optional)
npm test                          # 31 domain + API tests
npm run build && node scripts/serve.ts 8691   # static export at http://127.0.0.1:8691
npm run e2e                       # 25 Playwright tests (needs Google Chrome)
node apps/api/src/server.ts       # /v1 API on :8690, OpenAPI at /openapi.json
```
`?skip=1`, `?view=venue|speakers|field|seats|compare|listen`, `&scenario=speech|chamber|show`, `?gfx=off`, `?motion=reduced`.

## The pipeline
`model/parts.json` is the contract for 69 named parts. `build.py` makes the hall kit and writes `analysis.json` (measured bounds and seat counts); `validate.py` re-imports the GLB and fails on a missing part, a misplaced pivot or a part outside the envelope. The acoustics are in `packages/domain` (image sources plus a statistical late field), shared by the browser and the API. See [docs/](docs/) and [design/](design/).

## Agent roles
`.claude/agents/` defines the twelve roles from the book, `.claude/skills/` the project skills. **Honest note:** this repository was produced by one Claude Code session playing those roles in sequence on one working tree, not by parallel subagents in separate worktrees. The multi-agent workflow is the development process; the product contains no agents.

## Not built, and why
PostgreSQL and object storage (JSON files and localStorage), certified or measured coefficients, non-shoebox geometry, spatial audio, a WASM ray engine, authentication, touch tests beyond the phone layout, and a measurement on a physical GPU. Frame numbers are SwiftShader. The intro's tone plays only if the visitor presses a button (browsers block autoplay).
