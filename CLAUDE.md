# SONORA

Spatial music venue and acoustic designer demo (blueprint 07, Advanced Engineering Build Book Vol. VII). Static site; the Blender hall kit is scripted. Every venue, material coefficient and speaker is synthetic or simplified. It is design support, NOT certified acoustic engineering.

- Build the asset: `npm run model` (Blender 4.5 at ~/Applications), then `node scripts/copy-assets.ts`. Contract: `model/parts.json` (69 named parts: shell, stage, 4 seat blocks, balcony, 20 wall panels, 6 reflectors, 4 speaker units, 6 stage lights, conductor, `Proxy_Hall`). The build also writes `model/exports/analysis.json` (measured bounds, seat counts) which `packages/domain/test` checks against the hall constants.
- Acoustics: `packages/domain/src` (acoustics.ts image sources order <= 6 plus a statistical late field, hall.ts Eyring RT60 and surfaces, field.ts zones, rays.ts, ir.ts). Tests: `npm test`, `npm run e2e` after `npm run build`.
- Space: glTF axes in metres, stage at z = -18, audience looks toward -z, the rear wall is at z = +18, floor y = 0. The plan view is stage-left: svg x = hall z, svg y = hall x.
- State: saved scenarios in localStorage `sonora:v1`; `window.__sLive` and `window.__sonoraStats` are exposed for tests.
- Multi-agent is the development process only (.claude/agents); the product contains no agents.
