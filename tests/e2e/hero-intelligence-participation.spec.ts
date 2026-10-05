import { expect, test, type Locator, type Page } from "@playwright/test";
import { narrativeScore } from "../../components/experience/narrative-score";
import { getIntelligenceParticipation } from "../../components/experience/intelligence-participation";

test.setTimeout(180_000);
test.use({ trace: "off", video: "off" });

async function openIntelligence(page: Page, locale = "en") {
  await page.goto(`/${locale}?intro=0&phase=intelligence`, { waitUntil: "domcontentloaded" });
  const inspector = page.locator("[data-intelligence-inspector]");
  await expect(inspector).toHaveAttribute("data-available", "true", { timeout: 80_000 });
  await expect(page.locator("[data-intelligence-station-explore]")).toBeEnabled();
  return inspector;
}

async function expectCardInsideViewport(card: Locator) {
  await expect(card).toBeVisible();
  const bounds = await card.boundingBox();
  expect(bounds).not.toBeNull();
  const viewport = card.page().viewportSize()!;
  expect(bounds!.x).toBeGreaterThanOrEqual(11);
  expect(bounds!.y).toBeGreaterThanOrEqual(11);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width - 11);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height - 11);
}

async function targetCenter(target: Locator) {
  await expect(target).toBeVisible();
  const bounds = await target.boundingBox();
  expect(bounds).not.toBeNull();
  return { x: bounds!.x + bounds!.width / 2, y: bounds!.y + bounds!.height / 2 };
}

test("booth and activity monitor targets reveal their participation on hover and click", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const inspector = await openIntelligence(page);
  const card = page.locator("[data-station-readout]");
  for (const station of ["photo", "touch", "stage", "game", "draw"] as const) {
    const target = page.locator(`[data-intelligence-station-target="${station}"]`);
    await expect(target).toBeVisible();
    const hoverPoint = await targetCenter(target);
    await page.mouse.move(hoverPoint.x, hoverPoint.y);
    await expect(inspector).toHaveAttribute("data-station", station);
    await expectCardInsideViewport(card);
    const record = getIntelligenceParticipation(station, "en");
    await expect(card.locator("h3")).toHaveText(record.title);
    await expect(card.locator("[data-station-metric='participants']")).toHaveText(record.metrics[0].value);
    const clickPoint = await targetCenter(target);
    await page.mouse.click(clickPoint.x, clickPoint.y);
    await page.mouse.move(20, 250);
    await expect(inspector).toHaveAttribute("data-station", station);
    await expect(inspector).toHaveAttribute("data-pinned", "true");
    if (station === "photo") await page.screenshot({ path: testInfo.outputPath("intelligence-photo-participation-desktop.png") });
    await page.keyboard.press("Escape");
    await expect(inspector).toHaveAttribute("data-station", "none");
  }
  // The original wide-screen signal remains the Intelligence owner throughout.
  await expect(page.locator("[data-intelligence-monitor-canvas]")).toHaveAttribute("data-monitor-person", "none");
  await expect(page.locator("[data-intelligence-monitor-canvas]")).toHaveAttribute("data-monitor-state", "playing");
});

test("the physical game monitor reveals and pins participation through native canvas input", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const inspector = await openIntelligence(page);
  await expect.poll(async () => {
    const surfaces = JSON.parse(await inspector.getAttribute("data-station-surfaces") ?? "[]") as { id: string; x: number; y: number }[];
    return surfaces.some((surface) => surface.id === "game");
  }).toBe(true);
  const point = (JSON.parse(await inspector.getAttribute("data-station-surfaces") ?? "[]") as { id: string; x: number; y: number }[]).find((surface) => surface.id === "game")!;
  const canvas = page.locator("[data-experience-canvas='true'] canvas");
  // This point must reach the original WebGL canvas, outside every DOM hotspot.
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, point)).toBe("CANVAS");
  await canvas.evaluate((surface: HTMLCanvasElement) => {
    surface.addEventListener("pointermove", () => { surface.dataset.nativeStationHover = "true"; }, { once: true });
    surface.addEventListener("click", () => { surface.dataset.nativeStationClick = "true"; }, { once: true });
  });
  await page.mouse.move(point.x, point.y);
  await expect(canvas).toHaveAttribute("data-native-station-hover", "true");
  await expect(inspector).toHaveAttribute("data-station", "game");
  await expect(inspector).toHaveAttribute("data-pinned", "false");
  await expectCardInsideViewport(page.locator("[data-station-readout]"));
  await page.mouse.click(point.x, point.y);
  await expect(canvas).toHaveAttribute("data-native-station-click", "true");
  await page.mouse.move(20, 250);
  await expect(inspector).toHaveAttribute("data-station", "game");
  await expect(inspector).toHaveAttribute("data-pinned", "true");
  await expect(page.locator("[data-station-metric='result']")).toHaveText(getIntelligenceParticipation("game", "en").metrics[1].value);
  await page.screenshot({ path: testInfo.outputPath("intelligence-game-participation-native-monitor.png") });
  await page.keyboard.press("Escape");
  await expect(inspector).toHaveAttribute("data-station", "none");
});

test("keyboard participation browsing keeps person selection and chapter cleanup available", async ({ page }) => {
  const inspector = await openIntelligence(page);
  const explore = page.locator("[data-intelligence-station-explore]");
  await explore.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-station-next]")).toBeFocused();
  const first = await inspector.getAttribute("data-station");
  await page.keyboard.press("Enter");
  await expect(inspector).not.toHaveAttribute("data-station", first!);
  await page.keyboard.press("Escape");
  await expect(explore).toBeFocused();
  await expect(inspector).toHaveAttribute("data-station", "none");
  await page.locator("[data-intelligence-explore]").click();
  await expect(inspector).not.toHaveAttribute("data-person", "none");
  await expect(inspector).toHaveAttribute("data-station", "none");
  await page.keyboard.press("Escape");
  await explore.click();
  const proof = narrativeScore.find((beat) => beat.id === "proof")!;
  await page.locator("[data-experience-root]").evaluate((root, progress) => {
    root.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
  }, proof.preview);
  await expect(inspector).toHaveAttribute("data-available", "false");
  await expect(inspector).toHaveAttribute("data-station", "none");
  await expect(page.locator("[data-station-readout]")).toHaveCount(0);
});

for (const locale of ["fa", "ar"] as const) {
  test(`${locale} mobile participation cards remain inside the viewport and close on tap`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await context.newPage();
    const inspector = await openIntelligence(page, locale);
    const targets = page.locator("[data-intelligence-station-target]");
    const tapPoint = await targetCenter(targets.first());
    await page.touchscreen.tap(tapPoint.x, tapPoint.y);
    const card = page.locator("[data-station-readout]");
    await expectCardInsideViewport(card);
    await expect(card).toHaveAttribute("dir", "rtl");
    await expect(card.locator("[data-station-metric='participants']")).not.toBeEmpty();
    await page.screenshot({ path: testInfo.outputPath(`intelligence-participation-${locale}-mobile.png`) });
    await expect(page.locator("[data-intelligence-monitor-canvas]")).toHaveAttribute("data-monitor-person", "none");
    await page.locator("[data-station-next]").tap();
    await expectCardInsideViewport(card);
    await page.locator("[data-station-close]").tap();
    await expect(inspector).toHaveAttribute("data-station", "none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await context.close();
  });
}
