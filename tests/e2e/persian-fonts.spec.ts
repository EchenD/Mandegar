import { expect, test } from "@playwright/test";
import { getNarrativeCopyTiming } from "../../components/experience/narrative-copy-timing";
import { getInteractionCopy } from "../../components/experience/interactions/interaction-copy";
import { waitForStation } from "./hero-interaction-helpers";

test.setTimeout(180_000);
test.use({ video: "off", trace: "off" });

for (const locale of ["fa", "en", "ar"] as const) {
  test(`${locale} uses its intended loaded font on mobile and inner-page headers`, async ({ page }, testInfo) => {
    const failedFonts: string[] = [];
    page.on("response", (response) => {
      if (response.status() >= 400 && /\.(woff2?|ttf)(?:\?|$)/.test(response.url())) {
        failedFonts.push(`${response.status()} ${response.url()}`);
      }
    });
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(`/${locale}/partners`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("main h1")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const fonts = await page.evaluate(() => ({
      family: getComputedStyle(document.body).fontFamily,
      loaded: Array.from(document.fonts).filter((font) => font.status === "loaded")
        .map((font) => ({ family: font.family, weight: font.weight })),
    }));
    const primary = fonts.family.split(",")[0].replaceAll('"', "").trim();
    if (locale === "fa") {
      expect(primary).toMatch(/rokhFaNum/i);
      expect(fonts.loaded.some((font) => /rokhFaNum/i.test(font.family) && font.weight === "400")).toBe(true);
      expect(fonts.family).toContain("Vazirmatn Variable");
    } else {
      expect(primary).toBe("Vazirmatn Variable");
      expect(fonts.loaded.some((font) => /rokhFaNum/i.test(font.family))).toBe(false);
    }
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "en" ? "ltr" : "rtl");
    for (const width of [320, 390, 761, 1003, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      const header = page.locator("header[data-home]");
      await expect(header).toBeVisible();
      await expect(header.locator("[data-analytics='cta_start_project']")).toBeInViewport();
      const overlaps = await header.evaluate((element) => {
        const children = Array.from(element.children).filter((child) => {
          const style = getComputedStyle(child);
          return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > .5;
        }).map((child) => ({ name: child.tagName, bounds: child.getBoundingClientRect() }));
        return children.flatMap((first, index) => children.slice(index + 1).flatMap((second) => {
          const x = Math.min(first.bounds.right, second.bounds.right) - Math.max(first.bounds.left, second.bounds.left);
          const y = Math.min(first.bounds.bottom, second.bounds.bottom) - Math.max(first.bounds.top, second.bounds.top);
          return x > 1 && y > 1 ? [`${first.name}/${second.name}`] : [];
        }));
      });
      expect(overlaps, `Header overlap at ${width}px`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
    }
    expect(failedFonts).toEqual([]);
    await testInfo.attach("loaded-fonts", { body: JSON.stringify(fonts, null, 2), contentType: "application/json" });
    await page.goto(`/${locale}/font-review-missing-page`, { waitUntil: "domcontentloaded" });
    const recovery = page.locator(`main section[lang='${locale}']`);
    await expect(recovery).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const recoveryFamily = await recovery.evaluate((element) => getComputedStyle(element).fontFamily.split(",")[0].replaceAll('"', "").trim());
    expect(recoveryFamily).toBe(primary);
  });
}

test("Persian hero monitors paint localized text with the same font as the page", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const recorded = new Map<string, string>();
    (window as typeof window & { canvasTextFonts: Map<string, string> }).canvasTextFonts = recorded;
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (...args: Parameters<typeof original>) {
      if (/[\u0600-\u06ff]/.test(args[0])) recorded.set(args[0], this.font);
      return original.apply(this, args);
    };
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/fa?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-loading-progress]")).toHaveAttribute("data-loading-progress", "100", { timeout: 100_000 });
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-runtime", /^(adaptive|full)$/, { timeout: 80_000 });
  await page.evaluate(() => document.fonts.ready);
  const primary = await page.evaluate(() => getComputedStyle(document.body).fontFamily.split(",")[0].replaceAll('"', "").trim());
  expect(primary).toMatch(/rokhFaNum/i);
  const copy = getInteractionCopy("fa");
  for (const [phase, station, text] of [
    ["engagement", "touch", "ایده"],
    ["experiences", "game", copy.game.distance],
    ["connection", "draw", copy.stations.draw.title],
  ] as const) {
    const timing = getNarrativeCopyTiming(phase);
    await page.locator("[data-experience-root]").evaluate((root, progress) => {
      root.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
    }, (timing.enterEnd + timing.exitStart) / 2);
    await expect(page.locator("[data-experience-root]")).toHaveAttribute("data-story-stage", phase);
    await waitForStation(page, station);
    await expect.poll(() => page.evaluate((label) => {
      return (window as typeof window & { canvasTextFonts: Map<string, string> }).canvasTextFonts.get(label) ?? "";
    }, text), { timeout: 20_000 }).toContain(primary);
  }
  await page.evaluate(() => document.fonts.ready);
  const records = await page.evaluate(() => Object.fromEntries(
    (window as typeof window & { canvasTextFonts: Map<string, string> }).canvasTextFonts,
  ));
  expect(Object.keys(records).length).toBeGreaterThan(3);
  for (const family of Object.values(records)) expect(family).toContain(primary);
  const allFacesLoaded = await page.evaluate((fonts) => fonts.every((font) => document.fonts.check(font.split(",")[0], "فارسی ۱۲۳")), Object.values(records));
  expect(allFacesLoaded).toBe(true);
  await testInfo.attach("canvas-fonts", { body: JSON.stringify(records, null, 2), contentType: "application/json" });
});
