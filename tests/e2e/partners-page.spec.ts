import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import editorialContent from "../../content/pages.json";
import journeyContent from "../../content/journey.json";
import pageCopy from "../../content/page-copy.json";
import trustContent from "../../content/trust.json";

for (const locale of ["fa", "en", "ar"] as const) {
  test(`${locale} partners page keeps its editorial layout, labels and keyboard links on mobile`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: locale === "ar" ? "reduce" : "no-preference" });
    await page.setViewportSize({ width: 1440, height: 900 });
    const response = await page.goto(`/${locale}/partners`);
    expect(response?.status()).toBe(200);
    const content = page.locator("[data-partners-page]");
    await expect(content.getByRole("heading", { level: 1 })).toHaveText(editorialContent.partners.title[locale]);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "en" ? "ltr" : "rtl");
    await expect(page.locator("link[rel='canonical']")).toHaveAttribute("href", new RegExp(`/${locale}/partners/?$`));
    await expect(page.locator("link[hreflang='fa']")).toHaveAttribute("href", /\/fa\/partners\/?$/);
    await expect(page.locator("link[hreflang='en']")).toHaveAttribute("href", /\/en\/partners\/?$/);
    await expect(page.locator("link[hreflang='ar']")).toHaveAttribute("href", /\/ar\/partners\/?$/);
    const approvedPartners = trustContent.clients.filter((partner: { publicationState?: string; isPlaceholder?: boolean }) => partner.publicationState === "published" && !partner.isPlaceholder);
    await expect(content.locator("[data-partner-profile]")).toHaveCount(approvedPartners.length || journeyContent.copy[locale].disciplines.length);
    if (!approvedPartners.length) {
      await expect(content.locator("[data-partners-placeholder]")).toHaveText(pageCopy[locale].partnersPlaceholderNote);
      await expect(content.locator("[data-partner-profile]").first()).toContainText(journeyContent.copy[locale].placeholder);
    }

    for (const viewport of [{ width: 1440, height: 900 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
      const copyOverlap = await content.locator("[data-partner-profile]").evaluateAll((cards) => cards.some((card) => {
        const bounds = card.getBoundingClientRect();
        const title = card.querySelector("h3")?.getBoundingClientRect();
        return !title || title.left < bounds.left || title.right > bounds.right;
      }));
      expect(copyOverlap).toBe(false);
    }

    const startProject = content.getByRole("link", { name: pageCopy[locale].startProject, exact: true });
    await startProject.focus();
    await expect(startProject).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/${locale}/contact/?$`), { timeout: 30_000 });
    expect(errors).toEqual([]);
  });
}

test("partners page has accessible content and navigation with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/partners", { waitUntil: "networkidle" });
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations, JSON.stringify(results.violations)).toEqual([]);
});
