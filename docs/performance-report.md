# Performance report

Measured with `node scripts/measure.mjs` on an Apple M3 Pro with Chrome through SwiftShader (CPU rasteriser). These are bounds, **not GPU results**; no physical GPU was available.

| Metric | Value |
|---|---|
| Transfer | 998 KB, 18 requests (the GLB is 770 KB of it uncompressed, 80 KB gzipped) |
| LCP | 4,612 ms (software rendering, model decode on the main thread) |
| CLS | 0 |
| Long tasks | 2,808 ms in total during load |
| Frame time, field view | median 66.6 ms, p95 66.8 ms in software |
| Draw calls / triangles | 42 / 14,540 (balcony and reflectors on) |
| Prediction | all 303 listener positions of the show preset in about 60 ms in Node; a speaker edit to a finished prediction took 110 to 133 ms in the browser |

Budgets enforced by the e2e suite: GLB under 900 KB, gzipped JS under 750 KB, fewer than 150 draw calls and 40,000 triangles, a speaker edit to a complete prediction under 5 s.
