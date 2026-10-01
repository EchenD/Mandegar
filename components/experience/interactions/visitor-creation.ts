export type PhotoLook = "warm" | "cool";

export type VisitorCreation = {
  lighting: boolean[];
  composer: boolean[];
  drawing: HTMLCanvasElement | null;
  drawingWall: HTMLCanvasElement | null;
  photoLook: PhotoLook;
  gameScore: number;
  gameBest: number;
};

const creation: VisitorCreation = {
  lighting: [false, false, false, false, false],
  composer: [false, false, false],
  drawing: null,
  drawingWall: null,
  photoLook: "warm",
  gameScore: 0,
  gameBest: 0,
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

export function saveComposer(elements: readonly boolean[]) {
  creation.composer = Array.from({ length: 3 }, (_, index) => Boolean(elements[index]));
  announceCreation();
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

export function savePhotoLook(look: PhotoLook) {
  creation.photoLook = look;
  announceCreation();
}

export function saveGameResult(score: number) {
  creation.gameScore = Math.max(0, Math.round(score));
  creation.gameBest = Math.max(creation.gameBest, creation.gameScore);
  announceCreation();
  return creation.gameBest;
}
