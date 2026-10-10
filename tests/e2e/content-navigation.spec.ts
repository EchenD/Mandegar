import { expect, test } from "@playwright/test";

const serviceSlugs = [
  "event-production",
  "exhibitions-and-space",
  "websites-and-applications",
  "content-and-media",
  "advertising-structures",
];

test.setTimeout(90_000);

for (const locale of ["fa", "en", "ar"] as const) {
  for (const width of [390, 1440]) {
    test(`${locale} homepage service links open their detail pages at ${width}px with reduced motion`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`/${locale}?intro=0`, { waitUntil: "domcontentloaded" });
      await expect(page.locator("[data-loading-progress]")).toHaveAttribute("data-loading-progress", "100", { timeout: 45_000 });
      await expect(page.locator("[data-experience-root]")).not.toHaveAttribute("data-intro-active", "true");

      const showcase = page.locator("[data-services-showcase]");
      await expect(showcase).toHaveAttribute("data-services-mode", "reduced");
      const links = showcase.locator("[data-service-button]");
      await expect(links).toHaveCount(serviceSlugs.length);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "en" ? "ltr" : "rtl");

      for (let index = 0; index < serviceSlugs.length; index += 1) {
        await expect(links.nth(index)).toHaveAttribute("href", `/${locale}/services/${serviceSlugs[index]}`);
      }

      if (width <= 760) {
        await expect(showcase.locator("[data-service-number]").first()).toBeHidden();
        for (const card of await showcase.locator("[data-service-copy]").all()) {
          const bounds = await card.evaluate((element) => ({
            title: element.querySelector("h3")!.getBoundingClientRect().toJSON(),
            image: element.querySelector("[data-service-poster]")!.getBoundingClientRect().toJSON(),
            description: element.querySelector("p")!.getBoundingClientRect().toJSON(),
          }));
          expect(bounds.title.bottom).toBeLessThanOrEqual(bounds.image.top + 1);
          expect(bounds.image.bottom).toBeLessThanOrEqual(bounds.description.top + 1);
        }
      }

      // The first link is keyboard activated; the last checks pointer access
      // after returning to the homepage from an ordinary detail route.
      await links.first().scrollIntoViewIfNeeded();
      await links.first().focus();
      await expect(links.first()).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(new RegExp(`/${locale}/services/${serviceSlugs[0]}/?$`));
      await expect(page.locator(".serviceDetail h1")).toBeVisible();

      await page.goBack({ waitUntil: "domcontentloaded" });
      await expect(page.locator("[data-experience-root]")).not.toHaveAttribute("data-intro-active", "true");
      await expect(showcase).toHaveAttribute("data-services-mode", "reduced");
      await links.last().click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/services/${serviceSlugs.at(-1)}/?$`));
      await expect(page.locator(".serviceDetail h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
    });
  }
}

test("reduced-motion direct service navigation keeps the linked title clear of the mobile header", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/fa?intro=0", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-loading-progress]")).toHaveAttribute("data-loading-progress", "100", { timeout: 45_000 });
  await expect(page.locator("[data-experience-root]")).not.toHaveAttribute("data-intro-active", "true");
  const showcase = page.locator("[data-services-showcase]");
  await expect(showcase).toHaveAttribute("data-services-mode", "reduced");
  await page.locator("[data-connected-journey]").evaluate((node) => node.dispatchEvent(
    new CustomEvent("mandegar:journey-seek", { detail: { label: "Service3" } }),
  ));
  const link = showcase.locator("[data-service-index='2'] [data-service-button]");
  await expect(link).toBeInViewport();
  await expect(link).toBeFocused();
  const bounds = await link.evaluate((element) => ({
    title: element.getBoundingClientRect().toJSON(),
    header: document.querySelector("header[data-home]")!.getBoundingClientRect().toJSON(),
  }));
  expect(bounds.title.top).toBeGreaterThanOrEqual(bounds.header.bottom + 8 - 1);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/fa\/services\/websites-and-applications\/?$/);
  await expect(page.locator(".serviceDetail h1")).toBeVisible();
});

test("animated homepage service button opens its dedicated page", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en?intro=0", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-loading-progress]")).toHaveAttribute("data-loading-progress", "100", { timeout: 90_000 });
  await page.locator("#primary-navigation a[href='#services']").click();
  const showcase = page.locator("[data-services-showcase]");
  await expect(showcase).toHaveAttribute("data-active-service", "events");
  const link = showcase.locator("[data-service-copy='events'] [data-service-button]");
  await expect(link).toBeInViewport();
  await link.click();
  await expect(page).toHaveURL(/\/en\/services\/event-production\/?$/);
  await expect(page.locator(".serviceDetail h1")).toBeVisible();
});

for (const locale of ["fa", "en", "ar"] as const) {
  for (const viewport of [{ width: 1003, height: 808 }, { width: 360, height: 640 }, { width: 320, height: 568 }, { width: 320, height: 500 }, { width: 844, height: 390 }]) {
    test(`${locale} service title links stay clear of descriptions at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
      test.setTimeout(240_000);
      await page.setViewportSize(viewport);
      await page.goto(`/${locale}?intro=0#services`, { waitUntil: "domcontentloaded" });
      await expect(page.locator("[data-loading-progress]")).toHaveAttribute("data-loading-progress", "100", { timeout: 90_000 });
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "en" ? "ltr" : "rtl");
      const journey = page.locator("[data-connected-journey]");
      const showcase = page.locator("[data-services-showcase]");
      const hint = showcase.locator("[data-services-scroll-hint]");
      const mobileComposition = viewport.width <= 760 || viewport.height <= 500 && viewport.width <= 1000;

      for (let index = 0; index < serviceSlugs.length; index += 1) {
        await journey.evaluate((node, label) => node.dispatchEvent(new CustomEvent("mandegar:journey-seek", { detail: { label } })), `Service${index + 1}`);
        const panel = showcase.locator(`[data-service-index='${index}']`);
        await expect(panel).toHaveAttribute("data-active", "true");
        await expect(panel).toHaveAttribute("data-description-writing", "false");
        const link = panel.locator("h3 [data-service-button]");
        await expect(link).toHaveAttribute("href", `/${locale}/services/${serviceSlugs[index]}`);
        await expect(link).toBeInViewport();
        if (mobileComposition) {
          await expect(hint).toBeHidden();
          await expect(panel.locator("[data-service-number]")).toBeHidden();
        } else {
          await expect(hint).toBeVisible();
        }
        const { linkBounds, descriptionBounds, hintBounds, headerBounds } = await panel.evaluate((element) => ({
          linkBounds: element.querySelector("h3 [data-service-button]")?.getBoundingClientRect().toJSON(),
          descriptionBounds: element.querySelector("p")?.getBoundingClientRect().toJSON(),
          hintBounds: element.closest("[data-services-showcase]")?.querySelector("[data-services-scroll-hint]")?.getBoundingClientRect().toJSON(),
          headerBounds: document.querySelector("header[data-home]")?.getBoundingClientRect().toJSON(),
        }));
        expect(linkBounds).not.toBeNull();
        expect(descriptionBounds).not.toBeNull();
        expect(hintBounds).not.toBeNull();
        expect(linkBounds!.height).toBeGreaterThanOrEqual(44);
        expect(linkBounds!.y + linkBounds!.height).toBeLessThanOrEqual(descriptionBounds!.y + 1);
        if (mobileComposition) {
          expect(linkBounds!.y).toBeGreaterThanOrEqual(headerBounds!.bottom + 8 - 1);
          expect(linkBounds!.bottom).toBeLessThan(viewport.height * .4 + 1);
          expect(descriptionBounds!.y).toBeGreaterThanOrEqual(viewport.height * .7 - 1);
          expect(descriptionBounds!.bottom + 16).toBeLessThanOrEqual(viewport.height + 1);
        } else {
          expect(descriptionBounds!.y + descriptionBounds!.height + 8).toBeLessThanOrEqual(hintBounds!.y + 1);
          expect(hintBounds!.y + hintBounds!.height).toBeLessThanOrEqual(viewport.height + 1);
        }
        if (locale === "fa" && viewport.width === 1003 && index === 3) {
          await page.screenshot({ path: testInfo.outputPath("fa-content-title-link.png") });
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
      const lastLink = showcase.locator("[data-service-button]").last();
      await lastLink.focus();
      await expect(lastLink).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(new RegExp(`/${locale}/services/${serviceSlugs.at(-1)}/?$`), { timeout: 30_000 });
    });
  }
}
