import { expect, test } from "@playwright/test";
import { getInteractionCopy, getMobileHeroCopy } from "../../components/experience/interactions/interaction-copy";
import { getNarrativeCopyTiming } from "../../components/experience/narrative-copy-timing";
import { waitForStation } from "./hero-interaction-helpers";

test.setTimeout(180_000);
test.use({ video: "off", trace: "off" });

test("narrow short mobile viewport keeps hero prompts clear of sound and touch controls", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 360 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto("/fa?intro=0&phase=activation", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-particle-loader]")).toHaveAttribute("data-complete", "true", { timeout: 80_000 });
  const root = page.locator("[data-experience-root]");
  const photoTiming = getNarrativeCopyTiming("activation");
  await root.evaluate((element, progress) => {
    element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
  }, (photoTiming.enterEnd + photoTiming.exitStart) / 2);
  const prompt = page.locator("[data-scene-copy='activation']");
  const sound = page.locator("[data-hero-sound]");
  await expect(prompt.getByText(getMobileHeroCopy("fa").instructions.photo, { exact: true })).toBeVisible();
  await expect(sound).toBeVisible();
  const [promptBox, soundBox] = await Promise.all([prompt.boundingBox(), sound.boundingBox()]);
  expect(promptBox).not.toBeNull();
  expect(soundBox).not.toBeNull();
  expect(promptBox!.x).toBeGreaterThanOrEqual(soundBox!.x + soundBox!.width);
  const gameTiming = getNarrativeCopyTiming("experiences");
  await root.evaluate((element, progress) => {
    element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
  }, (gameTiming.enterEnd + gameTiming.exitStart) / 2);
  await waitForStation(page, "game");
  const gameInstruction = page.locator("[data-interaction-instruction]");
  const gameDock = page.locator("[data-mobile-game-dock]");
  await expect(gameInstruction).toBeVisible();
  await expect(gameDock).toBeVisible();
  const [gameInstructionBox, gameDockBox] = await Promise.all([gameInstruction.boundingBox(), gameDock.boundingBox()]);
  expect(gameInstructionBox).not.toBeNull();
  expect(gameDockBox).not.toBeNull();
  expect(gameInstructionBox!.x).toBeGreaterThanOrEqual(soundBox!.x + soundBox!.width);
  expect(gameInstructionBox!.y + gameInstructionBox!.height).toBeLessThan(gameDockBox!.y);
  await page.getByRole("button", { name: getInteractionCopy("fa").skip, exact: true }).tap();
  await expect(page.locator("[data-interaction-director]")).not.toHaveAttribute("data-active-station", "game", { timeout: 30_000 });
  const drawTiming = getNarrativeCopyTiming("connection");
  await root.evaluate((element, progress) => {
    element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
  }, (drawTiming.enterEnd + drawTiming.exitStart) / 2);
  await waitForStation(page, "draw");
  const instruction = page.locator("[data-interaction-instruction]");
  const dock = page.locator("[data-mobile-drawing-dock]");
  const skip = page.getByRole("button", { name: getInteractionCopy("fa").skip, exact: true });
  await expect(instruction.getByText(getMobileHeroCopy("fa").instructions.draw, { exact: true })).toBeVisible();
  await expect(dock).toBeVisible();
  await expect(skip).toBeVisible();
  const [instructionBox, dockBox, skipBox, statusBox, headerBox] = await Promise.all([
    instruction.boundingBox(),
    dock.boundingBox(),
    skip.boundingBox(),
    page.locator("[data-phase-rail]").boundingBox(),
    page.locator("header[data-home]").boundingBox(),
  ]);
  for (const bounds of [instructionBox, dockBox, skipBox, statusBox, headerBox]) expect(bounds).not.toBeNull();
  expect(instructionBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
  expect(instructionBox!.x).toBeGreaterThanOrEqual(soundBox!.x + soundBox!.width);
  expect(instructionBox!.y + instructionBox!.height).toBeLessThan(dockBox!.y);
  expect(dockBox!.y + dockBox!.height).toBeLessThan(skipBox!.y);
  expect(skipBox!.y + skipBox!.height).toBeLessThan(statusBox!.y);
  const controls = await dock.locator("button").evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }));
  for (const control of controls) {
    expect(control.width).toBeGreaterThanOrEqual(44);
    expect(control.height).toBeGreaterThanOrEqual(44);
  }
  const shellHeight = await page.locator("[data-mandegar-experience]").evaluate((element) => element.getBoundingClientRect().height);
  const overlayHeight = await page.locator("[data-interaction-director]").evaluate((element) => element.getBoundingClientRect().height);
  expect(overlayHeight).toBe(shellHeight);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await skip.tap();
  await expect(page.locator("[data-interaction-director]")).not.toHaveAttribute("data-active-station", "draw", { timeout: 30_000 });
  await context.close();
});
