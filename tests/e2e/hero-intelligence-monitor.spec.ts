import { expect, test, type Page } from "@playwright/test";
import { narrativeScore } from "../../components/experience/narrative-score";
import { interactionSurfaceSizes } from "../../components/experience/scene-config";
import { getIntelligenceCopy } from "../../components/experience/intelligence-inspector-copy";
import { getMonitorTextureSamples, observeMonitorTextures } from "./monitor-texture-observer";

test.setTimeout(180_000);
test.use({ trace: "off", video: "off" });

async function seek(page: Page, id: string) {
  const beat = narrativeScore.find((item) => item.id === id)!;
  await page.locator("[data-experience-root]").evaluate((root, progress) => {
    root.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
  }, beat.preview);
}

async function waitForMonitor(page: Page) {
  const surface = page.locator("[data-intelligence-monitor-canvas]");
  await expect(surface).toHaveAttribute("data-monitor-state", "playing", { timeout: 80_000 });
  await expect(surface).toHaveAttribute("data-monitor-blend", "1.000");
  return surface;
}

test("the wide Intelligence monitor animates, follows the latest person and retains its painted content", async ({ page }, testInfo) => {
  await observeMonitorTextures(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" && /shader|WebGLProgram|VALIDATE_STATUS/.test(message.text())) errors.push(message.text()); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en?intro=0&phase=intelligence", { waitUntil: "domcontentloaded" });
  const surface = await waitForMonitor(page);
  const inspector = page.locator("[data-intelligence-inspector]");
  await expect(inspector).toHaveAttribute("data-available", "true", { timeout: 60_000 });
  await expect(surface).toHaveAttribute("width", String(interactionSurfaceSizes.videoWall.canvas.width));
  await expect(surface).toHaveAttribute("height", String(interactionSurfaceSizes.videoWall.canvas.height));
  await expect(surface).toHaveAttribute("aria-label", /Participation signal.*Audience insight/);
  await expect.poll(async () => (await getMonitorTextureSamples(page, "videoWall")).some((sample) => sample.media === "intelligence" && sample.blend > 0.99)).toBe(true);
  const firstFrame = await surface.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await expect.poll(() => surface.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())).not.toBe(firstFrame);
  await page.screenshot({ path: testInfo.outputPath("intelligence-ambient-desktop.png") });

  await inspector.locator("[data-intelligence-explore]").focus();
  await page.keyboard.press("Enter");
  for (let index = 0; index < 3; index += 1) await page.keyboard.press("Enter");
  const selected = await inspector.getAttribute("data-person");
  await expect(surface).toHaveAttribute("data-monitor-person", selected!);
  await expect(inspector).toHaveAttribute("data-world-readout-person", selected!);
  await expect(inspector).toHaveAttribute("data-world-readout-state", "ready");
  await expect(page.locator("[data-scene-copy='intelligence']")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("intelligence-selected-desktop.png") });
  await page.keyboard.press("Escape");
  await expect(surface).toHaveAttribute("data-monitor-person", "none");

  await seek(page, "proof");
  await expect(surface).toHaveAttribute("data-monitor-state", "hidden");
  await expect(surface).toHaveAttribute("data-monitor-blend", "0.000");
  await expect.poll(async () => (await getMonitorTextureSamples(page, "videoWall")).at(-1)?.media).toBe("intelligence");
  await seek(page, "intelligence");
  await waitForMonitor(page);
  await expect(surface).toHaveAttribute("data-monitor-person", "none");
  expect(errors).toEqual([]);
});

