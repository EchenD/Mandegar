"use client";

/* eslint-disable react-hooks/immutability -- R3F scene graphs and shader uniforms are mutated imperatively. */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { heroModelLoader, heroTextureLoader } from "./hero-loading";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { publicAssetPath } from "@/lib/public-asset-path";
import type { Locale } from "@/lib/i18n";
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
import { ComposerObjects } from "./ComposerObjects";
import { DeferredBakedCrowd } from "./BakedCrowd";
import { DataFlowNetwork } from "./DataFlowNetwork";
import { experienceState } from "./experience-state";
import type { SceneProject } from "./experience-types";
import { resolveInteractionAnchors, type InteractionAnchorRuntime } from "./interactions/interaction-anchors";
import { stageBeamColors } from "./interactions/interaction-palette";
import { getVisitorCreation } from "./interactions/visitor-creation";
import { photoScrollTiming } from "./interactions/scroll-scenes";
import { getVisitorPresentation } from "./interactions/visitor-presentation";
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
import { IntelligenceStationAnchors, canInspectIntelligenceStations } from "./IntelligenceStationAnchors";
import { getIntelligenceSnapshot, hoverIntelligenceStation, pinIntelligenceStation } from "./intelligence-inspector-store";

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
  const names = [
    ...Object.values(bakedSceneContract.exhibition.screens),
    ...bakedSceneContract.exhibition.interactionAnchors.beamEmitterMeshes,
  ];
  names.forEach((name) => {
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

// Photo flash volume controls. Direction uses world-space X/Y/Z and is normalized at runtime.
const photoFlashVolumeTuning = {
  direction: [0, 0, 1] as const,
  originOffset: [0, 0, 0] as const,
  length: 3.8,
  radius: 1,
  opacity: 0.42,
};

function createBeamFadeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "rgba(255,255,255,.06)");
    gradient.addColorStop(0.16, "rgba(255,255,255,.56)");
    gradient.addColorStop(0.72, "rgba(255,255,255,.32)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function createRadialLightTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 31);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.2, "rgba(255,255,255,.72)");
    gradient.addColorStop(0.58, "rgba(255,255,255,.2)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function createGameWaveTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(64, 64, 37, 64, 64, 62);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.58, "rgba(255,255,255,0)");
    gradient.addColorStop(0.76, "rgba(255,255,255,.9)");
    gradient.addColorStop(0.9, "rgba(255,255,255,.22)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function InteractionBeamEffects({
  anchors,
  quality,
  root,
}: {
  anchors: InteractionAnchorRuntime;
  quality: SceneQuality;
  root: THREE.Object3D;
}) {
  const rig = useMemo(() => {
    const group = new THREE.Group();
    group.name = "fxInteraction_stage_lighting";
    group.renderOrder = 6;

    const segmentCount = quality === "full" ? 20 : 12;
    const beamTexture = createBeamFadeTexture();
    const radialTexture = createRadialLightTexture();
    const beamGeometry = new THREE.CylinderGeometry(0.62, 0.025, 1, segmentCount, 1, true);
    const beamMaterial = new THREE.MeshBasicMaterial({
      map: beamTexture,
      transparent: true,
      opacity: quality === "full" ? 0.34 : 0.25,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      toneMapped: false,
    });
    const beams = new THREE.InstancedMesh(beamGeometry, beamMaterial, stageBeamColors.length);
    beams.name = "fxInteraction_stage_beam_volumes";
    beams.frustumCulled = false;
    beams.renderOrder = 6;
    beams.raycast = () => {};
    beams.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const poolGeometry = new THREE.CircleGeometry(0.78, segmentCount);
    poolGeometry.rotateX(-Math.PI / 2);
    const poolMaterial = new THREE.MeshBasicMaterial({
      map: radialTexture,
      transparent: true,
      opacity: quality === "full" ? 0.9 : 0.72,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const pools = new THREE.InstancedMesh(poolGeometry, poolMaterial, stageBeamColors.length);
    pools.name = "fxInteraction_stage_floor_pools";
    pools.frustumCulled = false;
    pools.renderOrder = 7;
    pools.raycast = () => {};
    pools.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const flareGeometry = new THREE.BufferGeometry();
    const flarePositions = new Float32Array(stageBeamColors.length * 3);
    const flareColors = new Float32Array(stageBeamColors.length * 3);
    flareGeometry.setAttribute("position", new THREE.BufferAttribute(flarePositions, 3));
    flareGeometry.setAttribute("color", new THREE.BufferAttribute(flareColors, 3));
    const flareMaterial = new THREE.PointsMaterial({
      map: radialTexture,
      size: quality === "full" ? 0.22 : 0.17,
      sizeAttenuation: true,
      transparent: true,
      opacity: quality === "full" ? 0.96 : 0.76,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      toneMapped: false,
    });
    const flares = new THREE.Points(flareGeometry, flareMaterial);
    flares.name = "fxInteraction_stage_emitter_flares";
    flares.frustumCulled = false;
    flares.renderOrder = 8;
    flares.raycast = () => {};

    const emitterBindings: Array<{
      mesh: THREE.Mesh;
      originalMaterial: THREE.Material | THREE.Material[];
      material: THREE.MeshBasicMaterial;
      beamIndex: number;
    }> = [];
    bakedSceneContract.exhibition.interactionAnchors.beamEmitterMeshes.forEach((name, beamIndex) => {
      root.getObjectByName(name)?.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const material = new THREE.MeshBasicMaterial({
          color: 0x000000,
          transparent: false,
          opacity: 1,
          depthTest: true,
          depthWrite: true,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
          toneMapped: false,
        });
        emitterBindings.push({
          mesh: object,
          originalMaterial: object.material,
          material,
          beamIndex,
        });
      });
    });

    const origins: THREE.Vector3[] = [];
    const targets: THREE.Vector3[] = [];
    const midpoints: THREE.Vector3[] = [];
    const directions: THREE.Quaternion[] = [];
    const lengths: number[] = [];
    const colors = stageBeamColors.map((color) => new THREE.Color(color));
    const up = new THREE.Vector3(0, 1, 0);
    const initialMatrix = new THREE.Matrix4().makeScale(0.001, 0.001, 0.001);

    anchors.beamOrigins.forEach((origin, index) => {
      const start = origin.object.getWorldPosition(new THREE.Vector3());
      const end = anchors.beamTargets[index].object.getWorldPosition(new THREE.Vector3());
      const direction = end.clone().sub(start);
      const length = direction.length();
      origins.push(start);
      targets.push(end.clone().add(new THREE.Vector3(0, 0.012, 0)));
      midpoints.push(start.clone().add(end).multiplyScalar(0.5));
      directions.push(new THREE.Quaternion().setFromUnitVectors(up, direction.normalize()));
      lengths.push(length);
      flarePositions.set(start.toArray(), index * 3);
      beams.setMatrixAt(index, initialMatrix);
      pools.setMatrixAt(index, initialMatrix);
      beams.setColorAt(index, new THREE.Color(0));
      pools.setColorAt(index, new THREE.Color(0));
    });
    beams.instanceMatrix.needsUpdate = true;
    pools.instanceMatrix.needsUpdate = true;
    beams.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    pools.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    (flareGeometry.getAttribute("color") as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);

    group.add(beams, pools, flares);
    return {
      group,
      beams,
      pools,
      flares,
      beamGeometry,
      beamMaterial,
      beamTexture,
      poolGeometry,
      poolMaterial,
      flareGeometry,
      flareMaterial,
      radialTexture,
      origins,
      targets,
      midpoints,
      directions,
      lengths,
      colors,
      emitterBindings,
      intensities: new Float32Array(stageBeamColors.length),
      playbackAge: 0,
      wasComplete: false,
      finaleAge: Number.POSITIVE_INFINITY,
      beamMatrix: new THREE.Matrix4(),
      poolMatrix: new THREE.Matrix4(),
      beamScale: new THREE.Vector3(),
      poolScale: new THREE.Vector3(),
      poolQuaternion: new THREE.Quaternion(),
      workingColor: new THREE.Color(),
    };
  }, [anchors, quality, root]);

  useFrame((_, delta) => {
    if (interactionRuntime.stageComplete && interactionRuntime.activeBeams.every(Boolean) && !rig.wasComplete) rig.finaleAge = 0;
    rig.wasComplete = interactionRuntime.stageComplete;
    rig.finaleAge += delta;
    const finaleProgress = Math.min(1, rig.finaleAge / 1.05);
    const inStage = interactionRuntime.stageProgress > 0 && interactionRuntime.stageProgress < 1;
    const finalePulse = inStage
      ? Math.sin(THREE.MathUtils.smoothstep(interactionRuntime.stageProgress, 0.7, 0.88) * Math.PI)
      : rig.finaleAge < 1.05 ? Math.sin(finaleProgress * Math.PI) : 0;
    const lighting = inStage ? interactionRuntime.activeBeams : getVisitorCreation().lighting;
    const presentation = getVisitorPresentation(experienceState.progress);
    const showingSavedLighting = !inStage && experienceState.sequence === "loop";
    const visibility = inStage
      ? Math.max(interactionRuntime.stageVisibility, interactionRuntime.stageComplete ? presentation.lightingVisibility * 0.45 : 0)
      : showingSavedLighting ? presentation.lightingVisibility * 0.45 : 0;
    const selectedCount = lighting.reduce((count, enabled) => count + Number(enabled), 0);
    const buildDuration = Math.max(0, selectedCount - 1) * 0.65 + 0.5;
    const holdUntil = buildDuration + 1.5;
    const cycleDuration = holdUntil + 1.1;
    if (inStage) {
      rig.playbackAge = buildDuration;
    } else if (selectedCount > 0 && showingSavedLighting && presentation.lightingPlayback) {
      rig.playbackAge = (rig.playbackAge + Math.min(delta, 0.1)) % cycleDuration;
    }
    const fade = 1 - THREE.MathUtils.smoothstep(rig.playbackAge, holdUntil, holdUntil + 0.9);
    const flareColors = rig.flareGeometry.getAttribute("color") as THREE.BufferAttribute;
    let visibleEnergy = 0;
    let selectedIndex = 0;

    rig.intensities.forEach((current, index) => {
      const enabled = lighting[index] ?? false;
      const revealStart = selectedIndex * 0.65;
      const reveal = THREE.MathUtils.smoothstep(rig.playbackAge, revealStart, revealStart + 0.5);
      const playback = inStage ? 1 : 0.14 + 0.86 * reveal * fade;
      if (enabled) selectedIndex += 1;
      const target = enabled ? visibility * playback * (inStage ? interactionRuntime.beamIntensities[index] : 1) * (quality === "full" ? 1 : 0.8) : 0;
      const intensity = THREE.MathUtils.damp(current, target, enabled ? 10 : 14, delta);
      rig.intensities[index] = intensity;
      visibleEnergy += intensity;
      const energy = intensity * (1 + finalePulse * 0.62);
      const radiusPulse = 1 + finalePulse * 0.12;

      rig.beamScale.set(radiusPulse, rig.lengths[index], radiusPulse);
      rig.beamMatrix.compose(rig.midpoints[index], rig.directions[index], rig.beamScale);
      rig.beams.setMatrixAt(index, rig.beamMatrix);
      rig.workingColor.copy(rig.colors[index]).multiplyScalar(energy);
      rig.beams.setColorAt(index, rig.workingColor);

      const poolSize = Math.max(0.001, intensity * (1 + finalePulse * 0.28));
      rig.poolScale.set(poolSize, poolSize, poolSize);
      rig.poolMatrix.compose(rig.targets[index], rig.poolQuaternion, rig.poolScale);
      rig.pools.setMatrixAt(index, rig.poolMatrix);
      rig.pools.setColorAt(index, rig.workingColor);

      flareColors.setXYZ(
        index,
        rig.workingColor.r,
        rig.workingColor.g,
        rig.workingColor.b,
      );
    });
    rig.emitterBindings.forEach(({ material, beamIndex }) => {
      const qualityScale = quality === "full" ? 1 : 0.8;
      const colorStrength = THREE.MathUtils.clamp(
        rig.intensities[beamIndex] / qualityScale,
        0,
        1,
      );
      material.color.copy(rig.colors[beamIndex]).multiplyScalar(colorStrength);
    });
    rig.group.visible = visibleEnergy > 0.002;
    rig.beams.instanceMatrix.needsUpdate = true;
    rig.beams.instanceColor!.needsUpdate = true;
    rig.pools.instanceMatrix.needsUpdate = true;
    rig.pools.instanceColor!.needsUpdate = true;
    flareColors.needsUpdate = true;
  });

  useEffect(() => {
    rig.emitterBindings.forEach(({ mesh, material }) => {
      mesh.material = material;
      material.needsUpdate = true;
    });

    return () => {
      rig.emitterBindings.forEach(({ mesh, originalMaterial, material }) => {
        if (mesh.material === material) mesh.material = originalMaterial;
        material.dispose();
      });
      rig.beamGeometry.dispose();
      rig.beamMaterial.dispose();
      rig.beamTexture.dispose();
      rig.poolGeometry.dispose();
      rig.poolMaterial.dispose();
      rig.flareGeometry.dispose();
      rig.flareMaterial.dispose();
      rig.radialTexture.dispose();
    };
  }, [rig]);

  return <primitive object={rig.group} />;
}

function getWorldPointAtUv(
  root: THREE.Object3D,
  targetU: number,
  targetV: number,
): THREE.Vector3 | null {
  let result: THREE.Vector3 | null = null;
  root.updateWorldMatrix(true, true);
  root.traverse((object) => {
    if (result || !(object instanceof THREE.Mesh)) return;
    const positions = object.geometry.getAttribute("position");
    const uvs = object.geometry.getAttribute("uv");
    if (!positions || !uvs) return;
    const indices = object.geometry.index;
    const triangleCount = indices ? indices.count : positions.count;
    for (let offset = 0; offset <= triangleCount - 3; offset += 3) {
      const a = indices ? indices.getX(offset) : offset;
      const b = indices ? indices.getX(offset + 1) : offset + 1;
      const c = indices ? indices.getX(offset + 2) : offset + 2;
      const au = uvs.getX(a);
      const av = uvs.getY(a);
      const bu = uvs.getX(b);
      const bv = uvs.getY(b);
      const cu = uvs.getX(c);
      const cv = uvs.getY(c);
      const denominator = (bv - cv) * (au - cu) + (cu - bu) * (av - cv);
      if (Math.abs(denominator) < 1e-8) continue;
      const weightA = ((bv - cv) * (targetU - cu) + (cu - bu) * (targetV - cv)) / denominator;
      const weightB = ((cv - av) * (targetU - cu) + (au - cu) * (targetV - cv)) / denominator;
      const weightC = 1 - weightA - weightB;
      if (weightA < -1e-4 || weightB < -1e-4 || weightC < -1e-4) continue;
      result = new THREE.Vector3(
        positions.getX(a) * weightA + positions.getX(b) * weightB + positions.getX(c) * weightC,
        positions.getY(a) * weightA + positions.getY(b) * weightB + positions.getY(c) * weightC,
        positions.getZ(a) * weightA + positions.getZ(b) * weightB + positions.getZ(c) * weightC,
      ).applyMatrix4(object.matrixWorld);
      break;
    }
  });
  return result;
}

type ScenePointerCapture = {
  setPointerCapture: (pointerId: number) => void;
  releasePointerCapture: (pointerId: number) => void;
};

type GamePointerProjection = {
  pointerId: number;
  capture: ScenePointerCapture;
  input: "pointer" | "touch";
  origin: THREE.Vector3;
  uAxis: THREE.Vector3;
  vAxis: THREE.Vector3;
  plane: THREE.Plane;
  point: THREE.Vector3;
  uu: number;
  uv: number;
  vv: number;
  determinant: number;
  x: number;
  y: number;
};

function createGamePointerProjection(screen: THREE.Object3D, event: ThreeEvent<PointerEvent>): GamePointerProjection | null {
  const origin = getWorldPointAtUv(screen, 0.5, 0.5);
  const right = getWorldPointAtUv(screen, 0.6, 0.5);
  const up = getWorldPointAtUv(screen, 0.5, 0.6);
  if (!origin || !right || !up || !event.uv) return null;
  const uAxis = right.sub(origin).multiplyScalar(10);
  const vAxis = up.sub(origin).multiplyScalar(10);
  const uu = uAxis.dot(uAxis);
  const uv = uAxis.dot(vAxis);
  const vv = vAxis.dot(vAxis);
  const determinant = uu * vv - uv * uv;
  if (Math.abs(determinant) < 1e-8) return null;
  return {
    pointerId: event.pointerId,
    capture: event.target as unknown as ScenePointerCapture,
    input: event.pointerType === "touch" ? "touch" : "pointer",
    origin,
    uAxis,
    vAxis,
    plane: new THREE.Plane().setFromNormalAndCoplanarPoint(uAxis.clone().cross(vAxis).normalize(), origin),
    point: new THREE.Vector3(),
    uu,
    uv,
    vv,
    determinant,
    x: event.uv.x,
    y: event.uv.y,
  };
}

function projectGamePointer(ray: THREE.Ray, pointer: GamePointerProjection) {
  if (!ray.intersectPlane(pointer.plane, pointer.point)) return;
  pointer.point.sub(pointer.origin);
  const u = pointer.point.dot(pointer.uAxis);
  const v = pointer.point.dot(pointer.vAxis);
  pointer.x = 0.5 + (u * pointer.vv - v * pointer.uv) / pointer.determinant;
  pointer.y = 0.5 + (v * pointer.uu - u * pointer.uv) / pointer.determinant;
}

function NarrativeParticles({
  environment,
  exhibition,
  quality,
}: {
  environment: THREE.Object3D;
  exhibition: THREE.Object3D;
  quality: SceneQuality;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!group.current) return;
    group.current.visible = experienceState.narrative.phase !== "engagement"
      && interactionRuntime.activeStation !== "touch";
  });
  return (
    <group ref={group} name="fxNarrative_ambient_particles">
      <TransitionParticleField environment={environment} exhibition={exhibition} quality={quality} />
      <AmbientDust exhibition={exhibition} quality={quality} />
    </group>
  );
}

