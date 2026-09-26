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
  touchElements: boolean[];
  photoStep: "idle" | "ready" | "countdown" | "captured";
  monitorEntries: Partial<Record<BakedScreenId, MonitorEntry>>;
  sceneHandlers: Partial<Record<InteractionStation, SceneInteractionHandler>>;
} = {
  availableStation: null,
  activeStation: null,
  activeBeams: [false, false, false, false, false],
  touchElements: [false, false, false],
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
  interactionRuntime.touchElements = [false, false, false];
  interactionRuntime.photoStep = "idle";
  interactionRuntime.monitorEntries = {};
  interactionRuntime.sceneHandlers = {};
}
