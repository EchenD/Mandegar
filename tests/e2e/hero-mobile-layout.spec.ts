import { expect, test, type Locator, type Page } from "@playwright/test";
import type { Locale } from "../../lib/i18n";
import { getHeroPhase } from "../../components/experience/hero-timeline-config";
import { getNarrativeCopyTiming } from "../../components/experience/narrative-copy-timing";
import { getInteractionCopy, getMobileHeroCopy } from "../../components/experience/interactions/interaction-copy";
import { waitForStation } from "./hero-interaction-helpers";

test.setTimeout(180_000);
test.use({ video: "off", trace: "off" });

async function seekPhase(page: Page, phase: Parameters<typeof getHeroPhase>[0]) {
  const timing = getNarrativeCopyTiming(phase);
  const progress = (timing.enterEnd + timing.exitStart) / 2;
  await page.locator("[data-experience-root]").evaluate((root, target) => {
    root.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress: target, sync: true } }));
  }, progress);
  await expect(page.locator("[data-experience-root]")).toHaveAttribute("data-story-stage", phase);
}

async function box(locator: Locator) {
  await expect(locator).toBeVisible();
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  return bounds!;
}

async function expectSeparate(first: Locator, second: Locator) {
  const [a, b] = await Promise.all([box(first), box(second)]);
  expect(a.y + a.height <= b.y || b.y + b.height <= a.y || a.x + a.width <= b.x || b.x + b.width <= a.x).toBe(true);
}

async function expectInsideViewport(locator: Locator) {
  const bounds = await box(locator);
  const viewport = locator.page().viewportSize()!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
}

for (const { locale, width, height } of [
  { locale: "fa", width: 320, height: 568 },
  { locale: "en", width: 390, height: 844 },
  { locale: "ar", width: 360, height: 640 },
] as const satisfies Array<{ locale: Locale; width: number; height: number }>) {
  test(`${locale} mobile hero separates upper copy, interaction controls and phase status`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/${locale}?intro=0&phase=activation`, { waitUntil: "domcontentloaded" });
    const root = page.locator("[data-experience-root]");
    const director = page.locator("[data-interaction-director]");
    await expect(director).toHaveAttribute("data-runtime", /^(adaptive|full)$/, { timeout: 80_000 });
    const phaseRail = page.locator("[data-phase-rail]");
    const sound = page.locator("[data-hero-sound]");
    const soundNames = {
      fa: ["فعال‌کردن صدا", "قطع صدا"],
      en: ["Enable sound", "Mute sound"],
      ar: ["تفعيل الصوت", "كتم الصوت"],
    } as const;
    await expect(page.getByRole("button", { name: soundNames[locale][0], exact: true })).toBeVisible();
    await sound.tap();
    await expect(page.getByRole("button", { name: soundNames[locale][1], exact: true })).toHaveAttribute("aria-pressed", "true");
    await sound.tap();
    await expect(sound).toHaveAttribute("aria-pressed", "false");
    expect((await box(sound)).height).toBeGreaterThanOrEqual(44);
    expect((await box(sound)).width).toBeGreaterThanOrEqual(44);
    await expect(page.locator("[data-work-shortcut]")).toBeHidden();

    const mobileCopy = getMobileHeroCopy(locale);
    for (const [phase, station] of [["activation", "photo"], ["reveal", "stage"]] as const) {
      await seekPhase(page, phase);
      const cue = page.locator(`[data-scene-copy='${phase}']`);
      await expect(cue.getByText(mobileCopy.instructions[station], { exact: true })).toBeVisible();
      await expectInsideViewport(cue);
      await expectSeparate(cue, sound);
      await expectSeparate(cue, phaseRail);
      expect((await box(cue)).y).toBeGreaterThanOrEqual((await box(page.locator("header[data-home]"))).y + (await box(page.locator("header[data-home]"))).height);
    }

    const copy = getInteractionCopy(locale);
    for (const [phase, station, dock] of [
      ["experiences", "game", "[data-mobile-game-dock]"],
      ["connection", "draw", "[data-mobile-drawing-dock]"],
    ] as const) {
      await seekPhase(page, phase);
      await waitForStation(page, station);
      if (station === "game") {
        // Keep the running race from completing while its control layout is measured.
        const game = page.locator("[data-game-spatial-controls]");
        await expect(game).toHaveAttribute("data-game-status", "running");
        const pause = page.locator("[data-mobile-game-action]");
        await expect(pause).toHaveText(copy.game.pause);
        await pause.tap();
        await expect(game).toHaveAttribute("data-game-status", "paused");
        await expect(pause).toHaveText(copy.game.resume);
      }
      const instruction = page.locator("[data-interaction-instruction]");
      const controls = page.locator(dock);
      const skip = page.getByRole("button", { name: copy.skip, exact: true });
      await expect(instruction.getByText(mobileCopy.instructions[station], { exact: true })).toBeVisible();
      await expect(page.locator("[data-copy-layer]")).toHaveAttribute("aria-hidden", "true");
      await expect(page.locator("[data-copy-layer]")).toHaveCSS("opacity", "0");
      await expectSeparate(instruction, controls);
      await expectSeparate(controls, skip);
      await expectSeparate(skip, phaseRail);
      await expectInsideViewport(instruction);
      await expectInsideViewport(controls);
      expect((await box(skip)).height).toBeGreaterThanOrEqual(44);
      expect(await page.locator("#interaction-scroll-hint").evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(1);
      if (station === "game") await skip.tap();
      else { await skip.focus(); await page.keyboard.press("Enter"); }
      await expect(director).not.toHaveAttribute("data-active-station", station, { timeout: 30_000 });
    }

    await seekPhase(page, "intelligence");
    const inspector = page.locator("[data-intelligence-inspector]");
    await expect(inspector).toHaveAttribute("data-available", "true", { timeout: 30_000 });
    const heading = page.locator("[data-scene-copy='intelligence']");
    const people = page.locator("[data-intelligence-explore]");
    const stations = page.locator("[data-intelligence-station-explore]");
    await expect(heading.getByText(mobileCopy.intelligence, { exact: true })).toBeVisible();
    await expectSeparate(heading, people);
    await expectSeparate(people, stations);
    await expectSeparate(stations, phaseRail);
    await expectInsideViewport(people);
    await expectInsideViewport(stations);
    await expect(stations).toBeEnabled();
    await stations.focus();
    await page.keyboard.press("Enter");
    await expect(inspector).toHaveAttribute("data-pinned", "true");
    await expect(heading).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(stations).toBeFocused();
    await expect(heading).toBeVisible();
    expect(await root.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect(errors).toEqual([]);
    await context.close();
  });
}

test("short mobile landscape keeps drawing controls clear of instructions and Skip", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 568, height: 320 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto("/fa?intro=0&phase=connection", { waitUntil: "domcontentloaded" });
  await waitForStation(page, "draw");
  const instruction = page.locator("[data-interaction-instruction]");
  const dock = page.locator("[data-mobile-drawing-dock]");
  const skip = page.getByRole("button", { name: getInteractionCopy("fa").skip, exact: true });
  await expectInsideViewport(instruction);
  await expectInsideViewport(dock);
  await expectSeparate(instruction, dock);
  await expectSeparate(dock, skip);
  await expectSeparate(skip, page.locator("[data-phase-rail]"));
  await context.close();
});
