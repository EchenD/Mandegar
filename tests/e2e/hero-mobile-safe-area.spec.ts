import { expect, test, type Locator, type Page } from "@playwright/test";
import { getHeroPhase } from "../../components/experience/hero-timeline-config";
import { getNarrativeCopyTiming } from "../../components/experience/narrative-copy-timing";
import type { ScenePhaseId } from "../../components/experience/narrative-score";

test.setTimeout(240_000);
test.use({ hasTouch: true, isMobile: true, video: "off", trace: "off" });

async function seekPhase(page: Page, phase: ScenePhaseId) {
  const timing = getNarrativeCopyTiming(phase);
  const root = page.locator("[data-experience-root]");
  await root.evaluate((element, progress) => {
    element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
  }, (timing.enterEnd + timing.exitStart) / 2);
  await expect(root).toHaveAttribute("data-story-stage", phase);
  await expect.poll(async () => Number(await root.getAttribute("data-camera-frame")), {
    timeout: 20_000,
  }).toBeCloseTo(getHeroPhase(phase).viewFrame, 1);
}

async function setViewportAndInset(page: Page, width: number, height: number, safeBottom: number) {
  await page.setViewportSize({ width, height });
  // The shared inset variable lets this exercise a notched phone without
  // depending on the test browser's platform-specific env() values.
  await page.locator("[data-experience-root]").evaluate((element: HTMLElement, inset) => {
    element.style.setProperty("--hero-mobile-safe-bottom", `${inset}px`);
  }, safeBottom);
}

async function expectInsideViewport(locator: Locator) {
  await expect(locator).toBeVisible();
  const viewport = locator.page().viewportSize()!;
  await expect.poll(() => locator.evaluate((element, size) => {
    const bounds = element.getBoundingClientRect();
    return Math.min(bounds.left, bounds.top, size.width - bounds.right, size.height - bounds.bottom);
  }, viewport)).toBeGreaterThanOrEqual(-0.5);
}

async function expectAbove(first: Locator, second: Locator, gap = 8) {
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  await expect.poll(async () => {
    const [a, b] = await Promise.all([first.boundingBox(), second.boundingBox()]);
    return a && b ? b.y - a.y - a.height : -Infinity;
  }).toBeGreaterThanOrEqual(gap);
}

async function expectSeparate(first: Locator, second: Locator, gap = 0) {
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  await expect.poll(async () => {
    const [a, b] = await Promise.all([first.boundingBox(), second.boundingBox()]);
    return a && b ? Math.max(
      b.x - a.x - a.width,
      a.x - b.x - b.width,
      b.y - a.y - a.height,
      a.y - b.y - b.height,
    ) : -Infinity;
  }).toBeGreaterThanOrEqual(gap);
}

for (const locale of ["fa", "en", "ar"] as const) {
  test(`${locale} lower hero copy clears safe-area status and compact Intelligence targets`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 421 });
    await page.goto(`/${locale}?intro=0&phase=discovery`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-loading-progress]")).toHaveAttribute("data-loading-progress", "100", { timeout: 100_000 });
    await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-runtime", /^(adaptive|full)$/, { timeout: 80_000 });
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "en" ? "ltr" : "rtl");
    const status = page.locator("[data-phase-rail]");

    // 421px sits just above the compact narrative layout breakpoint.
    await setViewportAndInset(page, 320, 421, 34);
    for (const phase of ["discovery", "proof", "invitation", "reveal"] as const) {
      await seekPhase(page, phase);
      const copy = page.locator(`[data-scene-copy='${phase}']`);
      await expectInsideViewport(copy);
      await expectAbove(copy, status);
      if (phase === "invitation") {
        await expectInsideViewport(copy.locator("a"));
      }
    }

    if (locale === "fa") {
      for (const [width, height, safeBottom] of [
        [320, 421, 0],
        [320, 568, 34],
        [390, 600, 34],
        [390, 844, 0],
      ] as const) {
        await setViewportAndInset(page, width, height, safeBottom);
        await seekPhase(page, "reveal");
        const copy = page.locator("[data-scene-copy='reveal']");
        await expectInsideViewport(copy);
        await expectAbove(copy, status);
      }
    }

    for (const height of [421, 430, 500, 540, 541]) {
      await setViewportAndInset(page, 320, height, 34);
      await seekPhase(page, "intelligence");
      const inspector = page.locator("[data-intelligence-inspector]");
      await expect(inspector).toHaveAttribute("data-available", "true", { timeout: 30_000 });
      const copy = page.locator("[data-scene-copy='intelligence']");
      const people = page.locator("[data-intelligence-explore]");
      const stations = page.locator("[data-intelligence-station-explore]");
      const targets = page.locator("[data-intelligence-station-target]");
      await expect.poll(() => targets.count()).toBeGreaterThan(0);
      await expectInsideViewport(copy);
      await expectInsideViewport(people);
      await expectInsideViewport(stations);
      await expectSeparate(copy, people);
      await expectSeparate(copy, stations);
      await expectSeparate(people, stations);
      await expectAbove(people, status);
      await expectAbove(stations, status);
      for (const target of await targets.all()) {
        await expectSeparate(copy, target, 8);
      }
    }

    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
  });
}
