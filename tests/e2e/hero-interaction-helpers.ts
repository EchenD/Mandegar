import { expect, type Page } from "@playwright/test";
import { raceBoard } from "../../components/experience/interactions/race-game";
import { narrativeScore, type ScenePhaseId } from "../../components/experience/narrative-score";

const reviewPhases = { photo: "activation", touch: "engagement", stage: "reveal", game: "experiences", draw: "connection" } satisfies Record<string, ScenePhaseId>;
type ReviewStation = keyof typeof reviewPhases;

function stationArrival(station: ReviewStation) {
  const beat = narrativeScore.find((item) => item.id === reviewPhases[station])!;
  return beat.preview;
}

export async function seekStationReview(page: Page, station: ReviewStation) {
  const director = page.locator("[data-interaction-director]");
  await expect(director).toHaveAttribute("data-runtime", /^(full|adaptive)$/, { timeout: 80_000 });
  await page.locator("[data-experience-root]").evaluate((root: HTMLElement, { station: expectedStation, progress }) => {
    const currentDirector = root.querySelector<HTMLElement>("[data-interaction-director]");
    if (currentDirector?.dataset.activeStation === expectedStation && currentDirector.dataset.presentation === "active") return;
    // Automatic arrival acquires the root hold before React commits its
    // director state. A review seek during that gap would begin departure.
    if (root.dataset.interactionActive === expectedStation && !root.hasAttribute("data-interaction-result") && !root.hasAttribute("data-interaction-departing")) return;
    root.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
  }, { station, progress: stationArrival(station) + (station === "touch" ? 0.002 : 0) });
}

export async function returnToStationForward(page: Page, station: ReviewStation) {
  const root = page.locator("[data-experience-root]");
  if (await page.locator("[data-interaction-director]").getAttribute("data-presentation") === "result") {
    await expect(root).not.toHaveAttribute("data-interaction-active", station);
  }
  await root.evaluate((element, progress) => {
    element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
  }, stationArrival(station) - 0.004);
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-active-station", "none");
  const distance = await root.evaluate((element: HTMLElement) => element.offsetHeight - innerHeight);
  await page.mouse.wheel(0, distance * 0.008);
  return waitForStation(page, station);
}

export async function continueFromResult(page: Page, station: ReviewStation) {
  const director = page.locator("[data-interaction-director]");
  await expect(director).toHaveAttribute("data-presentation", "result");
  await expect(page.locator(`p[data-interaction-result='${station}']`)).toBeVisible();
  // The semantic lock ends when the result appears; the root retains the
  // actual scroll hold for its protected reading period.
  await expect(page.locator("[data-experience-root]")).not.toHaveAttribute("data-interaction-active", station);
  await page.mouse.wheel(0, 120);
  await expect(director).toHaveAttribute("data-active-station", "none");
}

export async function waitForStation(page: Page, station: string) {
  const director = page.locator("[data-interaction-director]");
  await expect(director).toHaveAttribute("data-available-station", station, { timeout: 80_000 });
  if (await director.getAttribute("data-active-station") !== station) {
    await page.locator(`[data-interaction-hotspot='${station}']`).click();
  }
  await expect(director).toHaveAttribute("data-active-station", station, { timeout: 80_000 });
  await expect(director).toHaveAttribute("data-scroll-locked", "false");
  return director;
}

export async function activateWithKeyboard(page: Page, selector: string) {
  const button = page.locator(selector);
  await expect(button).toBeEnabled();
  await button.focus();
  await page.keyboard.press("Enter");
}

export async function puzzleTiles(page: Page, preview = false) {
  const attribute = preview ? "data-puzzle-preview-tiles" : "data-puzzle-tiles";
  return JSON.parse(await page.locator("[data-touch-spatial-controls]").getAttribute(attribute) ?? "[]") as number[];
}

export async function swapPuzzleSlots(page: Page, first: number, second: number, input: "keyboard" | "touch" = "keyboard") {
  const controls = page.locator("[data-touch-spatial-controls]");
  const moves = Number(await controls.getAttribute("data-puzzle-moves"));
  if (input === "touch") {
    await page.locator(`[data-puzzle-slot='${first}']`).tap();
    await page.locator(`[data-puzzle-slot='${second}']`).tap();
  } else {
    await activateWithKeyboard(page, `[data-puzzle-slot='${first}']`);
    await activateWithKeyboard(page, `[data-puzzle-slot='${second}']`);
  }
  await expect(controls).toHaveAttribute("data-puzzle-moves", String(moves + 1));
}

// Solve through the same slot controls available to visitors, using the current
// permutation rather than replacing saved state or calling an internal store.
export async function solvePuzzle(page: Page, input: "keyboard" | "touch" = "keyboard", leaveFinalSwap = false) {
  for (let move = 0; move < 9; move += 1) {
    const tiles = await puzzleTiles(page);
    expect([...tiles].sort((first, second) => first - second)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const first = tiles.findIndex((piece, slot) => piece !== slot);
    if (first < 0) return null;
    const second = tiles.indexOf(first);
    const swapped = [...tiles];
    [swapped[first], swapped[second]] = [swapped[second], swapped[first]];
    if (leaveFinalSwap && swapped.every((piece, slot) => piece === slot)) return { first, second };
    await swapPuzzleSlots(page, first, second, input);
    if (swapped.every((piece, slot) => piece === slot)) return null;
  }
  throw new Error("Puzzle did not solve within eight swaps");
}

// End a run through visitor keyboard input and an actual traffic collision.
// Read the same observable car/traffic positions used by the pointer tests;
// never replace the saved game or invoke a private completion callback.
export async function driveRaceToCollision(page: Page) {
  await expect(page.locator("[data-game-spatial-controls]")).toHaveAttribute("data-game-status", "running");
  return page.locator("[data-game-canvas]").evaluate((element: HTMLCanvasElement, playerY) => new Promise<number>((resolve, reject) => {
    const started = performance.now();
    const controls = document.querySelector<HTMLElement>("[data-game-spatial-controls]")!;
    let held: string | null = null;
    element.focus({ preventScroll: true });
    const steer = (next: string | null) => {
      if (held === next) return;
      if (held) element.dispatchEvent(new KeyboardEvent("keyup", { key: held, bubbles: true, cancelable: true }));
      held = next;
      if (next) element.dispatchEvent(new KeyboardEvent("keydown", { key: next, bubbles: true, cancelable: true }));
    };
    const tick = (now: number) => {
      if (!element.isConnected || now - started > 30_000) {
        steer(null);
        reject(new Error("Keyboard steering did not produce a traffic collision."));
        return;
      }
      if (controls.dataset.gameStatus === "complete") {
        steer(null);
        resolve(Number(controls.dataset.gameScore));
        return;
      }
      const traffic = JSON.parse(element.dataset.traffic ?? "[]") as Array<{ x: number; y: number }>;
      const approaching = traffic.filter((car) => car.y <= playerY + 24).sort((first, second) => second.y - first.y)[0];
      const delta = approaching ? approaching.x - Number(element.dataset.carX) : 0;
      steer(Math.abs(delta) <= 12 ? null : delta < 0 ? "ArrowLeft" : "ArrowRight");
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), raceBoard.playerY);
}
