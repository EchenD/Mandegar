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
  validateInteractionAnchors,
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
import { resolveInteractionAnchors, type InteractionAnchorRuntime } from "./interactions/interaction-anchors";
import {
  dispatchSceneInteraction,
  interactionRuntime,
  publishInteractionAnchors,
  requestInteraction,
} from "./interactions/interaction-runtime";
import type { InteractionAnchorPoint, InteractionStation } from "./interactions/interaction-types";
import {
  assetSlots,
  getHeroBackgroundProgress,
  journeyBackgroundColor,
  sceneTokens,
  type SceneQuality,
} from "./scene-config";
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

function projectObject(
  anchor: { object: THREE.Object3D; fallback: boolean },
  camera: THREE.Camera,
  size: { width: number; height: number },
  world: THREE.Vector3,
  projected: THREE.Vector3,
): InteractionAnchorPoint {
  anchor.object.getWorldPosition(world);
  projected.copy(world).project(camera);
  return {
    x: (projected.x * 0.5 + 0.5) * size.width,
    y: (-projected.y * 0.5 + 0.5) * size.height,
    visible: projected.z >= -1 && projected.z <= 1
      && projected.x >= -1.08 && projected.x <= 1.08
      && projected.y >= -1.08 && projected.y <= 1.08,
    fallback: anchor.fallback,
  };
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

const screenStations: Partial<Record<BakedScreenId, InteractionStation>> = {
  interactive: "touch",
  videoWall: "stage",
  game: "game",
  main: "draw",
};

function InteractionBeamEffects({
  anchors,
  quality,
}: {
  anchors: InteractionAnchorRuntime;
  quality: SceneQuality;
}) {
  const group = useMemo(() => {
    const next = new THREE.Group();
    next.name = "fxInteraction_stage_beams";
    anchors.beamOrigins.forEach((origin, index) => {
      const start = origin.object.getWorldPosition(new THREE.Vector3());
      const end = anchors.beamTargets[index].object.getWorldPosition(new THREE.Vector3());
      const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
      const material = new THREE.LineBasicMaterial({
        color: ["#50c7ff", "#d95cff", "#ffb54a", "#75d8ff", "#ef86ff"][index],
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      const line = new THREE.Line(geometry, material);
      line.name = `fxInteraction_stage_beam_${String(index + 1).padStart(2, "0")}`;
      line.frustumCulled = false;
      line.raycast = () => {};
      next.add(line);
    });
    return next;
  }, [anchors]);

  useFrame((_, delta) => {
    group.children.forEach((child, index) => {
      const material = (child as THREE.Line).material as THREE.LineBasicMaterial;
      const target = interactionRuntime.activeBeams[index] ? (quality === "full" ? 0.92 : 0.62) : 0;
      material.opacity = THREE.MathUtils.damp(material.opacity, target, 12, delta);
      child.visible = material.opacity > 0.002;
    });
  });

  useEffect(() => () => {
    group.children.forEach((child) => {
      const line = child as THREE.Line;
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    });
  }, [group]);

  return <primitive object={group} />;
}

function createCueTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, 128, 128);
    context.beginPath();
    context.arc(64, 64, 42, 0, Math.PI * 2);
    context.strokeStyle = "rgba(117,216,255,.95)";
    context.lineWidth = 6;
    context.shadowColor = "#225cff";
    context.shadowBlur = 20;
    context.stroke();
    context.shadowBlur = 0;
    context.fillStyle = "#f7f7f4";
    context.fillRect(61, 45, 6, 38);
    context.fillRect(45, 61, 38, 6);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function InteractionSceneCues({ anchors }: { anchors: InteractionAnchorRuntime }) {
  const group = useMemo(() => {
    const next = new THREE.Group();
    next.name = "fxInteraction_station_cues";
    const texture = createCueTexture();
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: "#ffffff",
      transparent: true,
      opacity: 0.92,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    (Object.entries(anchors.stations) as Array<[InteractionStation, InteractionAnchorRuntime["stations"][InteractionStation]]>)
      .forEach(([station, anchor]) => {
        const sprite = new THREE.Sprite(material);
        sprite.name = `fxInteraction_cue_${station}`;
        sprite.userData.interactionStation = station;
        sprite.position.copy(anchor.object.getWorldPosition(new THREE.Vector3()));
        sprite.scale.setScalar(0.72);
        sprite.renderOrder = 50;
        sprite.visible = false;
        next.add(sprite);
      });
    next.userData.cueTexture = texture;
    next.userData.cueMaterial = material;
    return next;
  }, [anchors]);

  useFrame(({ clock }) => {
    const available = interactionRuntime.activeStation ? null : interactionRuntime.availableStation;
    const pulse = 0.82 + Math.sin(clock.elapsedTime * 3.2) * 0.12;
    (group.userData.cueMaterial as THREE.SpriteMaterial).opacity = pulse;
    group.children.forEach((child) => {
      child.visible = child.userData.interactionStation === available;
      const scale = child.visible ? 0.72 + Math.sin(clock.elapsedTime * 3.2) * 0.04 : 0.72;
      child.scale.setScalar(scale);
    });
  });

  useEffect(() => () => {
    (group.userData.cueMaterial as THREE.Material).dispose();
    (group.userData.cueTexture as THREE.Texture).dispose();
  }, [group]);

  return (
    <primitive
      object={group}
      onPointerMove={(event: ThreeEvent<PointerEvent>) => {
        if (!event.object.userData.interactionStation) return;
        event.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => { document.body.style.cursor = ""; }}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        const station = event.object.userData.interactionStation as InteractionStation | undefined;
        if (!station || interactionRuntime.availableStation !== station) return;
        event.stopPropagation();
        requestInteraction(station, "pointer");
      }}
    />
  );
}

function createFlashTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.18, "rgba(117,216,255,.9)");
    gradient.addColorStop(1, "rgba(117,216,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function InteractionPhotoEffects({ anchors }: { anchors: InteractionAnchorRuntime }) {
  const portraitSource = useLoader(THREE.TextureLoader, "/media/placeholders/photo-experience.webp");
  const group = useMemo(() => {
    const next = new THREE.Group();
    next.name = "fxInteraction_photo_result";
    const portrait = portraitSource.clone();
    portrait.colorSpace = THREE.SRGBColorSpace;
    portrait.needsUpdate = true;
    const phoneMaterial = new THREE.SpriteMaterial({
      map: portrait,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const phoneFrameMaterial = new THREE.SpriteMaterial({
      color: "#101419",
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const phoneFrame = new THREE.Sprite(phoneFrameMaterial);
    phoneFrame.name = "fxInteraction_photo_phone_frame";
    phoneFrame.position.copy(anchors.photoPhone.object.getWorldPosition(new THREE.Vector3()));
    phoneFrame.scale.set(0.06, 0.1, 1);
    phoneFrame.renderOrder = 52;
    phoneFrame.visible = false;
    const phone = new THREE.Sprite(phoneMaterial);
    phone.name = "fxInteraction_photo_phone_result";
    phone.position.copy(anchors.photoPhone.object.getWorldPosition(new THREE.Vector3()));
    phone.scale.set(0.05, 0.08, 1);
    phone.renderOrder = 53;
    phone.visible = false;
    const flashTexture = createFlashTexture();
    const flashMaterial = new THREE.SpriteMaterial({
      map: flashTexture,
      color: "#ffffff",
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const flash = new THREE.Sprite(flashMaterial);
    flash.name = "fxInteraction_photo_flash";
    flash.position.copy(anchors.photoFlash.object.getWorldPosition(new THREE.Vector3()));
    flash.scale.setScalar(2.4);
    flash.renderOrder = 51;
    flash.visible = false;
    next.add(phoneFrame, phone, flash);
    next.userData.phoneFrame = phoneFrame;
    next.userData.phoneFrameMaterial = phoneFrameMaterial;
    next.userData.phone = phone;
    next.userData.phoneMaterial = phoneMaterial;
    next.userData.portrait = portrait;
    next.userData.flash = flash;
    next.userData.flashMaterial = flashMaterial;
    next.userData.flashTexture = flashTexture;
    return next;
  }, [anchors, portraitSource]);
  const previousStep = useRef(interactionRuntime.photoStep);
  const flashAge = useRef(1);

  useFrame((_, delta) => {
    const phone = group.userData.phone as THREE.Sprite;
    const phoneMaterial = group.userData.phoneMaterial as THREE.SpriteMaterial;
    const phoneFrame = group.userData.phoneFrame as THREE.Sprite;
    const phoneFrameMaterial = group.userData.phoneFrameMaterial as THREE.SpriteMaterial;
    const flash = group.userData.flash as THREE.Sprite;
    const flashMaterial = group.userData.flashMaterial as THREE.SpriteMaterial;
    const step = interactionRuntime.photoStep;
    if (step === "captured" && previousStep.current !== "captured") flashAge.current = 0;
    previousStep.current = step;
    const showPhone = step === "captured";
    phone.visible = showPhone || phoneMaterial.opacity > 0.01;
    phoneFrame.visible = phone.visible;
    phoneMaterial.opacity = THREE.MathUtils.damp(phoneMaterial.opacity, showPhone ? 1 : 0, 9, delta);
    phoneFrameMaterial.opacity = phoneMaterial.opacity;
    const scale = THREE.MathUtils.damp(phoneFrame.scale.y, showPhone ? 0.78 : 0.08, 8, delta);
    phoneFrame.scale.set(scale * 0.58, scale, 1);
    phone.scale.set(scale * 0.5, scale * 0.9, 1);
    flashAge.current += delta;
    flashMaterial.opacity = Math.max(0, 1 - flashAge.current * 2.4);
    flash.visible = flashMaterial.opacity > 0.01;
  });

  useEffect(() => () => {
    (group.userData.phoneMaterial as THREE.Material).dispose();
    (group.userData.phoneFrameMaterial as THREE.Material).dispose();
    (group.userData.portrait as THREE.Texture).dispose();
    (group.userData.flashMaterial as THREE.Material).dispose();
    (group.userData.flashTexture as THREE.Texture).dispose();
  }, [group]);

  return <primitive object={group} />;
}

export function BakedMandegarScene({
  quality,
  projects,
  onFirstFrame,
}: {
  quality: SceneQuality;
  projects: SceneProject[];
  onFirstFrame?: () => void;
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
  const interactionAnchors = useMemo(
    () => resolveInteractionAnchors(exhibition),
    [exhibition],
  );
  const textures = useMemo(() => loadedTextures.map(prepareBakedTexture), [loadedTextures]);
  const runtimeRef = useRef<BakedSceneRuntime | null>(null);

  useEffect(() => {
    validateContractNodes(environmentGltf.scene, requiredEnvironmentNodes, "Environment GLB");
    validateContractNodes(exhibitionGltf.scene, requiredExhibitionNodes, "Exhibition GLB");
    validateInteractionAnchors(exhibitionGltf.scene);
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

  useEffect(() => () => interactionAnchors.dispose(), [interactionAnchors]);

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
    const nextRuntime: BakedSceneRuntime = {
      environment: environmentRuntime,
      central,
      left,
      right,
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
    world: Array.from({ length: 17 }, () => new THREE.Vector3()),
    projected: Array.from({ length: 17 }, () => new THREE.Vector3()),
    frame: 0,
  });

  const clearInteraction = useCallback(() => {
    document.body.style.cursor = "";
  }, []);
  const handlePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    const screenId = findScreenId(event.object);
    const station = screenId ? screenStations[screenId] : null;
    if (station && interactionRuntime.activeStation === station && event.uv) {
      event.stopPropagation();
      document.body.style.cursor = station === "game" || station === "stage" ? "pointer" : "crosshair";
      dispatchSceneInteraction(station, {
        phase: "move",
        x: THREE.MathUtils.clamp(event.uv.x, 0, 1),
        y: THREE.MathUtils.clamp(event.uv.y, 0, 1),
        pointerId: event.pointerId,
        input: event.pointerType === "touch" ? "touch" : "pointer",
      });
      return;
    }
    if (!station || interactionRuntime.availableStation !== station) {
      document.body.style.cursor = "";
      return;
    }
    event.stopPropagation();
    document.body.style.cursor = "pointer";
  }, []);
  const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    const screenId = findScreenId(event.object);
    const station = screenId ? screenStations[screenId] : null;
    if (!station || interactionRuntime.activeStation !== station || !event.uv) return;
    event.stopPropagation();
    const target = event.nativeEvent.target;
    if (target instanceof Element && "setPointerCapture" in target) {
      target.setPointerCapture(event.pointerId);
    }
    dispatchSceneInteraction(station, {
      phase: "down",
      x: THREE.MathUtils.clamp(event.uv.x, 0, 1),
      y: THREE.MathUtils.clamp(event.uv.y, 0, 1),
      pointerId: event.pointerId,
      input: event.pointerType === "touch" ? "touch" : "pointer",
    });
  }, []);
  const handlePointerEnd = useCallback((event: ThreeEvent<PointerEvent>) => {
    const screenId = findScreenId(event.object);
    const station = screenId ? screenStations[screenId] : null;
    if (!station || interactionRuntime.activeStation !== station || !event.uv) return;
    event.stopPropagation();
    dispatchSceneInteraction(station, {
      phase: event.type === "pointercancel" ? "cancel" : "up",
      x: THREE.MathUtils.clamp(event.uv.x, 0, 1),
      y: THREE.MathUtils.clamp(event.uv.y, 0, 1),
      pointerId: event.pointerId,
      input: event.pointerType === "touch" ? "touch" : "pointer",
    });
  }, []);
  const handlePointerOut = useCallback((event: ThreeEvent<PointerEvent>) => {
    const screenId = findScreenId(event.object);
    const station = screenId ? screenStations[screenId] : null;
    if (station && interactionRuntime.activeStation === station) {
      dispatchSceneInteraction(station, {
        phase: "cancel",
        x: event.uv ? THREE.MathUtils.clamp(event.uv.x, 0, 1) : 0.5,
        y: event.uv ? THREE.MathUtils.clamp(event.uv.y, 0, 1) : 0.5,
        pointerId: event.pointerId,
        input: event.pointerType === "touch" ? "touch" : "pointer",
      });
    }
    clearInteraction();
  }, [clearInteraction]);
  const handleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    const screenId = findScreenId(event.object);
    const station = screenId ? screenStations[screenId] : null;
    if (!station || !event.uv) return;
    if (interactionRuntime.activeStation === station) {
      event.stopPropagation();
      dispatchSceneInteraction(station, {
        phase: "activate",
        x: THREE.MathUtils.clamp(event.uv.x, 0, 1),
        y: THREE.MathUtils.clamp(event.uv.y, 0, 1),
        pointerId: 0,
        input: "pointer",
      });
      return;
    }
    if (interactionRuntime.availableStation !== station) return;
    event.stopPropagation();
    requestInteraction(station, "pointer");
  }, []);
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
    const scratch = projection.current;
    scratch.frame += 1;
    if (scratch.frame % 4 !== 0) return;
    environment.updateMatrixWorld(true);
    exhibition.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    let index = 0;
    const project = (anchor: { object: THREE.Object3D; fallback: boolean }) => {
      const point = projectObject(anchor, camera, size, scratch.world[index], scratch.projected[index]);
      index += 1;
      return point;
    };
    publishInteractionAnchors({
      stations: {
        photo: project(interactionAnchors.stations.photo),
        touch: project(interactionAnchors.stations.touch),
        stage: project(interactionAnchors.stations.stage),
        game: project(interactionAnchors.stations.game),
        draw: project(interactionAnchors.stations.draw),
      },
      photoFlash: project(interactionAnchors.photoFlash),
      photoPhone: project(interactionAnchors.photoPhone),
      beams: interactionAnchors.beamOrigins.map((origin, beamIndex) => ({
        origin: project(origin),
        target: project(interactionAnchors.beamTargets[beamIndex]),
      })),
    });
  });

  return (
    <group>
      <primitive object={environment} />
      <primitive
        object={exhibition}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      />
      <BakedScreenController root={exhibition} projects={projects} />
      <InteractionSceneCues anchors={interactionAnchors} />
      <InteractionPhotoEffects anchors={interactionAnchors} />
      <InteractionBeamEffects anchors={interactionAnchors} quality={quality} />
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
