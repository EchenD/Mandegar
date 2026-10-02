import { expect, test, type Locator, type Page } from "@playwright/test";

test.setTimeout(150_000);
test.use({ trace: "off", video: "off" });

async function openInvitation(page: Page) {
  await page.goto("/fa?intro=0&phase=invitation", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-particle-loader]")).toHaveAttribute("data-complete", "true", { timeout: 90_000 });
  await expect(page.locator("[data-experience-root]")).toHaveAttribute("data-story-stage", "invitation");
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-active-station", "none");
  const cta = page.locator("[data-scene-copy='invitation'] [data-analytics='cta_start_project']");
  await expect(cta).toBeVisible();
  await expect(cta).toBeInViewport();
  await expect(cta).toHaveAttribute("href", "/fa/contact");
  return cta;
}

async function expectPointerHitsLink(link: Locator) {
  await expect.poll(() => link.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return hit === element || (hit !== null && element.contains(hit));
  }), { message: "The visible link's center must receive the pointer, including during the hero handoff." }).toBe(true);
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 900, hasTouch: false },
  { name: "mobile", width: 390, height: 844, hasTouch: true },
] as const) {
  test.describe(`Persian invitation on ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: viewport.hasTouch });

    test("the visible project CTA receives a real pointer and opens contact", async ({ page }) => {
      const cta = await openInvitation(page);
      await expectPointerHitsLink(cta);
      const rect = await cta.boundingBox();
      expect(rect).not.toBeNull();
      const x = rect!.x + rect!.width / 2;
      const y = rect!.y + rect!.height / 2;
      if (viewport.hasTouch) await page.touchscreen.tap(x, y);
      else await page.mouse.click(x, y);
      await expect(page).toHaveURL(/\/fa\/contact\/?$/, { timeout: 20_000 });
      await expect(page.locator("main")).toBeVisible();
    });

    test("the same project CTA remains reachable and works with the keyboard", async ({ page }) => {
      const cta = await openInvitation(page);
      await cta.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(cta).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/fa\/contact\/?$/, { timeout: 20_000 });
      await expect(page.locator("main")).toBeVisible();
    });
  });
}