test("reverse travel hands the wide monitor from Intelligence back to scroll lighting", async ({ page }) => {
  await observeMonitorTextures(page);
  await page.goto("/en?intro=0&phase=intelligence", { waitUntil: "domcontentloaded" });
  const surface = await waitForMonitor(page);
  await seek(page, "reveal");
  await expect(surface).toHaveAttribute("data-monitor-state", "hidden");
  // The authored reveal preview is halfway through the scroll lighting window.
  await expect.poll(async () => Number(await page.locator("[data-stage-scroll]").getAttribute("data-stage-progress"))).toBeCloseTo(0.5, 3);
  await expect.poll(async () => (await getMonitorTextureSamples(page, "videoWall")).at(-1)?.media).toBe("stage");
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-active-station", "none");
  await seek(page, "intelligence");
  await waitForMonitor(page);
});

for (const locale of ["fa", "ar"] as const) {
  test(`${locale} mobile signals use the same wide monitor and compact head graphics`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await context.newPage();
    await page.goto(`/${locale}?intro=0&phase=intelligence`, { waitUntil: "domcontentloaded" });
    const surface = await waitForMonitor(page);
    const inspector = page.locator("[data-intelligence-inspector]");
    await expect(inspector).toHaveAttribute("data-available", "true", { timeout: 70_000 });
    await expect(surface).toHaveAttribute("width", "1740");
    await expect(surface).toHaveAttribute("height", "450");
    await expect(surface).toHaveAttribute("aria-label", `${getIntelligenceCopy(locale).signal}. ${getIntelligenceCopy(locale).example}.`);
    await expect.poll(async () => JSON.parse(await inspector.getAttribute("data-visible-people") ?? "[]").length).toBeGreaterThan(0);
    const person = JSON.parse(await inspector.getAttribute("data-visible-people") ?? "[]")[0] as { id: string; x: number; y: number };
    await page.touchscreen.tap(person.x, person.y);
    await expect(surface).toHaveAttribute("data-monitor-person", person.id);
    await expect(inspector).toHaveAttribute("data-world-readout-person", person.id);
    await expect(inspector).toHaveAttribute("data-world-readout-state", "ready");
    const leader = JSON.parse(await inspector.getAttribute("data-world-readout-leader") ?? "null");
    expect(Math.abs(leader.start.x - leader.end.x)).toBeGreaterThan(0);
    expect(leader.end.y).toBeLessThan(leader.start.y);
    expect(Math.abs(leader.end.y - leader.start.y)).toBeLessThanOrEqual(90);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`intelligence-signals-${locale}-mobile.png`) });
    await context.close();
  });
}

test("switching reduced motion off and on safely rebuilds and releases the Intelligence scene", async ({ page }) => {
  await page.goto("/en?intro=0&phase=intelligence", { waitUntil: "domcontentloaded" });
  await waitForMonitor(page);
  const root = page.locator("[data-experience-root]");
  const progress = Number(await root.getAttribute("data-native-progress"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("[data-semantic-fallback]")).toBeVisible();
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-scroll-locked", "false");
  await expect(page.locator("[data-intelligence-monitor-canvas]")).toHaveAttribute("data-monitor-state", "hidden");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await waitForMonitor(page);
  await expect(root).toHaveAttribute("data-story-stage", "intelligence");
  expect(Math.abs(Number(await root.getAttribute("data-native-progress")) - progress)).toBeLessThan(0.002);
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-active-station", "none");
  await expect(page.locator("[data-intelligence-inspector]")).toHaveAttribute("data-available", "true", { timeout: 60_000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("[data-semantic-fallback]")).toBeVisible();
  await expect(page.locator("[data-intelligence-monitor-canvas]")).toHaveAttribute("data-monitor-state", "hidden");
});

test("a page opened with reduced motion can restore scrolling and enter Intelligence", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en?intro=0", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-semantic-fallback]")).toBeVisible();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator("[data-mandegar-experience]")).toHaveAttribute("data-runtime", "full");
  await seek(page, "intelligence");
  await waitForMonitor(page);
  await expect(page.locator("[data-intelligence-inspector]")).toHaveAttribute("data-available", "true", { timeout: 60_000 });
  await expect(page.locator("[data-experience-root]")).toHaveAttribute("data-story-stage", "intelligence");
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-scroll-locked", "false");
});
