import * as THREE from "three";
import { bakedSceneContract } from "../baked-scene-contract";
import type { InteractionStation } from "./interaction-types";

type AnchorResolution = {
  object: THREE.Object3D;
  fallback: boolean;
};

const fallbackStations: Record<InteractionStation, string> = {
  photo: bakedSceneContract.exhibition.sections.left.root,
  touch: bakedSceneContract.exhibition.screens.interactive,
  stage: bakedSceneContract.exhibition.screens.videoWall,
  game: bakedSceneContract.exhibition.screens.game,
  draw: bakedSceneContract.exhibition.screens.main,
};

function fallbackObject(
  root: THREE.Object3D,
  sourceName: string,
  name: string,
  offset: readonly [number, number, number] = [0, 0, 0],
) {
  root.updateMatrixWorld(true);
  const source = root.getObjectByName(sourceName) ?? root;
  const worldPosition = source.getWorldPosition(new THREE.Vector3());
  const localPosition = root.worldToLocal(worldPosition).add(new THREE.Vector3(...offset));
  const helper = new THREE.Object3D();
  helper.name = `${name}__runtime_fallback`;
  helper.position.copy(localPosition);
  helper.userData.interactionFallback = true;
  root.add(helper);
  return helper;
}

function resolve(
  root: THREE.Object3D,
  name: string,
  sourceName: string,
  offset?: readonly [number, number, number],
): AnchorResolution {
  const authored = root.getObjectByName(name);
  return authored
    ? { object: authored, fallback: false }
    : { object: fallbackObject(root, sourceName, name, offset), fallback: true };
}

export type InteractionAnchorRuntime = {
  stations: Record<InteractionStation, AnchorResolution>;
  photoFlash: AnchorResolution;
  photoPhone: AnchorResolution;
  beamOrigins: AnchorResolution[];
  beamTargets: AnchorResolution[];
  dispose: () => void;
};

export function resolveInteractionAnchors(root: THREE.Object3D): InteractionAnchorRuntime {
  const contract = bakedSceneContract.exhibition.interactionAnchors;
  const created: THREE.Object3D[] = [];
  const resolveTracked = (
    name: string,
    sourceName: string,
    offset?: readonly [number, number, number],
  ) => {
    const result = resolve(root, name, sourceName, offset);
    if (result.fallback) created.push(result.object);
    return result;
  };
  const centralAnchor = bakedSceneContract.exhibition.sections.central.root;
  const beamX = [-2.8, -1.4, 0, 1.4, 2.8] as const;

  return {
    stations: {
      photo: resolveTracked(contract.photoHotspot, fallbackStations.photo, [-0.65, 0.35, 0.25]),
      touch: resolveTracked(contract.touchHotspot, fallbackStations.touch, [0, 0, 0.16]),
      stage: resolveTracked(contract.stageHotspot, fallbackStations.stage, [0, 2, 0.18]),
      game: resolveTracked(contract.gameHotspot, fallbackStations.game, [0, 0, 0.16]),
      draw: resolveTracked(contract.drawHotspot, fallbackStations.draw, [0, 0, 0.16]),
    },
    photoFlash: resolveTracked(contract.photoFlash, fallbackStations.photo, [-0.25, 1.1, 0.4]),
    photoPhone: resolveTracked(contract.photoPhone, fallbackStations.photo, [1.1, 0.2, 0.5]),
    beamOrigins: contract.beamOrigins.map((name, index) => (
      resolveTracked(name, centralAnchor, [beamX[index], 4.8, -0.5])
    )),
    beamTargets: contract.beamTargets.map((name, index) => (
      resolveTracked(name, centralAnchor, [beamX[index] * 0.72, -1.4, 0.8])
    )),
    dispose: () => created.forEach((object) => object.removeFromParent()),
  };
}
