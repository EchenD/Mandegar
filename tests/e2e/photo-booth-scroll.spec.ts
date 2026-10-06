import { expect, test, type Page } from "@playwright/test";
import { getNarrativeCopyTiming } from "../../components/experience/narrative-copy-timing";

test.setTimeout(150_000);
test.use({ video: "off", trace: "off" });

const copyTiming = getNarrativeCopyTiming("activation");
const scenePoint = (amount: number) => {
  const points = [[0, 520], [0.28, 580], [0.38, 610], [0.56, 668.5], [1, 700]];
  if (amount >= 1) return 700 / 2500;
  const index = points.findIndex(([at]) => at >= amount);
  if (index <= 0) return 520 / 2500;
  const [from, start] = points[index - 1];
  const [to, end] = points[index];
  return (start + (end - start) * (amount - from) / (to - from)) / 2500;
};
const capturePoint = scenePoint(0.28);
const readyPoint = (amount: number) => copyTiming.enterStart + (capturePoint - copyTiming.enterStart) * amount;

async function openBooth(page: Page, locale: string) {
  await page.goto(`/${locale}?intro=0&phase=discovery`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-loading-progress]")).toHaveAttribute("data-loading-progress", "100", { timeout: 90_000 });
  await expect(page.locator("[data-experience-root]")).not.toHaveAttribute("data-intro-active", "true");
}

async function seek(page: Page, progress: number) {
  await page.locator("[data-experience-root]").evaluate((root, value) => {
    root.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress: value, sync: true } }));
  }, progress);
  await expect.poll(async () => Number(await page.locator("[data-experience-root]").getAttribute("data-native-progress")))
    .toBeCloseTo(progress, 4);
}

async function photoAnchor(page: Page) {
  return page.evaluate(() => new Promise<{ x: number; y: number }>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener("mandegar:interaction-anchors", receive);
      reject(new Error("The photo booth camera anchor was not rendered."));
    }, 10_000);
    const receive = (event: Event) => {
      const frame = (event as CustomEvent<{ stations: { photo: { x: number; y: number; fallback: boolean } } }>).detail;
      if (frame.stations.photo.fallback) return;
      clearTimeout(timer);
      window.removeEventListener("mandegar:interaction-anchors", receive);
      resolve({ x: frame.stations.photo.x, y: frame.stations.photo.y });
    };
    window.addEventListener("mandegar:interaction-anchors", receive);
  }));
}

test("photo cue starts with the text, pauses without scrolling and reverses without a Skip button", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openBooth(page, "fa");
  const photo = page.locator("[data-photo-scroll]");
  const root = page.locator("[data-experience-root]");
  const director = page.locator("[data-interaction-director]");
  const text = page.locator("[data-scene-copy='activation'] [data-copy-line]");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  await seek(page, copyTiming.enterStart - 0.001);
  await expect(photo).toHaveAttribute("data-photo-state", "idle");
  await expect(text).toBeHidden();
  await seek(page, copyTiming.enterStart + 0.003);
  await expect(text).toBeVisible();
  const opacity = await text.evaluate((element) => Number(getComputedStyle(element).opacity));
  expect(opacity).toBeGreaterThan(0);
  expect(opacity).toBeLessThan(1);
  await expect(photo).toHaveAttribute("data-photo-state", "countdown");
  const paused = await photo.getAttribute("data-photo-animation-progress");
  // Longer than the former automatic countdown and phone delivery combined.
  await page.waitForTimeout(2_500);
  await expect(photo).toHaveAttribute("data-photo-animation-progress", paused!);

  for (const amount of [0.5, 0.85, 0.5, 0.1]) {
    await seek(page, readyPoint(amount));
    await expect.poll(async () => Number(await photo.getAttribute("data-photo-animation-progress"))).toBeCloseTo(amount * 0.28, 3);
    await expect(photo).toHaveAttribute("data-photo-state", "countdown");
  }
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(director).toHaveAttribute("data-scroll-locked", "false");
  await expect(page.locator("[data-interaction-escape], [data-interaction-replay]")).toHaveCount(0);
  await expect(root).not.toHaveAttribute("data-interaction-active");
  await expect(page.locator("[data-scroll-cue]")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("photo-ready-desktop.png") });
  await seek(page, copyTiming.enterStart - 0.001);
  await expect(photo).toHaveAttribute("data-photo-state", "idle");
  await expect(text).toBeHidden();
  expect(errors).toEqual([]);
});

