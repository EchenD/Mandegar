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
