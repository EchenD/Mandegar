import { expect, test, type Page } from "@playwright/test";
import { seekStationReview, waitForStation } from "./hero-interaction-helpers";
import { installationViews } from "../../components/experience/interactions/installation-demo";
import { serviceChapters } from "../../components/experience/services-copy";

test.setTimeout(150_000);
test.use({ video: "off", trace: "off" });

async function ready(page: Page, route = "/en?intro=0") {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-loading-progress]")).toHaveAttribute("data-loading-progress", "100", { timeout: 100_000 });
}

test("lighting waits for input and each scroll increment activates one lamp", async ({ page }) => {
  await ready(page, "/en?intro=0&phase=reveal");
  await seekStationReview(page, "stage");
  const director = await waitForStation(page, "stage");
  const lighting = page.locator("[data-stage-scroll]");
  await expect(lighting).toHaveAttribute("data-lit-lamps", "0");
  await page.waitForTimeout(2800);
  await expect(lighting).toHaveAttribute("data-lit-lamps", "0");
  for (let lamp = 1; lamp <= 3; lamp += 1) {
    if (lamp === 2) await page.keyboard.press("ArrowDown");
    else await page.mouse.wheel(0, 120);
    await expect(lighting).toHaveAttribute("data-lit-lamps", String(lamp));
  }
  await page.mouse.wheel(0, -120);
  await expect(lighting).toHaveAttribute("data-lit-lamps", "2");
  for (let lamp = 3; lamp <= 5; lamp += 1) {
    await page.mouse.wheel(0, 120);
    await expect(lighting).toHaveAttribute("data-lit-lamps", String(lamp));
  }
  await expect(director).toHaveAttribute("data-presentation", "result");
  await page.screenshot({ path: "Docs/hero-flow-review/client-feedback/lighting-desktop.png" });
  await expect(page.locator("[data-experience-root]")).not.toHaveAttribute("data-interaction-active", "stage");
  await page.mouse.wheel(0, 120);
  await expect(director).toHaveAttribute("data-active-station", "none");
});

test("table and keyboard buttons switch the installation screen and release ownership on exit", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await ready(page, "/en?intro=0&phase=engagement");
  await seekStationReview(page, "touch");
  const director = await waitForStation(page, "touch");
  const screen = page.locator("[data-composer-canvas]");
  await expect(screen).toHaveAttribute("data-transition-progress", "1.000");
  await expect(page.locator("[data-puzzle-slot]")).toHaveCount(0);
  for (const view of installationViews) {
    const button = page.locator(`[data-installation-button="${view}"]`);
    await expect(button).toHaveAttribute("data-physical-enabled", "true");
    const x = Number(await button.getAttribute("data-projected-x"));
    const y = Number(await button.getAttribute("data-projected-y"));
    expect(x).toBeGreaterThan(0);
    expect(y).toBeLessThan(900);
    await page.mouse.click(x, y);
    await expect(screen).toHaveAttribute("data-installation-view", view);
    await expect(button).toHaveAttribute("aria-pressed", "true");
  }
  await page.locator("[data-installation-button='details']").focus();
  await page.keyboard.press("Enter");
  await expect(screen).toHaveAttribute("data-installation-view", "details");
  await page.screenshot({ path: "Docs/hero-flow-review/client-feedback/installation-desktop.png" });
  await page.keyboard.press("Escape");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(screen).toHaveCount(0);
});

for (const locale of ["fa", "ar"] as const) {
  test(`${locale} installation controls fit a short RTL phone and work by touch`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true });
    const page = await context.newPage();
    await ready(page, `/${locale}?intro=0&phase=engagement`);
    await seekStationReview(page, "touch");
    await waitForStation(page, "touch");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    for (const view of installationViews) {
      const button = page.locator(`[data-installation-button="${view}"]`);
      await expect(button).toBeInViewport();
      const bounds = await button.boundingBox();
      expect(bounds!.width).toBeGreaterThanOrEqual(44);
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
      await button.tap();
      await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-installation-view", view);
    }
    await expect(page.locator("[data-scroll-cue]")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
    await page.screenshot({ path: `Docs/hero-flow-review/client-feedback/installation-${locale}-mobile.png` });
    const menu = page.locator("header button[aria-controls='primary-navigation']");
    await menu.tap();
    await page.locator("header nav a[href='#services']").tap();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("[data-connected-journey]")).toHaveAttribute("data-journey-phase", "services");
    await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-scroll-locked", "false");
    await expect(page.locator("[data-service-button]").first()).toBeInViewport();
    await context.close();
  });
}

