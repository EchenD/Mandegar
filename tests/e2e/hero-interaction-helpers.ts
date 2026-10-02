import { expect, type Page } from "@playwright/test";

export async function waitForStation(page: Page, station: string) {
  const director = page.locator("[data-interaction-director]");
  await expect(director).toHaveAttribute("data-available-station", station, { timeout: 80_000 });
  await expect(director).toHaveAttribute("data-active-station", station, { timeout: 80_000 });
  await expect(director).toHaveAttribute("data-scroll-locked", "true");
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
  }
  throw new Error("Puzzle did not solve within eight swaps");
}