function InteractionGameEffects({
  anchors,
  quality,
  screen,
}: {
  anchors: InteractionAnchorRuntime;
  quality: SceneQuality;
  screen: THREE.Object3D | null;
}) {
  const camera = useThree((state) => state.camera);
  const rig = useMemo(() => {
    const group = new THREE.Group();
    group.name = "fxInteraction_game_breakout";
    const center = screen
      ? getWorldPointAtUv(screen, 0.5, 0.5)
      : anchors.stations.game.object.getWorldPosition(new THREE.Vector3());
    const screenCenter = center ?? anchors.stations.game.object.getWorldPosition(new THREE.Vector3());
    const right = screen ? getWorldPointAtUv(screen, 0.6, 0.5) : null;
    const down = screen ? getWorldPointAtUv(screen, 0.5, 0.6) : null;
    const xAxis = right
      ? right.clone().sub(screenCenter).multiplyScalar(10)
      : new THREE.Vector3(1, 0, 0);
    const yAxis = down
      ? down.clone().sub(screenCenter).multiplyScalar(10)
      : new THREE.Vector3(0, -1.3, 0);
    const normal = xAxis.clone().cross(yAxis).normalize();
    if (normal.dot(camera.position.clone().sub(screenCenter)) < 0) normal.negate();
    const scale = Math.max(0.2, Math.min(xAxis.length(), yAxis.length()));
    const texture = createGameWaveTexture();
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: "#75d8ff",
      transparent: true,
      opacity: 0,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const impact = new THREE.Sprite(material);
    impact.name = "fxInteraction_game_block_light";
    impact.renderOrder = 18;
    impact.frustumCulled = false;
    impact.raycast = () => {};
    group.add(impact);
    return {
      group,
      screenCenter,
      xAxis,
      yAxis,
      normal,
      scale,
      texture,
      material,
      impact,
      observedHitId: interactionRuntime.gameHitId,
      age: Number.POSITIVE_INFINITY,
    };
  }, [anchors, camera, screen]);

  useFrame((_, delta) => {
    if (interactionRuntime.gameHitId !== rig.observedHitId) {
      rig.observedHitId = interactionRuntime.gameHitId;
      rig.age = 0;
      rig.impact.position.copy(rig.screenCenter)
        .addScaledVector(rig.xAxis, interactionRuntime.gameHitX - 0.5)
        .addScaledVector(rig.yAxis, interactionRuntime.gameHitY - 0.5)
        .addScaledVector(rig.normal, rig.scale * 0.035);
    } else {
      rig.age += delta;
    }
    const progress = Math.min(1, rig.age / 0.45);
    const visibility = interactionRuntime.gameVisibility;
    rig.group.visible = visibility > 0.001 && progress < 1;
    rig.material.opacity = Math.sin(progress * Math.PI) * (quality === "full" ? 0.28 : 0.2) * visibility;
    rig.impact.scale.setScalar(rig.scale * (0.06 + progress * 0.34));
  });

  useEffect(() => () => {
    rig.material.dispose();
    rig.texture.dispose();
  }, [rig]);

  return <primitive object={rig.group} />;
}

