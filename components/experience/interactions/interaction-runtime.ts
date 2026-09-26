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
};

type SceneInteractionHandler = (event: SceneInteractionEvent) => void;

export const interactionRuntime: {
  availableStation: InteractionStation | null;
  activeStation: InteractionStation | null;
  activeBeams: boolean[];
  stageComplete: boolean;
  stageVisibility: number;
  gameVisibility: number;
  gameTarget: number;
  gameLaunchId: number;
  gameLaunchTarget: number;
  gameLaunchAccuracy: number;
  gameLaunchDestinationX: number;
  gameLaunchDestinationY: number;
  gameLaunchResult: 0 | 1 | 2;
  gameGateOffsetX: number;
  gameGateOffsetY: number;
  gameCompletedTargets: boolean[];
  gameComplete: boolean;
  touchElements: boolean[];
  touchVisibility: number;
  photoStep: "idle" | "ready" | "countdown" | "captured";
  monitorEntries: Partial<Record<BakedScreenId, MonitorEntry>>;
  sceneHandlers: Partial<Record<InteractionStation, SceneInteractionHandler>>;
} = {
  availableStation: null,
  activeStation: null,
  activeBeams: [false, false, false, false, false],
  stageComplete: false,
  stageVisibility: 0,
  gameVisibility: 0,
  gameTarget: 0,
  gameLaunchId: 0,
  gameLaunchTarget: 0,
  gameLaunchAccuracy: 1,
  gameLaunchDestinationX: 0,
  gameLaunchDestinationY: 0,
  gameLaunchResult: 0,
  gameGateOffsetX: 0,
  gameGateOffsetY: 0,
  gameCompletedTargets: [false, false, false],
  gameComplete: false,
  touchElements: [false, false, false],
  touchVisibility: 0,
  photoStep: "idle",
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
) {
  if (!canvas) {
    delete interactionRuntime.monitorEntries[screen];
    return;
  }
  interactionRuntime.monitorEntries[screen] = { canvas, revision: 1 };
}

export function markInteractionCanvasDirty(screen: BakedScreenId) {
  const entry = interactionRuntime.monitorEntries[screen];
  if (entry) entry.revision += 1;
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
  interactionRuntime.gameTarget = 0;
  interactionRuntime.gameLaunchId = 0;
  interactionRuntime.gameLaunchTarget = 0;
  interactionRuntime.gameLaunchAccuracy = 1;
  interactionRuntime.gameLaunchDestinationX = 0;
  interactionRuntime.gameLaunchDestinationY = 0;
  interactionRuntime.gameLaunchResult = 0;
  interactionRuntime.gameGateOffsetX = 0;
  interactionRuntime.gameGateOffsetY = 0;
  interactionRuntime.gameCompletedTargets = [false, false, false];
  interactionRuntime.gameComplete = false;
  interactionRuntime.touchElements = [false, false, false];
  interactionRuntime.touchVisibility = 0;
  interactionRuntime.photoStep = "idle";
  interactionRuntime.monitorEntries = {};
  interactionRuntime.sceneHandlers = {};
}
