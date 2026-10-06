import { expect, test, type Page } from "@playwright/test";
import { heroTimeline } from "../../components/experience/hero-timeline-config";

test.setTimeout(180_000);
test.use({ video: "off", trace: "off" });

async function open(page: Page, locale = "en") {
  await page.goto(`/${locale}?intro=0&phase=discovery`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-loading-progress]")).toHaveAttribute("data-loading-progress", "100", { timeout: 90_000 });
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-runtime", /^(full|adaptive)$/);
}

async function seek(page: Page, frame: number) {
  await page.locator("[data-experience-root]").evaluate((root, progress) => {
    root.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
  }, frame / heroTimeline.lastFrame);
}

test("mobile arrival waits for the finger to lift and scrolling to settle", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await open(page, "fa");
    const director = page.locator("[data-interaction-director]");
    const client = await context.newCDPSession(page);
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 20, y: 500 }] });
    await seek(page, 825);
    await expect(director).toHaveAttribute("data-available-station", "touch");
    await page.waitForTimeout(350);
    await expect(director).toHaveAttribute("data-active-station", "none");
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(director).toHaveAttribute("data-active-station", "touch");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(director).toHaveAttribute("data-scroll-locked", "false");
    await page.screenshot({ path: testInfo.outputPath("mobile-settled-arrival.png") });
  } finally { await context.close(); }
});

test("a large wheel arrival cannot open controls during the same wheel gesture", async ({ page }) => {
  await open(page);
  const elapsed = await page.locator("[data-experience-root]").evaluate((root, progress) => new Promise<number>((resolve, reject) => {
    const started = performance.now();
    window.dispatchEvent(new WheelEvent("wheel", { deltaY: innerHeight * 2, bubbles: true }));
    root.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
    const check = () => {
      if (root.getAttribute("data-interaction-active") === "touch") resolve(performance.now() - started);
      else if (performance.now() - started > 10_000) reject(new Error("Settled wheel arrival did not activate."));
      else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }), 825 / heroTimeline.lastFrame);
  expect(elapsed).toBeGreaterThanOrEqual(250);
});

test("keyboard entry focuses controls and Escape restores focus from the page body without scrolling", async ({ page }) => {
  await open(page);
  await page.keyboard.press("Tab");
  const previous = page.getByRole("navigation", { name: "Primary navigation" }).locator("a").first();
  await previous.focus();
  await seek(page, 825);
  const director = page.locator("[data-interaction-director]");
  const skip = page.locator("[data-interaction-escape]");
  await expect(skip).toBeFocused();
  const top = await page.evaluate(() => scrollY);
  await skip.evaluate((button: HTMLButtonElement) => button.blur());
  await page.keyboard.press("Escape");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(previous).toBeFocused();
  expect(Math.abs(await page.evaluate(() => scrollY) - top)).toBeLessThan(2);
});
