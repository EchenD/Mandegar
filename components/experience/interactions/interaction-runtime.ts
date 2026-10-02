import type { BakedScreenId } from "../baked-scene-contract";
import type {
  InteractionAnchorFrame,
  InteractionInput,
  InteractionStation,
  SceneInteractionEvent,
} from "./interaction-types";

type MonitorEntry = {
  canvas: HTMLCanvasElement;
  revision: number;
  blend?: number;
};

type PhotoSurfaceEntry = {
  canvas: HTMLCanvasElement;
  revision: number;
};

type SceneInteractionHandler = (event: SceneInteractionEvent) => void;

export const interactionRuntime: {
  availableStation: InteractionStation | null;
  activeStation: InteractionStation | null;
  activeBeams: boolean[];
  stageComplete: boolean;
  stageVisibility: number;
  gameVisibility: number;
  gameHitId: number;
  gameHitX: number;
  gameHitY: number;
  gameComplete: boolean;
  ambientGameSurface: MonitorEntry | null;
  touchVisibility: number;
  photoStep: "idle" | "ready" | "countdown" | "captured";
  photoCount: number;
  photoVisibility: number;
  photoSurface: PhotoSurfaceEntry | null;
  monitorEntries: Partial<Record<BakedScreenId, MonitorEntry>>;
  sceneHandlers: Partial<Record<InteractionStation, SceneInteractionHandler>>;
} = {
  availableStation: null,
  activeStation: null,
  activeBeams: [false, false, false, false, false],
  stageComplete: false,
  stageVisibility: 0,
  gameVisibility: 0,
  gameHitId: 0,
  gameHitX: 0,
  gameHitY: 0,
  gameComplete: false,
  ambientGameSurface: null,
  touchVisibility: 0,
  photoStep: "idle",
  photoCount: 3,
  photoVisibility: 0,
  photoSurface: null,
  monitorEntries: {},
  sceneHandlers: {},
};

export function requestInteraction(station: InteractionStation, input: InteractionInput) {
  if (typeof window === "undefined" || interactionRuntime.availableStation !== station) return;
  window.dispatchEvent(new CustomEvent("mandegar:interaction-request", {
    detail: { station, input },
  }));
}

export function publishInteractionAnchors(frame: InteractionAnchorFrame) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("mandegar:interaction-anchors", { detail: frame }));
}

export function registerInteractionCanvas(
  screen: BakedScreenId,
  canvas: HTMLCanvasElement | null,
  blend?: number,
) {
  if (!canvas) {
    delete interactionRuntime.monitorEntries[screen];
    return;
  }
  interactionRuntime.monitorEntries[screen] = { canvas, revision: 1, blend };
}

export function markInteractionCanvasDirty(screen: BakedScreenId) {
  const entry = interactionRuntime.monitorEntries[screen];
  if (entry) entry.revision += 1;
}

export function registerPhotoSurface(canvas: HTMLCanvasElement | null) {
  interactionRuntime.photoSurface = canvas ? { canvas, revision: 1 } : null;
}

export function markPhotoSurfaceDirty() {
  if (interactionRuntime.photoSurface) interactionRuntime.photoSurface.revision += 1;
}

export function registerSceneInteraction(
  station: InteractionStation,
  handler: SceneInteractionHandler | null,
) {
  if (handler) {
    interactionRuntime.sceneHandlers[station] = handler;
  } else {
    delete interactionRuntime.sceneHandlers[station];
  }
}

export function dispatchSceneInteraction(
  station: InteractionStation,
  event: SceneInteractionEvent,
) {
  if (interactionRuntime.activeStation !== station) return false;
  const handler = interactionRuntime.sceneHandlers[station];
  if (!handler) return false;
  handler(event);
  return true;
}

export function resetInteractionRuntime() {
  interactionRuntime.availableStation = null;
  interactionRuntime.activeStation = null;
  interactionRuntime.activeBeams = [false, false, false, false, false];
  interactionRuntime.stageComplete = false;
  interactionRuntime.stageVisibility = 0;
  interactionRuntime.gameVisibility = 0;
  interactionRuntime.gameHitId = 0;
  interactionRuntime.gameHitX = 0;
  interactionRuntime.gameHitY = 0;
  interactionRuntime.gameComplete = false;
  interactionRuntime.ambientGameSurface = null;
  interactionRuntime.touchVisibility = 0;
  interactionRuntime.photoStep = "idle";
  interactionRuntime.photoCount = 3;
  interactionRuntime.photoVisibility = 0;
  interactionRuntime.photoSurface = null;
  interactionRuntime.monitorEntries = {};
  interactionRuntime.sceneHandlers = {};
}
