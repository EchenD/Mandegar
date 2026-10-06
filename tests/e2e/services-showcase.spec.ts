import { expect, test, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";

const services = [
  { id: "events", title: "Events" },
  { id: "exhibitions", title: "Exhibitions" },
  { id: "web-apps", title: "Websites & applications" },
  { id: "content", title: "Content creation" },
  { id: "advertising", title: "Advertising structures" },
] as const;
const locales = ["fa", "en", "ar"] as const;
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

test.setTimeout(120_000);

const diagnostics = new WeakMap<Page, { pageErrors: string[]; consoleErrors: string[]; assetErrors: string[] }>();
test.beforeEach(async ({ page }) => {
  const messages = { pageErrors: [] as string[], consoleErrors: [] as string[], assetErrors: [] as string[] };
  diagnostics.set(page, messages);
  page.on("pageerror", (error) => messages.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") messages.consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && /\/models\/services\/|\/media\/services\//.test(response.url())) {
      messages.assetErrors.push(`${response.status()} ${response.url()}`);
    }
  });
});
test.afterEach(async ({ page }, testInfo) => {
  const messages = diagnostics.get(page);
  await testInfo.attach("runtime-diagnostics", {
    body: JSON.stringify(messages, null, 2),
    contentType: "application/json",
  });
  expect(messages?.pageErrors ?? []).toEqual([]);
  expect(messages?.assetErrors ?? []).toEqual([]);
});

async function openWork(page: Page, locale: typeof locales[number] = "en") {
  await page.goto(`/${locale}?intro=0`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-loading-progress]")).toHaveAttribute("data-loading-progress", "100", { timeout: 90_000 });
  await expect(page.locator("[data-experience-root]")).not.toHaveAttribute("data-intro-active", "true");
  const journey = page.locator("[data-connected-journey]");
  await expect(journey).toBeAttached({ timeout: 45_000 });
  if (await journey.getAttribute("data-motion") === "reduced") {
    await journey.evaluate((node) => node.dispatchEvent(new CustomEvent("mandegar:journey-seek", {
      detail: { label: "Work" },
    })));
  } else {
    await seekJourney(page, "Work");
  }
  await expect(journey.locator("[data-project-copy='0'] a")).toBeInViewport();
  await expectProjectHeadlineAboveImage(journey);
  await expect(page.locator("[data-services-showcase]")).toBeAttached();
  return journey;
}

async function expectProjectHeadlineAboveImage(journey: Locator) {
  await expect(journey.locator("[data-project-category]")).toHaveCount(0);
  const firstHeading = journey.locator("[data-project-copy='0'] h2");
  const completeTitle = await journey.locator("[data-project-copy='0'] a").getAttribute("aria-label");
  await expect(firstHeading).toBeVisible();
  await expect(firstHeading).toHaveText(completeTitle ?? "");
  const firstImage = await journey.getAttribute("data-motion") === "reduced"
    ? journey.locator("[data-project-copy='0'] img")
    : journey.locator("[data-orbit-card='0'] img");
  await test.info().attach("project-reading-geometry", {
    body: JSON.stringify({
      phase: await journey.getAttribute("data-journey-phase"),
      progress: await journey.getAttribute("data-journey-progress"),
      expectedTitle: completeTitle,
      heading: await firstHeading.boundingBox(),
      image: await firstImage.boundingBox(),
    }, null, 2),
    contentType: "application/json",
  });
  await expect.poll(async () => {
    const heading = await firstHeading.boundingBox();
    const image = await firstImage.boundingBox();
    return heading && image ? heading.y + heading.height - image.y : Infinity;
  }).toBeLessThanOrEqual(2);
}

async function seekJourney(page: Page, label: string) {
  const journey = page.locator("[data-connected-journey]");
  await expect(journey).toHaveAttribute("data-journey-labels", /\S/);
  const target = await journey.evaluate((node, nextLabel) => {
    const labels = JSON.parse(node.getAttribute("data-journey-labels") ?? "{}") as Record<string, number>;
    const progress = labels[nextLabel];
    if (!Number.isFinite(progress)) throw new Error(`Unknown journey label: ${nextLabel}`);
    node.dispatchEvent(new CustomEvent("mandegar:journey-seek", {
      detail: { label: nextLabel },
    }));
    return progress;
  }, label);
  await expect.poll(() => journey.evaluate((node) => {
    const top = node.getBoundingClientRect().top + window.scrollY;
    return (window.scrollY - top) / Math.max(1, node.clientHeight - window.innerHeight);
  })).toBeCloseTo(target, 3);
  await expect.poll(async () => Number(await journey.getAttribute("data-journey-progress")))
    .toBeCloseTo(target, 3);
}

