import { expect, test, type Page } from "@playwright/test";
const open = async (page: Page, url: string) => { await page.goto(url); await expect(page.getByTestId("hud")).toBeVisible({ timeout: 30_000 }); await expect(page.locator(".app")).toHaveAttribute("data-intro", "done"); await expect(page.getByTestId("hud")).toHaveCSS("opacity", "1"); };
const done = (page: Page) => expect(page.getByTestId("field-status")).toHaveAttribute("data-done", "true", { timeout: 20_000 });
const num = async (page: Page, id: string) => Number((await page.getByTestId(id).textContent())!.replace(/[^0-9.\-]/g, ""));
type W = { __sLive: { wave: number; revealOn: number; level: number } };

// Blueprint section 19, the demo script.
test("demo walk: intro, venue builder, move a speaker, simulate, compare materials, play audio, save", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByTestId("skip-intro")).toBeVisible(); await expect(page.getByTestId("intro")).toHaveAttribute("data-step", /[0-9]/);
  await page.getByTestId("skip-intro").click(); await expect(page.getByTestId("intro")).toHaveCount(0, { timeout: 40_000 });
  await expect(page.getByTestId("hud")).toHaveCSS("opacity", "1", { timeout: 10_000 }); // toBeVisible ignores opacity, so assert it
  expect(await page.evaluate(() => (window as unknown as W).__sLive.revealOn)).toBe(0);
  // venue builder: a scenario, the reverberation target, a module
  await expect(page.getByRole("heading", { name: "Venue builder" })).toBeVisible(); await page.getByTestId("scenario-show").click(); await expect(page.getByTestId("rt-chip")).toHaveAttribute("data-ok", "true"); const rtShow = await num(page, "rt-mid");
  await page.getByTestId("scenario-speech").click(); expect(await num(page, "rt-mid")).toBeLessThan(rtShow); await page.getByTestId("scenario-show").click();
  // move the speaker array: keyboard on the plan, prediction updates progressively and then completes
  await page.getByTestId("nav-speakers").click(); await done(page); await page.getByTestId("unit-arrayL").click(); const x0 = Number(await page.getByTestId("unit-x").inputValue()), spread0 = await num(page, "spread");
  await page.getByTestId("plan-unit-arrayL").focus(); for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowDown"); await page.keyboard.press("Shift+ArrowRight");
  expect(Number(await page.getByTestId("unit-x").inputValue())).toBeCloseTo(x0 + 3, 0); // positions snap to a quarter metre await done(page); expect(await num(page, "spread")).not.toBe(spread0);
  // simulation: the field view, a click on the map, another quantity
  await page.getByTestId("nav-field").click(); await done(page); await page.getByTestId("plan").locator(".cell").nth(10).click(); const spl1 = await num(page, "reading-spl"); await page.getByTestId("plan").locator(".cell").nth(200).click(); expect(await num(page, "reading-spl")).not.toBe(spl1);
  await page.getByTestId("metric").selectOption("c80"); await expect(page.getByTestId("legend")).toBeVisible(); await page.getByTestId("band").selectOption("0");
  // zones
  await page.getByTestId("nav-seats").click(); const c80 = async (z: string) => Number((await page.getByTestId(`zone-${z}`).locator("td").nth(1).textContent())); expect(await c80("front")).toBeGreaterThan(await c80("rear"));
  // compare two materials: foam on the rear wall shortens the reverberation, and applying B changes the venue
  await page.getByTestId("nav-compare").click(); await page.getByTestId("cmp-surface").selectOption("rear"); await page.getByTestId("cmp-a").selectOption("concrete"); await page.getByTestId("cmp-b").selectOption("foam"); expect(await num(page, "cmp-delta-rt")).toBeLessThan(0); await page.getByTestId("apply-b").click();
  await page.getByTestId("nav-venue").click(); await expect(page.getByTestId("surf-rear-base")).toHaveValue("foam");
  // audio: play (or report that audio is unavailable), reactive meter, stop
  await page.getByTestId("nav-listen").click(); await page.getByTestId("play").click(); await expect.poll(() => page.getByTestId("audio-state").getAttribute("data-state"), { timeout: 10_000 }).toMatch(/playing|unavailable/); await page.getByTestId("stop").click(); await expect(page.getByTestId("audio-state")).toHaveAttribute("data-state", "idle");
  // save a scenario and find it in the list
  await page.getByTestId("save-name").fill("Test hall"); await page.getByTestId("save").click(); await expect(page.getByTestId("saved-list")).toContainText("Test hall");
  expect(errors).toEqual([]);
});
test("dragging a speaker on the plan moves it and the prediction follows", async ({ page }) => {
  await open(page, "/?skip=1&view=speakers&scenario=show"); await done(page); await page.getByTestId("unit-arrayR").click(); const z0 = Number(await page.getByTestId("unit-z").inputValue()), x0 = Number(await page.getByTestId("unit-x").inputValue());
  const b = (await page.getByTestId("plan-unit-arrayR").locator("rect").boundingBox())!; const sx = b.x + b.width / 2, sy = b.y + b.height / 2; await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx + 60, sy + 40, { steps: 6 }); await page.mouse.up();
  expect(Number(await page.getByTestId("unit-z").inputValue())).toBeGreaterThan(z0 + 2); expect(Number(await page.getByTestId("unit-x").inputValue())).not.toBe(x0); await done(page);
});
test("saved scenarios persist across a reload and can be loaded and deleted", async ({ page }) => {
  await open(page, "/?skip=1&view=listen&scenario=speech"); await page.getByTestId("save-name").fill("Lecture A"); await page.getByTestId("save").click(); await page.goto("/?skip=1&view=listen&scenario=show"); await expect(page.getByTestId("saved-list")).toContainText("Lecture A");
  await page.getByTestId("saved-list").getByRole("button", { name: "Load" }).click(); await page.getByTestId("nav-venue").click(); await expect(page.getByTestId("scenario-speech")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("nav-listen").click(); await page.getByTestId("saved-list").getByRole("button", { name: "Delete" }).click(); await expect(page.getByTestId("saved-list")).not.toContainText("Lecture A");
});
test("modules change the hall: removing the balcony drops its seats, its zone and its triangles", async ({ page }) => {
  await open(page, "/?skip=1&view=venue&scenario=chamber"); await page.waitForFunction(() => typeof (window as unknown as { __sonoraStats?: unknown }).__sonoraStats === "function"); await page.waitForTimeout(1200);
  const tris = () => page.evaluate(() => (window as unknown as { __sonoraStats: () => { triangles: number } }).__sonoraStats().triangles); const before = await tris(), seats0 = await page.getByTestId("seat-count").textContent();
  await page.getByTestId("balcony").uncheck(); await page.waitForTimeout(800); expect(await tris()).toBeLessThan(before); expect(await page.getByTestId("seat-count").textContent()).not.toBe(seats0);
  await page.getByTestId("nav-seats").click(); await done(page); await expect(page.getByTestId("zone-balcony")).toHaveCount(0); await expect(page.getByTestId("seat-balcony")).toHaveCount(0);
});
test("more treatment lowers the reverberation time, and the verdict follows the scenario's target", async ({ page }) => {
  await open(page, "/?skip=1&view=venue&scenario=chamber"); const t0 = await num(page, "rt-mid"); await page.getByTestId("surf-ceiling-treat").selectOption("foam"); await page.getByTestId("surf-ceiling-cover").fill("1"); expect(await num(page, "rt-mid")).toBeLessThan(t0); await expect(page.getByTestId("rt-chip")).toHaveAttribute("data-ok", "false");
});
test("deep link opens a view and a scenario", async ({ page }) => { await open(page, "/?view=field&scenario=speech"); await expect(page.getByRole("heading", { name: "Acoustic field" })).toBeVisible(); await page.getByTestId("nav-venue").click(); await expect(page.getByTestId("scenario-speech")).toHaveAttribute("aria-pressed", "true"); });
test("refresh mid-sequence restarts the intro cleanly", async ({ page }) => { await page.goto("/"); await page.waitForTimeout(1500); await page.reload(); await expect(page.getByTestId("intro")).toHaveAttribute("data-step", /[01]/); });
test("keyboard: views and surfaces are reachable without a pointer", async ({ page }) => {
  await open(page, "/?skip=1&view=venue"); await expect(async () => { await page.getByTestId("nav-compare").focus(); await expect(page.getByTestId("nav-compare")).toBeFocused({ timeout: 500 }); }).toPass({ timeout: 15_000 });
  await page.keyboard.press("Enter"); await expect(page.getByRole("heading", { name: "Compare two materials" })).toBeVisible();
});
test("choices made while the intro's last fade is still running are kept", async ({ page }) => {
  await page.goto("/"); await page.getByTestId("skip-intro").click(); await expect(page.getByTestId("hud")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("nav-seats").click(); await expect(page.getByTestId("intro")).toHaveCount(0, { timeout: 40_000 }); await expect(page.getByRole("heading", { name: "Audience experience" })).toBeVisible();
});
test("the intro's wavefront reveals the hall and ends with the whole hall lit", async ({ page }) => {
  await page.goto("/"); await page.waitForFunction(() => (window as unknown as W).__sLive?.wave > 3, null, { timeout: 40_000 }); const early = await page.evaluate(() => (window as unknown as W).__sLive.revealOn); expect(early).toBe(1);
  await page.getByTestId("skip-intro").click(); await expect(page.getByTestId("intro")).toHaveCount(0, { timeout: 40_000 }); expect(await page.evaluate(() => (window as unknown as W).__sLive.wave)).toBeGreaterThanOrEqual(46);
});
