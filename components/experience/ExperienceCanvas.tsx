"use client";

/* eslint-disable react-hooks/immutability -- R3F render-loop callbacks intentionally mutate Three.js scene objects. */

import { Canvas, useFrame, useLoader, useThree, type ThreeEvent } from "@react-three/fiber";
import { Component, Suspense, type CSSProperties, type ErrorInfo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { AudienceSystem } from "./AudienceSystem";
import {
  narrativeCueRanges as activationSequence,
  rangeProgress as phaseProgress,
} from "./narrative-score";
import { CameraRig } from "./CameraRig";
import { ExperiencePostProcessing } from "./ExperiencePostProcessing";
import { assetSlots, qualityProfiles, sceneTokens, type SceneQuality } from "./scene-config";
import { experienceState } from "./experience-state";
import spatialStyles from "./SpatialLabels.module.css";

type RuntimeState = "pending" | "fallback" | SceneQuality;
type SceneProject = { src: string; label: string };
type ExperienceCanvasProps = {
  className?: string;
  enabledByCms?: boolean;
  projects?: SceneProject[];
  zoneLabels?: { photo: string; game: string };
  onProjectSelect?: (index: number) => void;
  onRuntimeReady?: (runtime: RuntimeState) => void;
  onFirstFrame?: () => void;
};

type ModelAnchor = {
  object: THREE.Object3D;
  localPosition: THREE.Vector3;
  localBounds: THREE.Box3 | null;
  surfaceFacing: boolean;
};

type SurfaceProjectionScratch = {
  inverseMatrix: THREE.Matrix4;
  localCamera: THREE.Vector3;
  localDirection: THREE.Vector3;
  localHit: THREE.Vector3;
  ray: THREE.Ray;
  raycaster: THREE.Raycaster;
  worldDirection: THREE.Vector3;
  intersections: THREE.Intersection[];
};

type SpatialScreenPoint = {
  x: number;
  y: number;
  visible: boolean;
};

type SpatialHudModeId = "assembly" | "activationLeft" | "activationRight" | "reveal" | "experiences" | "proof" | "intelligence";

type SpatialHudMode = {
  id: SpatialHudModeId;
  range: readonly [number, number];
  primary: ModelAnchor;
  secondary: ModelAnchor | null;
  measureStart: ModelAnchor | null;
  measureEnd: ModelAnchor | null;
  measureMeters: number;
};

type SpatialHudModeCopy = {
  primaryCode: string;
  primaryValue: string;
  secondaryCode?: string;
  secondaryValue?: string;
  measurementPrefix?: string;
};

type SpatialHudFrame = {
  mode: SpatialHudModeId | null;
  opacity: number;
  compact: boolean;
  width: number;
  height: number;
  primary: SpatialScreenPoint;
  secondary: SpatialScreenPoint;
  measureStart: SpatialScreenPoint;
  measureEnd: SpatialScreenPoint;
  measureMeters: number;
};

const defaultProjectMedia = [
  "/media/placeholders/exhibition-space.webp",
  "/media/placeholders/stage-production.webp",
  "/media/placeholders/interactive-wall.webp",
] as const;

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  varying vec2 vUv;
  uniform sampler2D uMedia;
  uniform float uEnergy;
  uniform float uCelebration;
  uniform float uPeak;
  uniform float uHover;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uOffset;
  void main() {
    vec3 quiet = vec3(0.58, 0.61, 0.62);
    vec3 cobalt = vec3(0.13, 0.36, 1.0);
    vec3 cyan = vec3(0.31, 0.78, 1.0);
    vec3 magenta = vec3(0.85, 0.36, 1.0);
    vec3 amber = vec3(1.0, 0.71, 0.29);
    float wave = sin((vUv.x * 7.0 - vUv.y * 4.0) + uTime * 0.5 + uOffset) * 0.5 + 0.5;
    float ribbon = smoothstep(0.42, 0.9, wave);
    float signal = smoothstep(0.82, 1.0, sin((vUv.x + vUv.y) * 18.0 - uTime * 1.15 + uOffset) * 0.5 + 0.5);
    vec3 eventColor = mix(cobalt, cyan, smoothstep(0.05, 0.82, vUv.y));
    eventColor = mix(eventColor, magenta, smoothstep(0.58, 1.0, vUv.x) * 0.5);
    eventColor = mix(eventColor, magenta, ribbon * uEnergy * 0.62);
    eventColor = mix(eventColor, amber, smoothstep(0.58, 1.0, vUv.x) * uPeak * 0.68);
    eventColor += cyan * signal * 0.34;
    vec2 mediaUv = vUv;
    mediaUv.x += sin(vUv.y * 22.0 + uTime * 1.8) * 0.0035 * uHover;
    mediaUv.y += cos(vUv.x * 18.0 + uTime * 1.35) * 0.002 * uHover;
    vec3 mediaColor = texture2D(uMedia, mediaUv).rgb;
    vec3 color = mix(quiet, eventColor, uEnergy);
    color = mix(color, mediaColor, 0.1 + uEnergy * 0.86);
    color += mix(cyan, magenta, vUv.x) * ribbon * uCelebration * 0.18;
    float edge = smoothstep(0.0, 0.035, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
    color += cyan * (1.0 - edge) * (0.22 + uHover * 1.25);
    float vignette = smoothstep(0.02, 0.16, vUv.x * (1.0 - vUv.x) * vUv.y * (1.0 - vUv.y));
    gl_FragColor = vec4(color * (0.72 + vignette * 0.42 + uHover * 0.08 + uPeak * 0.16), uOpacity);
  }
`;

function smoothstep(value: number) {
  const safe = Math.min(1, Math.max(0, value));
  return safe * safe * (3 - 2 * safe);
}

function createModelAnchor(
  root: THREE.Object3D,
  name: string,
  normalizedPosition: readonly [number, number, number],
  surfaceFacing = false,
) {
  const object = root.getObjectByName(name);
  if (!object) return null;
  root.updateMatrixWorld(true);
  if (object instanceof THREE.Mesh) {
    object.geometry.computeBoundingBox();
    const localBounds = object.geometry.boundingBox;
    if (localBounds && !localBounds.isEmpty()) {
      return {
        object,
        localPosition: new THREE.Vector3(
          THREE.MathUtils.lerp(localBounds.min.x, localBounds.max.x, normalizedPosition[0]),
          THREE.MathUtils.lerp(localBounds.min.y, localBounds.max.y, normalizedPosition[1]),
          THREE.MathUtils.lerp(localBounds.min.z, localBounds.max.z, normalizedPosition[2]),
        ),
        localBounds: localBounds.clone(),
        surfaceFacing,
      } satisfies ModelAnchor;
    }
  }
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) return null;
  const worldPosition = new THREE.Vector3(
    THREE.MathUtils.lerp(bounds.min.x, bounds.max.x, normalizedPosition[0]),
    THREE.MathUtils.lerp(bounds.min.y, bounds.max.y, normalizedPosition[1]),
    THREE.MathUtils.lerp(bounds.min.z, bounds.max.z, normalizedPosition[2]),
  );
  return {
    object,
    localPosition: object.worldToLocal(worldPosition),
    localBounds: null,
    surfaceFacing: false,
  } satisfies ModelAnchor;
}

function projectModelAnchor(
  anchor: ModelAnchor,
  camera: THREE.Camera,
  size: { width: number; height: number },
  worldPosition: THREE.Vector3,
  projectedPosition: THREE.Vector3,
  output: SpatialScreenPoint,
  surfaceScratch: SurfaceProjectionScratch,
) {
  worldPosition.copy(anchor.localPosition);
  anchor.object.localToWorld(worldPosition);
  if (anchor.surfaceFacing && anchor.localBounds) {
    surfaceScratch.worldDirection.copy(worldPosition).sub(camera.position);
    const targetDistance = surfaceScratch.worldDirection.length();
    surfaceScratch.worldDirection.normalize();
    surfaceScratch.raycaster.set(camera.position, surfaceScratch.worldDirection);
    surfaceScratch.raycaster.near = 0;
    surfaceScratch.raycaster.far = targetDistance + anchor.localBounds.getSize(surfaceScratch.localHit).length();
    surfaceScratch.intersections.length = 0;
    surfaceScratch.raycaster.intersectObject(anchor.object, false, surfaceScratch.intersections);
    const meshHit = surfaceScratch.intersections[0];
    if (meshHit) {
      worldPosition.copy(meshHit.point);
    } else {
      surfaceScratch.inverseMatrix.copy(anchor.object.matrixWorld).invert();
      surfaceScratch.localCamera.copy(camera.position).applyMatrix4(surfaceScratch.inverseMatrix);
      surfaceScratch.localDirection.copy(anchor.localPosition).sub(surfaceScratch.localCamera).normalize();
      surfaceScratch.ray.set(surfaceScratch.localCamera, surfaceScratch.localDirection);
      if (surfaceScratch.ray.intersectBox(anchor.localBounds, surfaceScratch.localHit)) {
        worldPosition.copy(surfaceScratch.localHit).applyMatrix4(anchor.object.matrixWorld);
      }
    }
  }
  projectedPosition.copy(worldPosition).project(camera);
  const matrix = camera.matrixWorld.elements;
  const cameraX = worldPosition.x - camera.position.x;
  const cameraY = worldPosition.y - camera.position.y;
  const cameraZ = worldPosition.z - camera.position.z;
  const forwardDistance = cameraX * -matrix[8] + cameraY * -matrix[9] + cameraZ * -matrix[10];
  output.x = (projectedPosition.x * 0.5 + 0.5) * size.width;
  output.y = (-projectedPosition.y * 0.5 + 0.5) * size.height;
  output.visible = forwardDistance > 0
    && projectedPosition.z >= -1
    && projectedPosition.z <= 1
    && Math.abs(projectedPosition.x) <= 1.12
    && Math.abs(projectedPosition.y) <= 1.12;
}

function getSpatialMomentOpacity(progress: number, range: readonly [number, number]) {
  const span = Math.max(0.001, range[1] - range[0]);
  const fade = Math.min(0.026, span * 0.2);
  const enter = smoothstep(phaseProgress(progress, [range[0], range[0] + fade]));
  const exit = smoothstep(phaseProgress(progress, [range[1] - fade, range[1]]));
  return enter * (1 - exit);
}

function makeTrail(points: Array<[number, number, number]>) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  const samples = curve.getPoints(80);
  const positions: number[] = [];
  for (let index = 1; index < samples.length; index += 1) positions.push(...samples[index - 1].toArray(), ...samples[index].toArray());
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setDrawRange(0, 0);
  return geometry;
}

type ScreenBinding = {
  name: string;
  material: THREE.ShaderMaterial;
  wake: readonly [number, number];
  projectIndex: number;
};

type RevealBinding = {
  name: string;
  object: THREE.Mesh;
  wireObject: THREE.Mesh;
  material: THREE.Material;
  wireMaterial: THREE.MeshBasicMaterial;
  baseOpacity: number;
  basePosition: THREE.Vector3;
  order: number;
};

function createScreenMaterial(offset: number, texture: THREE.Texture) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    vertexShader,
    fragmentShader,
    uniforms: {
      uMedia: { value: texture },
      uEnergy: { value: 0 },
      uCelebration: { value: 0 },
      uPeak: { value: 0 },
      uHover: { value: 0 },
      uOpacity: { value: 0.12 },
      uTime: { value: 0 },
      uOffset: { value: offset },
    },
  });
}

function getInteraction(object: THREE.Object3D) {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (typeof current.userData.projectIndex === "number") return { projectIndex: current.userData.projectIndex as number, zone: null };
    if (typeof current.userData.zone === "string") return { projectIndex: null, zone: current.userData.zone as "photo" | "game" | "touch" };
    current = current.parent;
  }
  return { projectIndex: null, zone: null };
}

function MandegarModel({
  projects,
  onFirstFrame,
  onProjectSelect,
  onSpatialFrame,
}: {
  projects: SceneProject[];
  onFirstFrame?: () => void;
  onProjectSelect?: (index: number) => void;
  onSpatialFrame?: (frame: SpatialHudFrame) => void;
}) {
  const gltf = useLoader(GLTFLoader, assetSlots.assembled);
  const { camera, size } = useThree();
  const projectSources = useMemo(() => defaultProjectMedia.map((fallback, index) => projects[index]?.src || fallback), [projects]);
  const textures = useLoader(THREE.TextureLoader, projectSources);
  const firstFrame = useRef(false);
  const spatialProjection = useRef({
    world: Array.from({ length: 4 }, () => new THREE.Vector3()),
    projected: Array.from({ length: 4 }, () => new THREE.Vector3()),
    primary: { x: 0, y: 0, visible: false },
    secondary: { x: 0, y: 0, visible: false },
    measureStart: { x: 0, y: 0, visible: false },
    measureEnd: { x: 0, y: 0, visible: false },
    surface: {
      inverseMatrix: new THREE.Matrix4(),
      localCamera: new THREE.Vector3(),
      localDirection: new THREE.Vector3(),
      localHit: new THREE.Vector3(),
      ray: new THREE.Ray(),
      raycaster: new THREE.Raycaster(),
      worldDirection: new THREE.Vector3(),
      intersections: [] as THREE.Intersection[],
    },
  });
  const revealBeacon = useRef<THREE.Group>(null);
  const revealBeaconLight = useRef<THREE.PointLight>(null);
  const revealBeaconMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const wireQuiet = useMemo(() => new THREE.Color("#8ca9c8"), []);
  const wireActive = useMemo(() => new THREE.Color(sceneTokens.colors.cyan), []);
  const energyCobalt = useMemo(() => new THREE.Color(sceneTokens.colors.cobalt), []);
  const energyCyan = useMemo(() => new THREE.Color(sceneTokens.colors.cyan), []);
  const energyMagenta = useMemo(() => new THREE.Color(sceneTokens.colors.magenta), []);
  const energyAmber = useMemo(() => new THREE.Color(sceneTokens.colors.amber), []);
  const haloQuiet = useMemo(() => new THREE.Color("#f0eee8"), []);
  const haloActive = useMemo(() => new THREE.Color("#dbe7ff"), []);

  useEffect(() => {
    textures.forEach((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.needsUpdate = true;
    });
  }, [textures]);

  const runtime = useMemo(() => {
    const scene = gltf.scene.clone(true);
    const wireScene = gltf.scene.clone(true);
    const ownedMaterials: THREE.Material[] = [];
    const sceneMeshes: THREE.Mesh[] = [];
    const wireMeshes = new Map<string, THREE.Mesh>();
    const screens: ScreenBinding[] = [];
    const standardMaterials = new Map<string, { material: THREE.MeshStandardMaterial; opacity: number }>();
    const screenConfig: Record<string, { wake: readonly [number, number]; offset: number; projectIndex: number }> = {
      led_left_screen_16x9: { wake: activationSequence.screens[0], offset: -1.7, projectIndex: 1 },
      led_right_screen_16x9: { wake: activationSequence.screens[1], offset: 1.7, projectIndex: 2 },
      led_central_media_21x9: { wake: activationSequence.mediaWall, offset: 0.2, projectIndex: 0 },
    };

    wireScene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const material = new THREE.MeshBasicMaterial({
        color: "#8ca9c8",
        wireframe: true,
        transparent: true,
        opacity: 0.46,
        depthWrite: false,
        blending: THREE.NormalBlending,
      });
      object.material = material;
      object.castShadow = false;
      object.receiveShadow = false;
      wireMeshes.set(object.name, object);
      ownedMaterials.push(material);
    });

    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      sceneMeshes.push(object);
      object.castShadow = object.name === "hero_canopy" || object.name === "stage_front_rise" || object.name.endsWith("_shell");
      object.receiveShadow = object.name === "hall_floor" || object.name === "stage_base";
      const screen = screenConfig[object.name];
      if (screen) {
        const material = createScreenMaterial(screen.offset, textures[screen.projectIndex]);
        object.material = material;
        object.userData.projectIndex = screen.projectIndex;
        ownedMaterials.push(material);
        screens.push({ name: object.name, material, wake: screen.wake, projectIndex: screen.projectIndex });
        return;
      }

      if (object.name.startsWith("booth_left_")) object.userData.zone = "photo";
      if (object.name.startsWith("booth_right_")) object.userData.zone = "game";
      if (object.name.startsWith("touch_")) object.userData.zone = "touch";
      const sourceMaterial = Array.isArray(object.material) ? object.material[0] : object.material;
      const material = sourceMaterial.clone();
      object.material = material;
      ownedMaterials.push(material);
      if (!(material instanceof THREE.MeshStandardMaterial)) return;
      material.envMapIntensity = 0.62;
      if (object.name === "hall_floor") {
        material.color.set("#bec5c8");
        material.roughness = 0.34;
        material.metalness = 0.08;
      } else if (object.name === "hall_circular_inlay") {
        material.color.set("#77828b");
        material.transparent = true;
        material.opacity = 0.32;
      } else if (object.name.includes("portal")) {
        material.color.set("#d2d8da");
        material.roughness = 0.34;
      } else if (object.name.startsWith("hero_core_rib_")) {
        material.color.set(Number(object.name.slice(-3)) % 2 ? "#cbd0d1" : "#dededa");
        material.roughness = Math.max(material.roughness, 0.46);
      }
      standardMaterials.set(object.name, { material, opacity: material.opacity });
    });

    const haloSignal = scene.getObjectByName("ring_signal_surface") as THREE.Mesh | undefined;
    if (haloSignal) haloSignal.scale.setScalar(1.018);
    scene.updateMatrixWorld(true);
    const sortedMeshes = sceneMeshes
      .map((object) => ({ object, minY: new THREE.Box3().setFromObject(object).min.y }))
      .sort((left, right) => left.minY - right.minY || left.object.name.localeCompare(right.object.name));
    const divisor = Math.max(1, sortedMeshes.length - 1);
    const revealBindings = sortedMeshes.flatMap<RevealBinding>(({ object }, index) => {
      const wireObject = wireMeshes.get(object.name);
      const material = Array.isArray(object.material) ? object.material[0] : object.material;
      const wireMaterial = wireObject && !Array.isArray(wireObject.material) && wireObject.material instanceof THREE.MeshBasicMaterial
        ? wireObject.material
        : null;
      if (!wireObject || !wireMaterial) return [];
      return [{
        name: object.name,
        object,
        wireObject,
        material,
        wireMaterial,
        baseOpacity: material.opacity,
        basePosition: object.position.clone(),
        order: index / divisor,
      }];
    });
    const revealByName = new Map(revealBindings.map((binding) => [binding.name, binding]));
    const makeSpatialMode = (
      id: SpatialHudModeId,
      range: readonly [number, number],
      primary: ModelAnchor | null,
      secondary: ModelAnchor | null = null,
      measureStart: ModelAnchor | null = null,
      measureEnd: ModelAnchor | null = null,
    ): SpatialHudMode | null => {
      if (!primary) return null;
      const hasMeasurement = Boolean(measureStart && measureEnd);
      const measureMeters = measureStart && measureEnd
        ? measureStart.object.localToWorld(measureStart.localPosition.clone()).distanceTo(
          measureEnd.object.localToWorld(measureEnd.localPosition.clone()),
        )
        : 0;
      return {
        id,
        range,
        primary,
        secondary,
        measureStart: hasMeasurement ? measureStart : null,
        measureEnd: hasMeasurement ? measureEnd : null,
        measureMeters,
      };
    };
    const surfaceAnchor = (name: string, position: readonly [number, number, number]) => createModelAnchor(scene, name, position, true);
    const fixedAnchor = (name: string, position: readonly [number, number, number]) => createModelAnchor(scene, name, position);
    const spatialModes = [
      makeSpatialMode(
        "assembly",
        sceneTokens.spatialLabels.moments.assembly,
        surfaceAnchor(sceneTokens.spatialLabels.nodes.core, [0.72, 0.56, 0.5]),
        null,
        fixedAnchor(sceneTokens.spatialLabels.nodes.core, [1.07, 0, 1.02]),
        fixedAnchor(sceneTokens.spatialLabels.nodes.core, [1.07, 1, 1.02]),
      ),
      makeSpatialMode(
        "activationLeft",
        sceneTokens.spatialLabels.moments.activationLeft,
        surfaceAnchor(sceneTokens.spatialLabels.nodes.leftShell, [0.58, 0.58, 0.5]),
        surfaceAnchor(sceneTokens.spatialLabels.nodes.leftTouch, [0.5, 0.55, 0.5]),
      ),
      makeSpatialMode(
        "activationRight",
        sceneTokens.spatialLabels.moments.activationRight,
        surfaceAnchor(sceneTokens.spatialLabels.nodes.rightShell, [0.42, 0.58, 0.5]),
        surfaceAnchor(sceneTokens.spatialLabels.nodes.rightTouch, [0.5, 0.55, 0.5]),
      ),
      makeSpatialMode(
        "reveal",
        sceneTokens.spatialLabels.moments.reveal,
        surfaceAnchor(sceneTokens.spatialLabels.nodes.canopy, [0.78, 0.5, 0.5]),
        surfaceAnchor(sceneTokens.spatialLabels.nodes.core, [0.7, 0.62, 0.5]),
        fixedAnchor(sceneTokens.spatialLabels.nodes.canopy, [0, 0.5, 0.5]),
        fixedAnchor(sceneTokens.spatialLabels.nodes.canopy, [1, 0.5, 0.5]),
      ),
      makeSpatialMode(
        "experiences",
        sceneTokens.spatialLabels.moments.experiences,
        surfaceAnchor(sceneTokens.spatialLabels.nodes.leftZone, [0.5, 0.68, 0.5]),
        surfaceAnchor(sceneTokens.spatialLabels.nodes.rightZone, [0.5, 0.68, 0.5]),
      ),
      makeSpatialMode(
        "proof",
        sceneTokens.spatialLabels.moments.proof,
        surfaceAnchor(sceneTokens.spatialLabels.nodes.media, [0.82, 0.68, 0.5]),
        null,
        fixedAnchor(sceneTokens.spatialLabels.nodes.media, [0, 1.14, 1.02]),
        fixedAnchor(sceneTokens.spatialLabels.nodes.media, [1, 1.14, 1.02]),
      ),
      makeSpatialMode(
        "intelligence",
        sceneTokens.spatialLabels.moments.intelligence,
        surfaceAnchor(sceneTokens.spatialLabels.nodes.leftZone, [0.5, 0.62, 0.5]),
        surfaceAnchor(sceneTokens.spatialLabels.nodes.core, [0.72, 0.54, 0.5]),
        fixedAnchor(sceneTokens.spatialLabels.nodes.leftZone, [0.5, 0.78, 1.02]),
        fixedAnchor(sceneTokens.spatialLabels.nodes.core, [0.5, 0.78, 1.02]),
      ),
    ].filter((mode): mode is SpatialHudMode => mode !== null);
    return {
      scene,
      wireScene,
      ownedMaterials,
      screens,
      standardMaterials,
      revealBindings,
      revealByName,
      spatialModes,
    };
  }, [gltf.scene, textures]);

  useEffect(() => {
    return () => {
      runtime.ownedMaterials.forEach((material) => material.dispose());
    };
  }, [runtime]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && runtime.spatialModes.length < 7) {
      console.warn("Some Mandegar spatial-label moments are unavailable; check the configured model nodes", sceneTokens.spatialLabels.nodes);
    }
  }, [runtime.spatialModes.length]);

  useFrame(({ clock }) => {
    if (!firstFrame.current) {
      firstFrame.current = true;
      onFirstFrame?.();
    }
    const progress = experienceState.progress;
    const mobile = size.width <= 760 || size.height > size.width * 1.35;

    const rawReset = smoothstep(phaseProgress(progress, activationSequence.loopReset));
    const reset = rawReset > 0.98 ? 1 : rawReset;
    const story = experienceState.narrative;
    const scrolledAssembly = smoothstep(phaseProgress(progress, activationSequence.objectAssembly));
    const assembly = scrolledAssembly * (1 - reset);
    const trails = smoothstep(phaseProgress(progress, activationSequence.lightTrails)) * (1 - reset);
    const booths = smoothstep(phaseProgress(progress, activationSequence.booths)) * (1 - reset);
    const media = smoothstep(phaseProgress(progress, activationSequence.mediaWall)) * (1 - reset);

    experienceState.assemblyProgress = assembly;
    runtime.scene.scale.setScalar(0.965 + assembly * 0.035);
    runtime.scene.position.y = -0.16 * (1 - assembly);
    runtime.wireScene.scale.copy(runtime.scene.scale);
    runtime.wireScene.position.copy(runtime.scene.position);
    runtime.revealBindings.forEach((binding, index) => {
      const start = binding.order * 0.7;
      const localReveal = smoothstep(phaseProgress(assembly, [start, Math.min(1, start + 0.3)]));
      binding.object.userData.assemblyReveal = localReveal;
      binding.object.position.copy(binding.basePosition);
      binding.object.position.y -= (1 - localReveal) * 0.22;
      binding.material.transparent = localReveal < 0.995 || binding.baseOpacity < 1;
      binding.material.opacity = binding.baseOpacity * localReveal;
      binding.material.depthWrite = localReveal > 0.8;
      binding.wireMaterial.opacity = (1 - localReveal) * (0.38 + Math.sin(clock.elapsedTime * 0.8 + index * 0.37) * 0.045);
      binding.wireMaterial.color.lerpColors(wireQuiet, wireActive, Math.max(trails * 0.28, (1 - localReveal) * 0.18));
    });

    const beaconTravel = reset > 0 ? 1 - reset : scrolledAssembly;
    const beaconVisibility = reset > 0
      ? Math.sin(reset * Math.PI)
      : smoothstep(phaseProgress(scrolledAssembly, [0.015, 0.12]))
        * (1 - smoothstep(phaseProgress(scrolledAssembly, [0.76, 1])));
    if (revealBeacon.current) {
      const pointerInfluence = 1 - smoothstep(phaseProgress(beaconTravel, [0.06, 0.52]));
      revealBeacon.current.visible = beaconVisibility > 0.002;
      revealBeacon.current.position.set(
        experienceState.pointerX * 5.8 * pointerInfluence + Math.sin(beaconTravel * Math.PI * 2.4) * 0.62,
        THREE.MathUtils.lerp(1.8 - experienceState.pointerY * 2.4, 5.15, beaconTravel),
        THREE.MathUtils.lerp(7.4, 0.2, beaconTravel),
      );
      revealBeacon.current.scale.setScalar(0.72 + beaconVisibility * 0.5);
    }
    if (revealBeaconLight.current) revealBeaconLight.current.intensity = beaconVisibility * 7.5 * experienceState.lightScale;
    if (revealBeaconMaterial.current) revealBeaconMaterial.current.opacity = beaconVisibility;
    if (reset > 0.98) {
      experienceState.focusProject = null;
      experienceState.focusZone = null;
    }
    runtime.screens.forEach(({ name, material, wake, projectIndex }) => {
      const localReveal = runtime.revealByName.get(name)?.object.userData.assemblyReveal as number | undefined;
      material.uniforms.uEnergy.value = smoothstep(phaseProgress(progress, wake)) * (1 - reset);
      material.uniforms.uCelebration.value = story.energy;
      material.uniforms.uPeak.value = story.peak;
      material.uniforms.uHover.value = THREE.MathUtils.lerp(material.uniforms.uHover.value, experienceState.focusProject === projectIndex ? 1 : 0, 0.12);
      material.uniforms.uOpacity.value = localReveal ?? 0;
      material.uniforms.uTime.value = clock.elapsedTime;
    });

    runtime.standardMaterials.forEach(({ material }, nodeName) => {
      const localReveal = (runtime.revealByName.get(nodeName)?.object.userData.assemblyReveal as number | undefined) ?? 0;
      if (nodeName === "ring_signature_halo") {
        material.emissive.copy(energyCyan).lerp(energyMagenta, story.peak * 0.64 + story.living * 0.12);
        material.emissiveIntensity = (0.08 + trails * 0.18 + story.energy * 2.35 + story.peak * 1.4) * experienceState.lightScale;
        material.color.lerpColors(haloQuiet, haloActive, story.energy * 0.72);
      } else if (nodeName === "ring_signal_surface") {
        material.transparent = true;
        material.opacity = localReveal * Math.min(1, trails * 0.3 + story.energy * 0.82 + story.peak * 0.18);
        material.emissive.copy(energyCobalt).lerp(energyMagenta, story.energy * 0.5 + story.peak * 0.4);
        material.emissiveIntensity = (0.4 + story.energy * 2.8 + story.peak * 1.25) * experienceState.lightScale;
      } else if (nodeName === "stage_signal_edge") {
        material.emissive.copy(energyCyan).lerp(energyAmber, story.energy * 0.5 + story.peak * 0.5);
        material.emissiveIntensity = (trails * 0.3 + story.energy * 1.7 + story.peak * 0.75) * experienceState.lightScale;
      } else if (nodeName.startsWith("wing_") && nodeName.endsWith("_signal")) {
        material.emissive.copy(nodeName.includes("left") ? energyMagenta : energyCyan).lerp(energyAmber, story.peak * 0.28);
        material.emissiveIntensity = (trails * 0.3 + story.energy * 1.6 + story.peak * 0.7) * experienceState.lightScale;
      } else if (nodeName === "hero_canopy_light") {
        material.emissive.copy(energyCyan).lerp(energyMagenta, story.peak * 0.34);
        material.emissiveIntensity = (trails * 0.3 + story.energy * 1.4 + story.peak * 0.75) * experienceState.lightScale;
      } else if (nodeName.startsWith("touch_")) {
        const focused = experienceState.focusZone === "touch";
        material.emissive.set(sceneTokens.colors.cobalt);
        material.emissiveIntensity = booths * (focused ? 3.2 : 1.15) * experienceState.lightScale;
      } else if (nodeName.startsWith("booth_") && nodeName.endsWith("_portal")) {
        const focused = (experienceState.focusZone === "photo" && nodeName.includes("left")) || (experienceState.focusZone === "game" && nodeName.includes("right"));
        material.emissive.set(sceneTokens.colors.cyan);
        material.emissiveIntensity = booths * (focused ? 1.1 : 0.16) * experienceState.lightScale;
      } else if (nodeName === "hero_rear_veil") {
        material.transparent = true;
        material.opacity = (0.2 + media * 0.24) * localReveal;
        material.emissive.set(sceneTokens.colors.cyan);
        material.emissiveIntensity = media * 0.22;
      }
    });

    if (onSpatialFrame) {
      const mode = runtime.spatialModes.find((candidate) => progress >= candidate.range[0] && progress < candidate.range[1]) ?? null;
      const opacity = mode ? getSpatialMomentOpacity(progress, mode.range) * (1 - reset) : 0;
      const projection = spatialProjection.current;
      if (mode && opacity > 0.001) {
        runtime.scene.updateMatrixWorld(true);
        camera.updateMatrixWorld(true);
        projectModelAnchor(mode.primary, camera, size, projection.world[0], projection.projected[0], projection.primary, projection.surface);
        if (mode.secondary) {
          projectModelAnchor(mode.secondary, camera, size, projection.world[1], projection.projected[1], projection.secondary, projection.surface);
        } else {
          projection.secondary.visible = false;
        }
        if (mode.measureStart && mode.measureEnd) {
          projectModelAnchor(mode.measureStart, camera, size, projection.world[2], projection.projected[2], projection.measureStart, projection.surface);
          projectModelAnchor(mode.measureEnd, camera, size, projection.world[3], projection.projected[3], projection.measureEnd, projection.surface);
        } else {
          projection.measureStart.visible = false;
          projection.measureEnd.visible = false;
        }
      } else {
        projection.primary.visible = false;
        projection.secondary.visible = false;
        projection.measureStart.visible = false;
        projection.measureEnd.visible = false;
      }
      onSpatialFrame({
        mode: mode?.id ?? null,
        opacity,
        compact: mobile,
        width: size.width,
        height: size.height,
        primary: projection.primary,
        secondary: projection.secondary,
        measureStart: projection.measureStart,
        measureEnd: projection.measureEnd,
        measureMeters: mode?.measureMeters ?? 0,
      });
    }
  });

  const handlePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    const interaction = getInteraction(event.object);
    if (interaction.projectIndex === null && interaction.zone === null) return;
    event.stopPropagation();
    experienceState.focusProject = interaction.projectIndex;
    experienceState.focusZone = interaction.zone;
    document.body.style.cursor = "pointer";
  }, []);

  const clearInteraction = useCallback(() => {
    experienceState.focusProject = null;
    experienceState.focusZone = null;
    document.body.style.cursor = "";
  }, []);

  const handleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    const interaction = getInteraction(event.object);
    if (interaction.projectIndex !== null) {
      event.stopPropagation();
      onProjectSelect?.(interaction.projectIndex);
      return;
    }
    if (interaction.zone) {
      event.stopPropagation();
      experienceState.focusZone = interaction.zone;
      experienceState.pointerPulse = 1;
    }
  }, [onProjectSelect]);

  useEffect(() => clearInteraction, [clearInteraction]);

  return (
    <group>
      <primitive object={runtime.wireScene} />
      <primitive
        object={runtime.scene}
        onPointerMove={handlePointerMove}
        onPointerOut={clearInteraction}
        onClick={handleClick}
      />
      <group ref={revealBeacon}>
        <pointLight ref={revealBeaconLight} intensity={0} distance={11} decay={1.7} color={sceneTokens.colors.cyan} />
        <mesh renderOrder={12}>
          <sphereGeometry args={[0.105, 20, 20]} />
          <meshBasicMaterial
            ref={revealBeaconMaterial}
            color="#dff8ff"
            toneMapped={false}
            transparent
            opacity={1}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
    </group>
  );
}

type SignalFieldData = {
  geometry: THREE.BufferGeometry;
  focus: THREE.Vector3;
};

type SurfaceParticleBinding = {
  mesh: THREE.Mesh;
  sampler: MeshSurfaceSampler;
  bounds: THREE.Box3;
  normalMatrix: THREE.Matrix3;
  wake: number;
  color: THREE.Color;
  cumulativeWeight: number;
};

type SignalRoute = {
  from: THREE.Vector3;
  control: THREE.Vector3;
  to: THREE.Vector3;
};

function seededNoise(value: number) {
  const raw = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
  return raw - Math.floor(raw);
}

function getObjectCenter(scene: THREE.Object3D, name: string, target = new THREE.Vector3()) {
  const object = scene.getObjectByName(name);
  if (!object) return null;
  if (object instanceof THREE.Mesh) {
    const bounds = new THREE.Box3().setFromObject(object);
    if (!bounds.isEmpty()) return bounds.getCenter(target);
  }
  return object.getWorldPosition(target);
}

function getNamedMesh(scene: THREE.Object3D, name: string) {
  const object = scene.getObjectByName(name);
  if (object instanceof THREE.Mesh) return object;
  let mesh: THREE.Mesh | null = null;
  object?.traverse((child) => {
    if (!mesh && child instanceof THREE.Mesh) mesh = child;
  });
  return mesh;
}

function makeSurfaceSampler(mesh: THREE.Mesh, salt: number) {
  const sampler = new MeshSurfaceSampler(mesh);
  let sampleIndex = 0;
  (sampler as unknown as {
    setRandomGenerator: (generator: () => number) => MeshSurfaceSampler;
  }).setRandomGenerator(() => seededNoise((sampleIndex += 1) * 9.731 + salt));
  sampler.build();
  return sampler;
}

function getSurfaceParticleBindings(sourceScene: THREE.Object3D) {
  let cumulativeWeight = 0;
  return sceneTokens.particles.surfaceNodes.flatMap<SurfaceParticleBinding>((definition, index) => {
    const mesh = getNamedMesh(sourceScene, definition.name);
    if (!mesh) return [];
    cumulativeWeight += definition.weight;
    return [{
      mesh,
      sampler: makeSurfaceSampler(mesh, 7.17 + index * 13.1),
      bounds: new THREE.Box3().setFromObject(mesh),
      normalMatrix: new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld),
      wake: definition.wake,
      color: new THREE.Color(definition.color).multiplyScalar(sceneTokens.particles.luminance.active),
      cumulativeWeight,
    }];
  });
}

function getSignalRoutes(sourceScene: THREE.Object3D, knownHaloCenter?: THREE.Vector3) {
  sourceScene.updateMatrixWorld(true);
  const sceneBounds = new THREE.Box3().setFromObject(sourceScene);
  const sceneCenter = sceneBounds.getCenter(new THREE.Vector3());
  const haloCenter = knownHaloCenter
    ?? getObjectCenter(sourceScene, sceneTokens.particles.modelNodes.haloMesh)
    ?? getObjectCenter(sourceScene, sceneTokens.particles.modelNodes.haloAnchor)
    ?? new THREE.Vector3(0, sceneCenter.y, 0);
  const getRoutePoint = (name: string) => name === sceneTokens.particles.modelNodes.haloMesh
    ? haloCenter.clone()
    : getObjectCenter(sourceScene, name);
  const routes = sceneTokens.particles.modelNodes.signalRoutes.flatMap<SignalRoute>((names) => {
    const from = getRoutePoint(names[0]);
    const to = getRoutePoint(names[1]);
    if (!from || !to) return [];
    const control = from.clone().lerp(to, 0.5);
    const horizontalDistance = Math.hypot(to.x - from.x, to.z - from.z);
    control.y += Math.min(0.72, 0.16 + horizontalDistance * 0.08);
    control.z = THREE.MathUtils.lerp(control.z, sceneCenter.z, 0.08);
    return [{ from, control, to }];
  });
  if (routes.length === 0) {
    const left = new THREE.Vector3(sceneBounds.min.x, sceneCenter.y, sceneCenter.z);
    const right = new THREE.Vector3(sceneBounds.max.x, sceneCenter.y, sceneCenter.z);
    routes.push(
      { from: left, control: left.clone().lerp(haloCenter, 0.5).add(new THREE.Vector3(0, 0.3, 0)), to: haloCenter.clone() },
      { from: haloCenter.clone(), control: haloCenter.clone().lerp(right, 0.5).add(new THREE.Vector3(0, 0.3, 0)), to: right },
    );
  }
  return routes;
}

function makeSignalField(count: number, sourceScene: THREE.Object3D): SignalFieldData {
  sourceScene.updateMatrixWorld(true);
  const sceneBounds = new THREE.Box3().setFromObject(sourceScene);
  const sceneCenter = sceneBounds.getCenter(new THREE.Vector3());
  const sceneSize = sceneBounds.getSize(new THREE.Vector3());
  const floorObject = sourceScene.getObjectByName(sceneTokens.particles.modelNodes.floor);
  const floorBounds = floorObject ? new THREE.Box3().setFromObject(floorObject) : sceneBounds;
  const floorY = floorBounds.isEmpty() ? sceneBounds.min.y : floorBounds.max.y;
  const haloMeshObject = sourceScene.getObjectByName(sceneTokens.particles.modelNodes.haloMesh);
  const haloMesh = haloMeshObject instanceof THREE.Mesh ? haloMeshObject : null;
  const haloCenter = haloMesh
    ? new THREE.Box3().setFromObject(haloMesh).getCenter(new THREE.Vector3())
    : getObjectCenter(sourceScene, sceneTokens.particles.modelNodes.haloAnchor) ?? new THREE.Vector3(0, sceneCenter.y, 0);
  const focus = getObjectCenter(sourceScene, sceneTokens.particles.modelNodes.focusAnchor) ?? sceneCenter.clone();
  const signalRoutes = getSignalRoutes(sourceScene, haloCenter);
  const surfaceBindings = getSurfaceParticleBindings(sourceScene);
  const surfaceWeight = surfaceBindings.at(-1)?.cumulativeWeight ?? 0;
  const layerWeight = sceneTokens.particles.layers.atmosphere
    + sceneTokens.particles.layers.surface
    + sceneTokens.particles.layers.signal;
  const atmosphereCount = Math.floor(count * sceneTokens.particles.layers.atmosphere / layerWeight);
  const surfaceCount = Math.floor(count * sceneTokens.particles.layers.surface / layerWeight);
  const surfaceEnd = Math.min(count, atmosphereCount + surfaceCount);

  const ambient = new Float32Array(count * 3);
  const surfaceTargets = new Float32Array(count * 3);
  const pathFrom = new Float32Array(count * 3);
  const pathControl = new Float32Array(count * 3);
  const pathTo = new Float32Array(count * 3);
  const ring = new Float32Array(count * 3);
  const energyColors = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const layers = new Float32Array(count);
  const wakes = new Float32Array(count);
  const pointScales = new Float32Array(count);
  const quiet = new THREE.Color(sceneTokens.particles.quietColor).multiplyScalar(sceneTokens.particles.luminance.quiet);
  const palette = sceneTokens.particles.palette.map((color) => (
    new THREE.Color(color).multiplyScalar(sceneTokens.particles.luminance.active)
  ));
  const ringSampler = haloMesh ? makeSurfaceSampler(haloMesh, 3.17) : null;
  const ringSample = new THREE.Vector3();
  const surfaceSample = new THREE.Vector3();
  const surfaceNormal = new THREE.Vector3();
  const surfaceSize = new THREE.Vector3();
  const fallbackRadius = Math.max(sceneSize.x, sceneSize.z) * 0.2;

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    const seedA = seededNoise(index * 3.17 + 1.3);
    const seedB = seededNoise(index * 7.91 + 4.7);
    const seedC = seededNoise(index * 13.37 + 9.2);
    seeds[index] = seededNoise(index * 17.17 + 5.9);
    const distribution = index % 20;
    if (distribution < 5) {
      // Ground dust creates contact and scale without turning into a visible grid.
      ambient[offset] = sceneCenter.x + (seedA * 2 - 1) * sceneSize.x * 0.5;
      ambient[offset + 1] = floorY + 0.035 + Math.pow(seedB, 2.4) * 0.32;
      ambient[offset + 2] = sceneCenter.z + (seedC * 2 - 1) * sceneSize.z * 0.52;
    } else if (distribution < 12) {
      // A true volume layer provides foreground/background parallax and depth.
      ambient[offset] = sceneCenter.x + (seedA * 2 - 1) * sceneSize.x * 0.46;
      ambient[offset + 1] = floorY + 0.18 + Math.pow(seedB, 1.25) * sceneSize.y * 0.78;
      ambient[offset + 2] = sceneCenter.z + (seedC * 2 - 1) * sceneSize.z * 0.46;
    } else if (distribution < 17) {
      // A restrained far-wall layer supports the concept-art atmosphere.
      ambient[offset] = sceneCenter.x + (seedA * 2 - 1) * sceneSize.x * 0.51;
      ambient[offset + 1] = floorY + 0.3 + seedB * sceneSize.y * 0.88;
      ambient[offset + 2] = sceneBounds.min.z + sceneSize.z * (0.015 + seedC * 0.045);
    } else {
      // Sparse side-volume particles keep the field from reading as flat planes.
      ambient[offset] = distribution % 2 === 0
        ? THREE.MathUtils.lerp(sceneBounds.min.x, sceneCenter.x, seedA * 0.18)
        : THREE.MathUtils.lerp(sceneBounds.max.x, sceneCenter.x, seedA * 0.18);
      ambient[offset + 1] = floorY + 0.25 + seedB * sceneSize.y * 0.82;
      ambient[offset + 2] = sceneCenter.z + (seedC * 2 - 1) * sceneSize.z * 0.45;
    }

    surfaceTargets.set(ambient.subarray(offset, offset + 3), offset);
    pathFrom.set(ambient.subarray(offset, offset + 3), offset);
    pathControl.set(ambient.subarray(offset, offset + 3), offset);
    pathTo.set(ambient.subarray(offset, offset + 3), offset);
    ring.set(ambient.subarray(offset, offset + 3), offset);

    let layer = index < atmosphereCount ? 0 : index < surfaceEnd ? 1 : 2;
    if (layer === 1 && surfaceWeight > 0) {
      const selection = seededNoise((index - atmosphereCount) * 5.17 + 1.9) * surfaceWeight;
      const binding = surfaceBindings.find((candidate) => selection <= candidate.cumulativeWeight) ?? surfaceBindings.at(-1);
      if (binding) {
        binding.sampler.sample(surfaceSample, surfaceNormal);
        surfaceSample.applyMatrix4(binding.mesh.matrixWorld);
        surfaceNormal.applyMatrix3(binding.normalMatrix).normalize();
        surfaceSample.addScaledVector(surfaceNormal, sceneTokens.particles.motion.surfaceOffset);
        surfaceSample.toArray(surfaceTargets, offset);
        const height = Math.max(0.001, binding.bounds.getSize(surfaceSize).y);
        const verticalOrder = THREE.MathUtils.clamp((surfaceSample.y - binding.bounds.min.y) / height, 0, 1);
        wakes[index] = binding.wake + verticalOrder * 0.035;
        binding.color.toArray(energyColors, offset);
      }
      pointScales[index] = 0.75 + seedB * 0.45;
    } else if (layer === 2) {
      const signalIndex = index - surfaceEnd;
      const route = signalRoutes[signalIndex % signalRoutes.length];
      route.from.toArray(pathFrom, offset);
      route.control.toArray(pathControl, offset);
      route.to.toArray(pathTo, offset);
      if (ringSampler && haloMesh) {
        ringSampler.sample(ringSample);
        ringSample.applyMatrix4(haloMesh.matrixWorld).toArray(ring, offset);
      } else {
        const angle = signalIndex * 2.399963;
        ring[offset] = haloCenter.x + Math.cos(angle) * fallbackRadius;
        ring[offset + 1] = haloCenter.y + (seedB - 0.5) * 0.16;
        ring[offset + 2] = haloCenter.z + Math.sin(angle) * fallbackRadius;
      }
      const signalColor = palette[(signalIndex + 1) % palette.length];
      signalColor.toArray(energyColors, offset);
      pointScales[index] = 0.8 + seedB * 0.5;
    } else {
      layer = 0;
      const dustColor = palette[index % palette.length];
      dustColor.toArray(energyColors, offset);
      pointScales[index] = 0.55 + seedB * 0.7;
    }
    layers[index] = layer;
    const energy = palette[index % palette.length];
    if (energyColors[offset] === 0 && energyColors[offset + 1] === 0 && energyColors[offset + 2] === 0) {
      energy.toArray(energyColors, offset);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(ambient, 3));
  geometry.setAttribute("aSurface", new THREE.BufferAttribute(surfaceTargets, 3));
  geometry.setAttribute("aPathFrom", new THREE.BufferAttribute(pathFrom, 3));
  geometry.setAttribute("aPathControl", new THREE.BufferAttribute(pathControl, 3));
  geometry.setAttribute("aPathTo", new THREE.BufferAttribute(pathTo, 3));
  geometry.setAttribute("aRing", new THREE.BufferAttribute(ring, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute("aLayer", new THREE.BufferAttribute(layers, 1));
  geometry.setAttribute("aWake", new THREE.BufferAttribute(wakes, 1));
  geometry.setAttribute("aPointScale", new THREE.BufferAttribute(pointScales, 1));
  geometry.setAttribute("aEnergyColor", new THREE.BufferAttribute(energyColors, 3));
  const quietColors = new Float32Array(count * 3);
  for (let index = 0; index < quietColors.length; index += 3) {
    quietColors[index] = quiet.r;
    quietColors[index + 1] = quiet.g;
    quietColors[index + 2] = quiet.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(quietColors, 3));
  geometry.computeBoundingSphere();
  return { geometry, focus };
}

function SignalField({ quality }: { quality: SceneQuality }) {
  const gltf = useLoader(GLTFLoader, assetSlots.assembled);
  const { camera, gl, size } = useThree();
  const data = useMemo(() => makeSignalField(sceneTokens.particles.count[quality], gltf.scene), [gltf.scene, quality]);
  const pointerNdc = useRef(new THREE.Vector2());
  const pointerWorld = useRef(data.focus.clone());
  const focusWorld = useRef(data.focus.clone());
  const pointerPlane = useRef(new THREE.Plane());
  const pointerNormal = useRef(new THREE.Vector3());
  const raycaster = useRef(new THREE.Raycaster());
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uReset: { value: 0 },
      uSignalAmount: { value: 0 },
      uRingAmount: { value: 0 },
      uActivation: { value: 0 },
      uEnergyAmount: { value: 0 },
      uCelebration: { value: 0 },
      uPeak: { value: 0 },
      uResponse: { value: 0.26 },
      uPointer: { value: data.focus.clone() },
      uPointerNormal: { value: new THREE.Vector3(0, 0, 1) },
      uPointerPulse: { value: 0 },
      uModelScale: { value: 1 },
      uModelYOffset: { value: 0 },
      uPointSize: { value: sceneTokens.particles.size[quality].glow },
      uCoreRatio: { value: sceneTokens.particles.size[quality].core / sceneTokens.particles.size[quality].glow },
      uMaximumPointSize: { value: sceneTokens.particles.screenSize.maximum[quality] },
      uViewportHeight: { value: size.height },
      uPixelRatio: { value: gl.getPixelRatio() },
      uCoreOpacityIdle: { value: sceneTokens.particles.opacity.core.idle },
      uCoreOpacityActive: { value: sceneTokens.particles.opacity.core.active },
      uGlowOpacityIdle: { value: sceneTokens.particles.opacity.glow.idle },
      uGlowOpacityActive: { value: sceneTokens.particles.opacity.glow.active },
    },
    vertexShader: `
      attribute vec3 color;
      attribute vec3 aSurface;
      attribute vec3 aPathFrom;
      attribute vec3 aPathControl;
      attribute vec3 aPathTo;
      attribute vec3 aRing;
      attribute vec3 aEnergyColor;
      attribute float aSeed;
      attribute float aLayer;
      attribute float aWake;
      attribute float aPointScale;
      uniform float uTime;
      uniform float uProgress;
      uniform float uReset;
      uniform float uSignalAmount;
      uniform float uRingAmount;
      uniform float uActivation;
      uniform float uEnergyAmount;
      uniform float uCelebration;
      uniform float uPeak;
      uniform float uResponse;
      uniform vec3 uPointer;
      uniform vec3 uPointerNormal;
      uniform float uPointerPulse;
      uniform float uModelScale;
      uniform float uModelYOffset;
      uniform float uPointSize;
      uniform float uMaximumPointSize;
      uniform float uViewportHeight;
      uniform float uPixelRatio;
      varying vec3 vColor;
      varying float vActivity;
      varying float vVisibility;
      varying float vBreath;

      void main() {
        float phase = aSeed * 31.4159;
        float dustMask = 1.0 - step(0.5, aLayer);
        float surfaceMask = step(0.5, aLayer) * (1.0 - step(1.5, aLayer));
        float signalMask = step(1.5, aLayer);
        float driftAmount = ${sceneTokens.particles.motion.drift.toFixed(4)};
        vec3 drift = vec3(
          sin(uTime * 0.31 + phase),
          cos(uTime * 0.27 + phase * 1.37),
          sin(uTime * 0.23 + phase * 0.73)
        ) * driftAmount;
        vec3 modelOffset = vec3(0.0, uModelYOffset, 0.0);
        vec3 surfaceTarget = aSurface * uModelScale + modelOffset + drift * 0.1;
        vec3 routeFrom = aPathFrom * uModelScale + modelOffset;
        vec3 routeControl = aPathControl * uModelScale + modelOffset;
        vec3 routeTo = aPathTo * uModelScale + modelOffset;
        vec3 ringTarget = aRing * uModelScale + modelOffset;
        float travel = fract(aSeed + uTime * ${sceneTokens.particles.motion.signalSpeed.toFixed(4)});
        vec3 routeA = mix(routeFrom, routeControl, travel);
        vec3 routeB = mix(routeControl, routeTo, travel);
        vec3 signalTarget = mix(routeA, routeB, travel);
        signalTarget += vec3(
          sin(phase + travel * 6.2831),
          cos(phase * 0.7 + travel * 6.2831) * 0.3,
          cos(phase + travel * 6.2831)
        ) * 0.028;
        signalTarget = mix(signalTarget, ringTarget + drift * 0.08, uRingAmount);
        vec3 dustPosition = position + drift * (0.72 + aPointScale * 0.28);
        vec3 worldPosition = dustPosition * dustMask + surfaceTarget * surfaceMask + signalTarget * signalMask;

        float surfaceReveal = smoothstep(aWake, aWake + 0.06, uProgress) * (1.0 - uReset);
        float signalVisibility = uActivation * (0.24 + uSignalAmount * 0.76) * (1.0 - uReset);
        float particlePopulation = mix(
          ${sceneTokens.visualStory.particles.quietPopulation.toFixed(3)},
          ${sceneTokens.visualStory.particles.livingPopulation.toFixed(3)},
          uCelebration
        );
        particlePopulation = mix(
          particlePopulation,
          ${sceneTokens.visualStory.particles.peakPopulation.toFixed(3)},
          uPeak
        );
        float dustPopulation = step(1.0 - particlePopulation, aSeed);
        vVisibility = dustMask * dustPopulation
          + surfaceMask * surfaceReveal * (0.4 + uEnergyAmount * 0.6)
          + signalMask * signalVisibility;

        vec3 pointerDelta = worldPosition - uPointer;
        float pointerDistance = max(length(pointerDelta), 0.001);
        float pointerLayerScale = dustMask + surfaceMask * 0.08 + signalMask * 0.35;
        float influence = (1.0 - smoothstep(0.0, ${sceneTokens.particles.motion.pointerRadius.toFixed(4)}, pointerDistance)) * uResponse * pointerLayerScale;
        vec3 radial = pointerDelta / pointerDistance;
        vec3 curl = normalize(cross(uPointerNormal, radial) + vec3(0.0001));
        worldPosition += curl * influence * ${sceneTokens.particles.motion.pointerCurl.toFixed(4)};
        worldPosition += radial * influence * ${sceneTokens.particles.motion.pointerPush.toFixed(4)};
        float ripple = sin(pointerDistance * 5.2 - (1.0 - uPointerPulse) * 16.0)
          * uPointerPulse * exp(-pointerDistance * 0.42);
        worldPosition += radial * ripple * ${sceneTokens.particles.motion.pressRipple.toFixed(4)};

        vec4 viewPosition = modelViewMatrix * vec4(worldPosition, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        float pulseSize = 1.0 + uPointerPulse * 0.45;
        float layerSize = aPointScale * (dustMask * 0.78 + surfaceMask * 0.96 + signalMask * 1.06);
        float storySize = mix(1.0, ${sceneTokens.visualStory.particles.livingScale.toFixed(3)}, uCelebration);
        storySize = mix(storySize, ${sceneTokens.visualStory.particles.peakScale.toFixed(3)}, uPeak);
        gl_PointSize = clamp(
          uPointSize * layerSize * pulseSize * storySize * uViewportHeight * uPixelRatio * 0.5 / max(1.0, -viewPosition.z),
          ${sceneTokens.particles.screenSize.minimum.toFixed(2)},
          uMaximumPointSize
        );
        vActivity = dustMask * (0.08 + uActivation * 0.12 + uCelebration * 0.28 + uPeak * 0.24)
          + surfaceMask * surfaceReveal * (0.55 + uEnergyAmount * 0.45)
          + signalMask * signalVisibility * (0.72 + uSignalAmount * 0.28);
        float colorMix = dustMask * (0.035 + uActivation * 0.08 + uCelebration * 0.44)
          + surfaceMask * surfaceReveal * (0.5 + uEnergyAmount * 0.5)
          + signalMask * (0.68 + uSignalAmount * 0.32);
        vColor = mix(color, aEnergyColor, colorMix);
        vColor *= mix(1.0, ${sceneTokens.visualStory.particles.livingBrightness.toFixed(3)}, uCelebration);
        vColor *= mix(1.0, ${sceneTokens.visualStory.particles.peakBrightness.toFixed(3)}, uPeak);
        vBreath = 0.86 + sin(uTime * (0.8 + aSeed * 0.5) + phase) * 0.14;
      }
    `,
    fragmentShader: `
      uniform float uCoreRatio;
      uniform float uCoreOpacityIdle;
      uniform float uCoreOpacityActive;
      uniform float uGlowOpacityIdle;
      uniform float uGlowOpacityActive;
      varying vec3 vColor;
      varying float vActivity;
      varying float vVisibility;
      varying float vBreath;

      void main() {
        vec2 centered = gl_PointCoord * 2.0 - 1.0;
        float radius = length(centered);
        if (radius > 1.0) discard;
        float core = 1.0 - smoothstep(uCoreRatio * 0.12, uCoreRatio, radius);
        float glow = pow(1.0 - radius, 2.6);
        float coreOpacity = mix(uCoreOpacityIdle, uCoreOpacityActive, vActivity);
        float glowOpacity = mix(uGlowOpacityIdle, uGlowOpacityActive, vActivity);
        float alpha = (core * coreOpacity + glow * glowOpacity) * vBreath * vVisibility;
        gl_FragColor = vec4(vColor * (0.72 + core * 0.58), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }), [data.focus, gl, quality, size.height]);

  useEffect(() => () => {
    data.geometry.dispose();
    material.dispose();
  }, [data, material]);
  useFrame(({ clock }, delta) => {
    const progress = experienceState.progress;
    const story = experienceState.narrative;
    const reset = smoothstep(phaseProgress(progress, activationSequence.loopReset));
    const signalAmount = smoothstep(phaseProgress(progress, activationSequence.intelligence)) * (1 - reset);
    const ringAmount = smoothstep(phaseProgress(progress, activationSequence.haloCondense)) * (1 - reset);
    const activation = smoothstep(phaseProgress(progress, activationSequence.lightTrails)) * (1 - reset);
    const energyAmount = story.energy;
    const pulse = experienceState.pointerPulse;
    const response = 0.26 + activation * 0.74;
    const modelScale = 0.965 + experienceState.assemblyProgress * 0.035;
    const modelYOffset = -0.16 * (1 - experienceState.assemblyProgress);
    pointerNdc.current.set(experienceState.pointerX, -experienceState.pointerY);
    camera.getWorldDirection(pointerNormal.current);
    focusWorld.current.copy(data.focus).multiplyScalar(modelScale);
    focusWorld.current.y += modelYOffset;
    pointerPlane.current.setFromNormalAndCoplanarPoint(pointerNormal.current, focusWorld.current);
    raycaster.current.setFromCamera(pointerNdc.current, camera);
    raycaster.current.ray.intersectPlane(pointerPlane.current, pointerWorld.current);
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uProgress.value = progress;
    material.uniforms.uReset.value = reset;
    material.uniforms.uSignalAmount.value = signalAmount;
    material.uniforms.uRingAmount.value = ringAmount;
    material.uniforms.uActivation.value = activation;
    material.uniforms.uEnergyAmount.value = energyAmount;
    material.uniforms.uCelebration.value = story.energy;
    material.uniforms.uPeak.value = story.peak;
    material.uniforms.uResponse.value = response;
    material.uniforms.uPointer.value.copy(pointerWorld.current);
    material.uniforms.uPointerNormal.value.copy(pointerNormal.current);
    material.uniforms.uPointerPulse.value = pulse;
    material.uniforms.uModelScale.value = modelScale;
    material.uniforms.uModelYOffset.value = modelYOffset;
    material.uniforms.uViewportHeight.value = size.height;
    material.uniforms.uPixelRatio.value = gl.getPixelRatio();
    experienceState.pointerPulse = Math.max(0, pulse - delta * 0.52);
  });

  return (
    <points geometry={data.geometry} material={material} frustumCulled={false} />
  );
}

function ExhibitionWorld({
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
  const { scene } = useThree();
  const trailMaterials = useRef<Array<THREE.LineBasicMaterial | null>>([]);
  const trailObjects = useRef<Array<THREE.LineSegments | null>>([]);
  const ambientLight = useRef<THREE.AmbientLight>(null);
  const hemisphereLight = useRef<THREE.HemisphereLight>(null);
  const keyLight = useRef<THREE.DirectionalLight>(null);
  const fillLight = useRef<THREE.DirectionalLight>(null);
  const revealLight = useRef<THREE.PointLight>(null);
  const magentaLight = useRef<THREE.PointLight>(null);
  const amberLight = useRef<THREE.PointLight>(null);
  const interactionLight = useRef<THREE.PointLight>(null);
  const pointer = useRef(new THREE.Vector2());
  const quietBackground = useMemo(() => new THREE.Color(sceneTokens.environment.background.quiet), []);
  const activeBackground = useMemo(() => new THREE.Color(sceneTokens.environment.background.active), []);
  const peakBackground = useMemo(() => new THREE.Color(sceneTokens.environment.background.peak), []);
  const background = useMemo(() => new THREE.Color(), []);
  const trails = useMemo(() => [
    makeTrail([[-7, 0.025, 5.8], [-4.2, 0.03, 3.4], [-2.2, 0.035, 1.9], [0, 0.04, 1.1]]),
    makeTrail([[7, 0.026, 4.7], [4.7, 0.03, 3.2], [2.4, 0.035, 1.9], [0.5, 0.04, 1.0]]),
    makeTrail([[-5.8, 0.024, -0.8], [-4, 0.03, -0.2], [-2.6, 0.035, 0.7], [-1.2, 0.04, 0.8]]),
    makeTrail([[6.2, 0.027, -1.25], [4.8, 0.032, -0.45], [3.1, 0.036, 0.35], [1.25, 0.041, 0.78]]),
    makeTrail([[-7.4, 0.023, 2.1], [-5.1, 0.029, 1.3], [-3.3, 0.035, 1.45], [-1.65, 0.042, 0.9]]),
    makeTrail([[7.6, 0.024, 1.7], [5.6, 0.03, 1.05], [3.7, 0.036, 1.38], [1.85, 0.042, 0.84]]),
  ], []);
  useEffect(() => () => trails.forEach((trail) => trail.dispose()), [trails]);

  useFrame(({ clock }) => {
    const progress = experienceState.progress;
    const story = experienceState.narrative;
    pointer.current.lerp(new THREE.Vector2(experienceState.pointerX, experienceState.pointerY), 0.045);
    const rawReset = smoothstep(phaseProgress(progress, activationSequence.loopReset));
    const reset = rawReset > 0.98 ? 1 : rawReset;
    const trailAmount = smoothstep(phaseProgress(progress, activationSequence.lightTrails)) * (1 - reset);
    trails.forEach((geometry, index) => {
      const line = trailObjects.current[index];
      const material = trailMaterials.current[index];
      const count = geometry.getAttribute("position").count;
      line?.geometry.setDrawRange(0, Math.max(0, Math.floor(count * Math.max(0, trailAmount - index * 0.045))));
      if (material) {
        const storyOpacity = Math.max(
          story.living * sceneTokens.visualStory.trails.livingOpacity,
          story.peak * sceneTokens.visualStory.trails.peakOpacity,
        );
        material.opacity = Math.min(1, (0.22 + storyOpacity) * trailAmount);
      }
    });
    if (ambientLight.current) ambientLight.current.intensity = sceneTokens.environment.lights.ambient * (1 - story.living * 0.12 - story.peak * 0.24);
    if (hemisphereLight.current) hemisphereLight.current.intensity = sceneTokens.environment.lights.hemisphere * (1 - story.living * 0.08 - story.peak * 0.18);
    if (keyLight.current) keyLight.current.intensity = sceneTokens.environment.lights.key * (1 - story.living * 0.1 - story.peak * 0.18);
    if (fillLight.current) fillLight.current.intensity = sceneTokens.environment.lights.fill * (1 + story.living * 0.24 + story.peak * 0.22);
    if (revealLight.current) revealLight.current.intensity = (0.15 + story.energy * 6.4 + story.peak * 2.2) * experienceState.lightScale;
    if (magentaLight.current) magentaLight.current.intensity = (story.energy * 2.4 + story.peak * 2.1 + Math.sin(clock.elapsedTime * 0.72) * story.energy * 0.2) * experienceState.lightScale;
    if (amberLight.current) amberLight.current.intensity = (story.energy * 1.85 + story.peak * 2.35 + Math.cos(clock.elapsedTime * 0.58) * story.energy * 0.16) * experienceState.lightScale;
    if (interactionLight.current) {
      interactionLight.current.position.set(pointer.current.x * 7, 3.7 - pointer.current.y * 2.8, 4.5);
      interactionLight.current.intensity = (0.18 + story.energy * 0.72 + experienceState.pointerPulse * 1.4) * experienceState.lightScale;
    }
    background.copy(quietBackground).lerp(activeBackground, story.living * 0.82).lerp(peakBackground, story.peak * 0.78);
    scene.background = background;
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(background);
      scene.fog.near = sceneTokens.environment.fog.near + story.energy * 3.5;
      scene.fog.far = sceneTokens.environment.fog.far + story.energy * 12;
    }
  });

  return (
    <>
      <fog attach="fog" args={[sceneTokens.colors.fog, sceneTokens.environment.fog.near, sceneTokens.environment.fog.far]} />
      <ambientLight ref={ambientLight} intensity={sceneTokens.environment.lights.ambient} color="#fffdf8" />
      <hemisphereLight ref={hemisphereLight} args={["#f7f9fa", "#778592", sceneTokens.environment.lights.hemisphere]} />
      <directionalLight ref={keyLight} castShadow position={[4, 10, 7]} intensity={sceneTokens.environment.lights.key} color="#fff8ea" shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight ref={fillLight} position={[-7, 4, 4]} intensity={sceneTokens.environment.lights.fill} color="#b8dfff" />
      <pointLight ref={revealLight} position={[0, 4.2, 1]} intensity={0.15} distance={20} color={sceneTokens.colors.cyan} />
      <pointLight ref={magentaLight} position={[-5.5, 3.1, 1.8]} intensity={0} distance={16} color={sceneTokens.colors.magenta} />
      <pointLight ref={amberLight} position={[5.8, 2.4, 2.6]} intensity={0} distance={16} color={sceneTokens.colors.amber} />
      <pointLight ref={interactionLight} position={[0, 3.7, 4.5]} intensity={0.18} distance={8} color={sceneTokens.colors.cyan} />

      <Suspense fallback={null}>
        <CameraRig />
        <MandegarModel
          projects={projects}
          onFirstFrame={onFirstFrame}
          onProjectSelect={onProjectSelect}
          onSpatialFrame={onSpatialFrame}
        />
        <SignalField quality={quality} />
      </Suspense>
      {trails.map((geometry, index) => (
        <lineSegments key={index} ref={(value) => { trailObjects.current[index] = value; }} geometry={geometry}>
          <lineBasicMaterial ref={(value) => { trailMaterials.current[index] = value; }} color={sceneTokens.visualStory.trails.colors[index]} transparent opacity={0} depthWrite={false} />
        </lineSegments>
      ))}
      {sceneTokens.featureFlags.audience ? <AudienceSystem quality={quality} /> : null}
    </>
  );
}

class CanvasErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== "production") console.warn("Mandegar exhibition canvas fallback", error, info.componentStack);
  }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

