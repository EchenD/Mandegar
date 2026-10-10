import { expect, test, type Page } from "@playwright/test";
import { getMobileCameraFramingAspect, getResponsiveCameraFov, mobileCameraFraming } from "../../components/experience/camera-framing";
import { getHeroRenderDpr } from "../../components/experience/hero-render-quality";
import { heroTimeline } from "../../components/experience/hero-timeline-config";

test.use({ video: "off", trace: "off" });

async function renderSize(page: Page) {
  return page.locator("[data-experience-canvas='true'] canvas").evaluate((canvas: HTMLCanvasElement) => {
    const bounds = canvas.getBoundingClientRect();
    return {
      ratio: canvas.width / bounds.width,
      pixels: canvas.width * canvas.height,
      width: bounds.width,
      height: bounds.height,
    };
  });
}

test("camera framing stays continuous across narrow-window and portrait thresholds", () => {
  for (const phase of heroTimeline.phases) {
    for (const width of [760, 960]) {
      const before = getResponsiveCameraFov(31.4, width - 0.01, 700, phase.preview);
      const after = getResponsiveCameraFov(31.4, width + 0.01, 700, phase.preview);
      expect(Math.abs(after - before)).toBeLessThan(0.01);
    }
    for (const aspect of [0.9, 1, 1.25]) {
      const before = getResponsiveCameraFov(31.4, 1024, 1024 / (aspect - 0.00001), phase.preview);
      const after = getResponsiveCameraFov(31.4, 1024, 1024 / (aspect + 0.00001), phase.preview);
      expect(Math.abs(after - before)).toBeLessThan(0.01);
    }
    for (const height of [600, 760]) {
      const before = getResponsiveCameraFov(31.4, 390, height - 0.01, phase.preview);
      const after = getResponsiveCameraFov(31.4, 390, height + 0.01, phase.preview);
      expect(Math.abs(after - before)).toBeLessThan(0.01);
    }
  }
  for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(getResponsiveCameraFov(31.4, value, 844)).toBe(31.4);
    expect(getResponsiveCameraFov(31.4, 390, value)).toBe(31.4);
  }
  expect(getMobileCameraFramingAspect(Number.NaN)).toBe(mobileCameraFraming.arrival);
  expect(getMobileCameraFramingAspect(-1)).toBe(mobileCameraFraming.arrival);
  expect(getMobileCameraFramingAspect(2)).toBe(mobileCameraFraming.loop);
});

test("mobile lenses hold during viewing windows and ease continuously through camera travel", () => {
  for (const phase of heroTimeline.phases) {
    expect(getMobileCameraFramingAspect(phase.start)).toBeCloseTo(mobileCameraFraming[phase.id], 8);
    expect(getMobileCameraFramingAspect(phase.end)).toBeCloseTo(mobileCameraFraming[phase.id], 8);
    expect(getMobileCameraFramingAspect(phase.preview)).toBeCloseTo(mobileCameraFraming[phase.id], 8);
  }
  for (const [width, height] of [[390, 844], [390, 700], [390, 600], [320, 568], [360, 960], [320, 1200], [760, 475]]) {
    for (let index = 0; index < heroTimeline.phases.length - 1; index += 1) {
      const phase = heroTimeline.phases[index];
      const next = heroTimeline.phases[index + 1];
      const values = Array.from({ length: 101 }, (_, step) => getResponsiveCameraFov(31.4, width, height,
        phase.end + (next.start - phase.end) * step / 100));
      const minimum = Math.min(values[0], values.at(-1)!);
      const maximum = Math.max(values[0], values.at(-1)!);
      values.forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(minimum - 0.000001);
        expect(value).toBeLessThanOrEqual(maximum + 0.000001);
      });
      // No lens jump or sharp velocity change at the edges of a chapter.
      expect(Math.abs(values[1] - values[0])).toBeLessThan(0.001);
      expect(Math.abs(values.at(-1)! - values.at(-2)!)).toBeLessThan(0.001);
      expect(getResponsiveCameraFov(31.4, 1440, 900, next.start)).toBe(31.4);
    }
  }
  expect(getResponsiveCameraFov(31.4, 320, 1200, 0)).toBeLessThanOrEqual(100);
  const connection = heroTimeline.phases.find((phase) => phase.id === "connection")!;
  expect(getResponsiveCameraFov(31.4, 320, 1200, connection.preview)).toBeLessThan(90);
  expect(getResponsiveCameraFov(31.4, 390, 844, 0)).toBe(getResponsiveCameraFov(31.4, 390, 844, 1));
});