test("mobile intro keeps its scroll cue clear and the menu bypasses the animation", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await ready(page, "/fa?introDuration=30000");
  await expect(page.locator("[data-experience-intro='active']")).toBeVisible();
  const cue = page.locator("[data-scroll-cue]");
  await expect(cue).toBeVisible();
  const cueBounds = await cue.boundingBox();
  const skipBounds = await page.locator("[data-experience-intro] button").boundingBox();
  expect(cueBounds).not.toBeNull();
  expect(skipBounds).not.toBeNull();
  expect(cueBounds!.y + cueBounds!.height).toBeLessThan(skipBounds!.y);
  await page.screenshot({ path: "Docs/hero-flow-review/client-feedback/intro-fa-mobile.png" });
  await page.locator("header button[aria-controls='primary-navigation']").tap();
  await page.locator("header nav a[href='#services']").tap();
  await expect(page.locator("[data-connected-journey]")).toHaveAttribute("data-journey-phase", "services");
  await expect(page.locator("[data-experience-intro]")).toHaveCount(0);
  await context.close();
});

test("loading waits for core assets and the header bypasses the intro into readable sections", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let requested = false;
  await page.route("**/mandegar_exhibition.glb", async (route) => {
    requested = true;
    await gate;
    await route.continue().catch(() => {});
  });
  await page.goto("/en", { waitUntil: "domcontentloaded" });
  try {
    await expect.poll(() => requested, { timeout: 80_000 }).toBe(true);
    const loader = page.getByRole("progressbar", { name: "Preparing the exhibition world" });
    await expect(loader).toBeVisible();
    const progress = Number(await loader.getAttribute("aria-valuenow"));
    expect(progress).toBeGreaterThanOrEqual(0);
    expect(progress).toBeLessThan(100);
    await expect(loader.locator("strong")).toContainText("%");
    release();
    await expect(page.locator("[data-loading-progress]")).toHaveAttribute("data-loading-progress", "100", { timeout: 100_000 });
  } finally {
    release();
  }
  const journey = page.locator("[data-connected-journey]");
  for (const [section, phase] of [["services", "services"], ["about", "about"], ["showcase", "projects"]] as const) {
    await page.locator(`header nav a[href='#${section}']`).click();
    await expect(page).toHaveURL(new RegExp(`#${section}$`));
    await expect(journey).toHaveAttribute("data-journey-phase", phase);
    await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-active-station", "none");
  }
  await page.goBack();
  await expect(journey).toHaveAttribute("data-journey-phase", "about");
  await page.locator("header nav a[href='#contact']").click();
  await expect(journey).toHaveAttribute("data-journey-phase", "finale");
  await expect(journey.locator("[data-final-cta]")).toBeVisible();
});

test("each upward swipe lights one lamp on mobile without moving the authored camera", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await ready(page, "/fa?intro=0&phase=reveal");
  await seekStationReview(page, "stage");
  await waitForStation(page, "stage");
  const lighting = page.locator("[data-stage-scroll]");
  const session = await context.newCDPSession(page);
  for (let lamp = 1; lamp <= 5; lamp += 1) {
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 20, y: 490 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 20, y: 418 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(lighting).toHaveAttribute("data-lit-lamps", String(lamp));
  }
  await page.screenshot({ path: "Docs/hero-flow-review/client-feedback/lighting-fa-mobile.png" });
  await context.close();
});

test("service deep link survives a reload and every service leads to its matching page", async ({ page }) => {
  await ready(page, "/en#services");
  const journey = page.locator("[data-connected-journey]");
  await expect(journey).toHaveAttribute("data-journey-phase", "services");
  for (let index = 0; index < serviceChapters.length; index += 1) {
    await journey.evaluate((node, label) => node.dispatchEvent(new CustomEvent("mandegar:journey-seek", { detail: { label } })), `Service${index + 1}`);
    const panel = page.locator(`[data-service-copy="${serviceChapters[index].id}"]`);
    const link = panel.locator("[data-service-button]");
    await expect(link).toBeInViewport();
    await expect(link).toHaveAttribute("href", `/en/services/${serviceChapters[index].slug}`);
    const response = await page.request.get(`/en/services/${serviceChapters[index].slug}`);
    expect(response.status()).toBe(200);
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-loading-progress]")).toHaveAttribute("data-loading-progress", "100", { timeout: 100_000 });
  await expect(journey).toHaveAttribute("data-journey-phase", "services");
});

test("header services jump cancels an active installation hold", async ({ page }) => {
  await ready(page, "/en?intro=0&phase=engagement");
  await seekStationReview(page, "touch");
  await waitForStation(page, "touch");
  await page.locator("header nav a[href='#services']").click();
  await expect(page.locator("[data-connected-journey]")).toHaveAttribute("data-journey-phase", "services");
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-scroll-locked", "false");
});

test("reduced motion keeps section navigation and all service links accessible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page, "/fa#services");
  const showcase = page.locator("[data-services-showcase]");
  await expect(showcase).toHaveAttribute("data-services-mode", "reduced");
  await expect(showcase.locator("[data-service-button]")).toHaveCount(5);
  await expect(showcase.locator("[data-service-button]").first()).toBeInViewport();
  await showcase.locator("[data-service-button]").first().focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/fa\/services\/event-production/);
});
