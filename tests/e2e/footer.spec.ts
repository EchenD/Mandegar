import { expect, test } from "@playwright/test";

test("localized footer keeps copyright separate and links reachable at mobile and desktop sizes", async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const locale of ["fa", "en", "ar"] as const) {
    for (const width of [360, 1024]) {
      await page.setViewportSize({ width, height: 768 });
      await page.goto(`/${locale}?intro=0`, { waitUntil: "domcontentloaded" });
      const footer = page.locator("footer.footer");
      const bottom = footer.locator(".footerBottom");
      const copyright = bottom.locator("[dir='ltr']");
      const legal = bottom.getByRole("link");
      await footer.scrollIntoViewIfNeeded();
      await expect(copyright).toHaveText(/^© \d{4} Mandegar$/);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "en" ? "ltr" : "rtl");
      await expect(legal).toHaveAttribute("href", `/${locale}/legal`);

      const links = footer.getByRole("link");
      expect(await links.count()).toBeGreaterThanOrEqual(5);
      for (const link of await links.all()) {
        const bounds = await link.boundingBox();
        expect(bounds?.height).toBeGreaterThanOrEqual(44);
      }

      const copyrightBounds = await copyright.boundingBox();
      const legalBounds = await legal.boundingBox();
      if (!copyrightBounds || !legalBounds) throw new Error("Footer legal row is missing");
      if (width < 600) {
        expect(copyrightBounds.y + copyrightBounds.height).toBeLessThan(legalBounds.y);
      } else {
        const copyrightCentre = copyrightBounds.y + copyrightBounds.height / 2;
        const legalCentre = legalBounds.y + legalBounds.height / 2;
        expect(Math.abs(copyrightCentre - legalCentre)).toBeLessThanOrEqual(1);
      }

      await legal.focus();
      await expect(legal).toBeFocused();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(2);
    }
  }
});
