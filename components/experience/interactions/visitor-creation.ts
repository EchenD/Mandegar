import { isValidPuzzleTiles, shufflePuzzleTiles, type PuzzleProgress } from "./puzzle-engine";

export type VisitorCreation = {
  lighting: boolean[];
  puzzle: PuzzleProgress;
  drawing: HTMLCanvasElement | null;
  drawingWall: HTMLCanvasElement | null;
  gameScore: number;
  gameBest: number;
  gameCompleted: boolean;
};

const creation: VisitorCreation = {
  lighting: [false, false, false, false, false],
  puzzle: { tiles: shufflePuzzleTiles(), moves: 0, started: false },
  drawing: null,
  drawingWall: null,
  gameScore: 0,
  gameBest: 0,
  gameCompleted: false,
};

function announceCreation() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("mandegar:creation-change"));
}

export function getVisitorCreation(): Readonly<VisitorCreation> {
  return creation;
}

export function saveLightingLook(beams: readonly boolean[]) {
  creation.lighting = Array.from({ length: 5 }, (_, index) => Boolean(beams[index]));
  announceCreation();
}

export function savePuzzle(progress: PuzzleProgress) {
  if (!isValidPuzzleTiles(progress.tiles) || !Number.isFinite(progress.moves) || progress.moves < 0) return false;
  creation.puzzle = {
    tiles: Object.freeze([...progress.tiles]),
    moves: Math.floor(progress.moves),
    started: Boolean(progress.started),
  };
  announceCreation();
  return true;
}

export function saveDrawing(artwork: HTMLCanvasElement, wall: HTMLCanvasElement) {
  const snapshot = document.createElement("canvas");
  snapshot.width = artwork.width;
  snapshot.height = artwork.height;
  const context = snapshot.getContext("2d");
  if (!context) return;
  context.drawImage(artwork, 0, 0);
  creation.drawing = snapshot;
  creation.drawingWall = wall;
  announceCreation();
}

export function clearDrawing() {
  creation.drawing = null;
  creation.drawingWall = null;
  announceCreation();
}

export function saveGameResult(score: number) {
  creation.gameScore = Math.max(0, Math.round(score));
  creation.gameBest = Math.max(creation.gameBest, creation.gameScore);
  announceCreation();
  return creation.gameBest;
}

export function completeGameResult(score: number) {
  creation.gameCompleted = true;
  return saveGameResult(score);
}
