import type { ScenePhaseId } from "../narrative-score";

export type InteractionStation = "photo" | "touch" | "stage" | "game" | "draw";
export type InteractionLifecycle =
  | "unavailable"
  | "available"
  | "active"
  | "completing"
  | "complete"
  | "cancelled";
export type InteractionInput = "keyboard" | "pointer" | "touch";
export type SceneInteractionPhase = "down" | "move" | "up" | "cancel" | "activate";

export type SceneInteractionEvent = {
  phase: SceneInteractionPhase;
  x: number;
  y: number;
  pointerId: number;
  input: InteractionInput;
};

export type InteractionState = {
  activeStation: InteractionStation | null;
  availableStation: InteractionStation | null;
  lifecycle: InteractionLifecycle;
  input: InteractionInput | null;
  completed: Record<InteractionStation, boolean>;
};

export type InteractionStationDefinition = {
  id: InteractionStation;
  phase: ScenePhaseId;
  anchor: string;
  screen: "interactive" | "videoWall" | "game" | "main" | null;
};

export type InteractionAnchorPoint = {
  x: number;
  y: number;
  visible: boolean;
  fallback: boolean;
};

export type InteractionAnchorFrame = {
  stations: Record<InteractionStation, InteractionAnchorPoint>;
  photoFlash: InteractionAnchorPoint;
  photoPhone: InteractionAnchorPoint;
  beams: Array<{ origin: InteractionAnchorPoint; target: InteractionAnchorPoint }>;
};
