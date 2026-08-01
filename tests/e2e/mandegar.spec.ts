import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const aspectMatrix = [
  { name: "desktop-wide", width: 1440, height: 900 },
  { name: "desktop-tall", width: 1280, height: 1600 },
  { name: "tablet-landscape", width: 1024, height: 768 },
  { name: "tablet-portrait", width: 768, height: 1024 },
  { name: "mobile-standard", width: 390, height: 844 },
  { name: "mobile-tall", width: 430, height: 932 },
  { name: "mobile-narrow", width: 360, height: 800 },
  { name: "ultrawide", width: 2560, height: 1080 },
];

const locales = ["fa", "en", "ar"] as const;

const routeMatrix = [
  { name: "about", path: "/fa/about" },
  { name: "services", path: "/fa/services" },
  { name: "projects", path: "/fa/projects" },
  { name: "contact", path: "/fa/contact" },
  { name: "legal", path: "/fa/legal" },
  { name: "project-detail", path: "/fa/projects/placeholder-exhibition-01" },
  { name: "service-detail", path: "/fa/services/event-production" },
];

const routeViewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];

async function assertNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const result = await page.evaluate(() => {
    const documentWidth = document.documentElement.scrollWidth;
    const viewportWidth = window.innerWidth;
    const offenders = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ element, rect }) => !element.closest("[aria-hidden='true']") && rect.width > 0 && (rect.right > viewportWidth + 2 || rect.left < -2))
      .slice(0, 8)
      .map(({ element, rect }) => ({ tag: element.tagName, className: element.className, right: Math.round(rect.right), left: Math.round(rect.left) }));
    return { documentWidth, viewportWidth, offenders };
  });
  expect(result.documentWidth, JSON.stringify(result.offenders)).toBeLessThanOrEqual(result.viewportWidth + 2);
  expect(result.offenders, JSON.stringify(result)).toEqual([]);
  const mediaBoxes = await page.locator(".mediaFrame").evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { width: Math.round(rect.width), height: Math.round(rect.height) };
  }));
  expect(mediaBoxes.every((box) => box.width > 0 && box.height > 0), JSON.stringify(mediaBoxes)).toBe(true);
}

async function settleAndLoadPage(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
  });
  const revealElements = await page.locator("[data-reveal]").all();
  for (const element of revealElements) {
    await element.scrollIntoViewIfNeeded();
    await page.waitForTimeout(80);
  }
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  });
  await page.waitForTimeout(220);
}

async function revealAndLoadPage(page: import("@playwright/test").Page) {
  await settleAndLoadPage(page);
  await expect(page.locator("#hero-title")).toBeInViewport();
}