async function expectReadableService(page: Page, index: number, locale = "en") {
  const service = services[index];
  const showcase = page.locator("[data-services-showcase]");
  const copy = showcase.locator(`[data-service-copy='${service.id}']`);
  const heading = copy.getByRole("heading");
  await expect(showcase).toHaveAttribute("data-active-service", service.id);
  await expect(heading).toBeVisible();
  await expect(heading).toBeInViewport();
  const fullTitle = await heading.getAttribute("aria-label");
  expect(fullTitle).toBeTruthy();
  if (locale === "en") expect(fullTitle).toBe(service.title);
  await expect(copy.locator("[data-service-title-text]")).toHaveText(fullTitle ?? "", { timeout: 10_000 });
  await expect(copy).toHaveAttribute("data-title-writing", "false");
  await expect(copy).toHaveAttribute("data-description-writing", "false");
  await expect(copy.locator("p")).toBeVisible();
  await expect(copy.locator("p")).toBeInViewport();
  const fullDescription = await copy.locator("[data-service-description-accessible]").textContent();
  expect(fullDescription).toBeTruthy();
  await expect(copy.locator("[data-service-description-text]")).toHaveText(fullDescription ?? "");
  if (await showcase.getAttribute("data-services-mode") === "spatial") {
    const scene = page.locator("[data-services-scene]");
    await expect(scene).toHaveAttribute("data-services-ready", "true", { timeout: 45_000 });
    await expect.poll(async () => Number(await scene.getAttribute("data-services-render-progress")))
      .toBeCloseTo(0.12 + index * 0.19, 3);
    await expect.poll(async () => Number(await scene.getAttribute("data-services-rotation")))
      .toBeCloseTo(index * Math.PI / 2, 4);
    await expect.poll(async () => Number(await scene.getAttribute("data-services-color-reveal")))
      .toBeCloseTo(1, 4);
  }
  await expect(copy.locator("[data-service-button]")).toBeVisible();
  await expect(copy.locator("[data-service-button]")).toBeInViewport();
  const headingBounds = await heading.boundingBox();
  expect(headingBounds).not.toBeNull();
  expect(Math.abs((headingBounds?.x ?? 0) + (headingBounds?.width ?? 0) / 2 - (page.viewportSize()?.width ?? 0) / 2))
    .toBeLessThanOrEqual(12);
  const visibleTitles = await showcase.locator("[data-service-copy]").evaluateAll((panels) => (
    panels.filter((panel) => {
      const style = getComputedStyle(panel);
      const rect = panel.getBoundingClientRect();
      return panel.getAttribute("aria-hidden") !== "true"
        && style.visibility !== "hidden"
        && Number(style.opacity) > 0.1
        && rect.width > 0
        && rect.height > 0;
    }).map((panel) => panel.getAttribute("data-service-copy"))
  ));
  expect(visibleTitles).toEqual([service.id]);
}

async function waitForNativeScrollToSettle(page: Page) {
  await expect.poll(async () => {
    const start = await page.evaluate(() => window.scrollY);
    await page.waitForTimeout(200);
    return Math.abs(await page.evaluate(() => window.scrollY) - start);
  }, { timeout: 10_000 }).toBeLessThan(1);
}

async function serviceProgressPixel(page: Page, localProgress: number) {
  return page.locator("[data-connected-journey]").evaluate((node, progress) => {
    const labels = JSON.parse(node.getAttribute("data-journey-labels") ?? "{}") as Record<string, number>;
    const normalized = labels.Service1 + (progress - 0.12) / 0.19 * (labels.Service2 - labels.Service1);
    return node.getBoundingClientRect().top + window.scrollY
      + normalized * Math.max(1, node.clientHeight - window.innerHeight);
  }, localProgress);
}

async function wheelToServiceProgress(page: Page, progress: number) {
  const target = await serviceProgressPixel(page, progress);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const before = await page.evaluate(() => window.scrollY);
    if (Math.abs(target - before) <= 2) return;
    await page.mouse.wheel(0, target - before);
    await expect.poll(() => page.evaluate(() => window.scrollY)).not.toBe(before);
    await waitForNativeScrollToSettle(page);
  }
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(target, -1);
}

async function drawnServiceState(page: Page) {
  return page.locator("[data-services-scene]").evaluate((node) => ({
    progress: Number(node.getAttribute("data-services-render-progress")),
    rotation: Number(node.getAttribute("data-services-rotation")),
    frame: Number(node.getAttribute("data-services-frame")),
    breath: Number(node.getAttribute("data-services-breath-scale")),
    pointerX: Number(node.getAttribute("data-services-camera-pointer-x")),
    pointerY: Number(node.getAttribute("data-services-camera-pointer-y")),
    colorReveal: Number(node.getAttribute("data-services-color-reveal")),
  }));
}

async function expectBakedServiceScene(page: Page) {
  const scene = page.locator("[data-services-scene]");
  await expect(scene).toHaveAttribute("data-services-ready", "true", { timeout: 45_000 });
  await expect(scene).toHaveAttribute("data-services-material-unlit", "true");
  await expect(scene).toHaveAttribute("data-services-textures", "11");
  await expect(scene).toHaveAttribute("data-services-ground-shadows", "5");
  await expect(scene).toHaveAttribute("data-services-color-reveal", /\d/);
}

