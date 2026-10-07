import { expect, test } from "@playwright/test";

test.setTimeout(90_000);
test.use({ video: "off", trace: "off" });

for (const [locale, width] of [["fa", 390], ["en", 1440], ["ar", 390]] as const) {
  test(`${locale} starts at the top on reload and returns home without script or hydration errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && /script tag|hydrat/i.test(message.text())) errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/${locale}?intro=0`, { waitUntil: "domcontentloaded" });

    const root = page.locator("[data-experience-root]");
    const html = page.locator("html");
    const ready = async () => {
      await expect(page.locator("[data-loading-progress]")).toHaveAttribute("data-loading-progress", "100", { timeout: 45_000 });
      await expect(root).not.toHaveAttribute("data-intro-active", "true");
      await expect(html).not.toHaveAttribute("data-experience-scroll-lock");
      await expect(html).toHaveAttribute("dir", locale === "en" ? "ltr" : "rtl");
      await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBe(0);
      expect(await page.evaluate(() => history.scrollRestoration)).toBe("manual");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    };
    await ready();

    // Client navigation keeps the locale layout mounted. The component's
    // mount reset must still work after Next.js has already run the script.
    await page.locator(`.footer a[href='/${locale}/about']`).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/about/?$`));
    await expect(root).toHaveCount(0);
    await expect(html).not.toHaveAttribute("data-experience-scroll-lock");
    await expect.poll(() => page.evaluate(() => history.scrollRestoration)).toBe("auto");
    await page.locator(`header a[href='/${locale}']`).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/?$`));
    await ready();
    await page.evaluate(() => scrollTo({ top: 1200, behavior: "instant" }));
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(500);
    await page.reload({ waitUntil: "domcontentloaded" });
    expect(Math.round(await page.evaluate(() => scrollY))).toBe(0);
    await ready();
    expect(errors).toEqual([]);
  });
}

for (const [device, width] of [["desktop", 1440], ["mobile", 390]] as const) {
  test(`${device} language links switch between all locales without script or hydration errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && /script tag|hydrat/i.test(message.text())) errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/fa?intro=0", { waitUntil: "domcontentloaded" });
    const html = page.locator("html");
    const root = page.locator("[data-experience-root]");
    for (const [index, locale] of (["fa", "en", "ar", "fa", "ar", "en"] as const).entries()) {
      if (index > 0) {
        await page.evaluate(() => scrollTo({ top: 1200, behavior: "instant" }));
        await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(500);
        if (device === "mobile") {
          const menu = page.locator("header button[aria-controls='primary-navigation']");
          if (await menu.getAttribute("aria-expanded") !== "true") await menu.click();
        }
        await page.locator(`header a[data-analytics='language_select'][href='/${locale}']:visible`).click();
        await expect(page).toHaveURL(new RegExp(`/${locale}/?$`));
      }
      await expect(page.locator("[data-loading-progress]")).toHaveAttribute("data-loading-progress", "100", { timeout: 45_000 });
      await expect(root).not.toHaveAttribute("data-intro-active", "true");
      await expect(html).not.toHaveAttribute("data-experience-scroll-lock");
      await expect(html).toHaveAttribute("lang", locale);
      await expect(html).toHaveAttribute("dir", locale === "en" ? "ltr" : "rtl");
      await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      expect(errors).toEqual([]);
    }
  });
}
