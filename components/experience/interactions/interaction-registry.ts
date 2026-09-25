import { bakedSceneContract } from "../baked-scene-contract";
import type { InteractionStation, InteractionStationDefinition } from "./interaction-types";

export const interactionRegistry: Record<InteractionStation, InteractionStationDefinition> = {
  photo: {
    id: "photo",
    phase: "activation",
    anchor: bakedSceneContract.exhibition.interactionAnchors.photoHotspot,
    screen: null,
  },
  touch: {
    id: "touch",
    phase: "engagement",
    anchor: bakedSceneContract.exhibition.interactionAnchors.touchHotspot,
    screen: "interactive",
  },
  stage: {
    id: "stage",
    phase: "reveal",
    anchor: bakedSceneContract.exhibition.interactionAnchors.stageHotspot,
    screen: "videoWall",
  },
  game: {
    id: "game",
    phase: "experiences",
    anchor: bakedSceneContract.exhibition.interactionAnchors.gameHotspot,
    screen: "game",
  },
  draw: {
    id: "draw",
    phase: "connection",
    anchor: bakedSceneContract.exhibition.interactionAnchors.drawHotspot,
    screen: "main",
  },
};

export const interactionStations = Object.keys(interactionRegistry) as InteractionStation[];

export function getStationForPhase(phase: string) {
  return interactionStations.find((station) => interactionRegistry[station].phase === phase) ?? null;
}
