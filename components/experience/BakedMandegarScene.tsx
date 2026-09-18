"use client";

/* eslint-disable react-hooks/immutability -- R3F scene graphs and shader uniforms are mutated imperatively. */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  bakedSceneContract,
  requiredEnvironmentNodes,
  requiredExhibitionNodes,
  validateContractMaterials,
  validateContractNodes,
  type BakedScreenId,
} from "./baked-scene-contract";
import {
  createBakedSceneMaterial,
  prepareBakedTexture,
  type BakedMaterialUniforms,
} from "./baked-scene-material";
import {
  bindRuntimeMaterial,
  restoreRuntimeMaterial,
  type RuntimeMaterialBinding,
} from "./baked-material-binding";
import { AmbientDust } from "./AmbientDust";
import { getRevealExtent, getRevealOrigin } from "./baked-reveal-geometry";
import { BakedScreenController } from "./BakedScreenController";
import { DeferredBakedCrowd } from "./BakedCrowd";
import { DataFlowNetwork } from "./DataFlowNetwork";
import { experienceState } from "./experience-state";
import type { SceneProject } from "./experience-types";
import {
  assetSlots,
  getHeroBackgroundProgress,
  journeyBackgroundColor,
  phaseProgress,
  sceneTokens,
  type SceneQuality,
} from "./scene-config";
import type { SpatialHudFrame, SpatialHudModeId, SpatialScreenPoint } from "./spatial-hud";
import { TransitionParticleField } from "./TransitionParticleField";

type SectionRuntime = {
  root: THREE.Object3D;
  uniforms: BakedMaterialUniforms;
  material: THREE.ShaderMaterial;
  bindings: RuntimeMaterialBinding[];
};

type BakedSceneRuntime = {
  environment: SectionRuntime;
  central: SectionRuntime;
  left: SectionRuntime;
  right: SectionRuntime;
  hudModes: HudMode[];
};

type HudMode = {
  id: SpatialHudModeId;
  range: readonly [number, number];
  primary: THREE.Object3D | null | undefined;
  secondary: THREE.Object3D | null | undefined;
  measure: THREE.Object3D | null | undefined;
};

function collectExcludedScreenObjects(root: THREE.Object3D) {
  const excluded = new Set<THREE.Object3D>();
  Object.values(bakedSceneContract.exhibition.screens).forEach((name) => {
    root.getObjectByName(name)?.traverse((object) => excluded.add(object));
  });
  return excluded;
}

function createSectionRuntime({
  root,
  anchor,
  quietMap,
  peakMap,
  materialName,
  excluded = new Set<THREE.Object3D>(),
}: {
  root: THREE.Object3D;
  anchor: THREE.Object3D | null | undefined;
  quietMap: THREE.Texture;
  peakMap: THREE.Texture;
  materialName: string;
  excluded?: Set<THREE.Object3D>;
}) {
  root.updateMatrixWorld(true);
  const revealOrigin = getRevealOrigin(root, anchor);
  const runtime = createBakedSceneMaterial({
    name: materialName,
    quietMap,
    peakMap,
    edgeColor: sceneTokens.bakedScene.material.edgeColor,
  });
  runtime.uniforms.uRevealOrigin.value.copy(revealOrigin);
  runtime.uniforms.uRevealExtent.value = getRevealExtent(root, revealOrigin);
  runtime.uniforms.uEdgeStrength.value = sceneTokens.bakedScene.material.edgeStrength;
  return {
    root,
    ...runtime,
    bindings: bindRuntimeMaterial(root, runtime.material, excluded),
  } satisfies SectionRuntime;
}

function disposeSectionRuntime(runtime: SectionRuntime) {
  restoreRuntimeMaterial(runtime.bindings, runtime.material);
  runtime.material.dispose();
}

function updateSection(
  runtime: SectionRuntime,
  reveal: number,
  peak: number,
  elapsedTime: number,
) {
  const production = experienceState.stage.production;
  runtime.uniforms.uRevealProgress.value = reveal;
  runtime.uniforms.uPeakMix.value = peak;
  runtime.uniforms.uTime.value = elapsedTime;
  runtime.uniforms.uEdgeWidth.value = production.revealEdgeWidth;
  runtime.uniforms.uTurbulence.value = production.revealTurbulence;
  runtime.root.visible = reveal > 0.001;
}

function smoothstep(value: number) {
  const safe = THREE.MathUtils.clamp(value, 0, 1);
  return safe * safe * (3 - 2 * safe);
}

function getHudOpacity(progress: number, range: readonly [number, number]) {
  const span = Math.max(0.001, range[1] - range[0]);
  const fade = Math.min(0.026, span * 0.2);
  const enter = smoothstep(phaseProgress(progress, [range[0], range[0] + fade]));
  const exit = smoothstep(phaseProgress(progress, [range[1] - fade, range[1]]));
  return enter * (1 - exit);
}