test("short portrait game views gain room while other shots retain their framing", () => {
  const game = heroTimeline.phases.find((phase) => phase.id === "experiences")!;
  // Keep the viewport aspect constant so this measures space reserved for the
  // short-screen instructions, rather than ordinary portrait lens correction.
  const aspect = 0.48;
  const sample = (height: number, progress: number) => getResponsiveCameraFov(31.4, height * aspect, height, progress);
  const shortGame = sample(600, game.preview);
  const tallGame = sample(844, game.preview);
  expect(shortGame).toBeGreaterThan(tallGame + 5);
  for (const height of [568, 600, 680, 760, 844]) {
    const resting = sample(height, game.preview);
    expect(sample(height, game.start)).toBeCloseTo(resting, 8);
    expect(sample(height, game.end)).toBeCloseTo(resting, 8);
  }
  const resizeValues = Array.from({ length: 101 }, (_, step) => sample(600 + 160 * step / 100, game.preview));
  for (let index = 1; index < resizeValues.length; index += 1) {
    expect(resizeValues[index]).toBeLessThanOrEqual(resizeValues[index - 1] + 0.000001);
  }
  expect(Math.abs(resizeValues[1] - resizeValues[0])).toBeLessThan(0.001);
  expect(Math.abs(resizeValues.at(-1)! - resizeValues.at(-2)!)).toBeLessThan(0.001);
  for (const phase of heroTimeline.phases.filter((phase) => phase.id !== "experiences")) {
    expect(sample(600, phase.preview)).toBeCloseTo(sample(844, phase.preview), 8);
  }
});

test("mobile rendering sharpens dense displays within the device and pixel budgets", () => {
  const normal = getHeroRenderDpr("adaptive", 390, 844, 3);
  const constrained = getHeroRenderDpr("adaptive", 390, 844, 3, true);
  expect(normal).toBeGreaterThanOrEqual(1.5);
  expect(normal).toBeLessThanOrEqual(1.75);
  expect(normal * normal * 390 * 844).toBeLessThanOrEqual(1_250_000);
  expect(constrained).toBeLessThanOrEqual(1.5);
  expect(constrained * constrained * 390 * 844).toBeLessThanOrEqual(750_000);
  const tall = getHeroRenderDpr("adaptive", 430, 1100, 3);
  expect(tall * tall * 430 * 1100).toBeLessThanOrEqual(1_250_000 + 1);
  expect(getHeroRenderDpr("adaptive", 390, 844, 1)).toBe(1);
  expect(getHeroRenderDpr("full", 2560, 1440, 2)).toBe(1.5);
  expect(getHeroRenderDpr("adaptive", 390, 844, 0.75)).toBe(0.75);
  for (const constrainedDevice of [false, true]) {
    const budget = constrainedDevice ? 750_000 : 1_250_000;
    for (const [width, height] of [[1920, 1080], [3840, 2160], [7680, 4320]]) {
      const ratio = getHeroRenderDpr("adaptive", width, height, 3, constrainedDevice);
      expect(ratio).toBeGreaterThan(0);
      expect(ratio * ratio * width * height).toBeLessThanOrEqual(budget + 1);
    }
  }
  for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(Number.isFinite(getHeroRenderDpr("adaptive", invalid, 844, 3))).toBe(true);
    expect(Number.isFinite(getHeroRenderDpr("adaptive", 390, invalid, 3))).toBe(true);
    expect(getHeroRenderDpr("adaptive", 390, 844, invalid)).toBe(1);
  }
});