async function wheelThroughFirstTurn(page: Page, direction: "forward" | "backward") {
  const progressSteps = direction === "forward"
    ? [0.17, 0.185, 0.2, 0.215, 0.23, 0.245, 0.26]
    : [0.26, 0.245, 0.23, 0.215, 0.2, 0.185, 0.17];
  const states = [];
  for (const progress of progressSteps) {
    await wheelToServiceProgress(page, progress);
    await expect.poll(async () => (await drawnServiceState(page)).progress).toBeCloseTo(progress, 2);
    states.push(await drawnServiceState(page));
    if (direction === "backward" && progress === 0.2) {
      const eventCopy = page.locator("[data-service-copy='events']");
      await expect(eventCopy).toHaveAttribute("data-title-writing", "true");
      const visibleTitle = await eventCopy.locator("[data-service-title-text]").textContent();
      expect(visibleTitle?.length ?? 0).toBeGreaterThan(0);
      expect(visibleTitle?.length ?? 0).toBeLessThan(services[0].title.length);
      expect(services[0].title.startsWith(visibleTitle ?? "")).toBe(true);
    }
  }
  expect(states.some((state) => state.rotation > 0.2 && state.rotation < Math.PI / 2 - 0.2), JSON.stringify(states)).toBe(true);
  for (let index = 1; index < states.length; index += 1) {
    expect(states[index].frame).toBeGreaterThan(states[index - 1].frame);
    const difference = states[index].rotation - states[index - 1].rotation;
    if (direction === "forward") expect(difference).toBeGreaterThanOrEqual(-0.03);
    else expect(difference).toBeLessThanOrEqual(0.03);
  }
  expect(Math.abs(states[states.length - 1].rotation - states[0].rotation)).toBeGreaterThan(1.2);
  return states;
}

async function continuouslyWheelThroughFirstTurn(page: Page) {
  await wheelToServiceProgress(page, 0.17);
  const target = await serviceProgressPixel(page, 0.26);
  const before = await page.evaluate(() => window.scrollY);
  const sampling = page.evaluate(() => new Promise<Array<{
    progress: number;
    rotation: number;
    frame: number;
    elapsed: number;
  }>>((resolve) => {
    const samples: Array<{ progress: number; rotation: number; frame: number; elapsed: number }> = [];
    const started = performance.now();
    const sample = () => {
      const scene = document.querySelector("[data-services-scene]");
      const state = {
        progress: Number(scene?.getAttribute("data-services-render-progress")),
        rotation: Number(scene?.getAttribute("data-services-rotation")),
        frame: Number(scene?.getAttribute("data-services-frame")),
        elapsed: performance.now() - started,
      };
      if (state.frame !== samples[samples.length - 1]?.frame) samples.push(state);
      if (state.progress >= 0.259 || state.elapsed > 12_000) resolve(samples);
      else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));
  await page.mouse.wheel(0, target - before);
  await waitForNativeScrollToSettle(page);
  const frames = await sampling;
  const intermediateAngles = frames
    .filter((state) => state.rotation > 0.1 && state.rotation < Math.PI / 2 - 0.1)
    .map((state) => state.rotation.toFixed(2));
  expect(new Set(intermediateAngles).size, JSON.stringify(frames)).toBeGreaterThanOrEqual(3);
  let longestGap = 0;
  for (let index = 1; index < frames.length; index += 1) {
    longestGap = Math.max(longestGap, frames[index].elapsed - frames[index - 1].elapsed);
    expect(frames[index].rotation).toBeGreaterThanOrEqual(frames[index - 1].rotation - 0.03);
  }
  expect(longestGap, JSON.stringify(frames)).toBeLessThan(1_500);
  await expect.poll(async () => (await drawnServiceState(page)).progress).toBeCloseTo(0.26, 2);
  return { frames, longestGap };
}

async function expectContentFits(page: Page) {
  const bounds = await page.locator("[data-services-showcase]").evaluate((root) => {
    const candidates = Array.from(root.querySelectorAll<HTMLElement>("h2, h3, p, button"));
    const outside = candidates.flatMap((element) => {
      if (element.closest("[aria-hidden='true'], [inert]")) return [];
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || Number(style.opacity) < 0.1 || !rect.width || !rect.height) return [];
      return rect.left < -2 || rect.right > innerWidth + 2
        ? [{ text: element.textContent, left: rect.left, right: rect.right }]
        : [];
    });
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      outside,
    };
  });
  expect(bounds.overflow, JSON.stringify(bounds)).toBeLessThanOrEqual(2);
  expect(bounds.outside, JSON.stringify(bounds)).toEqual([]);
}