function projectObject(
  object: THREE.Object3D | null | undefined,
  camera: THREE.Camera,
  size: { width: number; height: number },
  world: THREE.Vector3,
  projected: THREE.Vector3,
  output: SpatialScreenPoint,
) {
  if (!object) {
    output.visible = false;
    return;
  }
  object.getWorldPosition(world);
  projected.copy(world).project(camera);
  output.x = (projected.x * 0.5 + 0.5) * size.width;
  output.y = (-projected.y * 0.5 + 0.5) * size.height;
  output.visible = projected.z >= -1 && projected.z <= 1
    && projected.x >= -1.15 && projected.x <= 1.15
    && projected.y >= -1.15 && projected.y <= 1.15;
}

function projectMeasurement(
  object: THREE.Object3D | null | undefined,
  camera: THREE.Camera,
  size: { width: number; height: number },
  worldStart: THREE.Vector3,
  worldEnd: THREE.Vector3,
  projectedStart: THREE.Vector3,
  projectedEnd: THREE.Vector3,
  start: SpatialScreenPoint,
  end: SpatialScreenPoint,
) {
  if (!object) {
    start.visible = false;
    end.visible = false;
    return 0;
  }
  const bounds = new THREE.Box3().setFromObject(object);
  worldStart.set(bounds.min.x, bounds.max.y, bounds.max.z);
  worldEnd.set(bounds.max.x, bounds.max.y, bounds.max.z);
  projectedStart.copy(worldStart).project(camera);
  projectedEnd.copy(worldEnd).project(camera);
  start.x = (projectedStart.x * 0.5 + 0.5) * size.width;
  start.y = (-projectedStart.y * 0.5 + 0.5) * size.height;
  end.x = (projectedEnd.x * 0.5 + 0.5) * size.width;
  end.y = (-projectedEnd.y * 0.5 + 0.5) * size.height;
  start.visible = projectedStart.z >= -1 && projectedStart.z <= 1;
  end.visible = projectedEnd.z >= -1 && projectedEnd.z <= 1;
  return worldStart.distanceTo(worldEnd);
}

function findScreenId(object: THREE.Object3D) {
  let current: THREE.Object3D | null = object;
  while (current) {
    const entry = Object.entries(bakedSceneContract.exhibition.screens)
      .find(([, name]) => current?.name === name);
    if (entry) return entry[0] as BakedScreenId;
    current = current.parent;
  }
  return null;
}