test.describe("Mandegar responsive layout", () => {
  for (const viewport of aspectMatrix) {
    test(`home fits ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/fa", { waitUntil: "networkidle" });
      await expect(page.locator("#hero-title")).toBeVisible();
      await expect(page.locator("#main-content")).toBeVisible();
      await revealAndLoadPage(page);
      await assertNoHorizontalOverflow(page);
      await page.screenshot({ path: `test-results/ui/${viewport.name}-fa-viewport.png`, fullPage: false });
      await page.screenshot({ path: `test-results/ui/${viewport.name}-fa.png`, fullPage: true });
    });
  }

  for (const locale of locales) {
    test(`${locale} direction and key routes render`, async ({ page }) => {
      await page.goto(`/${locale}`, { waitUntil: "networkidle" });
      await expect.poll(() => page.locator("html").getAttribute("lang")).toBe(locale);
      await expect(page.locator("[data-locale]")).toHaveAttribute("dir", locale === "en" ? "ltr" : "rtl");
      await expect(page.locator("h1").first()).toBeVisible();
      await assertNoHorizontalOverflow(page);
    });
  }

  test("mobile navigation opens and remains keyboard-addressable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/fa", { waitUntil: "networkidle" });
    const menu = page.locator("button[aria-controls='primary-navigation']");
    await menu.focus();
    await expect(menu).toBeFocused();
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#primary-navigation a").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeFocused();
  });

  test("language switcher preserves the current route", async ({ page }) => {
    await page.goto("/fa/projects", { waitUntil: "networkidle" });
    const englishLink = page.locator("a[hreflang='en']:visible").first();
    await expect(englishLink).toHaveAttribute("href", "/en/projects");
    await englishLink.click();
    await expect(page).toHaveURL(/\/en\/projects$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });

  test("localized metadata, structured data and security headers are present", async ({ page }) => {
    const response = await page.goto("/en/services/event-production", { waitUntil: "networkidle" });
    expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
    await expect(page.locator("link[rel='canonical']")).toHaveAttribute("href", /\/en\/services\/event-production$/);
    await expect(page.locator("link[rel='alternate'][hreflang='fa']")).toHaveCount(1);
    await expect(page.locator("script[type='application/ld+json']")).not.toHaveCount(0);
  });

  for (const path of ["/fa", "/en", "/fa/projects", "/fa/contact", "/fa/legal"]) {
    test(`${path} has no automated WCAG A/AA violations`, async ({ page }) => {
      await page.goto(path, { waitUntil: "networkidle" });
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(result.violations, result.violations.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
    });
  }

  test("reduced motion keeps the semantic fallback visible", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/fa", { waitUntil: "networkidle" });
    await expect(page.locator(".canvasFallback")).toBeVisible();
    await expect(page.locator("#hero-title")).toBeVisible();
  });

  test("homepage owns one persistent canvas host and advances the scroll narrative", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en", { waitUntil: "networkidle" });
    await expect(page.locator("[data-experience-root]")).toHaveCount(1);
    await expect(page.locator("[data-experience-canvas-host]")).toHaveCount(1);
    await expect(page.locator(".heroSpark")).toBeVisible();
    await expect(page.locator(".sceneMediaFrame")).toHaveCount(4);
    await expect(page.locator(".sceneNavigator")).toBeVisible();
    expect(await page.locator("[data-experience-canvas-host] canvas").count()).toBeLessThanOrEqual(1);
    await expect(page.locator("[data-story-stage]")).toHaveAttribute("data-story-stage", "spark");
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight * 0.48, behavior: "auto" }));
    await page.waitForTimeout(500);
    await expect.poll(() => page.locator("[data-story-stage]").getAttribute("data-story-stage")).not.toBe("spark");
    await expect(page.locator("[data-stage='proof']")).toBeVisible();
  });

  test("scene atlas stays aligned with the visible chapter", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en", { waitUntil: "networkidle" });
    for (const stage of ["proof", "capability", "intelligence"]) {
      await page.locator(`[data-stage="${stage}"]`).scrollIntoViewIfNeeded();
      await expect.poll(() => page.locator("[data-experience-root]").getAttribute("data-story-stage")).toBe(stage);
    }
  });

  test("persistent scene does not cover the footer at the end of the narrative", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en", { waitUntil: "networkidle" });
    await page.mouse.wheel(0, 100000);
    await page.waitForTimeout(1800);
    const result = await page.evaluate(() => {
      const footer = document.querySelector(".footer");
      if (!footer) return { covered: false, reason: "missing footer" };
      const rect = footer.getBoundingClientRect();
      const y = Math.min(window.innerHeight - 10, Math.max(10, rect.top + 20));
      const element = document.elementFromPoint(20, y);
      return { covered: Boolean(element?.closest(".footer")), element: element?.tagName, top: Math.round(rect.top) };
    });
    expect(result.covered, JSON.stringify(result)).toBe(true);
  });

  test("project filters and detail route work", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/fa/projects", { waitUntil: "networkidle" });
    await expect(page.locator(".projectCard")).toHaveCount(3);
    await page.locator(".filterButton").nth(1).click();
    await expect(page.locator(".projectCard")).toHaveCount(1);
    await page.goto("/fa/projects/placeholder-exhibition-01", { waitUntil: "networkidle" });
    await expect(page.locator(".detailHero h1")).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  for (const route of routeMatrix) {
    for (const viewport of routeViewports) {
      test(`${route.name} fits ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(route.path, { waitUntil: "networkidle" });
        await expect(page.locator("h1").first()).toBeVisible();
        await settleAndLoadPage(page);
        await assertNoHorizontalOverflow(page);
      });
    }
  }
});