async function expectCompleteStaticServices(page: Page) {
  const showcase = page.locator("[data-services-showcase]");
  await expect(showcase).toHaveAttribute("data-services-mode", "reduced");
  for (const service of services) {
    const copy = showcase.locator(`[data-service-copy='${service.id}']`);
    await copy.scrollIntoViewIfNeeded();
    await expect(copy.getByRole("heading")).toBeVisible();
    await expect(copy.getByRole("heading")).toBeInViewport();
    await expect(copy.getByRole("heading")).not.toHaveText("");
    await expect(copy.locator("p")).toBeVisible();
    await expect(copy.locator("p")).toBeInViewport();
    await expect(copy.locator("p")).not.toHaveText("");
    const poster = copy.locator("[data-service-poster]");
    await expect(poster).toBeVisible();
    await expect.poll(() => poster.evaluate((image) => (
      image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0
    ))).toBe(true);
    await expectContentFits(page);
  }
}

test("all five services advance and backtrack with readable selected copy", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.setViewportSize(viewports[0]);
  const journey = await openWork(page);
  await expect(page.locator("[data-services-showcase]")).toHaveAttribute("data-services-mode", "spatial");
  const capturedServices = new Set<number>();
  for (const index of [0, 1, 2, 3, 4, 3, 2, 1, 0]) {
    await seekJourney(page, `Service${index + 1}`);
    await expect(journey).toHaveAttribute("data-journey-phase", "services");
    await expectReadableService(page, index);
    if (index === 0) {
      await expectBakedServiceScene(page);
    }
    if (!capturedServices.has(index)) {
      await page.screenshot({ path: testInfo.outputPath(`services-${services[index].id}-desktop.png`) });
      capturedServices.add(index);
    }
  }
  await page.screenshot({ path: testInfo.outputPath("services-events-desktop.png") });
  await seekJourney(page, "Service5");
  await page.screenshot({ path: testInfo.outputPath("services-advertising-desktop.png") });
});