export function BakedMandegarScene({
  quality,
  projects,
  onFirstFrame,
  onProjectSelect,
  onSpatialFrame,
}: {
  quality: SceneQuality;
  projects: SceneProject[];
  onFirstFrame?: () => void;
  onProjectSelect?: (index: number) => void;
  onSpatialFrame?: (frame: SpatialHudFrame) => void;
}) {
  const environmentGltf = useLoader(GLTFLoader, assetSlots.environment);
  const exhibitionGltf = useLoader(GLTFLoader, assetSlots.exhibition);
  const loadedTextures = useLoader(THREE.TextureLoader, [
    assetSlots.bakedTextures.environmentQuiet,
    assetSlots.bakedTextures.environmentPeak,
    assetSlots.bakedTextures.exhibitionQuiet,
    assetSlots.bakedTextures.exhibitionPeak,
  ]);
  const { camera, gl, scene, size } = useThree();
  const firstFrame = useRef(false);
  const warmupFrameRendered = useRef(false);
  const bakedBackground = useMemo(() => new THREE.Color(sceneTokens.bakedScene.background), []);
  const journeyBackground = useMemo(() => new THREE.Color(journeyBackgroundColor), []);
  const blendedBackground = useMemo(() => new THREE.Color(), []);
  const environment = useMemo(() => {
    const clone = cloneSkeleton(environmentGltf.scene);
    clone.visible = false;
    return clone;
  }, [environmentGltf.scene]);
  const exhibition = useMemo(() => {
    const clone = cloneSkeleton(exhibitionGltf.scene);
    clone.visible = false;
    return clone;
  }, [exhibitionGltf.scene]);
  const textures = useMemo(() => loadedTextures.map(prepareBakedTexture), [loadedTextures]);
  const runtimeRef = useRef<BakedSceneRuntime | null>(null);

  useEffect(() => {
    validateContractNodes(environmentGltf.scene, requiredEnvironmentNodes, "Environment GLB");
    validateContractNodes(exhibitionGltf.scene, requiredExhibitionNodes, "Exhibition GLB");
    validateContractMaterials(
      environmentGltf.scene,
      [bakedSceneContract.materials.environment],
      "Environment GLB",
    );
    validateContractMaterials(
      exhibitionGltf.scene,
      [bakedSceneContract.materials.exhibition],
      "Exhibition GLB",
    );
  }, [environmentGltf.scene, exhibitionGltf.scene]);

  useEffect(() => {
    environment.updateMatrixWorld(true);
    exhibition.updateMatrixWorld(true);
    const environmentRoot = environment.getObjectByName(bakedSceneContract.environment.section)
      ?? new THREE.Group();
    const excludedScreens = collectExcludedScreenObjects(exhibition);
    const centralRoot = exhibition.getObjectByName(bakedSceneContract.exhibition.sections.central.root)
      ?? new THREE.Group();
    const leftRoot = exhibition.getObjectByName(bakedSceneContract.exhibition.sections.left.root)
      ?? new THREE.Group();
    const rightRoot = exhibition.getObjectByName(bakedSceneContract.exhibition.sections.right.root)
      ?? new THREE.Group();
    const environmentRuntime = createSectionRuntime({
      root: environmentRoot,
      anchor: environment.getObjectByName(bakedSceneContract.environment.revealAnchor),
      quietMap: textures[0],
      peakMap: textures[1],
      materialName: "MAT_ENV_BAKED_RUNTIME",
    });
    const central = createSectionRuntime({
      root: centralRoot,
      anchor: exhibition.getObjectByName(bakedSceneContract.exhibition.sections.central.revealAnchor),
      quietMap: textures[2],
      peakMap: textures[3],
      materialName: "MAT_EXHIBIT_CENTRAL_RUNTIME",
      excluded: excludedScreens,
    });
    const left = createSectionRuntime({
      root: leftRoot,
      anchor: exhibition.getObjectByName(bakedSceneContract.exhibition.sections.left.revealAnchor),
      quietMap: textures[2],
      peakMap: textures[3],
      materialName: "MAT_EXHIBIT_LEFT_RUNTIME",
      excluded: excludedScreens,
    });
    const right = createSectionRuntime({
      root: rightRoot,
      anchor: exhibition.getObjectByName(bakedSceneContract.exhibition.sections.right.revealAnchor),
      quietMap: textures[2],
      peakMap: textures[3],
      materialName: "MAT_EXHIBIT_RIGHT_RUNTIME",
      excluded: excludedScreens,
    });
    const hudModes: HudMode[] = [
      {
        id: "assembly",
        range: sceneTokens.bakedScene.hudMoments.central,
        primary: exhibition.getObjectByName(bakedSceneContract.exhibition.sections.central.hudAnchor),
        secondary: null,
        measure: centralRoot,
      },
      {
        id: "activationLeft",
        range: sceneTokens.bakedScene.hudMoments.left,
        primary: exhibition.getObjectByName(bakedSceneContract.exhibition.sections.left.hudAnchor),
        secondary: null,
        measure: leftRoot,
      },
      {
        id: "activationRight",
        range: sceneTokens.bakedScene.hudMoments.right,
        primary: exhibition.getObjectByName(bakedSceneContract.exhibition.sections.right.hudAnchor),
        secondary: null,
        measure: rightRoot,
      },
      {
        id: "experiences",
        range: sceneTokens.bakedScene.hudMoments.experiences,
        primary: exhibition.getObjectByName(bakedSceneContract.exhibition.sections.left.hudAnchor),
        secondary: exhibition.getObjectByName(bakedSceneContract.exhibition.sections.right.hudAnchor),
        measure: null,
      },
      {
        id: "proof",
        range: sceneTokens.bakedScene.hudMoments.proof,
        primary: exhibition.getObjectByName(bakedSceneContract.exhibition.sections.central.hudAnchor),
        secondary: exhibition.getObjectByName(bakedSceneContract.exhibition.sections.right.hudAnchor),
        measure: exhibition.getObjectByName(bakedSceneContract.exhibition.screens.videoWall),
      },
      {
        id: "intelligence",
        range: sceneTokens.bakedScene.hudMoments.intelligence,
        primary: exhibition.getObjectByName(bakedSceneContract.exhibition.sections.left.signalAnchor),
        secondary: exhibition.getObjectByName(bakedSceneContract.exhibition.sections.central.signalAnchor),
        measure: null,
      },
    ];
    const nextRuntime: BakedSceneRuntime = {
      environment: environmentRuntime,
      central,
      left,
      right,
      hudModes,
    };

    runtimeRef.current = nextRuntime;
    environment.visible = true;
    exhibition.visible = true;
    warmupFrameRendered.current = false;
    textures.forEach((texture) => gl.initTexture(texture));

    return () => {
      if (runtimeRef.current === nextRuntime) {
        runtimeRef.current = null;
      }

      environment.visible = false;
      exhibition.visible = false;
      warmupFrameRendered.current = false;
      disposeSectionRuntime(nextRuntime.environment);
      disposeSectionRuntime(nextRuntime.central);
      disposeSectionRuntime(nextRuntime.left);
      disposeSectionRuntime(nextRuntime.right);
    };
  }, [environment, exhibition, gl, textures]);

  const projection = useRef({
    world: Array.from({ length: 4 }, () => new THREE.Vector3()),
    projected: Array.from({ length: 4 }, () => new THREE.Vector3()),
    primary: { x: 0, y: 0, visible: false },
    secondary: { x: 0, y: 0, visible: false },
    measureStart: { x: 0, y: 0, visible: false },
    measureEnd: { x: 0, y: 0, visible: false },
  });

  const clearInteraction = useCallback(() => {
    experienceState.focusProject = null;
    experienceState.focusScreen = null;
    document.body.style.cursor = "";
  }, []);
  const handlePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    const screenId = findScreenId(event.object);
    if (!screenId) return;
    event.stopPropagation();
    experienceState.focusProject = screenId === "interactive" ? 1 : screenId === "game" ? 2 : 0;
    experienceState.focusScreen = screenId;
    document.body.style.cursor = "pointer";
  }, []);
  const handleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    const screenId = findScreenId(event.object);
    if (!screenId) return;
    event.stopPropagation();
    const index = screenId === "interactive" ? 1 : screenId === "game" ? 2 : 0;
    onProjectSelect?.(index);
  }, [onProjectSelect]);
  useEffect(() => clearInteraction, [clearInteraction]);

  useFrame(({ clock }) => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    blendedBackground.copy(bakedBackground).lerp(
      journeyBackground,
      getHeroBackgroundProgress(experienceState.progress),
    );
    scene.background = blendedBackground;

    // Keep every section renderable for one covered frame so Three.js uploads
    // geometry and compiles each reveal material before the intro can begin.
    if (!warmupFrameRendered.current) {
      warmupFrameRendered.current = true;
      return;
    }

    const production = experienceState.stage.production;
    const heroPresence = 1;
    const environmentReveal = experienceState.sequence === "loading"
      ? 0
      : experienceState.sequence === "intro"
        ? experienceState.intro.assemblyProgress
        : production.environmentReveal * heroPresence;
    updateSection(runtime.environment, environmentReveal, production.environmentPeak, clock.elapsedTime);
    updateSection(runtime.central, production.centralReveal * heroPresence, production.centralPeak, clock.elapsedTime);
    updateSection(runtime.left, production.leftReveal * heroPresence, production.leftPeak, clock.elapsedTime);
    updateSection(runtime.right, production.rightReveal * heroPresence, production.rightPeak, clock.elapsedTime);

    if (!firstFrame.current) {
      firstFrame.current = true;
      onFirstFrame?.();
    }
    if (!onSpatialFrame) return;
    const progress = experienceState.progress;
    const mode = runtime.hudModes.find((candidate) => (
      progress >= candidate.range[0] && progress < candidate.range[1]
    )) ?? null;
    const opacity = mode
      ? getHudOpacity(progress, mode.range) * experienceState.stage.spatialProminence * heroPresence
      : 0;
    const scratch = projection.current;
    if (mode && opacity > 0.001) {
      environment.updateMatrixWorld(true);
      exhibition.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      projectObject(mode.primary, camera, size, scratch.world[0], scratch.projected[0], scratch.primary);
      projectObject(mode.secondary, camera, size, scratch.world[1], scratch.projected[1], scratch.secondary);
    } else {
      scratch.primary.visible = false;
      scratch.secondary.visible = false;
    }
    const measureMeters = mode && opacity > 0.001
      ? projectMeasurement(
        mode.measure,
        camera,
        size,
        scratch.world[2],
        scratch.world[3],
        scratch.projected[2],
        scratch.projected[3],
        scratch.measureStart,
        scratch.measureEnd,
      )
      : 0;
    if (!mode || opacity <= 0.001) {
      scratch.measureStart.visible = false;
      scratch.measureEnd.visible = false;
    }
    onSpatialFrame({
      mode: mode?.id ?? null,
      opacity,
      compact: size.width <= 760,
      width: size.width,
      height: size.height,
      primary: scratch.primary,
      secondary: scratch.secondary,
      measureStart: scratch.measureStart,
      measureEnd: scratch.measureEnd,
      measureMeters,
    });
  });

  return (
    <group>
      <primitive object={environment} />
      <primitive
        object={exhibition}
        onPointerMove={handlePointerMove}
        onPointerOut={clearInteraction}
        onClick={handleClick}
      />
      <BakedScreenController root={exhibition} projects={projects} />
      <TransitionParticleField
        environment={environment}
        exhibition={exhibition}
        quality={quality}
      />
      <AmbientDust exhibition={exhibition} quality={quality} />
      <DataFlowNetwork exhibition={exhibition} />
      <DeferredBakedCrowd quietMap={textures[2]} peakMap={textures[3]} />
    </group>
  );
}
