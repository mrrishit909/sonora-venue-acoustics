import { expect, test } from "@playwright/test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
// Budgets. Frame times here are SwiftShader (CPU rasteriser) numbers: they prove the scene is bounded, not that a GPU hits 60 fps.
const out = new URL("../../apps/web/out/", import.meta.url).pathname;
const size = (dir: string): number => readdirSync(dir).reduce((a, f) => { const p = join(dir, f), s = statSync(p); return a + (s.isDirectory() ? size(p) : f.endsWith(".js") ? gzipSync(readFileSync(p)).length : 0); }, 0);
test("download weight stays inside the budget", () => {
  expect(statSync(out + "models/hall.glb").size).toBeLessThan(900_000);
  expect(size(out + "_next/static/chunks")).toBeLessThan(750_000); // gzipped JS incl. three.js
});
test("scene cost: draw calls and triangles are bounded", async ({ page }) => {
  await page.goto("/?skip=1&view=field"); await page.waitForFunction(() => typeof (window as unknown as { __sonoraStats?: unknown }).__sonoraStats === "function", null, { timeout: 30_000 }); await page.waitForTimeout(2000);
  const st = await page.evaluate(() => (window as unknown as { __sonoraStats: () => { calls: number; triangles: number } }).__sonoraStats());
  console.log("renderer", JSON.stringify(st));
  expect(st.calls).toBeLessThan(150); expect(st.triangles).toBeLessThan(40_000);
});
test("a speaker edit gives a full prediction quickly while the canvas renders", async ({ page }) => {
  await page.goto("/?skip=1&view=speakers&scenario=show"); await expect(page.getByTestId("field-status")).toHaveAttribute("data-done", "true", { timeout: 30_000 }); await page.waitForTimeout(1500);
  const t0 = Date.now(); await page.getByTestId("unit-x").fill("-6"); await expect(page.getByTestId("field-status")).toHaveAttribute("data-done", "false"); await expect(page.getByTestId("field-status")).toHaveAttribute("data-done", "true", { timeout: 15_000 });
  console.log("edit-to-prediction ms", Date.now() - t0); expect(Date.now() - t0).toBeLessThan(5000);
});