function CanvasFallback({ className }: { className?: string }) {
  return <div className={className} data-webgl="fallback" aria-hidden="true" />;
}

export function ExperienceCanvas({ className, enabledByCms = true, projects = [], zoneLabels, onProjectSelect, onRuntimeReady, onFirstFrame }: ExperienceCanvasProps) {
  const [runtime, setRuntime] = useState<RuntimeState>("pending");
  const [pageVisible, setPageVisible] = useState(true);
  const spatialRoot = useRef<HTMLDivElement>(null);
  const primaryLeader = useRef<SVGPathElement>(null);
  const secondaryLeader = useRef<SVGPathElement>(null);
  const measurementGroup = useRef<SVGGElement>(null);
  const measurementLine = useRef<SVGPathElement>(null);
  const primaryLabel = useRef<HTMLDivElement>(null);
  const secondaryLabel = useRef<HTMLDivElement>(null);
  const primaryCode = useRef<HTMLSpanElement>(null);
  const primaryValue = useRef<HTMLElement>(null);
  const secondaryCode = useRef<HTMLSpanElement>(null);
  const secondaryValue = useRef<HTMLElement>(null);
  const measurementLabel = useRef<HTMLDivElement>(null);
  const projectLabel = projects[0]?.label || "PRIMARY DISPLAY";
  const spatialHudCopy = useMemo<Record<SpatialHudModeId, SpatialHudModeCopy>>(() => ({
    assembly: {
      primaryCode: "FORM / 01",
      primaryValue: "CORE ASSEMBLY",
      measurementPrefix: "H",
    },
    activationLeft: {
      primaryCode: "SIGNAL / L",
      primaryValue: "EXPERIENCE POD",
      secondaryCode: "TOUCH / L",
      secondaryValue: "INTERACTION SURFACE",
    },
    activationRight: {
      primaryCode: "SIGNAL / R",
      primaryValue: "EXPERIENCE POD",
      secondaryCode: "TOUCH / R",
      secondaryValue: "INTERACTION SURFACE",
    },
    reveal: {
      primaryCode: "LIGHT / 01",
      primaryValue: "CANOPY SIGNAL",
      secondaryCode: "CORE / ACTIVE",
      secondaryValue: "REVEAL COMPLETE",
      measurementPrefix: "DIA",
    },
    experiences: {
      primaryCode: "ZONE / L",
      primaryValue: zoneLabels?.photo || "PHOTO EXPERIENCE",
      secondaryCode: "ZONE / R",
      secondaryValue: zoneLabels?.game || "GAME EXPERIENCE",
    },
    proof: {
      primaryCode: "MEDIA / 21:9",
      primaryValue: projectLabel,
      measurementPrefix: "W",
    },
    intelligence: {
      primaryCode: "FLOW / INPUT",
      primaryValue: "HUMAN SIGNAL",
      secondaryCode: "CORE / OUTPUT",
      secondaryValue: "SOFT INSIGHT",
      measurementPrefix: "DELTA",
    },
  }), [projectLabel, zoneLabels?.game, zoneLabels?.photo]);

  const renderSpatialHud = useCallback((frame: SpatialHudFrame) => {
    const root = spatialRoot.current;
    if (!root) return;
    const copy = frame.mode ? spatialHudCopy[frame.mode] : null;
    const active = Boolean(copy) && frame.opacity > 0.002 && (frame.primary.visible || frame.secondary.visible);
    root.style.opacity = frame.opacity.toFixed(4);
    root.style.visibility = active ? "visible" : "hidden";
    root.dataset.compact = frame.compact ? "true" : "false";
    root.dataset.mode = frame.mode ?? "none";
    if (!active || !copy) return;

    if (primaryCode.current?.textContent !== copy.primaryCode) primaryCode.current!.textContent = copy.primaryCode;
    if (primaryValue.current?.textContent !== copy.primaryValue) primaryValue.current!.textContent = copy.primaryValue;
    if (secondaryCode.current && secondaryCode.current.textContent !== (copy.secondaryCode ?? "")) secondaryCode.current.textContent = copy.secondaryCode ?? "";
    if (secondaryValue.current && secondaryValue.current.textContent !== (copy.secondaryValue ?? "")) secondaryValue.current.textContent = copy.secondaryValue ?? "";

    const safeArea = frame.compact ? sceneTokens.spatialLabels.safeArea.compact : sceneTokens.spatialLabels.safeArea.desktop;
    const labelHalfWidth = frame.compact ? 60 : 84;
    const horizontalOffset = frame.compact ? 82 : 128;
    const coreSide = frame.primary.x <= frame.width * 0.52 ? -1 : 1;
    const mediaSide = -coreSide;
    const inlineSafety = Math.min(safeArea.inline, Math.max(12, (frame.width - labelHalfWidth * 2) / 3));
    const safeTop = Math.min(safeArea.top, frame.height * 0.35);
    const safeBottom = Math.min(safeArea.bottom, frame.height * 0.35);
    const clampX = (value: number) => THREE.MathUtils.clamp(value, inlineSafety + labelHalfWidth, frame.width - inlineSafety - labelHalfWidth);
    const clampY = (value: number) => THREE.MathUtils.clamp(value, safeTop, frame.height - safeBottom);
    const placeAnnotation = (
      point: SpatialScreenPoint,
      side: number,
      verticalOffset: number,
      label: HTMLDivElement | null,
      leader: SVGPathElement | null,
    ) => {
      if (!label || !leader) return;
      const visible = point.visible;
      label.dataset.side = side < 0 ? "left" : "right";
      label.style.opacity = visible ? "1" : "0";
      label.style.visibility = visible ? "visible" : "hidden";
      leader.style.opacity = visible ? "1" : "0";
      if (!visible) return;
      const labelX = clampX(point.x + side * horizontalOffset);
      const labelY = clampY(point.y + verticalOffset);
      const edgeX = labelX - side * labelHalfWidth;
      const elbowX = point.x + side * Math.min(34, Math.abs(edgeX - point.x) * 0.42);
      const elbowY = THREE.MathUtils.lerp(point.y, labelY, 0.48);
      label.style.transform = `translate3d(${labelX.toFixed(2)}px, ${labelY.toFixed(2)}px, 0) translate(-50%, -50%)`;
      leader.setAttribute(
        "d",
        `M ${point.x.toFixed(2)} ${point.y.toFixed(2)} L ${elbowX.toFixed(2)} ${elbowY.toFixed(2)} L ${edgeX.toFixed(2)} ${labelY.toFixed(2)} M ${(point.x - 3).toFixed(2)} ${point.y.toFixed(2)} L ${point.x.toFixed(2)} ${(point.y - 3).toFixed(2)} L ${(point.x + 3).toFixed(2)} ${point.y.toFixed(2)} L ${point.x.toFixed(2)} ${(point.y + 3).toFixed(2)} Z`,
      );
    };

    placeAnnotation(frame.primary, coreSide, frame.compact ? -46 : -62, primaryLabel.current, primaryLeader.current);
    placeAnnotation(frame.secondary, mediaSide, frame.compact ? 38 : 52, secondaryLabel.current, secondaryLeader.current);

    const showMeasurement = frame.measureStart.visible && frame.measureEnd.visible && frame.measureMeters > 0;
    if (measurementGroup.current) measurementGroup.current.style.opacity = showMeasurement ? "1" : "0";
    if (measurementLabel.current) {
      measurementLabel.current.style.opacity = showMeasurement ? "1" : "0";
      measurementLabel.current.style.visibility = showMeasurement ? "visible" : "hidden";
    }
    if (!showMeasurement || !measurementLine.current || !measurementLabel.current) return;
    const dx = frame.measureEnd.x - frame.measureStart.x;
    const dy = frame.measureEnd.y - frame.measureStart.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const normalX = -dy / length;
    const normalY = dx / length;
    const tick = frame.compact ? 4 : 5;
    measurementLine.current.setAttribute(
      "d",
      `M ${frame.measureStart.x.toFixed(2)} ${frame.measureStart.y.toFixed(2)} L ${frame.measureEnd.x.toFixed(2)} ${frame.measureEnd.y.toFixed(2)} M ${(frame.measureStart.x - normalX * tick).toFixed(2)} ${(frame.measureStart.y - normalY * tick).toFixed(2)} L ${(frame.measureStart.x + normalX * tick).toFixed(2)} ${(frame.measureStart.y + normalY * tick).toFixed(2)} M ${(frame.measureEnd.x - normalX * tick).toFixed(2)} ${(frame.measureEnd.y - normalY * tick).toFixed(2)} L ${(frame.measureEnd.x + normalX * tick).toFixed(2)} ${(frame.measureEnd.y + normalY * tick).toFixed(2)}`,
    );
    const measurementX = clampX((frame.measureStart.x + frame.measureEnd.x) * 0.5 + normalX * 14);
    const measurementY = clampY((frame.measureStart.y + frame.measureEnd.y) * 0.5 + normalY * 14);
    const measurementText = `${copy.measurementPrefix ? `${copy.measurementPrefix} / ` : ""}${frame.measureMeters.toFixed(2)} M`;
    if (measurementLabel.current.textContent !== measurementText) measurementLabel.current.textContent = measurementText;
    measurementLabel.current.style.transform = `translate3d(${measurementX.toFixed(2)}px, ${measurementY.toFixed(2)}px, 0) translate(-50%, -50%)`;
  }, [spatialHudCopy]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
      const supportsWebGL = Boolean(document.createElement("canvas").getContext("webgl2") || document.createElement("canvas").getContext("webgl"));
      const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 8;
      const adaptive = window.matchMedia("(max-width: 760px)").matches || (navigator.hardwareConcurrency || 8) <= 4 || deviceMemory <= 4;
      const nextRuntime: RuntimeState = enabledByCms && !reduced && !saveData && supportsWebGL ? (adaptive ? "adaptive" : "full") : "fallback";
      experienceState.quality = nextRuntime === "full" ? "full" : "adaptive";
      setRuntime(nextRuntime);
      onRuntimeReady?.(nextRuntime);
      if (nextRuntime === "fallback") window.requestAnimationFrame(() => onFirstFrame?.());
    });
    const onVisibilityChange = () => setPageVisible(document.visibilityState === "visible");
    const onPointerMove = (event: PointerEvent) => {
      experienceState.pointerX = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2;
      experienceState.pointerY = (event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2;
    };
    const resetPointer = () => {
      experienceState.pointerX = 0;
      experienceState.pointerY = 0;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("blur", resetPointer);
    document.documentElement.addEventListener("pointerleave", resetPointer);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("blur", resetPointer);
      document.documentElement.removeEventListener("pointerleave", resetPointer);
      experienceState.progress = 0;
      experienceState.pointerX = 0;
      experienceState.pointerY = 0;
      experienceState.pointerPulse = 0;
      experienceState.assemblyProgress = 0;
      experienceState.focusDistance = 18;
      experienceState.focusProject = null;
      experienceState.focusZone = null;
      document.body.style.cursor = "";
    };
  }, [enabledByCms, onFirstFrame, onRuntimeReady]);

  if (runtime === "pending" || runtime === "fallback") return <CanvasFallback className={className} />;
  const profile = qualityProfiles[runtime];
  return (
    <>
      <CanvasErrorBoundary fallback={<CanvasFallback className={className} />}>
        <Canvas
          className={className}
          data-experience-canvas="true"
          data-particle-system="signal-network"
          data-interaction-system="pointer-touch"
          data-color-mode="aces"
          data-postprocessing={runtime === "full" ? "bloom-dof" : "performance"}
          aria-hidden="true"
          dpr={[profile.dpr[0], profile.dpr[1]]}
          frameloop={pageVisible ? "always" : "never"}
          camera={{ position: [0, 4, 27], fov: 48, near: 0.1, far: 60 }}
          shadows={runtime === "full"}
          gl={{ alpha: false, antialias: profile.antialias, powerPreference: runtime === "full" ? "high-performance" : "low-power" }}
          onPointerDown={() => { experienceState.pointerPulse = 1; }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = sceneTokens.environment.exposure;
            gl.outputColorSpace = THREE.SRGBColorSpace;
          }}
        >
          <ExhibitionWorld
            quality={runtime}
            projects={projects}
            onFirstFrame={onFirstFrame}
            onProjectSelect={onProjectSelect}
            onSpatialFrame={renderSpatialHud}
          />
          <ExperiencePostProcessing quality={runtime} />
        </Canvas>
      </CanvasErrorBoundary>
      <div
        ref={spatialRoot}
        className={spatialStyles.root}
        data-spatial-labels="model-anchored"
        data-compact="false"
        dir="ltr"
        style={{
          "--hud-accent": sceneTokens.spatialLabels.accent,
          "--hud-ink": sceneTokens.spatialLabels.ink,
        } as CSSProperties}
        aria-hidden="true"
      >
        <svg className={spatialStyles.graphics} aria-hidden="true">
          <path ref={primaryLeader} className={spatialStyles.leader} />
          <path ref={secondaryLeader} className={`${spatialStyles.leader} ${spatialStyles.secondaryGraphic}`} />
          <g ref={measurementGroup} className={spatialStyles.measurementGroup}>
            <path ref={measurementLine} className={spatialStyles.dimension} />
          </g>
        </svg>
        <div ref={primaryLabel} className={spatialStyles.label} data-side="left">
          <span ref={primaryCode}>FORM / 01</span>
          <strong ref={primaryValue} dir="auto">CORE ASSEMBLY</strong>
        </div>
        <div ref={secondaryLabel} className={`${spatialStyles.label} ${spatialStyles.secondaryLabel}`} data-side="right">
          <span ref={secondaryCode} />
          <strong ref={secondaryValue} dir="auto" />
        </div>
        <div ref={measurementLabel} className={spatialStyles.measurementLabel}>0.00 M</div>
      </div>
    </>
  );
}