test("scrolling advances photo delivery along the authored camera window and reverses it", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openBooth(page, "en");
  const root = page.locator("[data-experience-root]");
  const photo = page.locator("[data-photo-scroll]");
  await seek(page, scenePoint(0.29));
  await expect(photo).toHaveAttribute("data-photo-state", "captured");
  const startingAnchor = await photoAnchor(page);
  const scrollDistance = await root.evaluate((element: HTMLElement) => element.offsetHeight - innerHeight);
  const initialProgress = Number(await photo.getAttribute("data-photo-animation-progress"));
  await page.mouse.move(20, 450);
  await page.mouse.wheel(0, (scenePoint(0.33) - scenePoint(0.29)) * scrollDistance);
  await expect.poll(async () => Number(await photo.getAttribute("data-photo-animation-progress"))).toBeGreaterThan(initialProgress + 0.01);
  await expect.poll(async () => Number(await root.getAttribute("data-native-progress"))).toBeCloseTo(scenePoint(0.33), 3);
  const flyingAnchor = await photoAnchor(page);
  expect([startingAnchor.x, startingAnchor.y, flyingAnchor.x, flyingAnchor.y].every(Number.isFinite)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("photo-flight-desktop.png") });

  await seek(page, scenePoint(0.33));
  const forward = await photo.getAttribute("data-photo-animation-progress");
  await seek(page, scenePoint(0.48));
  await expect.poll(async () => Number(await photo.getAttribute("data-photo-animation-progress"))).toBeGreaterThan(0.38);
  await expect(photo).toHaveAttribute("data-photo-state", "captured");
  await page.screenshot({ path: testInfo.outputPath("photo-delivered-desktop.png") });
  await page.keyboard.press("ArrowUp");
  await expect.poll(async () => Number(await photo.getAttribute("data-photo-animation-progress"))).toBeLessThan(0.48);
  await seek(page, scenePoint(0.33));
  await expect(photo).toHaveAttribute("data-photo-animation-progress", forward!);
  await seek(page, scenePoint(1));
  await expect(photo).toHaveAttribute("data-photo-state", "idle");
  await seek(page, scenePoint(0.48));
  await expect(photo).toHaveAttribute("data-photo-state", "captured");
  await seek(page, readyPoint(0.85));
  await expect(photo).toHaveAttribute("data-photo-state", "countdown");
  await expect(root).not.toHaveAttribute("data-interaction-active");
  await expect(page.locator("[data-composer-canvas]")).toHaveCount(0);
});

for (const locale of ["fa", "ar"] as const) {
  test(`${locale} mobile swipes scrub the photo forward and backward without a camera hold`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    try {
      await openBooth(page, locale);
      const root = page.locator("[data-experience-root]");
      const photo = page.locator("[data-photo-scroll]");
      await seek(page, readyPoint(0.45));
      await expect(photo).toHaveAttribute("data-photo-state", "countdown");
      const initialPhoto = Number(await photo.getAttribute("data-photo-animation-progress"));
      const initialScroll = await page.evaluate(() => scrollY);
      const session = await context.newCDPSession(page);
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 30, y: 660 }] });
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 30, y: 540 }] });
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(initialScroll + 50);
      await expect.poll(async () => Number(await photo.getAttribute("data-photo-animation-progress"))).toBeGreaterThan(initialPhoto);
      await expect(root).not.toHaveAttribute("data-interaction-active");

      await seek(page, scenePoint(0.46));
      await expect(photo).toHaveAttribute("data-photo-state", "captured");
      await page.screenshot({ path: testInfo.outputPath(`photo-delivered-${locale}-mobile.png`) });
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 30, y: 470 }] });
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 30, y: 620 }] });
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await expect.poll(async () => Number(await photo.getAttribute("data-photo-animation-progress"))).toBeLessThan(0.42);
      await expect(root).not.toHaveAttribute("data-interaction-active");
      await expect(page.locator("[data-interaction-escape]")).toHaveCount(0);
      await expect(page.locator("[data-scene-copy='activation']")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    } finally {
      await context.close();
    }
  });
}

for (const { locale, label, viewport } of [
  { locale: "en", label: "Ready!", viewport: { width: 1440, height: 900 } },
  { locale: "fa", label: "آماده!", viewport: { width: 1440, height: 900 } },
  { locale: "fa", label: "آماده!", viewport: { width: 390, height: 844 } },
  { locale: "ar", label: "جاهز!", viewport: { width: 390, height: 844 } },
]) {
  test(`${locale} ${viewport.width}px photo booth paints a localized Ready cue and clears it on capture`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      const observer = window as unknown as Window & { __photoCuePaints: { text: string; width: number; direction: string }[] };
      observer.__photoCuePaints = [];
      const paint = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
        if (this.canvas.hasAttribute("data-photo-scroll")) {
          observer.__photoCuePaints.push({ text, width: Math.min(this.measureText(text).width, maxWidth ?? Infinity), direction: this.direction });
        }
        if (maxWidth === undefined) paint.call(this, text, x, y);
        else paint.call(this, text, x, y, maxWidth);
      };
    });
    await openBooth(page, locale);
    const photo = page.locator("[data-photo-scroll]");
    const paintedTexts = () => page.evaluate(() => (window as unknown as Window & { __photoCuePaints: { text: string }[] }).__photoCuePaints.map((paint) => paint.text));
    const paintedPixels = () => photo.evaluate((canvas: HTMLCanvasElement) => {
      const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      let painted = 0;
      for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 0) painted += 1;
      return painted;
    });
    await seek(page, readyPoint(0.5));
    await expect.poll(paintedTexts).toContain(label);
    await expect.poll(paintedPixels).toBeGreaterThan(100);
    const paint = await page.evaluate(() => (window as unknown as Window & { __photoCuePaints: { text: string; width: number; direction: string }[] }).__photoCuePaints.at(-1)!);
    expect(paint.width).toBeLessThan(800);
    expect(paint.direction).toBe(locale === "en" ? "ltr" : "rtl");
    await page.screenshot({ path: testInfo.outputPath(`photo-ready-${locale}-${viewport.width}.png`) });
    await seek(page, scenePoint(0.48));
    await expect(photo).toHaveAttribute("data-photo-state", "captured");
    await expect.poll(paintedPixels).toBe(0);
    await seek(page, readyPoint(0.85));
    await expect(photo).toHaveAttribute("data-photo-state", "countdown");
    await expect.poll(paintedPixels).toBeGreaterThan(100);
    expect((await paintedTexts()).every((text) => text === label)).toBe(true);
    await expect(page.locator("[data-interaction-escape]")).toHaveCount(0);
  });
}
