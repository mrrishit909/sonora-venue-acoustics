import { expect, test } from "@playwright/test";
test("reduced motion: static story, no timeline, same planner", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" }), page = await ctx.newPage(); await page.goto("/");
  await expect(page.getByRole("dialog", { name: "Opening story" })).toContainText("violin"); await expect(page.getByTestId("pause-motion")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("skip-intro").click(); await expect(page.getByRole("heading", { name: "Venue builder" })).toBeVisible(); await page.getByTestId("nav-seats").click(); await expect(page.getByTestId("zones")).toBeVisible(); await ctx.close();
});
test("graphics failure: the poster still, and every view still works from the DOM", async ({ page }) => {
  await page.goto("/?gfx=off&skip=1&view=speakers&scenario=show"); await expect(page.getByTestId("poster")).toBeVisible(); await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.getByTestId("field-status")).toHaveAttribute("data-done", "true", { timeout: 20_000 }); await page.getByTestId("unit-x").fill("-5"); await expect(page.getByTestId("field-status")).toHaveAttribute("data-done", "true", { timeout: 20_000 });
  await page.getByTestId("nav-seats").click(); await expect(page.getByTestId("zone-front")).toBeVisible(); await page.getByTestId("nav-compare").click(); await expect(page.getByTestId("cmp-table")).toBeVisible();
});
test("WebGL context loss falls back to the poster", async ({ page }) => {
  await page.goto("/?skip=1&view=field"); await expect(page.locator("canvas")).toHaveCount(1, { timeout: 30_000 }); await page.waitForFunction(() => typeof (window as unknown as { __sonoraStats?: unknown }).__sonoraStats === "function");
  await page.evaluate(() => document.querySelector("canvas")!.dispatchEvent(new Event("webglcontextlost", { cancelable: true }))); await expect(page.getByTestId("poster")).toBeVisible(); await page.getByTestId("nav-seats").click(); await expect(page.getByTestId("zones")).toBeVisible();
});
test("phone width: nothing scrolls sideways and the panel stays reachable", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true }), page = await ctx.newPage(); await page.goto("/?skip=1&view=venue&gfx=off");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0); await expect(page.getByTestId("nav-speakers")).toBeVisible(); await page.getByTestId("nav-speakers").click(); await expect(page.getByTestId("plan")).toBeVisible(); await ctx.close();
});
test("audio unavailable: the page says so and the prediction still works", async ({ browser }) => {
  const ctx = await browser.newContext(), page = await ctx.newPage(); await page.addInitScript(() => { delete (window as unknown as Record<string, unknown>).AudioContext; delete (window as unknown as Record<string, unknown>).webkitAudioContext; });
  await page.goto("/?skip=1&view=listen&gfx=off"); await page.getByTestId("play").click(); await expect(page.getByTestId("audio-state")).toHaveAttribute("data-state", "unavailable"); await expect(page.getByTestId("audio-state")).toContainText("not available"); await ctx.close();
});
test("pause motion stops the ambient animation", async ({ page }) => { await page.goto("/?skip=1&view=field"); await page.getByTestId("pause-motion").click(); await expect(page.getByTestId("pause-motion")).toHaveAttribute("aria-pressed", "true"); });
