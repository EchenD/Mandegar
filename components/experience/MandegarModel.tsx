"use client";

/* eslint-disable react-hooks/immutability -- R3F render-loop callbacks intentionally mutate Three.js scene objects. */

import { useFrame, useLoader, useThree, type ThreeEvent } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { experienceState } from "./experience-state";
import {
  narrativeCueRanges as activationSequence,
  rangeProgress as phaseProgress,
} from "./narrative-score";
import { assetSlots, sceneTokens } from "./scene-config";
import type { SpatialHudFrame, SpatialHudModeId, SpatialScreenPoint } from "./spatial-hud";

export type SceneProject = { src: string; label: string };

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

type SpatialHudMode = {
  id: SpatialHudModeId;
  range: readonly [number, number];
  primary: ModelAnchor;
  secondary: ModelAnchor | null;
  measureStart: ModelAnchor | null;
  measureEnd: ModelAnchor | null;
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

export function MandegarModel({
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





  useEffect(() => {
    textures.forEach((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.needsUpdate = true;
    });
  }, [textures]);

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
