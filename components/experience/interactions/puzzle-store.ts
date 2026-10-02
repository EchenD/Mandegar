import {
  getPuzzleSlotAtPoint,
  isPuzzleSlot,
  isPuzzleSolved,
  puzzleDragThreshold,
  shufflePuzzleTiles,
  swapPuzzleTiles,
} from "./puzzle-engine";
import { getVisitorCreation, savePuzzle } from "./visitor-creation";

export type PuzzleDragSurface = "table" | "monitor" | "semantic";
export type PuzzleDrag = Readonly<{
  pointerId: number;
  sourceSlot: number;
  x: number;
  y: number;
  targetSlot: number | null;
  moved: boolean;
  surface: PuzzleDragSurface;
}>;

export type PuzzleState = Readonly<{
  tiles: readonly number[];
  previewTiles: readonly number[];
  selectedSlot: number | null;
  focusedSlot: number | null;
  dragging: PuzzleDrag | null;
  interactive: boolean;
  started: boolean;
  moves: number;
  solved: boolean;
  revision: number;
}>;

const saved = getVisitorCreation().puzzle;
let state: PuzzleState = {
  tiles: saved.tiles,
  previewTiles: saved.tiles,
  selectedSlot: null,
  focusedSlot: null,
  dragging: null,
  interactive: false,
  started: saved.started,
  moves: saved.moves,
  solved: isPuzzleSolved(saved.tiles),
  revision: 0,
};
let dragOrigin: { x: number; y: number } | null = null;
const listeners = new Set<() => void>();

function publish(next: Omit<PuzzleState, "revision">, committed = false) {
  state = { ...next, revision: state.revision + 1 };
  if (committed) savePuzzle({ tiles: state.tiles, moves: state.moves, started: state.started });
  listeners.forEach((listener) => listener());
}

export function getPuzzleState(): PuzzleState {
  return state;
}

export function subscribePuzzle(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function setPuzzleInteractive(interactive: boolean) {
  if (state.interactive === interactive) return;
  if (!interactive) dragOrigin = null;
  publish({
    ...state,
    interactive,
    ...(interactive ? {} : { dragging: null, previewTiles: state.tiles, selectedSlot: null, focusedSlot: null }),
  });
}

export function setPuzzleFocusedSlot(slot: number | null) {
  if (slot !== null && !isPuzzleSlot(slot)) return;
  if (state.focusedSlot === slot) return;
  publish({ ...state, focusedSlot: slot });
}

export function clearPuzzleSelection() {
  if (state.selectedSlot === null) return;
  publish({ ...state, selectedSlot: null });
}

export function activatePuzzleSlot(slot: number) {
  if (!state.interactive || state.solved || state.dragging || !isPuzzleSlot(slot)) return;
  const sourceSlot = state.selectedSlot;
  if (sourceSlot === null || sourceSlot === slot) {
    const started = state.started;
    publish({ ...state, selectedSlot: sourceSlot === slot ? null : slot, started: true }, !started);
    return;
  }
  const tiles = swapPuzzleTiles(state.tiles, sourceSlot, slot);
  publish({
    ...state,
    tiles,
    previewTiles: tiles,
    selectedSlot: null,
    started: true,
    moves: state.moves + 1,
    solved: isPuzzleSolved(tiles),
  }, true);
}

export function beginPuzzleDrag(
  sourceSlot: number,
  pointerId: number,
  x: number,
  y: number,
  surface: PuzzleDragSurface = "monitor",
) {
  if (!state.interactive || state.solved || state.dragging || !isPuzzleSlot(sourceSlot)
    || !Number.isInteger(pointerId) || getPuzzleSlotAtPoint(x, y) === null) return false;
  dragOrigin = { x, y };
  publish({
    ...state,
    dragging: { pointerId, sourceSlot, x, y, targetSlot: sourceSlot, moved: false, surface },
  });
  return true;
}

export function updatePuzzleDrag(pointerId: number, x: number, y: number) {
  const dragging = state.dragging;
  if (!dragging || dragging.pointerId !== pointerId || !dragOrigin || !Number.isFinite(x) || !Number.isFinite(y)) return;
  const targetSlot = getPuzzleSlotAtPoint(x, y);
  const moved = dragging.moved || Math.hypot(x - dragOrigin.x, y - dragOrigin.y) >= puzzleDragThreshold;
  if (dragging.x === x && dragging.y === y && dragging.targetSlot === targetSlot && dragging.moved === moved) return;
  const previewTiles = moved && targetSlot !== null
    ? dragging.moved && dragging.targetSlot === targetSlot
      ? state.previewTiles
      : swapPuzzleTiles(state.tiles, dragging.sourceSlot, targetSlot)
    : state.tiles;
  publish({ ...state, dragging: { ...dragging, x, y, targetSlot, moved }, previewTiles });
}

export function finishPuzzleDrag(pointerId: number) {
  const dragging = state.dragging;
  if (!dragging || dragging.pointerId !== pointerId) return;
  dragOrigin = null;
  if (dragging.targetSlot === null) {
    publish({ ...state, dragging: null, previewTiles: state.tiles });
    return;
  }
  if (!dragging.moved) {
    publish({ ...state, dragging: null, previewTiles: state.tiles });
    activatePuzzleSlot(dragging.sourceSlot);
    return;
  }
  if (dragging.sourceSlot === dragging.targetSlot) {
    publish({ ...state, dragging: null, previewTiles: state.tiles });
    return;
  }
  const tiles = swapPuzzleTiles(state.tiles, dragging.sourceSlot, dragging.targetSlot);
  publish({
    ...state,
    tiles,
    previewTiles: tiles,
    dragging: null,
    selectedSlot: null,
    started: true,
    moves: state.moves + 1,
    solved: isPuzzleSolved(tiles),
  }, true);
}

export function cancelPuzzleDrag(pointerId?: number) {
  if (!state.dragging || (pointerId !== undefined && state.dragging.pointerId !== pointerId)) return;
  dragOrigin = null;
  publish({ ...state, dragging: null, previewTiles: state.tiles });
}

export function resetPuzzle(random = Math.random) {
  const tiles = shufflePuzzleTiles(random, state.tiles);
  dragOrigin = null;
  publish({
    ...state,
    tiles,
    previewTiles: tiles,
    selectedSlot: null,
    focusedSlot: null,
    dragging: null,
    started: false,
    moves: 0,
    solved: false,
  }, true);
}