for (const viewport of viewports) {
  for (const locale of locales) {
    test(`${locale} services fit ${viewport.name} with localized reading direction`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await openWork(page, locale);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "en" ? "ltr" : "rtl");
      const showcase = page.locator("[data-services-showcase]");
      await expect.poll(() => showcase.evaluate((root) => getComputedStyle(root).direction))
        .toBe(locale === "en" ? "ltr" : "rtl");
      for (let index = 0; index < services.length; index += 1) {
        await seekJourney(page, `Service${index + 1}`);
        await expectReadableService(page, index, locale);
        await expectContentFits(page);
        if (locale === "en" && viewport.name === "mobile") {
          await page.screenshot({ path: testInfo.outputPath(`services-${services[index].id}-mobile.png`) });
        }
      }
      await page.screenshot({ path: testInfo.outputPath(`${locale}-${viewport.name}-services.png`) });
    });
  }

  test(`${viewport.name} projects and About handoffs retain visible composition in both directions`, async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    await page.setViewportSize(viewport);
    const journey = await openWork(page);
    const labels = [
      "LastProjectRead",
      "ProjectsServicesStart",
      "ProjectsServicesMid",
      "ProjectsServicesEnd",
      "Service1",
      "Service5",
      "ServicesAboutStart",
      "ServicesAboutMid",
      "ServicesAboutEnd",
      "AboutRead",
      "ServicesAboutMid",
      "Service5",
      "ProjectsServicesMid",
      "LastProjectRead",
    ];
    for (const label of labels) {
      await seekJourney(page, label);
      await expect.poll(() => journey.locator("[data-journey-surface]").evaluate((surface) => (
        Math.round(surface.getBoundingClientRect().top)
      ))).toBe(0);
      const midpointPath = label.endsWith("Mid")
        ? testInfo.outputPath(`${viewport.name}-${label}.png`)
        : undefined;
      const screenshot = await page.screenshot({
        path: midpointPath,
        clip: {
          x: Math.round(viewport.width * 0.08),
          y: Math.round(viewport.height * 0.2),
          width: Math.round(viewport.width * 0.84),
          height: Math.round(viewport.height * 0.64),
        },
      });
      const stats = await sharp(screenshot).removeAlpha().stats();
      const variation = stats.channels.reduce((total, channel) => total + channel.stdev, 0) / stats.channels.length;
      const contrast = Math.max(...stats.channels.map((channel) => channel.max - channel.min));
      // A small, high-contrast seed is a valid bridge between the larger scenes.
      expect(variation, `${label} must retain central visual content`).toBeGreaterThan(0.5);
      expect(contrast, `${label} must contain a visible subject`).toBeGreaterThan(30);
      if (midpointPath) {
        await testInfo.attach(`${viewport.name}-${label}.png`, { path: midpointPath, contentType: "image/png" });
      }
    }
    await seekJourney(page, "Service1");
    await expectBakedServiceScene(page);
    const boundaries = [
      { name: "entry-black", progress: 0.03, reveal: "black" },
      { name: "entry-color", progress: 0.07, reveal: "partial" },
      { name: "entry-full", progress: 0.12, reveal: "full" },
      { name: "entry-reverse-color", progress: 0.07, reveal: "partial" },
      { name: "entry-reverse-black", progress: 0.03, reveal: "black" },
      { name: "entry-forward-full", progress: 0.12, reveal: "full" },
      { name: "exit-full", progress: 0.88, reveal: "full" },
      { name: "exit-color", progress: 0.93, reveal: "partial" },
      { name: "exit-black", progress: 0.97, reveal: "black" },
      { name: "exit-seed", progress: 0.995, reveal: "black" },
      { name: "exit-reverse-black", progress: 0.97, reveal: "black" },
      { name: "exit-reverse-color", progress: 0.93, reveal: "partial" },
      { name: "exit-reverse-full", progress: 0.88, reveal: "full" },
    ];
    const drawnBoundaries = [];
    const previousColors = new Map<number, number>();
    for (const boundary of boundaries) {
      await wheelToServiceProgress(page, boundary.progress);
      await expect.poll(async () => (await drawnServiceState(page)).progress).toBeCloseTo(boundary.progress, 3);
      const drawn = await drawnServiceState(page);
      if (boundary.reveal === "black") expect(drawn.colorReveal, boundary.name).toBeCloseTo(0, 4);
      else if (boundary.reveal === "full") expect(drawn.colorReveal, boundary.name).toBeCloseTo(1, 4);
      else {
        expect(drawn.colorReveal, boundary.name).toBeGreaterThan(0.2);
        expect(drawn.colorReveal, boundary.name).toBeLessThan(0.9);
      }
      const previous = previousColors.get(boundary.progress);
      if (previous !== undefined) {
        expect(Math.abs(drawn.colorReveal - previous), `${boundary.name} must restore its previous color`).toBeLessThan(0.025);
      } else previousColors.set(boundary.progress, drawn.colorReveal);
      drawnBoundaries.push({ name: boundary.name, ...drawn });
      if (["entry-black", "entry-color", "exit-color", "exit-black"].includes(boundary.name)) {
        await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-${boundary.name}.png`) });
      }
    }
    await testInfo.attach(`${viewport.name}-boundary-drawn-colors`, {
      body: JSON.stringify(drawnBoundaries, null, 2),
      contentType: "application/json",
    });
  });
}

test("English and Persian keep a centered desktop hint and readable short landscape captions", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const viewport = { width: 844, height: 390 };
  for (const locale of ["en", "fa"] as const) {
    await page.setViewportSize(viewports[0]);
    const journey = await openWork(page, locale);
    if (locale === "en") {
      await page.screenshot({ path: testInfo.outputPath("en-desktop-project-title.png") });
    }
    await seekJourney(page, "Service1");
    await expectReadableService(page, 0, locale);
    const hint = page.locator("[data-services-scroll-hint]");
    await expect(hint).toBeVisible();
    const desktopHintBounds = await hint.boundingBox();
    expect(desktopHintBounds).not.toBeNull();
    expect(Math.abs((desktopHintBounds?.x ?? 0) + (desktopHintBounds?.width ?? 0) / 2 - viewports[0].width / 2))
      .toBeLessThanOrEqual(12);
    if (locale === "en") {
      await page.screenshot({ path: testInfo.outputPath("en-desktop-services-final.png") });
    }
    await page.setViewportSize(viewport);
    await seekJourney(page, "Work");
    await expectProjectHeadlineAboveImage(journey);
    await page.screenshot({ path: testInfo.outputPath(`${locale}-landscape-project-title.png`) });
    for (let index = 0; index < services.length; index += 1) {
      await seekJourney(page, `Service${index + 1}`);
      await expectReadableService(page, index, locale);
      await expectContentFits(page);
      const description = page.locator(`[data-service-copy='${services[index].id}'] p`);
      await expect(hint).toBeHidden();
      const descriptionBounds = await description.boundingBox();
      expect(descriptionBounds).not.toBeNull();
      expect((descriptionBounds?.y ?? 0) + (descriptionBounds?.height ?? 0))
        .toBeLessThanOrEqual(viewport.height - 24);
    }
    await page.screenshot({ path: testInfo.outputPath(`${locale}-landscape-services.png`) });
  }
  await page.setViewportSize(viewports[1]);
  await expect(page.locator("[data-services-showcase]")).toHaveAttribute("data-mobile", "true");
  await seekJourney(page, "Service5");
  await expectReadableService(page, 4, "fa");
  await expectContentFits(page);
  await expect(page.locator("[data-services-scene]")).toHaveAttribute("data-services-ready", "true");
  await expect.poll(async () => (await drawnServiceState(page)).progress).toBeCloseTo(0.88, 2);
  await page.screenshot({ path: testInfo.outputPath("fa-mobile-services-final.png") });
});

test("keyboard and native scrolling traverse services without locking or snapping", async ({ page }) => {
  await page.setViewportSize(viewports[0]);
  await openWork(page);
  await seekJourney(page, "Service1");
  await expectReadableService(page, 0);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  const beforeKey = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("PageDown");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(beforeKey + 200);
  await waitForNativeScrollToSettle(page);
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 240);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 120);
  await waitForNativeScrollToSettle(page);
  const held = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(900);
  expect(Math.abs(await page.evaluate(() => window.scrollY) - held)).toBeLessThan(4);
  await expect(page.locator("html")).not.toHaveAttribute("data-experience-scroll-lock", "");
});

test("the first native wheel traversal renders intermediate turns on a cold page", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.setViewportSize(viewports[0]);
  let modelRequested = false;
  let requestSnapshot: Promise<{ scrollY: number; heroProgress: number; journeyProgress: number; at: number }> | undefined;
  page.on("request", (request) => {
    if (!new URL(request.url()).pathname.endsWith("/models/services/mandegar-services.glb")) return;
    modelRequested = true;
    requestSnapshot ??= page.evaluate(() => ({
      scrollY: window.scrollY,
      heroProgress: Number(document.querySelector("[data-experience-root]")?.getAttribute("data-native-progress") ?? 0),
      journeyProgress: Number(document.querySelector("[data-connected-journey]")?.getAttribute("data-journey-progress") ?? 0),
      at: performance.now(),
    }));
  });
  await page.goto("/en?intro=0", { waitUntil: "domcontentloaded" });
  await expect.poll(() => modelRequested, { timeout: 30_000 }).toBe(true);
  const requestedAtOpening = await requestSnapshot;
  expect(requestedAtOpening).toBeDefined();
  expect(Math.abs(requestedAtOpening?.scrollY ?? Infinity)).toBeLessThanOrEqual(2);
  expect(requestedAtOpening?.heroProgress).toBeLessThanOrEqual(0.001);
  expect(requestedAtOpening?.journeyProgress).toBeLessThanOrEqual(0.001);
  const scene = page.locator("[data-services-scene]");
  await expect(scene).toBeAttached({ timeout: 20_000 });
  expect(await page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(2);
  const journey = page.locator("[data-connected-journey]");
  const firstEntryAudit = journey.evaluate((node) => new Promise<{
    entryAt: number;
    warmStartedAt: number;
    warmedAt: number;
    readyAt: number;
    ready: boolean;
    frame: number;
    textures: number;
    groundShadows: number;
    unlit: string | null;
    poster: string | null;
    preparation: string | null;
  }>((resolve) => {
    const audit = () => {
      if (node.getAttribute("data-journey-phase") !== "services") return;
      const renderer = document.querySelector("[data-services-scene]");
      const poster = document.querySelector("[data-services-showcase] [data-visible]");
      observer.disconnect();
      resolve({
        entryAt: performance.now(),
        warmStartedAt: Number(renderer?.getAttribute("data-services-warm-started-at")),
        warmedAt: Number(renderer?.getAttribute("data-services-warmed-at")),
        readyAt: Number(renderer?.getAttribute("data-services-ready-at")),
        ready: renderer?.getAttribute("data-services-ready") === "true",
        frame: Number(renderer?.getAttribute("data-services-frame")),
        textures: Number(renderer?.getAttribute("data-services-textures")),
        groundShadows: Number(renderer?.getAttribute("data-services-ground-shadows")),
        unlit: renderer?.getAttribute("data-services-material-unlit") ?? null,
        poster: poster?.getAttribute("data-visible") ?? null,
        preparation: renderer?.getAttribute("data-services-preparation") ?? null,
      });
    };
    const observer = new MutationObserver(audit);
    observer.observe(node, { attributes: true, attributeFilter: ["data-journey-phase", "data-service-progress"] });
    audit();
  })).catch(() => null);
  await seekJourney(page, "Work");
  await expect(journey.locator("[data-project-copy='0'] a")).toBeInViewport();
  await expectProjectHeadlineAboveImage(journey);
  await expect(journey).toHaveAttribute("data-journey-phase", "projects");
  const firstServicePixel = await serviceProgressPixel(page, 0.12);
  let distance = firstServicePixel - await page.evaluate(() => window.scrollY);
  while (distance > 2) {
    const wheelStep = Math.min(distance, viewports[0].height);
    await page.mouse.wheel(0, wheelStep);
    distance -= wheelStep;
    await page.waitForTimeout(100);
  }
  await waitForNativeScrollToSettle(page);
  await wheelToServiceProgress(page, 0.12);
  const entry = await firstEntryAudit;
  if (!entry) throw new Error("The first Services entry audit was interrupted before recording a frame.");
  await testInfo.attach("cold-start-readiness-timing", {
    body: JSON.stringify({ requestedAtOpening, firstServicesEntry: entry }, null, 2),
    contentType: "application/json",
  });
  expect(entry.ready, JSON.stringify(entry)).toBe(true);
  expect(entry.preparation, JSON.stringify(entry)).toBe("ready");
  expect(entry.frame, JSON.stringify(entry)).toBeGreaterThan(0);
  expect(entry.unlit, JSON.stringify(entry)).toBe("true");
  expect(entry.textures, JSON.stringify(entry)).toBe(11);
  expect(entry.groundShadows, JSON.stringify(entry)).toBe(5);
  expect(entry.readyAt, JSON.stringify(entry)).toBeGreaterThan(0);
  expect(entry.readyAt, JSON.stringify(entry)).toBeLessThan(entry.entryAt);
  expect(entry.poster, JSON.stringify(entry)).toBe("false");
  await expect(scene).toHaveAttribute("data-services-ready", "true");
  await expect(page.locator("[data-services-showcase] [data-visible]")).toHaveAttribute("data-visible", "false");
  await expectReadableService(page, 0);
  await page.screenshot({ path: testInfo.outputPath("cold-native-first-service.png") });
  const forward = await continuouslyWheelThroughFirstTurn(page);
  await wheelToServiceProgress(page, 0.31);
  await expectReadableService(page, 1);
  await page.screenshot({ path: testInfo.outputPath("cold-native-second-service.png") });
  const backward = await wheelThroughFirstTurn(page, "backward");
  await wheelToServiceProgress(page, 0.12);
  await expectReadableService(page, 0);
  await testInfo.attach("first-turn-drawn-frames", {
    body: JSON.stringify({ forward, backward }, null, 2),
    contentType: "application/json",
  });
});

test("a late model load draws the current first-turn pose before native scrolling continues", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.setViewportSize(viewports[0]);
  let releaseModel: (() => void) | undefined;
  const modelGate = new Promise<void>((resolve) => { releaseModel = resolve; });
  let modelRequested = false;
  await page.route("**/models/services/mandegar-services.glb*", async (route) => {
    modelRequested = true;
    await modelGate;
    await route.continue();
  });
  try {
    await openWork(page);
    await expect.poll(() => modelRequested).toBe(true);
    await wheelToServiceProgress(page, 0.2);
    const scene = page.locator("[data-services-scene]");
    await expect(scene).toHaveAttribute("data-services-ready", "false");
    await expect(page.locator("[data-service-poster][data-active='true']")).toBeVisible();
    releaseModel?.();
    await expect(scene).toHaveAttribute("data-services-ready", "true", { timeout: 45_000 });
    await expect.poll(async () => (await drawnServiceState(page)).progress).toBeCloseTo(0.2, 2);
    const firstDraw = await drawnServiceState(page);
    expect(firstDraw.rotation).toBeGreaterThan(0.2);
    expect(firstDraw.rotation).toBeLessThan(Math.PI / 2 - 0.2);
    await page.screenshot({ path: testInfo.outputPath("late-load-first-turn.png") });
    const states = [firstDraw];
    let partialTitleLength = 0;
    for (const progress of [0.215, 0.23, 0.245, 0.26]) {
      await wheelToServiceProgress(page, progress);
      await expect.poll(async () => (await drawnServiceState(page)).progress).toBeCloseTo(progress, 2);
      states.push(await drawnServiceState(page));
      if (progress === 0.245 || progress === 0.26) {
        const exhibitionCopy = page.locator("[data-service-copy='exhibitions']");
        await expect(exhibitionCopy).toHaveAttribute("data-title-writing", "true");
        const visibleTitle = await exhibitionCopy.locator("[data-service-title-text]").textContent();
        expect(visibleTitle?.length ?? 0).toBeGreaterThan(partialTitleLength);
        expect(visibleTitle?.length ?? 0).toBeLessThan(services[1].title.length);
        expect(services[1].title.startsWith(visibleTitle ?? "")).toBe(true);
        partialTitleLength = visibleTitle?.length ?? 0;
        if (progress === 0.245) {
          await page.screenshot({ path: testInfo.outputPath("services-typing-intermediate.png") });
        }
      }
    }
    for (let index = 1; index < states.length; index += 1) {
      expect(states[index].frame).toBeGreaterThan(states[index - 1].frame);
      expect(states[index].rotation).toBeGreaterThanOrEqual(states[index - 1].rotation - 0.03);
    }
    await wheelToServiceProgress(page, 0.31);
    await expectReadableService(page, 1);
    await testInfo.attach("late-load-drawn-frames", {
      body: JSON.stringify(states, null, 2),
      contentType: "application/json",
    });
  } finally {
    releaseModel?.();
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }
});

test("a held service breathes gently, responds to the pointer and pauses after About", async ({ page }, testInfo) => {
  await page.setViewportSize(viewports[0]);
  await openWork(page);
  await seekJourney(page, "Service3");
  await expectReadableService(page, 2);
  const scene = page.locator("[data-services-scene]");
  await expect(scene).toHaveAttribute("data-services-ready", "true", { timeout: 45_000 });
  await expect(scene).toHaveAttribute("data-services-active", "true");
  await page.mouse.move(viewports[0].width / 2, viewports[0].height / 2);
  await page.waitForTimeout(500);
  const initial = await drawnServiceState(page);
  const first = await page.screenshot({
    path: testInfo.outputPath("services-idle-first.png"),
    clip: { x: 300, y: 110, width: 840, height: 510 },
  });
  await expect.poll(async () => (await drawnServiceState(page)).frame).toBeGreaterThan(initial.frame + 5);
  await expect.poll(async () => Math.abs((await drawnServiceState(page)).breath - initial.breath))
    .toBeGreaterThan(0.0005);
  const breathing = await drawnServiceState(page);
  expect(breathing.breath).toBeGreaterThanOrEqual(0.99);
  expect(breathing.breath).toBeLessThanOrEqual(1.01);
  expect(breathing.rotation).toBeCloseTo(initial.rotation, 4);
  const second = await page.screenshot({
    path: testInfo.outputPath("services-idle-second.png"),
    clip: { x: 300, y: 110, width: 840, height: 510 },
  });
  const beforePixels = await sharp(first).removeAlpha().raw().toBuffer();
  const afterPixels = await sharp(second).removeAlpha().raw().toBuffer();
  let changedPixels = 0;
  for (let index = 0; index < beforePixels.length; index += 3) {
    if (Math.max(
      Math.abs(beforePixels[index] - afterPixels[index]),
      Math.abs(beforePixels[index + 1] - afterPixels[index + 1]),
      Math.abs(beforePixels[index + 2] - afterPixels[index + 2]),
    ) > 8) changedPixels += 1;
  }
  expect(changedPixels).toBeGreaterThan(30);
  await page.mouse.move(viewports[0].width - 30, 30);
  await expect.poll(async () => Math.abs((await drawnServiceState(page)).pointerX)).toBeGreaterThan(0.1);
  const pointer = await drawnServiceState(page);
  expect(Math.abs(pointer.pointerX)).toBeLessThanOrEqual(1);
  expect(Math.abs(pointer.pointerY)).toBeLessThanOrEqual(1);
  expect(pointer.rotation).toBeCloseTo(initial.rotation, 4);
  await seekJourney(page, "AboutRead");
  await expect(scene).toHaveAttribute("data-services-active", "false");
  await waitForNativeScrollToSettle(page);
  await page.waitForTimeout(300);
  const paused = await drawnServiceState(page);
  await page.waitForTimeout(650);
  expect((await drawnServiceState(page)).frame).toBe(paused.frame);
  await testInfo.attach("idle-and-pointer-drawn-frames", {
    body: JSON.stringify({ initial, breathing, pointer, paused, changedPixels }, null, 2),
    contentType: "application/json",
  });
});

for (const locale of locales) {
  test(`${locale} reduced motion exposes every service in ordinary page flow`, async ({ page }) => {
    await page.setViewportSize(viewports[1]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openWork(page, locale);
    await expectCompleteStaticServices(page);
    const positions = await page.locator("[data-service-copy]").evaluateAll((copies) => (
      copies.map((copy) => getComputedStyle(copy).position)
    ));
    expect(positions.every((position) => position !== "absolute" && position !== "fixed")).toBe(true);
  });
}

test("changing motion preference preserves every service and restores a ready 3D scene", async ({ page }) => {
  await page.setViewportSize(viewports[0]);
  const journey = await openWork(page);
  await seekJourney(page, "Service3");
  await expectReadableService(page, 2);
  await expect(page.locator("[data-services-scene]"))
    .toHaveAttribute("data-services-ready", "true", { timeout: 20_000 });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(journey).toHaveAttribute("data-motion", "reduced");
  await expect(page.locator("[data-services-scene]")).toHaveCount(0);
  await expectCompleteStaticServices(page);
  const about = journey.locator("[data-about]");
  await about.scrollIntoViewIfNeeded();
  const heading = about.getByRole("heading");
  await expect(heading).toBeVisible();
  await expect(heading).toBeInViewport();
  await expect(heading).toContainText("We are best at");
  await expect(heading).toContainText("design.");
  await expect(about.getByRole("link", { name: "Inside Mandegar" })).toBeVisible();

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(journey).toHaveAttribute("data-motion", "full");
  await seekJourney(page, "Service3");
  await expectReadableService(page, 2);
  await expect(page.locator("[data-services-scene]"))
    .toHaveAttribute("data-services-ready", "true", { timeout: 20_000 });
  await expectContentFits(page);
});

test("unavailable WebGL keeps all five services and their images readable", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: function (this: HTMLCanvasElement, contextId: string, options?: unknown) {
        if (/^webgl|experimental-webgl/.test(contextId)) return null;
        return Reflect.apply(original, this, [contextId, options]);
      },
    });
  });
  await page.setViewportSize(viewports[1]);
  await openWork(page);
  await expect(page.locator("[data-services-showcase]")).toHaveAttribute("data-services-mode", "poster");
  await expect(page.locator("[data-services-scene] canvas")).toHaveCount(0);
  for (let index = 0; index < services.length; index += 1) {
    await seekJourney(page, `Service${index + 1}`);
    await expectReadableService(page, index);
    const poster = page.locator("[data-services-showcase] [data-service-poster][data-active='true']");
    await expect(poster).toHaveCount(1);
    await expect(poster).toBeVisible();
    await expect.poll(() => poster.evaluate((image) => (
      image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0
    ))).toBe(true);
    await expectContentFits(page);
  }
});
