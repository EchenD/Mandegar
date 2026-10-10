import { expect, test, type Page } from "@playwright/test";
import { waitForStation } from "./hero-interaction-helpers";

test.setTimeout(120_000);

async function expectReadableWork(page: Page) {
  const journey = page.locator("[data-connected-journey]");
  const firstProject = journey.locator("[data-project-copy='0']");
  const projectLink = firstProject.getByRole("link");
  await expect(projectLink).toHaveCount(1);
  await expect(projectLink).toBeFocused();
  await expect(projectLink).toBeInViewport();
  await expect(firstProject.locator("[data-project-title]")).toHaveText(
    await projectLink.getAttribute("aria-label") ?? "",
  );
  await expect(firstProject.locator("[data-project-category]")).toHaveCount(0);
  await expect(firstProject.locator("[data-project-action]")).toHaveCount(0);
  if (await journey.getAttribute("data-motion") !== "reduced") {
    const imageLink = journey.locator("[data-orbit-card][data-featured='true'] [data-project-image-link]");
    await expect(imageLink).toHaveCount(1);
    await expect(imageLink).toBeInViewport();
    await expect(imageLink).toHaveAttribute("href", await projectLink.getAttribute("href") ?? "");
    expect(await journey.locator("[data-orbit-card][data-featured='false'] [data-project-image-link]").evaluateAll((links) => links.every((link) => (
      (link as HTMLAnchorElement).tabIndex === -1 && link.closest<HTMLElement>("[data-orbit-card]")?.inert
    )))).toBe(true);
  }
  const director = page.locator("[data-interaction-director]");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(director).toHaveAttribute("data-scroll-locked", "false");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(2);
}

test("keyboard shortcut jumps directly to readable work and scrolling continues", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en?intro=0", { waitUntil: "domcontentloaded" });
  const shortcut = page.getByRole("button", { name: "View work" });
  await expect(shortcut).toBeVisible({ timeout: 45_000 });
  await expect(page.locator("[data-experience-root]")).not.toHaveAttribute("data-intro-active", "true");
  await page.screenshot({ path: testInfo.outputPath("desktop-opening.png") });
  await shortcut.focus();
  await page.keyboard.press("Enter");
  await expectReadableWork(page);
  await page.screenshot({ path: testInfo.outputPath("desktop-work.png") });
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 200);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 100);
});

test.describe("mobile work shortcut", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  for (const locale of ["fa", "ar"] as const) {
    test(`${locale} mobile navigation reaches work without adding a shortcut beside the controls`, async ({ page }, testInfo) => {
      await page.goto(`/${locale}?intro=0&phase=engagement`, { waitUntil: "domcontentloaded" });
      await waitForStation(page, "touch");
      const shortcut = page.locator("[data-work-shortcut]");
      await expect(shortcut).toBeAttached();
      await expect(shortcut).toBeHidden();
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await page.locator("[aria-controls='primary-navigation']").tap();
      const projectsLink = page.locator("#primary-navigation a[href='#showcase']");
      await expect(projectsLink).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${locale}-mobile-navigation.png`) });
      await projectsLink.tap();
      await expectReadableWork(page);
      await page.screenshot({ path: testInfo.outputPath(`${locale}-mobile-work.png`) });
    });
  }
});

test("reduced-motion shortcut reaches the static project without opening an interaction", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en?intro=0", { waitUntil: "domcontentloaded" });
  const shortcut = page.getByRole("button", { name: "View work" });
  await expect(shortcut).toBeVisible({ timeout: 45_000 });
  await expect(page.locator("[data-connected-journey]")).toHaveAttribute("data-motion", "reduced");
  await shortcut.click();
  await expectReadableWork(page);
});
