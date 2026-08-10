import { expect, test } from "@playwright/test";

test("creative controls tune, persist and reset the active stage", async ({ page }) => {
  await page.goto("/fa?intro=0&phase=discovery&creative=1", { waitUntil: "networkidle" });

  const panel = page.locator("[data-creative-panel]");
  await expect(panel).toBeVisible();
  await expect(panel.getByLabel("Review stage")).toHaveValue("discovery");

  const signal = panel.locator("label").filter({ hasText: "Signal" }).locator("input");
  await signal.fill("0.73");
  await expect(panel.locator("output").filter({ hasText: "0.73" })).toHaveCount(1);

  await expect.poll(() => page.evaluate(() => {
    const saved = window.localStorage.getItem("mandegar:creative-stage-presets:v1");
    return saved ? JSON.parse(saved).stages.discovery.particleSignal : null;
  })).toBe(0.73);

  await panel.getByRole("button", { name: "Reset stage" }).click();
  await expect(panel.locator("output").filter({ hasText: "0.12" })).toHaveCount(1);
});
