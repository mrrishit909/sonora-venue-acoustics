import { expect, test } from "@playwright/test";
// Visual regression on the product surfaces with the canvas swapped for the poster (WebGL output is not bit-stable across GPUs).
for (const view of ["venue", "speakers", "field", "seats", "compare", "listen"]) {
  test(`visual: ${view}`, async ({ page }) => {
    await page.goto(`/?gfx=off&skip=1&view=${view}`); await page.addStyleTag({ content: "*{animation:none!important;transition:none!important}" });
    await expect(page.getByTestId("hud")).toBeVisible(); await expect(page.getByTestId("hud")).toHaveCSS("opacity", "1"); if (view !== "venue" && view !== "compare" && view !== "listen") await expect(page.getByTestId("field-status")).toHaveAttribute("data-done", "true", { timeout: 15_000 });
    await page.waitForTimeout(300); await expect(page).toHaveScreenshot(`${view}.png`);
  });
}