function InteractionPhotoEffects({ anchors }: { anchors: InteractionAnchorRuntime }) {
  const portraitSource = useLoader(
    heroTextureLoader,
    publicAssetPath("/media/placeholders/photo-experience.webp"),
  );
  const group = useMemo(() => {
    const next = new THREE.Group();
    next.name = "fxInteraction_photo_result";
    const interfaceOrigin = anchors.stations.photo.object.getWorldPosition(new THREE.Vector3());
    const flashPosition = anchors.photoFlash.object.getWorldPosition(new THREE.Vector3());
    const phoneDestination = anchors.photoPhone.object.getWorldPosition(new THREE.Vector3());
    const photoExitPosition = phoneDestination.clone()
      .lerp(interfaceOrigin, 0.38)
      .add(new THREE.Vector3(0, 0.34, 0));
    const portraitControlPoint = flashPosition.clone()
      .lerp(phoneDestination, 0.5)
      .add(new THREE.Vector3(0, 0.72, 0));
    const interfaceCanvas = document.createElement("canvas");
    interfaceCanvas.width = 2;
    interfaceCanvas.height = 2;
    const interfaceTexture = new THREE.CanvasTexture(interfaceCanvas);
    interfaceTexture.colorSpace = THREE.SRGBColorSpace;
    interfaceTexture.generateMipmaps = false;
    interfaceTexture.minFilter = THREE.LinearFilter;
    interfaceTexture.magFilter = THREE.LinearFilter;
    const interfaceMaterial = new THREE.SpriteMaterial({
      map: interfaceTexture,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const photoInterface = new THREE.Sprite(interfaceMaterial);
    photoInterface.name = "fxInteraction_photo_interface";
    photoInterface.position.copy(interfaceOrigin);
    photoInterface.scale.set(0.12, 0.078, 1);
    photoInterface.renderOrder = 54;
    photoInterface.frustumCulled = false;
    photoInterface.visible = false;
    photoInterface.raycast = () => {};
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
      color: "#f3eee7",
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const phoneFrame = new THREE.Sprite(phoneFrameMaterial);
    phoneFrame.name = "fxInteraction_photo_phone_frame";
    phoneFrame.position.copy(flashPosition);
    phoneFrame.scale.set(0.06, 0.1, 1);
    phoneFrame.renderOrder = 52;
    phoneFrame.visible = false;
    phoneFrame.userData.photoControl = "replay";
    const phone = new THREE.Sprite(phoneMaterial);
    phone.name = "fxInteraction_photo_phone_result";
    phone.position.copy(flashPosition);
    phone.scale.set(0.05, 0.08, 1);
    phone.renderOrder = 53;
    phone.visible = false;
    phone.userData.photoControl = "replay";
    const flashVolumeTexture = createBeamFadeTexture();
    const flashVolumeGeometry = new THREE.CylinderGeometry(
      photoFlashVolumeTuning.radius,
      0.02,
      1,
      20,
      1,
      true,
    );
    const flashVolumeMaterial = new THREE.MeshBasicMaterial({
      map: flashVolumeTexture,
      color: "#d8eeff",
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
      side: THREE.BackSide,
      toneMapped: false,
    });
    const flashVolume = new THREE.Mesh(flashVolumeGeometry, flashVolumeMaterial);
    const flashDirection = new THREE.Vector3(...photoFlashVolumeTuning.direction).normalize();
    const flashOrigin = flashPosition.clone().add(
      new THREE.Vector3(...photoFlashVolumeTuning.originOffset),
    );
    flashVolume.name = "fxInteraction_photo_flash_volume";
    flashVolume.position.copy(flashOrigin).addScaledVector(
      flashDirection,
      photoFlashVolumeTuning.length * 0.5,
    );
    flashVolume.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), flashDirection);
    flashVolume.scale.set(1, photoFlashVolumeTuning.length, 1);
    flashVolume.renderOrder = 49;
    flashVolume.frustumCulled = false;
    flashVolume.visible = false;
    flashVolume.raycast = () => {};
    const trailPositions = new Float32Array(18 * 3);
    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3));
    const trailMaterial = new THREE.LineBasicMaterial({
      color: "#75d8ff",
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const portraitTrail = new THREE.Line(trailGeometry, trailMaterial);
    portraitTrail.name = "fxInteraction_photo_portrait_trail";
    portraitTrail.renderOrder = 51;
    portraitTrail.frustumCulled = false;
    portraitTrail.raycast = () => {};
    portraitTrail.visible = false;
    const flashLight = new THREE.PointLight("#d8eeff", 0, 4.8, 2);
    flashLight.name = "fxInteraction_photo_flash_light";
    flashLight.position.copy(flashPosition);
    next.add(
      flashVolume,
      portraitTrail,
      photoInterface,
      phoneFrame,
      phone,
      flashLight,
    );
    next.userData.photoInterface = photoInterface;
    next.userData.interfaceMaterial = interfaceMaterial;
    next.userData.interfaceTexture = interfaceTexture;
    next.userData.phoneFrame = phoneFrame;
    next.userData.phoneFrameMaterial = phoneFrameMaterial;
    next.userData.phone = phone;
    next.userData.phoneMaterial = phoneMaterial;
    next.userData.portrait = portrait;
    next.userData.flashVolume = flashVolume;
    next.userData.flashVolumeGeometry = flashVolumeGeometry;
    next.userData.flashVolumeMaterial = flashVolumeMaterial;
    next.userData.flashVolumeTexture = flashVolumeTexture;
    next.userData.portraitTrail = portraitTrail;
    next.userData.trailGeometry = trailGeometry;
    next.userData.trailMaterial = trailMaterial;
    next.userData.trailPositions = trailPositions;
    next.userData.flashLight = flashLight;
    next.userData.interfaceOrigin = interfaceOrigin;
    next.userData.flashPosition = flashPosition;
    next.userData.phoneDestination = phoneDestination;
    next.userData.photoExitPosition = photoExitPosition;
    next.userData.portraitControlPoint = portraitControlPoint;
    next.userData.workingPosition = new THREE.Vector3();
    return next;
  }, [anchors, portraitSource]);
  const previousStep = useRef(interactionRuntime.photoStep);
  const flashAge = useRef(1);
  const captureAge = useRef(1);
  const surfaceTexture = useRef<{
    canvas: HTMLCanvasElement;
    revision: number;
    texture: THREE.CanvasTexture;
  } | null>(null);

  useFrame((_, delta) => {
    const photoInterface = group.userData.photoInterface as THREE.Sprite;
    const interfaceMaterial = group.userData.interfaceMaterial as THREE.SpriteMaterial;
    const phone = group.userData.phone as THREE.Sprite;
    const phoneMaterial = group.userData.phoneMaterial as THREE.SpriteMaterial;
    const phoneFrame = group.userData.phoneFrame as THREE.Sprite;
    const phoneFrameMaterial = group.userData.phoneFrameMaterial as THREE.SpriteMaterial;
    const flashVolume = group.userData.flashVolume as THREE.Mesh;
    const flashVolumeMaterial = group.userData.flashVolumeMaterial as THREE.MeshBasicMaterial;
    const portraitTrail = group.userData.portraitTrail as THREE.Line;
    const trailMaterial = group.userData.trailMaterial as THREE.LineBasicMaterial;
    const trailPositions = group.userData.trailPositions as Float32Array;
    const trailPositionAttribute = (group.userData.trailGeometry as THREE.BufferGeometry)
      .getAttribute("position") as THREE.BufferAttribute;
    const flashLight = group.userData.flashLight as THREE.PointLight;
    const surface = interactionRuntime.photoSurface;
    if (surface && surfaceTexture.current?.canvas !== surface.canvas) {
      surfaceTexture.current?.texture.dispose();
      const texture = new THREE.CanvasTexture(surface.canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;
      surfaceTexture.current = {
        canvas: surface.canvas,
        revision: surface.revision,
        texture,
      };
      interfaceMaterial.map = texture;
      interfaceMaterial.needsUpdate = true;
    } else if (surface && surfaceTexture.current?.revision !== surface.revision) {
      surfaceTexture.current!.revision = surface.revision;
      surfaceTexture.current!.texture.needsUpdate = true;
    }
    const step = interactionRuntime.photoStep;
    const interfaceTarget = interactionRuntime.photoVisibility;
    const exitProgress = step === "captured"
      ? THREE.MathUtils.smoothstep(THREE.MathUtils.clamp(1 - interfaceTarget, 0, 1), 0, 1)
      : 0;
    interfaceMaterial.opacity = THREE.MathUtils.damp(
      interfaceMaterial.opacity,
      step === "countdown" ? interfaceTarget : 0,
      10,
      delta,
    );
    const photoExitPosition = group.userData.photoExitPosition as THREE.Vector3;
    const workingPosition = group.userData.workingPosition as THREE.Vector3;
    const targetInterfaceScale = step === "countdown" ? 0.74 : 0.078;
    const interfaceScale = THREE.MathUtils.damp(
      photoInterface.scale.y,
      interfaceTarget > 0.001 ? targetInterfaceScale : 0.078,
      9,
      delta,
    );
    photoInterface.scale.set(interfaceScale * (800 / 520), interfaceScale, 1);
    photoInterface.visible = interfaceMaterial.opacity > 0.002;
    if (step === "captured" && previousStep.current !== "captured") {
      flashAge.current = 0;
      captureAge.current = 0;
    }
    if (step !== "captured" && previousStep.current === "captured") {
      phoneMaterial.opacity = 0;
      phoneFrameMaterial.opacity = 0;
      phone.visible = false;
      phoneFrame.visible = false;
      portraitTrail.visible = false;
      trailMaterial.opacity = 0;
    }
    previousStep.current = step;
    const showPhone = step === "captured";
    // Sample the existing flight and flash from scroll instead of elapsed time.
    // Pausing scroll holds the photograph; reversing retraces the same curve.
    captureAge.current = showPhone ? Math.max(0, (interactionRuntime.photoProgress - photoScrollTiming.capture) / (photoScrollTiming.deliveryEnd - photoScrollTiming.capture)) * 0.92 : 1;
    flashAge.current = showPhone ? Math.max(0, (interactionRuntime.photoProgress - photoScrollTiming.capture) / 0.06) * 0.52 : 1;
    phone.visible = showPhone || phoneMaterial.opacity > 0.01;
    phoneFrame.visible = phone.visible;
    const phoneTargetOpacity = showPhone ? Math.pow(interfaceTarget, 1.35) : 0;
    phoneMaterial.opacity = THREE.MathUtils.damp(phoneMaterial.opacity, phoneTargetOpacity, 11, delta);
    phoneFrameMaterial.opacity = phoneMaterial.opacity;
    if (showPhone) {
      const progress = THREE.MathUtils.smoothstep(
        THREE.MathUtils.clamp(captureAge.current / 0.92, 0, 1),
        0,
        1,
      );
      const inverse = 1 - progress;
      const flashPosition = group.userData.flashPosition as THREE.Vector3;
      const control = group.userData.portraitControlPoint as THREE.Vector3;
      const destination = group.userData.phoneDestination as THREE.Vector3;
      workingPosition.set(0, 0, 0)
        .addScaledVector(flashPosition, inverse * inverse)
        .addScaledVector(control, 2 * inverse * progress)
        .addScaledVector(destination, progress * progress);
      workingPosition.lerp(photoExitPosition, exitProgress);
      phone.position.copy(workingPosition);
      phoneFrame.position.copy(workingPosition);
      if (exitProgress > 0.001) {
        for (let index = 0; index < 18; index += 1) {
          const trailProgress = index / 17;
          const positionOffset = index * 3;
          trailPositions[positionOffset] = THREE.MathUtils.lerp(
            destination.x,
            workingPosition.x,
            trailProgress,
          );
          trailPositions[positionOffset + 1] = THREE.MathUtils.lerp(
            destination.y,
            workingPosition.y,
            trailProgress,
          );
          trailPositions[positionOffset + 2] = THREE.MathUtils.lerp(
            destination.z,
            workingPosition.z,
            trailProgress,
          );
        }
      } else {
        const trailStart = Math.max(0, progress - 0.24);
        for (let index = 0; index < 18; index += 1) {
          const trailProgress = trailStart + (progress - trailStart) * (index / 17);
          const trailInverse = 1 - trailProgress;
          const positionOffset = index * 3;
          trailPositions[positionOffset] = flashPosition.x * trailInverse * trailInverse
            + control.x * 2 * trailInverse * trailProgress
            + destination.x * trailProgress * trailProgress;
          trailPositions[positionOffset + 1] = flashPosition.y * trailInverse * trailInverse
            + control.y * 2 * trailInverse * trailProgress
            + destination.y * trailProgress * trailProgress;
          trailPositions[positionOffset + 2] = flashPosition.z * trailInverse * trailInverse
            + control.z * 2 * trailInverse * trailProgress
            + destination.z * trailProgress * trailProgress;
        }
      }
      trailPositionAttribute.needsUpdate = true;
      trailMaterial.opacity = exitProgress > 0.001
        ? Math.sin(exitProgress * Math.PI) * 0.38
        : Math.sin(progress * Math.PI) * 0.62;
      portraitTrail.visible = exitProgress > 0.001
        ? exitProgress < 0.99
        : progress > 0.01 && progress < 0.99;
      phoneMaterial.rotation = -0.035 + (1 - progress) * -0.13 + exitProgress * 0.1;
      phoneFrameMaterial.rotation = phoneMaterial.rotation;
    } else if (phoneMaterial.opacity < 0.02) {
      phone.position.copy(group.userData.flashPosition as THREE.Vector3);
      phoneFrame.position.copy(group.userData.flashPosition as THREE.Vector3);
      portraitTrail.visible = false;
      trailMaterial.opacity = 0;
      phoneMaterial.rotation = 0;
      phoneFrameMaterial.rotation = 0;
    }
    const travelScale = showPhone
      ? THREE.MathUtils.smoothstep(THREE.MathUtils.clamp(captureAge.current / 0.72, 0, 1), 0, 1)
      : 0;
    const exitScale = 1 - exitProgress * 0.58;
    const scale = THREE.MathUtils.damp(
      phoneFrame.scale.y,
      showPhone ? (0.16 + travelScale * 0.5) * exitScale : 0.08,
      8,
      delta,
    );
    phoneFrame.scale.set(scale * 0.6, scale, 1);
    phone.scale.set(scale * 0.52, scale * 0.92, 1);
    const volumeProgress = THREE.MathUtils.clamp(flashAge.current / 0.52, 0, 1);
    const volumeEnergy = Math.pow(1 - volumeProgress, 2);
    flashVolumeMaterial.opacity = volumeEnergy * photoFlashVolumeTuning.opacity;
    const volumeScale = 0.92 + volumeProgress * 0.18;
    flashVolume.scale.set(
      volumeScale,
      photoFlashVolumeTuning.length,
      volumeScale,
    );
    flashVolume.visible = flashVolumeMaterial.opacity > 0.002;
    const flashProgress = THREE.MathUtils.clamp(flashAge.current / 0.32, 0, 1);
    flashLight.intensity = Math.pow(1 - flashProgress, 2) * 38;
  });

  useEffect(() => () => {
    surfaceTexture.current?.texture.dispose();
    (group.userData.interfaceMaterial as THREE.Material).dispose();
    (group.userData.interfaceTexture as THREE.Texture).dispose();
    (group.userData.phoneMaterial as THREE.Material).dispose();
    (group.userData.phoneFrameMaterial as THREE.Material).dispose();
    (group.userData.portrait as THREE.Texture).dispose();
    (group.userData.flashVolumeGeometry as THREE.BufferGeometry).dispose();
    (group.userData.flashVolumeMaterial as THREE.Material).dispose();
    (group.userData.flashVolumeTexture as THREE.Texture).dispose();
    (group.userData.trailGeometry as THREE.BufferGeometry).dispose();
    (group.userData.trailMaterial as THREE.Material).dispose();
  }, [group]);

  const dispatchPhotoPointer = useCallback((
    phase: "down" | "move" | "up" | "cancel",
    event: ThreeEvent<PointerEvent>,
  ) => {
    if (interactionRuntime.activeStation !== "photo" || !event.uv) return;
    event.stopPropagation();
    const directControl = event.object.userData.photoControl as "replay" | undefined;
    if (directControl && captureAge.current < 1) return;
    dispatchSceneInteraction("photo", {
      phase,
      x: directControl === "replay" ? 0.425 : THREE.MathUtils.clamp(event.uv.x, 0, 1),
      y: directControl === "replay" ? 0.83 : THREE.MathUtils.clamp(1 - event.uv.y, 0, 1),
      pointerId: event.pointerId,
      input: event.pointerType === "touch" ? "touch" : "pointer",
    });
  }, []);

  return (
    <primitive
      object={group}
      onPointerMove={(event: ThreeEvent<PointerEvent>) => {
        document.body.style.cursor = "pointer";
        dispatchPhotoPointer("move", event);
      }}
      onPointerDown={(event: ThreeEvent<PointerEvent>) => dispatchPhotoPointer("down", event)}
      onPointerUp={(event: ThreeEvent<PointerEvent>) => dispatchPhotoPointer("up", event)}
      onPointerCancel={(event: ThreeEvent<PointerEvent>) => dispatchPhotoPointer("cancel", event)}
      onPointerOut={(event: ThreeEvent<PointerEvent>) => {
        document.body.style.cursor = "";
        dispatchPhotoPointer("cancel", event);
      }}
    />
  );
}

export function BakedMandegarScene({
  locale,
  quality,
  projects,
  onFirstFrame,
}: {
  locale: Locale;
  quality: SceneQuality;
  projects: SceneProject[];
  onFirstFrame?: () => void;
}) {
  const { camera, gl, scene, size } = useThree();
  const environmentGltf = useLoader(heroModelLoader, assetSlots.environment);
  const exhibitionGltf = useLoader(heroModelLoader, assetSlots.exhibition);
  const textureAssets = assetSlots.bakedTextures[quality];
  const loadedTextures = useLoader(heroTextureLoader, [
    textureAssets.environmentQuiet,
    textureAssets.environmentPeak,
    textureAssets.exhibitionQuiet,
    textureAssets.exhibitionPeak,
  ]);
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
  const textures = useMemo(() => {
    const maximum = gl.capabilities.getMaxAnisotropy();
    const anisotropy = Math.min(maximum, quality === "full" ? 8 : 4);
    return loadedTextures.map((texture) => prepareBakedTexture(texture, anisotropy));
  }, [gl, loadedTextures, quality]);
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
  const suppressedScreenClick = useRef<{
    station: InteractionStation;
    until: number;
  } | null>(null);
  const gamePointer = useRef<GamePointerProjection | null>(null);

  const releaseGamePointer = useCallback(() => {
    const pointer = gamePointer.current;
    gamePointer.current = null;
    if (pointer && gl.domElement.hasPointerCapture(pointer.pointerId)) {
      pointer.capture.releasePointerCapture(pointer.pointerId);
    }
  }, [gl]);
  const cancelGamePointer = useCallback(() => {
    const pointer = gamePointer.current;
    if (!pointer) return;
    dispatchSceneInteraction("game", {
      phase: "cancel",
      x: pointer.x,
      y: pointer.y,
      pointerId: pointer.pointerId,
      input: pointer.input,
    });
    releaseGamePointer();
  }, [releaseGamePointer]);

  const clearInteraction = useCallback(() => {
    document.body.style.cursor = "";
  }, []);
  const handlePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    const pointer = gamePointer.current;
    if (pointer && interactionRuntime.activeStation === "game") {
      event.stopPropagation();
      if (pointer.pointerId !== event.pointerId) return;
      projectGamePointer(event.ray, pointer);
      document.body.style.cursor = "ew-resize";
      dispatchSceneInteraction("game", {
        phase: "move",
        x: pointer.x,
        y: pointer.y,
        pointerId: pointer.pointerId,
        input: pointer.input,
      });
      return;
    }
    const screenId = findScreenId(event.object);
    const station = screenId ? screenStations[screenId] : null;
    if (canInspectIntelligenceStations()) {
      if (station) {
        event.stopPropagation();
        if (event.pointerType !== "touch") hoverIntelligenceStation(station);
        document.body.style.cursor = "pointer";
        return;
      }
      hoverIntelligenceStation(null);
    }
    if (station === "touch") { clearInteraction(); return; }
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
  }, [clearInteraction]);
  const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    const screenId = findScreenId(event.object);
    const station = screenId ? screenStations[screenId] : null;
    if (!station || interactionRuntime.activeStation !== station || !event.uv) return;
    if (station === "touch") return;
    event.stopPropagation();
    if (station === "game") {
      if (gamePointer.current && gamePointer.current.pointerId !== event.pointerId) return;
      const screen = exhibition.getObjectByName(bakedSceneContract.exhibition.screens.game);
      gamePointer.current = screen ? createGamePointerProjection(screen, event) : null;
      gamePointer.current?.capture.setPointerCapture(event.pointerId);
    } else {
      const target = event.nativeEvent.target;
      if (target instanceof Element && "setPointerCapture" in target) target.setPointerCapture(event.pointerId);
    }
    dispatchSceneInteraction(station, {
      phase: "down",
      x: THREE.MathUtils.clamp(event.uv.x, 0, 1),
      y: THREE.MathUtils.clamp(event.uv.y, 0, 1),
      pointerId: event.pointerId,
      input: event.pointerType === "touch" ? "touch" : "pointer",
    });
    if (interactionRuntime.activeStation !== station) {
      suppressedScreenClick.current = {
        station,
        until: performance.now() + 500,
      };
    }
  }, [exhibition]);
  const handlePointerEnd = useCallback((event: ThreeEvent<PointerEvent>) => {
    const pointer = gamePointer.current;
    if (pointer && pointer.pointerId !== event.pointerId && interactionRuntime.activeStation === "game") return;
    if (pointer && pointer.pointerId === event.pointerId) {
      event.stopPropagation();
      projectGamePointer(event.ray, pointer);
      dispatchSceneInteraction("game", {
        phase: event.type === "pointercancel" ? "cancel" : "up",
        x: pointer.x,
        y: pointer.y,
        pointerId: pointer.pointerId,
        input: pointer.input,
      });
      releaseGamePointer();
      return;
    }
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
  }, [releaseGamePointer]);
  const handlePointerOut = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (gamePointer.current && interactionRuntime.activeStation === "game") return;
    const screenId = findScreenId(event.object);
    const station = screenId ? screenStations[screenId] : null;
    if (station && getIntelligenceSnapshot().hoveredStation === station) hoverIntelligenceStation(null);
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
    if (canInspectIntelligenceStations()) {
      event.stopPropagation();
      pinIntelligenceStation(station);
      return;
    }
    if (station === "touch") return;
    const suppressed = suppressedScreenClick.current;
    suppressedScreenClick.current = null;
    if (suppressed?.station === station && performance.now() <= suppressed.until) {
      event.stopPropagation();
      return;
    }
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
  useEffect(() => {
    const departure = (event: Event) => {
      if ((event as CustomEvent<{ station: InteractionStation }>).detail?.station === "game") cancelGamePointer();
    };
    const lostCapture = (event: PointerEvent) => {
      if (interactionRuntime.activeStation === "touch") {
        dispatchSceneInteraction("touch", { phase: "cancel", x: 0, y: 0, pointerId: event.pointerId, input: "pointer" });
      }
      if (gamePointer.current?.pointerId === event.pointerId) cancelGamePointer();
    };
    window.addEventListener("blur", cancelGamePointer);
    window.addEventListener("mandegar:interaction-departure", departure);
    gl.domElement.addEventListener("lostpointercapture", lostCapture);
    gl.domElement.addEventListener("pointercancel", lostCapture);
    return () => {
      window.removeEventListener("blur", cancelGamePointer);
      window.removeEventListener("mandegar:interaction-departure", departure);
      gl.domElement.removeEventListener("lostpointercapture", lostCapture);
      gl.domElement.removeEventListener("pointercancel", lostCapture);
      cancelGamePointer();
    };
  }, [cancelGamePointer, gl]);

  useFrame(({ clock }) => {
    if (gamePointer.current && interactionRuntime.activeStation !== "game") cancelGamePointer();
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
      <ComposerObjects root={exhibition} />
      <InteractionPhotoEffects anchors={interactionAnchors} />
      <InteractionBeamEffects anchors={interactionAnchors} quality={quality} root={exhibition} />
      <InteractionGameEffects
        anchors={interactionAnchors}
        quality={quality}
        screen={exhibition.getObjectByName(bakedSceneContract.exhibition.screens.game) ?? null}
      />
      <NarrativeParticles
        environment={environment}
        exhibition={exhibition}
        quality={quality}
      />
      <DataFlowNetwork exhibition={exhibition} />
      <DeferredBakedCrowd locale={locale} quietMap={textures[2]} peakMap={textures[3]} />
      <IntelligenceStationAnchors anchors={interactionAnchors} exhibition={exhibition} getSurfacePoint={getWorldPointAtUv} />
    </group>
  );
}
