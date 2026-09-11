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
      .filter(({ element, rect }) => !element.closest("[aria-hidden='true'], [data-cinematic-beat], [data-scene-a11y]") && rect.width > 0 && (rect.right > viewportWidth + 2 || rect.left < -2))
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

async function seekPhase(
  page: import("@playwright/test").Page,
  phase: string,
) {
  const progress = await page.locator(`[data-phase-target='${phase}']`).evaluate((element) => (
    Number.parseFloat((element as HTMLElement).style.getPropertyValue("--phase-position")) / 100
  ));
  await page.locator("[data-experience-root]").evaluate((root, targetProgress) => {
    root.dispatchEvent(new CustomEvent("mandegar:seek", {
      detail: { progress: targetProgress },
    }));
  }, progress);
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
      await page.goto("/fa?intro=0", { waitUntil: "networkidle" });
      await expect(page.locator("[data-mandegar-experience]")).toBeVisible();
      await expect(page.locator("#main-content")).toBeVisible();
      await revealAndLoadPage(page);
      await assertNoHorizontalOverflow(page);
      await page.screenshot({ path: `test-results/ui/${viewport.name}-fa-viewport.png`, fullPage: false });
    });
  }

  for (const locale of locales) {
    test(`${locale} direction and key routes render`, async ({ page }) => {
      await page.goto(`/${locale}?intro=0`, { waitUntil: "networkidle" });
      await expect.poll(() => page.locator("html").getAttribute("lang")).toBe(locale);
      await expect(page.locator("[data-locale]")).toHaveAttribute("dir", locale === "en" ? "ltr" : "rtl");
      await expect(page.locator("[data-mandegar-experience]")).toBeVisible();
      await assertNoHorizontalOverflow(page);
    });
  }

  test("mobile navigation opens and remains keyboard-addressable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/fa?intro=0", { waitUntil: "networkidle" });
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

  test("header keeps identical geometry across inner pages", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const measureHeader = () => page.locator("header").evaluate((header) => {
      const navigation = header.querySelector("#primary-navigation");
      const headerRect = header.getBoundingClientRect();
      const navigationRect = navigation?.getBoundingClientRect();
      return {
        position: getComputedStyle(header).position,
        left: Math.round(headerRect.left),
        top: Math.round(headerRect.top),
        width: Math.round(headerRect.width),
        navigationCenter: navigationRect
          ? Math.round(navigationRect.left + navigationRect.width * 0.5)
          : null,
      };
    });

    await page.goto("/en/about", { waitUntil: "networkidle" });
    const aboutHeader = await measureHeader();
    await page.goto("/en/projects", { waitUntil: "networkidle" });
    const projectsHeader = await measureHeader();

    expect(projectsHeader).toEqual(aboutHeader);
    expect(aboutHeader.position).toBe("fixed");
    expect(aboutHeader.navigationCenter).toBe(720);
  });

  test("opening loader covers the full interface and isolates text blur", async ({ page }) => {
    test.setTimeout(90_000);
    await page.route("**/models/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      await route.continue();
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en?intro=1", { waitUntil: "domcontentloaded" });

    const loader = page.locator("[data-particle-loader]");
    await expect(loader).toBeVisible();
    await expect(loader).toHaveAttribute("data-complete", "false");

    const presentation = await page.evaluate(() => {
      const loaderElement = document.querySelector<HTMLElement>("[data-particle-loader]");
      const root = document.querySelector<HTMLElement>("[data-experience-root]");
      const copy = document.querySelector<HTMLElement>("[data-scene-copy]");
      const loaderRect = loaderElement?.getBoundingClientRect();
      const copyStyle = copy ? getComputedStyle(copy) : null;
      const copyBlurStyle = copy ? getComputedStyle(copy, "::before") : null;
      return {
        coversViewport: Boolean(
          loaderRect
          && loaderRect.left === 0
          && loaderRect.top === 0
          && loaderRect.width === innerWidth
          && loaderRect.height === innerHeight
        ),
        ownsTopCorner: Boolean(document.elementFromPoint(4, 4)?.closest("[data-particle-loader]")),
        rootZIndex: Number(root ? getComputedStyle(root).zIndex : 0),
        copyIsolation: copyStyle?.isolation,
        copyBackdrop: copyBlurStyle?.backdropFilter,
      };
    });

    expect(presentation.coversViewport).toBe(true);
    expect(presentation.ownsTopCorner).toBe(true);
    expect(presentation.rootZIndex).toBeGreaterThan(40);
    expect(presentation.copyIsolation).toBe("isolate");
    expect(presentation.copyBackdrop).toContain("blur");
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
    await page.goto("/fa?intro=0", { waitUntil: "networkidle" });
    await expect(page.locator("[data-webgl='fallback']")).toBeVisible();
    await expect(page.locator("[data-semantic-fallback] h2").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "شروع یک پروژه" }).last()).toBeVisible();
  });

  test("camera completion unlocks page scrolling before the reveal finishes", async ({ page }) => {
    test.setTimeout(90_000);
    const shaderErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && /shader|webgl/i.test(message.text())) shaderErrors.push(message.text());
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en?intro=1&introDuration=4900", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[aria-label*='Preparing the exhibition world']")).toHaveAttribute("data-complete", "true", { timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Skip intro" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Skip intro" })).toHaveCount(0, { timeout: 7_000 });
    await expect(page.locator("[data-experience-root]")).not.toHaveAttribute("data-intro-active", "true");
    await expect(page.locator("[data-experience-root]")).toHaveAttribute("data-story-stage", "arrival");
    await expect(page.locator("html")).not.toHaveAttribute("data-experience-scroll-lock", "");
    expect(shaderErrors).toEqual([]);
  });

  test("scroll guidance hands off to an accurate phase rail after user input", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en?intro=0", { waitUntil: "networkidle" });

    const root = page.locator("[data-experience-root]");
    const cue = page.locator("[data-scroll-cue]");
    const rail = page.locator("[data-phase-rail]");

    await expect(page.locator("[aria-label*='Preparing the exhibition world']")).toHaveAttribute(
      "data-complete",
      "true",
      { timeout: 30_000 },
    );
    await expect(root).not.toHaveAttribute("data-intro-active", "true", {
      timeout: 10_000,
    });
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-experience-scroll-lock",
      "",
    );
    await expect(cue).toBeVisible();
    await expect(rail).toBeHidden();

    await page.mouse.wheel(0, 120);
    await expect(root).toHaveAttribute("data-scroll-engaged", "true");
    await expect(cue).toBeHidden();
    await expect(rail).toBeVisible();

    const activation = page.locator("[data-phase-target='activation']");
    const { nativeProgress, railProgress } = await root.evaluate((element) => ({
      nativeProgress: Number((element as HTMLElement).dataset.nativeProgress),
      railProgress: Number(
        getComputedStyle(element).getPropertyValue("--scroll-progress").trim(),
      ),
    }));
    expect(nativeProgress).toBeGreaterThan(0);
    expect(railProgress).toBeCloseTo(nativeProgress, 4);
    expect(
      await activation.evaluate((element) =>
        element.style.getPropertyValue("--phase-position"),
      ),
    ).toBe("31%");
  });

  test("homepage owns one persistent canvas host and advances the scroll narrative", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en?intro=0", { waitUntil: "networkidle" });
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

  test("idle scrolling preserves the visitor's exact position", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en?intro=0", { waitUntil: "networkidle" });
    const root = page.locator("[data-experience-root]");
    await expect(page.locator("[aria-label*='Preparing the exhibition world']")).toHaveAttribute("data-complete", "true", { timeout: 30_000 });
    await root.evaluate((element) => {
      const rootElement = element as HTMLElement;
      const progress = 0.27;
      window.scrollTo({
        top: rootElement.offsetTop + (rootElement.offsetHeight - innerHeight) * progress,
        left: 0,
        behavior: "auto",
      });
    });
    await page.waitForTimeout(2_500);
    await expect(root).not.toHaveAttribute("data-scroll-snap");
    const settledProgress = await root.evaluate((element) => {
      const rootElement = element as HTMLElement;
      return (window.scrollY - rootElement.offsetTop) / Math.max(1, rootElement.offsetHeight - innerHeight);
    });
    expect(settledProgress).toBeCloseTo(0.27, 2);
  });

  test("opening copy breath follows physical scroll rather than sinus progress", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en?intro=0", { waitUntil: "networkidle" });
    const root = page.locator("[data-experience-root]");
    const arrival = page.locator("[data-scene-copy='arrival']");
    await expect(page.locator("[aria-label*='Preparing the exhibition world']")).toHaveAttribute("data-complete", "true", { timeout: 30_000 });
    await expect(root).not.toHaveAttribute("data-intro-active", "true", { timeout: 10_000 });
    const enterProgress = Number(await root.getAttribute("data-arrival-enter-progress"));
    const scrollToProgress = (progress: number) => root.evaluate((element, nextProgress) => {
      const rootElement = element as HTMLElement;
      window.scrollTo({
        top: rootElement.offsetTop + (rootElement.offsetHeight - innerHeight) * nextProgress,
        left: 0,
        behavior: "auto",
      });
    }, progress);

    await scrollToProgress(Math.max(0, enterProgress - 0.004));
    await expect.poll(async () => Number(await root.getAttribute("data-copy-progress"))).toBeLessThan(enterProgress);
    await expect(arrival).toBeHidden();
    await scrollToProgress(enterProgress + 0.01);
    await expect.poll(async () => Number(await root.getAttribute("data-copy-progress"))).toBeGreaterThan(enterProgress);
    await expect(arrival).toBeVisible();
  });

  test("nine-state scene stays aligned with named checkpoints", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en?intro=0", { waitUntil: "networkidle" });
    await expect(page.locator("[data-particle-loader='center-spark']")).toHaveAttribute("data-complete", "true", { timeout: 30_000 });
    await expect(page.locator("[data-experience-root]")).not.toHaveAttribute("data-intro-active", "true", { timeout: 10_000 });
    for (const stage of ["arrival", "discovery", "activation", "reveal", "experiences", "proof", "intelligence", "invitation", "loop"] as const) {
      await seekPhase(page, stage);
      await expect.poll(() => page.locator("[data-experience-root]").getAttribute("data-story-stage")).toBe(stage);
    }
  });

  test("storyboard copy appears one beat at a time", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/fa?intro=0", { waitUntil: "networkidle" });
    await expect(page.locator("[data-particle-loader='center-spark']")).toHaveAttribute("data-complete", "true", { timeout: 30_000 });
    await expect(page.locator("[data-experience-root]")).not.toHaveAttribute("data-intro-active", "true", { timeout: 10_000 });
    for (const stage of ["arrival", "discovery", "activation", "reveal", "experiences", "proof", "intelligence", "invitation", "loop"] as const) {
      await seekPhase(page, stage);
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
    const particleSystem = page.locator("[data-particle-system]");
    await expect(particleSystem).toHaveCount(1);
    const pipeline = await particleSystem.getAttribute("data-scene-pipeline");
    await expect(particleSystem).toHaveAttribute(
      "data-particle-system",
      pipeline === "baked-modular" ? "transition-boundary" : "signal-network",
    );
    await expect(page.locator("[data-interaction-system='pointer-touch']")).toHaveCount(1);
  });

  test("spatial annotations activate only near their projected object", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en?phase=discovery", { waitUntil: "networkidle" });
    await expect(page.locator("[aria-label*='Preparing the exhibition world']")).toHaveAttribute("data-complete", "true");
    const hud = page.locator("[data-spatial-labels]");
    const anchor = page.locator("[data-spatial-anchor='primary']");
    const annotation = page.locator("[data-spatial-annotation='primary']");
    await expect.poll(async () => {
      const x = await anchor.getAttribute("cx");
      const y = await anchor.getAttribute("cy");
      return x !== null && y !== null ? { x: Number(x), y: Number(y) } : null;
    }).not.toBeNull();
    const x = Number(await anchor.getAttribute("cx"));
    const y = Number(await anchor.getAttribute("cy"));
    await expect(annotation).toHaveCSS("opacity", "0");
    await page.mouse.move(x, y);
    await expect.poll(async () => Number(await hud.getAttribute("data-proximity"))).toBeGreaterThan(0.9);
    await expect.poll(() => annotation.evaluate((element) => Number(getComputedStyle(element).opacity))).toBeGreaterThan(0.8);
    await page.screenshot({ path: "test-results/ui/spatial-proximity.png", fullPage: false });
    await page.mouse.move(1, 1);
    await expect.poll(async () => Number(await hud.getAttribute("data-proximity"))).toBeLessThan(0.05);
    await expect.poll(() => annotation.evaluate((element) => Number(getComputedStyle(element).opacity))).toBeLessThan(0.1);
  });

  test("texture transition switches copy and header chrome to a light readable theme", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en?phase=activation", { waitUntil: "networkidle" });
    const root = page.locator("[data-experience-root]");
    await expect(root).toHaveAttribute("data-ui-tone", "light");
    const copy = page.locator("[data-scene-copy='activation']");
    await expect(copy).toBeVisible();
    const colors = await Promise.all([
      copy.evaluate((element) => getComputedStyle(element).color),
      page.locator("header a").first().evaluate((element) => getComputedStyle(element).color),
    ]);
    for (const color of colors) {
      const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
      expect(channels).toHaveLength(3);
      expect(channels.every((channel) => channel > 200), color).toBe(true);
    }
    await expect(page.locator("[data-scene-vignette]")).toHaveCount(1);
    await expect.poll(() => root.evaluate((element) => (
      element.style.getPropertyValue("--vignette-rgb")
    ))).toBe("5 7 10");
  });

  test("mobile controls remain available without pointer input", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/fa?phase=reveal", { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: "فعال‌کردن صدا" })).toBeVisible();
    await expect(page.locator("[data-scene-copy='reveal']")).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test("homepage releases the final loop state into page content and the footer", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en?intro=0", { waitUntil: "networkidle" });
    await expect(page.locator("[aria-label*='Preparing the exhibition world']")).toHaveAttribute("data-complete", "true", { timeout: 30_000 });
    await expect(page.locator("[data-experience-root]")).not.toHaveAttribute("data-intro-active", "true", { timeout: 10_000 });
    await page.evaluate(() => {
      document.querySelector<HTMLElement>("[data-experience-root]")?.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress: .999 } }));
    });
    await expect.poll(() => page.locator("[data-experience-root]").getAttribute("data-story-stage")).toBe("loop");
    await page.mouse.wheel(0, 900);
    await expect.poll(() => page.locator("[data-experience-root]").getAttribute("data-story-stage")).toBe("loop");
    await expect(page.locator("[data-post-experience]")).toBeVisible();
    await page.locator(".footer").scrollIntoViewIfNeeded();
    await expect(page.locator(".footer")).toBeVisible();
  });

  test("reload starts at the beginning and the gallery is pre-positioned behind the hero handoff", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en?intro=0", { waitUntil: "networkidle" });
    await expect(page.locator("[aria-label*='Preparing the exhibition world']")).toHaveAttribute("data-complete", "true", { timeout: 30_000 });

    const root = page.locator("[data-experience-root]");
    const journey = page.locator("[data-connected-journey]");
    const flow = await page.evaluate(() => {
      const hero = document.querySelector<HTMLElement>("[data-experience-root]");
      const projects = document.querySelector<HTMLElement>("[data-connected-journey]");
      if (!hero || !projects) return null;
      return {
        heroEnd: hero.getBoundingClientRect().top + window.scrollY + hero.offsetHeight,
        journeyStart: projects.getBoundingClientRect().top + window.scrollY,
        journeyMargin: getComputedStyle(projects).marginBlockStart,
        viewportHeight: window.innerHeight,
      };
    });
    expect(flow).not.toBeNull();
    expect(Math.abs((flow?.heroEnd ?? 0) - (flow?.journeyStart ?? 0) - (flow?.viewportHeight ?? 0) * 2)).toBeLessThan(2);
    expect(flow?.journeyMargin).toBe(`-${(flow?.viewportHeight ?? 0) * 2}px`);

    await root.evaluate((node) => {
      node.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress: .995 } }));
    });
    await expect.poll(() => journey.evaluate((node) => Number(getComputedStyle(node).getPropertyValue("--journey-reveal")))).toBeGreaterThan(.7);
    await expect.poll(() => journey.locator("[data-project-helix-sticky]").evaluate((node) => Math.round(node.getBoundingClientRect().top))).toBe(0);

    await page.evaluate(() => {
      const projects = document.querySelector<HTMLElement>("[data-connected-journey]");
      if (projects) window.scrollTo({ top: projects.offsetTop + window.innerHeight, behavior: "auto" });
    });
    await expect(journey.locator("canvas")).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => journey.locator("[data-project-helix-sticky]").evaluate((node) => Math.round(node.getBoundingClientRect().top))).toBe(0);
    await expect.poll(() => journey.evaluate((node) => Number(getComputedStyle(node).getPropertyValue("--journey-reveal")))).toBe(1);

    const backToTop = page.getByRole("button", { name: "Back to top" });
    await expect(backToTop).toBeVisible();
    await backToTop.click();
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(0);

    await page.evaluate(() => {
      const projects = document.querySelector<HTMLElement>("[data-connected-journey]");
      if (projects) window.scrollTo({ top: projects.offsetTop + window.innerHeight, behavior: "auto" });
    });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1_000);

    await page.reload({ waitUntil: "networkidle" });
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(0);
    await expect.poll(() => page.locator("[data-experience-root]").getAttribute("data-native-progress")).toBe("0.0000");
  });

  test("project helix renders CMS projects without hijacking page scroll", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en?intro=0", { waitUntil: "networkidle" });
    await expect(page.locator("[aria-label*='Preparing the exhibition world']")).toHaveAttribute("data-complete", "true", { timeout: 30_000 });
    const helix = page.locator("[data-project-helix]");
    await expect(helix.getByRole("button")).toHaveCount(6);
    const start = await helix.evaluate((node) => {
      const top = node.getBoundingClientRect().top + window.scrollY;
      const travel = node.clientHeight - window.innerHeight * 2;
      return top + window.innerHeight + travel * 0.08;
    });
    await page.evaluate((top) => window.scrollTo(0, top), start);
    await expect(helix.locator("canvas")).toBeVisible({ timeout: 30_000 });
    await expect(helix.getByRole("link", { name: /View project/ })).toBeVisible();
    await expect.poll(async () => {
      const box = await helix.locator("[data-project-helix-sticky]").boundingBox();
      return Math.round(box?.y ?? -100);
    }).toBe(0);
    const heldTitle = await helix.locator("h3").textContent();
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 450);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 100);
    await expect.poll(() => helix.locator("h3").textContent()).toBe(heldTitle);
    await expect(helix).not.toHaveAttribute("data-scroll-snap");
  });

  test("about system and client voice previews are interactive and accessible", async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en?intro=0", { waitUntil: "networkidle" });

    const about = page.locator("[data-about-system]");
    const processNodes = about.getByRole("button");
    await expect(processNodes).toHaveCount(4);
    const technology = about.getByRole("button", { name: /Technology/ });
    await technology.focus();
    await expect(technology).toBeFocused();
    await expect(technology).toHaveAttribute("aria-pressed", "true");
    await expect(about.locator("h3")).toHaveText("Technology");

    const voices = page.locator("[data-client-voices]");
    await expect(voices.locator("[data-sample='true']")).toBeVisible();
    const before = await voices.locator("article blockquote").textContent();
    await voices.getByRole("button", { name: "Next voice" }).click();
    await expect.poll(() => voices.locator("article blockquote").textContent()).not.toBe(before);
    await expect(voices.getByRole("group", { name: "Choose a client voice" }).getByRole("button")).toHaveCount(3);
  });

  test("new post-experience sections fit mobile RTL without overflow", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/fa?intro=0", { waitUntil: "networkidle" });
    await expect(page.locator("[data-about-system]")).toBeVisible();
    await expect(page.locator("[data-client-voices]")).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test("homepage centers bookend copy and keeps story copy lower", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const locale of ["fa", "en"] as const) {
      await page.goto(`/${locale}?phase=discovery`, { waitUntil: "networkidle" });
      const copy = page.locator("[data-scene-copy='discovery']");
      await expect(copy).toBeVisible();
      const result = await copy.evaluate((element) => ({
        left: element.getBoundingClientRect().left,
        right: element.getBoundingClientRect().right,
        top: element.getBoundingClientRect().top,
        bottom: element.getBoundingClientRect().bottom,
        font: getComputedStyle(element).fontFamily,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }));
      expect(Math.abs((result.left + result.right) * .5 - result.viewportWidth * .5)).toBeLessThan(4);
      expect(result.top).toBeGreaterThan(result.viewportHeight * .5);
      expect(result.bottom).toBeLessThan(result.viewportHeight * .92);
      expect(result.font).toContain("Vazirmatn Variable");
    }

    for (const stage of ["arrival", "loop"] as const) {
      await seekPhase(page, stage);
      const copy = page.locator(`[data-scene-copy='${stage}']`);
      await expect(copy).toBeVisible();
      const center = await copy.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          x: rect.left + rect.width * 0.5,
          y: rect.top + rect.height * 0.5,
          viewportWidth: innerWidth,
          viewportHeight: innerHeight,
        };
      });
      expect(Math.abs(center.x - center.viewportWidth * 0.5)).toBeLessThan(4);
      expect(Math.abs(center.y - center.viewportHeight * 0.5)).toBeLessThan(4);
    }
  });

  test("project filters and detail route work", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/fa/projects", { waitUntil: "networkidle" });
    await expect(page.locator(".projectCard")).toHaveCount(6);
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
