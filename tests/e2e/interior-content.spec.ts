import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import pageCopy from "../../content/page-copy.json";
import projectContent from "../../content/projects.json";

for (const locale of ["fa", "en", "ar"] as const) {
  const copy = pageCopy[locale];

  test(`${locale} archive filtering and service FAQs work with the keyboard`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${locale}/projects`);
    const filters = page.locator(".filterButton");
    const total = projectContent.filter((project) => project.publicationState === "published").length;
    await expect(page.locator(".projectCard")).toHaveCount(total);
    await filters.nth(1).focus();
    await page.keyboard.press("Space");
    await expect(filters.nth(1)).toHaveAttribute("aria-pressed", "true");
    expect(await page.locator(".projectCard").count()).toBeLessThan(total);
    await expect(page.locator("main [role='status']")).not.toBeEmpty();
    await filters.first().focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".projectCard")).toHaveCount(total);

    await page.goto(`/${locale}/services/event-production`);
    const firstFaq = page.locator("#faq details").first();
    await firstFaq.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(firstFaq).toHaveAttribute("open", "");
    await expect(firstFaq.locator("p")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(firstFaq).not.toHaveAttribute("open");
    for (const link of await page.locator("main").getByRole("link", { name: copy.startProject }).all()) {
      await expect(link).toHaveAttribute("href", `/${locale}/contact`);
    }
  });

  test(`${locale} contact brief stays usable when clipboard access is denied`, async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async () => { throw new Error("Permission denied"); } },
      });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${locale}/contact`);
    await expect(page.locator(".contactCard")).toHaveCount(4);
    await expect(page.locator("main a[href^='mailto:'], main a[href^='tel:'], main a[href^='https://wa.me/']")).toHaveCount(0);
    await page.getByRole("button", { name: copy.copyBrief }).click();
    const fallback = page.locator("textarea");
    await expect(fallback).toBeVisible();
    await expect(fallback).toBeFocused();
    await expect(fallback).toHaveAttribute("readonly", "");
    await expect(fallback).toHaveValue(new RegExp(copy.briefFields[0]));
    const selected = await fallback.evaluate((field: HTMLTextAreaElement) => field.selectionEnd - field.selectionStart === field.value.length);
    expect(selected).toBe(true);
    await expect(page.getByRole("status")).toHaveText(copy.copyBriefFailed);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
  });

  test(`${locale} unknown project and legal draft give clear localized guidance`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(`/${locale}/projects/missing-project`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.notFoundTitle);
    await expect(page.getByRole("link", { name: copy.backHome })).toHaveAttribute("href", `/${locale}`);
    await page.goto(`/${locale}/legal`);
    await expect(page.locator(".legalNotice")).toHaveText(copy.legalDraftNotice);
    await expect(page.locator("meta[name='robots']")).toHaveAttribute("content", /noindex/);
    await page.locator("main nav a[href^='#legal-']").last().click();
    await expect(page).toHaveURL(/#legal-\d+$/);
    expect(errors).toEqual([]);
  });

  test(`${locale} unmatched URLs have a localized global recovery page`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(`/${locale}/missing-page`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.notFoundTitle);
    await expect(page.locator("main section")).toHaveAttribute("lang", locale);
    await expect(page.locator("main section")).toHaveAttribute("dir", locale === "en" ? "ltr" : "rtl");
    await expect(page.getByRole("link", { name: copy.backHome })).toHaveAttribute("href", `/${locale}`);
    expect(errors).toEqual([]);
  });
}

test("project brief can be copied without submitting visitor data", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/en/contact");
  await page.getByRole("button", { name: pageCopy.en.copyBrief }).click();
  await expect(page.getByRole("status")).toHaveText(pageCopy.en.copiedBrief);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(pageCopy.en.briefFields[0]);
  await expect(page.locator("form")).toHaveCount(0);
});

for (const path of ["/en/about", "/en/services", "/en/services/event-production", "/en/projects/placeholder-exhibition-01"]) {
  test(`${path} has accessible finished content and footer`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path, { waitUntil: "networkidle" });
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(result.violations, JSON.stringify(result.violations)).toEqual([]);
  });
}
