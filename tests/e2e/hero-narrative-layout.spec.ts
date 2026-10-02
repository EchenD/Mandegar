import { expect, test } from "@playwright/test";
import { narrativeScore } from "../../components/experience/narrative-score";
import { waitForStation } from "./hero-interaction-helpers";

test.setTimeout(240_000);
test.use({ video: "off", trace: "off" });

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

const stations: Record<string, string> = {
  activation: "photo",
  engagement: "touch",
  reveal: "stage",
  experiences: "game",
  connection: "draw",
};

const stationCanvases: Record<string, string> = {
  photo: "[data-photo-spatial-controls] canvas",
  touch: "[data-composer-canvas]",
  stage: "[data-stage-canvas]",
  game: "[data-game-canvas]",
  draw: "[data-drawing-canvas]",
};

const visualPhases = new Set(["discovery", "engagement", "reveal", "proof", "intelligence"]);

for (const locale of ["fa", "ar"] as const) {
  for (const viewport of viewports) {
    test(`${locale} narrative remains readable within the ${viewport.name} scene when seeking forward and back`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.goto(`/${locale}?intro=0`, { waitUntil: "domcontentloaded" });
      const root = page.locator("[data-experience-root]");
      const director = page.locator("[data-interaction-director]");
      await expect(page.locator("[data-particle-loader]")).toHaveAttribute("data-complete", "true", { timeout: 45_000 });
      await expect(root).not.toHaveAttribute("data-intro-active", "true");
      await page.evaluate(() => document.fonts.ready);

      const beats = narrativeScore.filter((beat) => beat.id !== "loop");
      const reverseBeats = ["intelligence", "connection", "discovery"].map((id) => beats.find((beat) => beat.id === id)!);
      for (const [index, beat] of [...beats, ...reverseBeats].entries()) {
        await root.evaluate((element, progress) => {
          element.dispatchEvent(new CustomEvent("mandegar:seek", {
            detail: { progress, sync: true },
          }));
        }, beat.preview);
        await expect(root).toHaveAttribute("data-story-stage", beat.id);
        // The first forward arrival opens an authored station. Dismiss it to
        // measure the story text; reverse visits retain the dismissed state.
        if (index < beats.length && stations[beat.id]) {
          const station = stations[beat.id];
          await waitForStation(page, station);
          await expect(page.locator(stationCanvases[station])).toHaveAttribute("data-transition-progress", "1.000");
          await page.keyboard.press("Escape");
        }
        await expect(director).toHaveAttribute("data-active-station", "none");
        await expect(root).not.toHaveAttribute("data-interaction-active");
        const copy = page.locator(`[data-scene-copy='${beat.id}']`);
        await expect(copy).toBeVisible();
        await expect.poll(() => copy.locator("p").evaluate((paragraph) => Number(getComputedStyle(paragraph).opacity))).toBe(1);

        const presentation = await copy.evaluate((element) => {
          const lines = Array.from(element.querySelectorAll<HTMLElement>("[data-copy-line]"));
          const paragraph = element.querySelector<HTMLElement>("p")!;
          const style = getComputedStyle(paragraph);
          const wrapperStyle = getComputedStyle(element);
          const backgroundChannels = wrapperStyle.backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [];
          return {
            boxes: lines.map((line) => {
              const rect = line.getBoundingClientRect();
              return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
            }),
            bodyFontSize: parseFloat(style.fontSize),
            bodyHeight: paragraph.getBoundingClientRect().height,
            bodyLineHeight: parseFloat(style.lineHeight),
            backgroundAlpha: backgroundChannels.length === 4 ? backgroundChannels[3] : 1,
            backgroundImage: wrapperStyle.backgroundImage,
            viewportWidth: innerWidth,
            viewportHeight: innerHeight,
            documentWidth: document.documentElement.scrollWidth,
            visibleMessages: Array.from(document.querySelectorAll<HTMLElement>("[data-scene-copy]")).filter((message) => {
              const messageStyle = getComputedStyle(message);
              return messageStyle.visibility !== "hidden" && Number(messageStyle.opacity) > 0.1;
            }).map((message) => message.dataset.sceneCopy),
          };
        });
        expect(presentation.visibleMessages, beat.id).toEqual([beat.id]);
        expect(presentation.bodyFontSize, beat.id).toBeGreaterThanOrEqual(14);
        expect(presentation.documentWidth, beat.id).toBeLessThanOrEqual(presentation.viewportWidth + 1);
        for (const box of presentation.boxes) {
          expect(box.left, beat.id).toBeGreaterThanOrEqual(0);
          expect(box.right, beat.id).toBeLessThanOrEqual(presentation.viewportWidth);
          expect(box.top, beat.id).toBeGreaterThanOrEqual(0);
          expect(box.bottom, beat.id).toBeLessThanOrEqual(presentation.viewportHeight);
        }
        expect(presentation.backgroundAlpha, beat.id).toBeLessThan(0.05);
        expect(presentation.backgroundImage, beat.id).toBe("none");
        if (viewport.name === "desktop") {
          expect(presentation.bodyHeight, beat.id).toBeLessThanOrEqual(presentation.bodyLineHeight + 1);
        }
        if (locale === "fa" && viewport.name === "desktop" && index < beats.length && visualPhases.has(beat.id)) {
          await page.evaluate(() => new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }));
          await testInfo.attach(`narrative-fa-desktop-${beat.id}`, {
            body: await page.screenshot(),
            contentType: "image/png",
          });
        }
      }
      await expect(root).toHaveAttribute("data-scroll-direction", "backward");
    });
  }
}
