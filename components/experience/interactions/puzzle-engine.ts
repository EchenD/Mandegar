export const puzzleSize = 3;
export const puzzleTileCount = puzzleSize * puzzleSize;
export const puzzleDragThreshold = 0.025;

export type PuzzleProgress = {
  tiles: readonly number[];
  moves: number;
  started: boolean;
};

export const solvedPuzzleTiles: readonly number[] = Object.freeze(
  Array.from({ length: puzzleTileCount }, (_, index) => index),
);

export function isPuzzleSlot(slot: number) {
  return Number.isInteger(slot) && slot >= 0 && slot < puzzleTileCount;
}

export function isValidPuzzleTiles(tiles: readonly number[]) {
  return tiles.length === puzzleTileCount
    && solvedPuzzleTiles.every((slot) => isPuzzleSlot(tiles[slot]))
    && new Set(tiles).size === puzzleTileCount;
}

export function isPuzzleSolved(tiles: readonly number[]) {
  return tiles.length === puzzleTileCount && solvedPuzzleTiles.every((slot) => tiles[slot] === slot);
}

export function swapPuzzleTiles(tiles: readonly number[], sourceSlot: number, targetSlot: number): readonly number[] {
  if (!isValidPuzzleTiles(tiles) || !isPuzzleSlot(sourceSlot) || !isPuzzleSlot(targetSlot) || sourceSlot === targetSlot) return tiles;
  const next = [...tiles];
  [next[sourceSlot], next[targetSlot]] = [next[targetSlot], next[sourceSlot]];
  return Object.freeze(next);
}

export function shufflePuzzleTiles(random = Math.random, previous?: readonly number[]): readonly number[] {
  const tiles = [...solvedPuzzleTiles];
  for (let slot = tiles.length - 1; slot > 0; slot -= 1) {
    const sample = random();
    const bounded = Number.isFinite(sample) ? Math.max(0, Math.min(1, sample)) : 0;
    const target = Math.min(slot, Math.floor(bounded * (slot + 1)));
    [tiles[slot], tiles[target]] = [tiles[target], tiles[slot]];
  }
  if (isPuzzleSolved(tiles)) [tiles[0], tiles[1]] = [tiles[1], tiles[0]];
  if (previous?.length === puzzleTileCount && tiles.every((piece, slot) => piece === previous[slot])) {
    [tiles[0], tiles[1]] = [tiles[1], tiles[0]];
    if (isPuzzleSolved(tiles)) [tiles[0], tiles[2]] = [tiles[2], tiles[0]];
  }
  return Object.freeze(tiles);
}

export function getPuzzleSlotAtPoint(x: number, y: number): number | null {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) return null;
  const column = Math.min(puzzleSize - 1, Math.floor(x * puzzleSize));
  const row = Math.min(puzzleSize - 1, Math.floor(y * puzzleSize));
  return row * puzzleSize + column;
}

export function getPuzzleSlotCenter(slot: number) {
  if (!isPuzzleSlot(slot)) return null;
  return {
    x: ((slot % puzzleSize) + 0.5) / puzzleSize,
    y: (Math.floor(slot / puzzleSize) + 0.5) / puzzleSize,
  };
}

export function getPuzzleAdjacentSlot(slot: number, key: string): number {
  if (!isPuzzleSlot(slot)) return 0;
  const column = slot % puzzleSize;
  const row = Math.floor(slot / puzzleSize);
  if (key === "ArrowLeft") return row * puzzleSize + Math.max(0, column - 1);
  if (key === "ArrowRight") return row * puzzleSize + Math.min(puzzleSize - 1, column + 1);
  if (key === "ArrowUp") return Math.max(0, row - 1) * puzzleSize + column;
  if (key === "ArrowDown") return Math.min(puzzleSize - 1, row + 1) * puzzleSize + column;
  return slot;
}
