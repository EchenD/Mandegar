import { expect, test, type Page } from "@playwright/test";
import { heroTimeline } from "../../components/experience/hero-timeline-config";

test.setTimeout(300_000);
test.use({ video: "off", trace: "off" });

async function seek(page: Page, progress: number) {
  const root = page.locator("[data-experience-root]");
  await root.evaluate((element, progress) => {
    element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
  }, progress);
  await expect.poll(async () => Number(await root.getAttribute("data-native-progress"))).toBeCloseTo(progress, 4);
}

async function expectEntryGeometry(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>("[data-experience-root]")!;
    const journey = document.querySelector<HTMLElement>("[data-connected-journey]")!;
    return (journey.getBoundingClientRect().top + scrollY - hero.offsetTop)
      / (hero.offsetHeight - innerHeight);
  })).toBeCloseTo(heroTimeline.cues.heroHandoffStart, 4);
}

for (const variant of [
  { name: "desktop", viewport: { width: 1440, height: 900 }, mobile: false },
  { name: "mobile", viewport: { width: 390, height: 844 }, mobile: true },
] as const) {
  test(`${variant.name} shows intelligence and invitation before the authored page handoff, including reverse and resize`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ viewport: variant.viewport, isMobile: variant.mobile, hasTouch: variant.mobile });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto("/fa?intro=0&phase=intelligence", { waitUntil: "domcontentloaded" });
      const root = page.locator("[data-experience-root]");
      await expect(page.locator("[data-loading-progress]")).toHaveAttribute("data-loading-progress", "100", { timeout: 90_000 });
      await expect(page.locator("[data-work-shortcut]")).toBeAttached();
      await expectEntryGeometry(page);
      const surface = page.locator("[data-journey-surface]");
      const invitation = heroTimeline.phases.find((phase) => phase.id === "invitation")!;
      const intelligence = heroTimeline.phases.find((phase) => phase.id === "intelligence")!;
      const invitationProgress = (invitation.start + invitation.end) / 2;
      const cta = page.locator("[data-scene-copy='invitation'] [data-analytics='cta_start_project']");

      await seek(page, (intelligence.start + intelligence.end) / 2);
      await expect(root).toHaveAttribute("data-story-stage", "intelligence");
      await expect(page.locator("[data-scene-copy='intelligence'] h2")).toBeVisible();
      expect(await surface.evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(variant.viewport.height - 2);

      const expectInvitation = async () => {
        await seek(page, invitationProgress);
        await expect(root).toHaveAttribute("data-story-stage", "invitation");
        await expect(cta).toBeVisible();
        await expect(cta).toBeInViewport();
        await expect(cta).toHaveAttribute("href", "/fa/contact");
        await expect.poll(() => cta.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          return hit === element || (hit !== null && element.contains(hit));
        })).toBe(true);
      };
      await expectInvitation();
      await cta.focus();
      await expect(cta).toBeFocused();
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await page.screenshot({ path: testInfo.outputPath(`${variant.name}-invitation-before-handoff.png`) });

      await seek(page, heroTimeline.cues.heroHandoffStart);
      await expect.poll(() => surface.evaluate((element) => element.getBoundingClientRect().top)).toBeCloseTo(variant.viewport.height, 0);
      await seek(page, (heroTimeline.cues.heroHandoffStart + heroTimeline.cues.heroHandoffEnd) / 2);
      await expect.poll(() => surface.evaluate((element) => element.getBoundingClientRect().top)).toBeCloseTo(variant.viewport.height / 2, 0);
      await page.screenshot({ path: testInfo.outputPath(`${variant.name}-page-handoff.png`) });
      await seek(page, heroTimeline.cues.heroHandoffEnd);
      await expect.poll(() => surface.evaluate((element) => element.getBoundingClientRect().top)).toBeCloseTo(0, 0);
      await expectInvitation();

      await page.setViewportSize({ width: variant.viewport.width, height: variant.viewport.height - 80 });
      await expectEntryGeometry(page);
      await expectInvitation();
      await seek(page, heroTimeline.cues.heroHandoffEnd);
      await expect.poll(() => surface.evaluate((element) => element.getBoundingClientRect().top)).toBeCloseTo(0, 0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
