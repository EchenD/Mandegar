import { expect, test, type Page } from "@playwright/test";

test.setTimeout(180_000);
test.use({ video: "off", trace: "off" });

async function expectReadablePartners(page: Page, title: string) {
  const partners = page.locator("[data-partners]");
  await expect(partners).toBeFocused({ timeout: 30_000 });
  await expect(partners.locator("[data-partner-center-text]")).toHaveText(title, { timeout: 30_000 });
  await expect(partners.locator("[data-partner-center]")).toBeInViewport();
  await expect(page).toHaveURL(/#partners$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
}

for (const [locale, viewport] of [
  ["fa", { width: 390, height: 844 }],
  ["en", { width: 1440, height: 900 }],
  ["ar", { width: 390, height: 844 }],
] as const) {
  test(`${locale} header keeps its placement and uses page links away from home`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(`/${locale}?intro=0`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    const homeHeader = await page.locator("header").boundingBox();
    await expect(page.locator("#primary-navigation > a")).toHaveCount(5);
    const sections = ["showcase", "services", "about", "partners", "contact"];
    for (const [index, section] of sections.entries()) {
      await expect(page.locator("#primary-navigation > a").nth(index)).toHaveAttribute("href", `#${section}`);
    }

    await page.goto(`/${locale}/about`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    const innerHeader = await page.locator("header").boundingBox();
    for (const coordinate of ["x", "y", "width", "height"] as const) {
      expect(Math.abs(innerHeader![coordinate] - homeHeader![coordinate])).toBeLessThanOrEqual(1);
    }
    const menu = page.locator("header button[aria-controls='primary-navigation']");
    if (viewport.width <= 760) await menu.click();
    const pages = ["projects", "services", "about", "partners", "contact"];
    for (const [index, path] of pages.entries()) {
      await expect(page.locator("#primary-navigation > a").nth(index)).toHaveAttribute("href", `/${locale}/${path}`);
    }
    await page.locator(`#primary-navigation > a[href='/${locale}/services']`).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/${locale}/services/?$`), { timeout: 45_000 });
    if (viewport.width <= 760) {
      await expect(menu).toHaveAttribute("aria-expanded", "false");
      expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
      await menu.click();
    }
    await page.locator(`#primary-navigation > a[href='/${locale}/partners']`).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/${locale}/partners/?$`), { timeout: 45_000 });
    await expect(page.locator("[data-partners-page]")).toBeVisible();
    await expect(page.locator("footer nav a").filter({ hasText: locale === "fa" ? "همراهان ما" : locale === "en" ? "Partners" : "شركاؤنا" })).toHaveAttribute("href", `/${locale}/partners`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
  });
}

test("desktop Partners navigation opens its page from an inner page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en/about", { waitUntil: "domcontentloaded" });
  const link = page.locator("#primary-navigation").getByRole("link", { name: "Partners", exact: true });
  await expect(link).toHaveAttribute("href", "/en/partners");
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/en\/partners\/?$/, { timeout: 45_000 });
  await expect(page.locator("[data-partners-page]")).toBeVisible();
  await expect(page.locator("#primary-navigation").getByRole("link", { name: "Partners", exact: true })).toHaveAttribute("aria-current", "page");
});

test("Persian mobile menu reaches Partners and releases the menu scroll lock", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage();
    await page.goto("/fa?intro=0&phase=reveal", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-loading-progress]")).toHaveAttribute("data-loading-progress", "100", { timeout: 100_000 });
    const menu = page.locator("header button[aria-controls='primary-navigation']");
    await menu.tap();
    await page.locator("#primary-navigation a[href='#partners']").tap();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expectReadablePartners(page, "همراهان ما");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  } finally {
    await context.close();
  }
});

test("Arabic reduced motion supports direct and footer Partners navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/ar#partners", { waitUntil: "domcontentloaded" });
  await expectReadablePartners(page, "شركاؤنا");
  await expect(page.locator("[data-connected-journey]")).toHaveAttribute("data-motion", "reduced");
  const footerLink = page.locator("footer nav").getByRole("link", { name: "شركاؤنا", exact: true });
  await footerLink.click();
  await expectReadablePartners(page, "شركاؤنا");
});

test("Partners navigation survives motion preference changes and mobile resizing", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en?intro=0#partners", { waitUntil: "domcontentloaded" });
  await expectReadablePartners(page, "Partners");
  const journey = page.locator("[data-connected-journey]");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(journey).toHaveAttribute("data-motion", "reduced");
  await expectReadablePartners(page, "Partners");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(journey).toHaveAttribute("data-journey-labels", /PartnersRead/);
  await expectReadablePartners(page, "Partners");
  await page.setViewportSize({ width: 390, height: 844 });
  await expectReadablePartners(page, "Partners");
});

test("Back restores the previous hero phase after visiting Partners and resizing", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en?intro=0&phase=reveal", { waitUntil: "domcontentloaded" });
  const root = page.locator("[data-experience-root]");
  await expect(page.locator("[data-loading-progress]")).toHaveAttribute("data-loading-progress", "100", { timeout: 100_000 });
  await expect(page.locator("[data-connected-journey]")).toHaveAttribute("data-journey-labels", /PartnersRead/);
  await root.evaluate((node) => node.dispatchEvent(new CustomEvent("mandegar:seek", {
    detail: { progress: .42, sync: true },
  })));
  await expect.poll(async () => Number(await root.getAttribute("data-native-progress"))).toBeCloseTo(.42, 3);
  const previousProgress = await root.getAttribute("data-native-progress");
  await page.locator("#primary-navigation a[href='#partners']").click();
  await expectReadablePartners(page, "Partners");
  await page.setViewportSize({ width: 1440, height: 820 });
  await page.goBack();
  await expect(page).not.toHaveURL(/#/);
  await expect.poll(async () => Number(await root.getAttribute("data-native-progress"))).toBeCloseTo(Number(previousProgress), 3);
  await page.goForward();
  await expectReadablePartners(page, "Partners");
});