for (const locale of ["fa", "en", "ar"] as const) {
  test(`${locale} dense mobile display renders smooth edges and reverses the phase lenses`, async ({ browser }) => {
    test.setTimeout(240_000);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, value: 8 });
      Object.defineProperty(navigator, "deviceMemory", { configurable: true, value: 8 });
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(`/${locale}?intro=0&phase=discovery`, { waitUntil: "domcontentloaded" });
      await expect(page.locator("[data-loading-progress]")).toHaveAttribute("data-loading-progress", "100", { timeout: 100_000 });
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "en" ? "ltr" : "rtl");
      const root = page.locator("[data-experience-root]");
      const canvas = page.locator("[data-experience-canvas='true'] canvas");
      await expect(canvas).toBeVisible();
      const rendering = await canvas.evaluate((element: HTMLCanvasElement) => {
        const bounds = element.getBoundingClientRect();
        return { width: element.width, height: element.height, ratio: element.width / bounds.width,
          antialias: element.getContext("webgl2")?.getContextAttributes()?.antialias };
      });
      expect(rendering.antialias).toBe(true);
      expect(rendering.ratio).toBeGreaterThanOrEqual(1.5);
      expect(rendering.ratio).toBeLessThanOrEqual(1.75);
      expect(rendering.width * rendering.height).toBeLessThanOrEqual(1_250_000);
      const phases = heroTimeline.phases.filter((phase) => phase.id !== "loop");
      const firstValues = new Map<string, number>();
      for (const phase of [...phases, ...[...phases].reverse()]) {
        await root.evaluate((element, progress) => element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } })), phase.preview);
        await expect(root).toHaveAttribute("data-story-stage", phase.id);
        await expect.poll(async () => Number(await root.getAttribute("data-camera-frame"))).toBeCloseTo(phase.viewFrame, 1);
        const projection = JSON.parse(await root.getAttribute("data-camera-projection") ?? "[]") as number[];
        const fov = projection[0];
        expect(fov).toBeGreaterThan(65);
        expect(fov).toBeLessThanOrEqual(100);
        if (firstValues.has(phase.id)) expect(fov).toBeCloseTo(firstValues.get(phase.id)!, 6);
        else firstValues.set(phase.id, fov);
      }
      expect(firstValues.get("connection")!).toBeLessThan(firstValues.get("arrival")! - 8);
      expect(firstValues.get("engagement")!).toBeLessThan(firstValues.get("reveal")! - 6);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
      expect(errors).toEqual([]);
      await page.setViewportSize({ width: 844, height: 390 });
      await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-runtime", "adaptive");
      await expect.poll(async () => (await renderSize(page)).width).toBe(844);
      await expect.poll(async () => (await renderSize(page)).ratio).toBeCloseTo(1.75, 2);
      expect((await renderSize(page)).pixels).toBeLessThanOrEqual(1_250_000);
    } finally {
      await context.close();
    }
  });
}

