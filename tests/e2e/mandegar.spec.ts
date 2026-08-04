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
      .filter(({ element, rect }) => !element.closest("[aria-hidden='true'], [data-cinematic-beat]") && rect.width > 0 && (rect.right > viewportWidth + 2 || rect.left < -2))
      .slice(0, 8)
      .map(({ element, rect }) => ({ tag: element.tagName, className: element.className, right: Math.round(rect.right), left: Math.round(rect.left) }));
    return { documentWidth, viewportWidth, offenders };
  });
  expect(result.documentWidth, JSON.stringify(result.offenders)).toBeLessThanOrEqual(result.viewportWidth + 2);
  expect(result.offenders, JSON.stringify(result)).toEqual([]);
  const mediaBoxes = await page.locator(".mediaFrame").evaluateAll((elements) => elements.filter((element) => {
    const rect = element.getBoundingClientRect();
    return !element.classList.contains("cinematicDomMedia") && rect.width > 32 && rect.height > 32;
  }).map((element) => {
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
  await expect(page.locator("[data-mandegar-experience]")).toBeInViewport();
}

test.describe("Mandegar responsive layout", () => {
  for (const viewport of aspectMatrix) {
    test(`home fits ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/fa", { waitUntil: "networkidle" });
      await expect(page.locator("[data-mandegar-experience]")).toBeVisible();
      await expect(page.locator("#main-content")).toBeVisible();
      await revealAndLoadPage(page);
      await assertNoHorizontalOverflow(page);
      await page.screenshot({ path: `test-results/ui/${viewport.name}-fa-viewport.png`, fullPage: false });
    });
  }

  for (const locale of locales) {
    test(`${locale} direction and key routes render`, async ({ page }) => {
      await page.goto(`/${locale}`, { waitUntil: "networkidle" });
      await expect.poll(() => page.locator("html").getAttribute("lang")).toBe(locale);
      await expect(page.locator("[data-locale]")).toHaveAttribute("dir", locale === "en" ? "ltr" : "rtl");
      await expect(page.locator("[data-mandegar-experience]")).toBeVisible();
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
    await expect(page.locator("[data-webgl='fallback']")).toBeVisible();
    await expect(page.locator("[data-semantic-fallback] h2").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "شروع یک پروژه" }).last()).toBeVisible();
  });

  test("homepage owns one persistent canvas host and advances the scroll narrative", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en", { waitUntil: "networkidle" });
    await expect(page.locator("[data-experience-root]")).toHaveCount(1);
    await expect(page.locator("[data-mandegar-experience]")).toHaveCount(1);
    await expect(page.locator("[data-experience-root] canvas")).toHaveCount(1);
    await expect(page.locator("[data-experience-root]")).toHaveAttribute("data-story-stage", "arrival");
    await expect(page.locator("[aria-label*='Preparing the exhibition world']")).toHaveAttribute("data-complete", "true");
    await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>("[data-experience-root]");
      if (root) window.scrollTo({ top: root.offsetTop + (root.offsetHeight - innerHeight) * .31, behavior: "auto" });
    });
    await expect.poll(() => page.locator("[data-experience-root]").getAttribute("data-story-stage")).toBe("activation");
  });

  test("nine-state scene stays aligned with named checkpoints", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en", { waitUntil: "networkidle" });
    for (const stage of ["arrival", "discovery", "activation", "reveal", "experiences", "proof", "intelligence", "invitation", "loop"] as const) {
      await page.locator(`[data-phase-target='${stage}']`).click();
      await expect.poll(() => page.locator("[data-experience-root]").getAttribute("data-story-stage")).toBe(stage);
    }
  });

  test("storyboard copy appears one beat at a time", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/fa", { waitUntil: "networkidle" });
    for (const stage of ["discovery", "activation", "reveal", "experiences", "proof", "intelligence", "invitation", "loop"] as const) {
      await page.locator(`[data-phase-target='${stage}']`).click();
      await expect.poll(() => page.locator("[data-experience-root]").getAttribute("data-story-stage")).toBe(stage);
      await page.waitForTimeout(550);
      await expect(page.locator(`[data-scene-copy='${stage}']`)).toBeVisible();
      const visibleCopies = await page.locator("[data-scene-copy]").evaluateAll((elements) => elements.filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== "hidden" && Number(style.opacity) > .1 && rect.width > 10 && rect.height > 10;
      }).map((element) => element.getAttribute("data-scene-copy")));
      expect(visibleCopies, `at stage ${stage}`).toEqual([stage]);
    }
  });

  test("experience zones respond to keyboard and project proof stays CMS-addressable", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en?phase=experiences", { waitUntil: "networkidle" });
    await expect(page.locator("[aria-label*='Preparing the exhibition world']")).toHaveAttribute("data-complete", "true");
    await expect(page.locator("[data-scene-copy='experiences']")).toBeVisible();
    const sceneNavigation = page.locator("[data-mandegar-experience] nav");
    const photo = sceneNavigation.getByRole("button", { name: /Photo/ });
    await photo.focus();
    await expect(photo).toBeFocused();

    await page.goto("/en?phase=proof", { waitUntil: "networkidle" });
    const proofLinks = page.locator("[data-mandegar-experience] nav a");
    await expect(proofLinks).toHaveCount(3);
    await expect(proofLinks.first()).toHaveAttribute("href", /\/en\/projects\//);
    await expect(page.locator("[data-particle-system='signal-network']")).toHaveCount(1);
    await expect(page.locator("[data-interaction-system='pointer-touch']")).toHaveCount(1);
  });

  test("mobile controls remain available without pointer input", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/fa?phase=reveal", { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: "فعال‌کردن صدا" })).toBeVisible();
    await expect(page.locator("[data-scene-copy='reveal']")).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test("homepage hides the footer and forward scroll wraps from loop to arrival", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en", { waitUntil: "networkidle" });
    await expect(page.locator(".footer")).toBeHidden();
    await page.evaluate(() => {
      document.querySelector<HTMLElement>("[data-experience-root]")?.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress: .995 } }));
    });
    await expect.poll(() => page.locator("[data-experience-root]").getAttribute("data-story-stage")).toBe("loop");
    await page.mouse.wheel(0, 900);
    await expect.poll(() => page.locator("[data-experience-root]").getAttribute("data-story-stage")).toBe("arrival");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(100);
  });

  test("homepage uses the unified variable typeface and left-side story placement", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const locale of ["fa", "en"] as const) {
      await page.goto(`/${locale}?phase=discovery`, { waitUntil: "networkidle" });
      const copy = page.locator("[data-scene-copy='discovery']");
      await expect(copy).toBeVisible();
      const result = await copy.evaluate((element) => ({
        left: element.getBoundingClientRect().left,
        font: getComputedStyle(element).fontFamily,
      }));
      expect(result.left).toBeLessThan(220);
      expect(result.font).toContain("Vazirmatn Variable");
    }
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