test("render budgets survive display-density changes, large viewports and tab suspension", async ({ browser }) => {
  test.setTimeout(240_000);
  const context = await browser.newContext({ viewport: { width: 430, height: 1100 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, value: 4 });
    Object.defineProperty(navigator, "deviceMemory", { configurable: true, value: 4 });
    const nativeMatchMedia = window.matchMedia.bind(window);
    const queries: MediaQueryList[] = [];
    Object.defineProperty(window, "heroResolutionQueries", { value: queries });
    window.matchMedia = (query) => {
      const result = nativeMatchMedia(query);
      if (query.startsWith("(resolution:")) queries.push(result);
      return result;
    };
  });
  const page = await context.newPage();
  try {
    await page.goto("/fa?intro=0&phase=proof", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-loading-progress]")).toHaveAttribute("data-loading-progress", "100", { timeout: 100_000 });
    await expect.poll(async () => (await renderSize(page)).ratio).toBeCloseTo(getHeroRenderDpr("adaptive", 430, 1100, 3, true), 2);
    for (const deviceRatio of [0.8, 2]) {
      await page.evaluate((ratio) => {
        Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: ratio });
        const queries = (window as Window & { heroResolutionQueries?: MediaQueryList[] }).heroResolutionQueries;
        if (!queries?.length) throw new Error("The canvas did not register a display-density observer.");
        queries.at(-1)!.dispatchEvent(new Event("change"));
      }, deviceRatio);
      await expect.poll(async () => (await renderSize(page)).ratio).toBeCloseTo(getHeroRenderDpr("adaptive", 430, 1100, deviceRatio, true), 2);
    }
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect.poll(async () => (await renderSize(page)).width).toBe(1920);
    await expect.poll(async () => (await renderSize(page)).ratio).toBeCloseTo(getHeroRenderDpr("adaptive", 1920, 1080, 2, true), 2);
    expect((await renderSize(page)).pixels).toBeLessThanOrEqual(750_000);
    const before = await renderSize(page);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      Reflect.deleteProperty(document, "visibilityState");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(100);
    expect(await renderSize(page)).toEqual(before);
  } finally {
    await context.close();
  }
});

test("resizing and live motion preferences switch quality without restarting the journey", async ({ browser }) => {
  test.setTimeout(240_000);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, value: 8 });
    Object.defineProperty(navigator, "deviceMemory", { configurable: true, value: 8 });
  });
  const page = await context.newPage();
  try {
    await page.goto("/en?intro=0&phase=proof", { waitUntil: "domcontentloaded" });
    const director = page.locator("[data-interaction-director]");
    const root = page.locator("[data-experience-root]");
    await expect(page.locator("[data-loading-progress]")).toHaveAttribute("data-loading-progress", "100", { timeout: 100_000 });
    await expect(director).toHaveAttribute("data-runtime", "full");
    const proof = heroTimeline.phases.find((phase) => phase.id === "proof")!;
    for (const [width, height, quality] of [[390, 844, "adaptive"], [1440, 900, "full"]] as const) {
      await page.setViewportSize({ width, height });
      await expect(director).toHaveAttribute("data-runtime", quality, { timeout: 20_000 });
      await expect(root).toHaveAttribute("data-story-stage", "proof");
      await expect.poll(async () => Number(await root.getAttribute("data-camera-frame")), { timeout: 20_000 }).toBeCloseTo(proof.viewFrame, 1);
      await expect.poll(async () => (await renderSize(page)).ratio, { timeout: 20_000 }).toBeCloseTo(getHeroRenderDpr(quality, width, height, 2), 2);
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(director).toHaveAttribute("data-runtime", "fallback");
    await expect(page.locator("[data-semantic-fallback]")).toBeVisible();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(director).toHaveAttribute("data-runtime", "full");
    await expect(root).toHaveAttribute("data-story-stage", "proof");
    await expect.poll(async () => Number(await root.getAttribute("data-camera-frame")), { timeout: 20_000 }).toBeCloseTo(proof.viewFrame, 1);
    await expect.poll(async () => (await renderSize(page)).ratio, { timeout: 20_000 }).toBeCloseTo(1.5, 2);
    const discovery = heroTimeline.phases.find((phase) => phase.id === "discovery")!;
    await root.evaluate((element, progress) => {
      window.dispatchEvent(new Event("resize"));
      element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
    }, discovery.preview);
    await expect(root).toHaveAttribute("data-story-stage", "discovery");
    await expect.poll(async () => Number(await root.getAttribute("data-camera-frame")), { timeout: 20_000 }).toBeCloseTo(discovery.viewFrame, 1);
  } finally {
    await context.close();
  }
});
