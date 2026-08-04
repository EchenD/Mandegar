"use client";

/* eslint-disable react-hooks/immutability -- R3F render-loop callbacks intentionally mutate Three.js scene objects. */

import { Canvas, useFrame, useLoader, useThree, type ThreeEvent } from "@react-three/fiber";
import { Component, Suspense, type ErrorInfo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { activationSequence, assetSlots, cameraKeyframes, phaseProgress, qualityProfiles, sceneTokens, type SceneQuality } from "./scene-config";
import { experienceState } from "./experience-state";

type RuntimeState = "pending" | "fallback" | SceneQuality;
type SceneProject = { src: string; label: string };
type ExperienceCanvasProps = {
  className?: string;
  enabledByCms?: boolean;
  projects?: SceneProject[];
  onProjectSelect?: (index: number) => void;
  onRuntimeReady?: (runtime: RuntimeState) => void;
  onFirstFrame?: () => void;
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
  uniform float uHover;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uOffset;
  void main() {
    vec3 quiet = vec3(0.58, 0.61, 0.62);
    vec3 cobalt = vec3(0.13, 0.36, 1.0);
    vec3 cyan = vec3(0.31, 0.78, 1.0);
    vec3 magenta = vec3(0.85, 0.36, 1.0);
    float wave = sin((vUv.x * 7.0 - vUv.y * 4.0) + uTime * 0.5 + uOffset) * 0.5 + 0.5;
    float ribbon = smoothstep(0.42, 0.9, wave);
    float signal = smoothstep(0.82, 1.0, sin((vUv.x + vUv.y) * 18.0 - uTime * 1.15 + uOffset) * 0.5 + 0.5);
    vec3 eventColor = mix(cobalt, cyan, smoothstep(0.05, 0.82, vUv.y));
    eventColor = mix(eventColor, magenta, smoothstep(0.58, 1.0, vUv.x) * 0.5);
    eventColor = mix(eventColor, magenta, ribbon * uEnergy * 0.62);
    eventColor += cyan * signal * 0.34;
    vec2 mediaUv = vUv;
    mediaUv.x += sin(vUv.y * 22.0 + uTime * 1.8) * 0.0035 * uHover;
    mediaUv.y += cos(vUv.x * 18.0 + uTime * 1.35) * 0.002 * uHover;
    vec3 mediaColor = texture2D(uMedia, mediaUv).rgb;
    vec3 color = mix(quiet, eventColor, uEnergy);
    color = mix(color, mediaColor, 0.1 + uEnergy * 0.86);
    float edge = smoothstep(0.0, 0.035, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
    color += cyan * (1.0 - edge) * (0.22 + uHover * 1.25);
    float vignette = smoothstep(0.02, 0.16, vUv.x * (1.0 - vUv.x) * vUv.y * (1.0 - vUv.y));
    gl_FragColor = vec4(color * (0.72 + vignette * 0.42 + uHover * 0.08), uOpacity);
  }
`;

function smoothstep(value: number) {
  const safe = Math.min(1, Math.max(0, value));
  return safe * safe * (3 - 2 * safe);
}

function sampleCamera(progress: number, mobile: boolean) {
  let left = cameraKeyframes[0];
  let right = cameraKeyframes[cameraKeyframes.length - 1];
  for (let index = 1; index < cameraKeyframes.length; index += 1) {
    if (progress <= cameraKeyframes[index].progress) {
      left = cameraKeyframes[index - 1];
      right = cameraKeyframes[index];
      break;
    }
  }
  const span = Math.max(0.0001, right.progress - left.progress);
  let mix = Math.min(1, Math.max(0, (progress - left.progress) / span));
  mix = right.ease === "reveal" ? 1 - Math.pow(1 - mix, 3) : right.ease === "loop" ? mix : smoothstep(mix);
  const from = mobile ? left.mobilePosition : left.position;
  const to = mobile ? right.mobilePosition : right.position;
  const fromRoll = mobile ? left.mobileRoll : left.roll;
  const toRoll = mobile ? right.mobileRoll : right.roll;
  return {
    position: new THREE.Vector3(...from).lerp(new THREE.Vector3(...to), mix),
    target: new THREE.Vector3(...left.target).lerp(new THREE.Vector3(...right.target), mix),
    roll: THREE.MathUtils.lerp(fromRoll, toRoll, mix),
    fov: THREE.MathUtils.lerp(left.fov, right.fov, mix),
  };
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

function MandegarModel({ projects, onFirstFrame, onProjectSelect }: { projects: SceneProject[]; onFirstFrame?: () => void; onProjectSelect?: (index: number) => void }) {
  const gltf = useLoader(GLTFLoader, assetSlots.assembled);
  const projectSources = useMemo(() => defaultProjectMedia.map((fallback, index) => projects[index]?.src || fallback), [projects]);
  const textures = useLoader(THREE.TextureLoader, projectSources);
  const firstFrame = useRef(false);
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
      material.envMapIntensity = 0.72;
      material.roughness = 0.42;
      material.metalness = 0.015;
      if (object.name === "hall_floor") {
        material.color.set("#d9dfe1");
        material.roughness = 0.26;
        material.metalness = 0.12;
      } else if (object.name === "hall_circular_inlay") {
        material.color.set("#89929a");
        material.transparent = true;
        material.opacity = 0.28;
      } else if (object.name.includes("portal")) {
        material.color.set("#e4eaec");
        material.roughness = 0.28;
      } else if (object.name.startsWith("hero_core_rib_")) {
        material.color.set(Number(object.name.slice(-3)) % 2 ? "#e1e3e2" : "#f6f5f1");
        material.roughness = 0.5;
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
    return { scene, wireScene, ownedMaterials, screens, standardMaterials, revealBindings, revealByName };
  }, [gltf.scene, textures]);

  useEffect(() => () => runtime.ownedMaterials.forEach((material) => material.dispose()), [runtime]);

  useFrame(({ clock }) => {
    if (!firstFrame.current) {
      firstFrame.current = true;
      onFirstFrame?.();
    }
    const progress = experienceState.progress;
    const rawReset = smoothstep(phaseProgress(progress, activationSequence.loopReset));
    const reset = rawReset > 0.98 ? 1 : rawReset;
    const scrolledAssembly = smoothstep(phaseProgress(progress, activationSequence.objectAssembly));
    const assembly = scrolledAssembly * (1 - reset);
    const reveal = smoothstep(phaseProgress(progress, activationSequence.totalReveal)) * (1 - reset);
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
      material.uniforms.uHover.value = THREE.MathUtils.lerp(material.uniforms.uHover.value, experienceState.focusProject === projectIndex ? 1 : 0, 0.12);
      material.uniforms.uOpacity.value = localReveal ?? 0;
      material.uniforms.uTime.value = clock.elapsedTime;
    });

    runtime.standardMaterials.forEach(({ material }, nodeName) => {
      const localReveal = (runtime.revealByName.get(nodeName)?.object.userData.assemblyReveal as number | undefined) ?? 0;
      if (nodeName === "ring_signature_halo") {
        material.emissive.copy(energyCyan).lerp(energyMagenta, reveal * 0.22);
        material.emissiveIntensity = (0.08 + trails * 0.18 + reveal * 2.2) * experienceState.lightScale;
        material.color.lerpColors(haloQuiet, haloActive, reveal * 0.5);
      } else if (nodeName === "ring_signal_surface") {
        material.transparent = true;
        material.opacity = localReveal * Math.min(1, trails * 0.3 + reveal * 0.82);
        material.emissive.copy(energyCobalt).lerp(energyMagenta, reveal * 0.58);
        material.emissiveIntensity = (0.4 + reveal * 2.8) * experienceState.lightScale;
      } else if (nodeName === "stage_signal_edge") {
        material.emissive.copy(energyCyan).lerp(energyAmber, reveal * 0.72);
        material.emissiveIntensity = (trails * 0.3 + reveal * 1.65) * experienceState.lightScale;
      } else if (nodeName.startsWith("wing_") && nodeName.endsWith("_signal")) {
        material.emissive.copy(nodeName.includes("left") ? energyMagenta : energyCyan);
        material.emissiveIntensity = (trails * 0.3 + reveal * 1.55) * experienceState.lightScale;
      } else if (nodeName === "hero_canopy_light") {
        material.emissive.copy(energyCyan);
        material.emissiveIntensity = (trails * 0.3 + reveal * 1.35) * experienceState.lightScale;
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
  ambient: Float32Array;
  network: Float32Array;
  ring: Float32Array;
  energyColors: Float32Array;
};

const networkHubs: ReadonlyArray<readonly [number, number, number]> = [
  [-7.2, 1.2, -1.4],
  [-4.2, 4.7, -1.8],
  [-1.5, 2.5, -0.4],
  [0, 5.6, 0],
  [2.4, 2, -0.8],
  [5.2, 4.2, -1.5],
  [7.5, 1.4, -1.8],
];

function seededNoise(value: number) {
  const raw = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
  return raw - Math.floor(raw);
}

function makeSignalField(count: number): SignalFieldData {
  const ambient = new Float32Array(count * 3);
  const network = new Float32Array(count * 3);
  const ring = new Float32Array(count * 3);
  const energyColors = new Float32Array(count * 3);
  const quiet = new THREE.Color("#aebbc8");
  const palette = [
    new THREE.Color(sceneTokens.colors.cobalt),
    new THREE.Color(sceneTokens.colors.cyan),
    new THREE.Color(sceneTokens.colors.magenta),
    new THREE.Color(sceneTokens.colors.amber),
  ];
  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    const seedA = seededNoise(index * 3.17 + 1.3);
    const seedB = seededNoise(index * 7.91 + 4.7);
    const seedC = seededNoise(index * 13.37 + 9.2);
    const distribution = index % 20;
    if (distribution < 11) {
      // A low, irregular floor constellation creates depth without a visible lattice.
      ambient[offset] = (seedA * 2 - 1) * 12.5;
      ambient[offset + 1] = 0.035 + Math.pow(seedB, 2.4) * 0.32;
      ambient[offset + 2] = seedC * 14 - 6.2;
    } else if (distribution < 17) {
      // The far wall carries a loose atmospheric point field like the keyframes.
      ambient[offset] = (seedA * 2 - 1) * 12.8;
      ambient[offset + 1] = 0.3 + seedB * 8.3;
      ambient[offset + 2] = -5.75 + (seedC - 0.5) * 0.72;
    } else {
      // Sparse side-volume particles keep the field from reading as flat planes.
      ambient[offset] = (distribution % 2 === 0 ? -1 : 1) * (8.8 + seedA * 3.8);
      ambient[offset + 1] = 0.25 + seedB * 7.5;
      ambient[offset + 2] = seedC * 11 - 5.4;
    }

    const segment = index % (networkHubs.length - 1);
    const from = networkHubs[segment];
    const to = networkHubs[segment + 1];
    const along = seededNoise(index * 5.73 + 2.1);
    const jitter = (seededNoise(index * 11.9 + 0.7) - 0.5) * 0.11;
    network[offset] = THREE.MathUtils.lerp(from[0], to[0], along) + jitter;
    network[offset + 1] = THREE.MathUtils.lerp(from[1], to[1], along) + (seedB - 0.5) * 0.14;
    network[offset + 2] = THREE.MathUtils.lerp(from[2], to[2], along) + (seedC - 0.5) * 0.12;

    const angle = index * 2.399963;
    const radius = 5.18 + (seedA - 0.5) * 0.22;
    ring[offset] = Math.cos(angle) * radius;
    ring[offset + 1] = 5.85 + (seedB - 0.5) * 0.16;
    ring[offset + 2] = Math.sin(angle) * radius;

    const energy = palette[index % palette.length];
    energyColors[offset] = energy.r;
    energyColors[offset + 1] = energy.g;
    energyColors[offset + 2] = energy.b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(ambient.slice(), 3));
  const quietColors = new Float32Array(count * 3);
  for (let index = 0; index < quietColors.length; index += 3) {
    quietColors[index] = quiet.r;
    quietColors[index + 1] = quiet.g;
    quietColors[index + 2] = quiet.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(quietColors, 3));
  return { geometry, ambient, network, ring, energyColors };
}

function SignalField({ quality }: { quality: SceneQuality }) {
  const field = useRef<THREE.Group>(null);
  const material = useRef<THREE.PointsMaterial>(null);
  const glowMaterial = useRef<THREE.PointsMaterial>(null);
  const data = useMemo(() => makeSignalField(quality === "full" ? 1500 : 650), [quality]);
  const quietColor = useMemo(() => new THREE.Color("#aebbc8"), []);

  useEffect(() => () => data.geometry.dispose(), [data]);
  useFrame(({ clock }, delta) => {
    const progress = experienceState.progress;
    const reset = smoothstep(phaseProgress(progress, activationSequence.loopReset));
    const loopSettled = reset > 0.98;
    const networkAmount = loopSettled ? 0 : smoothstep(phaseProgress(progress, activationSequence.intelligence)) * (1 - reset);
    const ringAmount = loopSettled ? 0 : smoothstep(phaseProgress(progress, activationSequence.haloCondense)) * (1 - reset);
    const activation = loopSettled ? 0 : smoothstep(phaseProgress(progress, activationSequence.lightTrails)) * (1 - reset);
    const energyAmount = loopSettled ? 0 : smoothstep(phaseProgress(progress, activationSequence.totalReveal)) * (1 - reset);
    const positions = data.geometry.getAttribute("position") as THREE.BufferAttribute;
    const array = positions.array as Float32Array;
    const colors = data.geometry.getAttribute("color") as THREE.BufferAttribute;
    const colorArray = colors.array as Float32Array;
    const pointerX = experienceState.pointerX * 7.5;
    const pointerY = 3.7 - experienceState.pointerY * 3.4;
    const pulse = experienceState.pointerPulse;
    const response = 0.26 + activation * 0.74;

    for (let index = 0; index < array.length; index += 3) {
      const ambientX = data.ambient[index] + Math.sin(clock.elapsedTime * 0.42 + index) * 0.065;
      const ambientY = data.ambient[index + 1] + Math.cos(clock.elapsedTime * 0.36 + index * 0.7) * 0.055;
      let x = THREE.MathUtils.lerp(ambientX, data.network[index], networkAmount);
      let y = THREE.MathUtils.lerp(ambientY, data.network[index + 1], networkAmount);
      let z = THREE.MathUtils.lerp(data.ambient[index + 2] + Math.sin(clock.elapsedTime * 0.3 + index * 0.4) * 0.05, data.network[index + 2], networkAmount);
      x = THREE.MathUtils.lerp(x, data.ring[index], ringAmount);
      y = THREE.MathUtils.lerp(y, data.ring[index + 1], ringAmount);
      z = THREE.MathUtils.lerp(z, data.ring[index + 2], ringAmount);

      const dx = x - pointerX;
      const dy = y - pointerY;
      const distance = Math.sqrt(dx * dx + dy * dy) + 0.001;
      const influence = Math.max(0, 1 - distance / 2.4) * response;
      const ripple = Math.sin(distance * 5.2 - (1 - pulse) * 16) * pulse * Math.exp(-distance * 0.42) * 0.38;
      x += dx / distance * (influence * 0.24 + ripple);
      y += dy / distance * (influence * 0.18 + ripple);

      const settle = loopSettled ? 1 : Math.min(1, delta * 7.5);
      array[index] += (x - array[index]) * settle;
      array[index + 1] += (y - array[index + 1]) * settle;
      array[index + 2] += (z - array[index + 2]) * settle;
      const colorAmount = 0.06 + energyAmount * 0.94;
      colorArray[index] = THREE.MathUtils.lerp(quietColor.r, data.energyColors[index], colorAmount);
      colorArray[index + 1] = THREE.MathUtils.lerp(quietColor.g, data.energyColors[index + 1], colorAmount);
      colorArray[index + 2] = THREE.MathUtils.lerp(quietColor.b, data.energyColors[index + 2], colorAmount);
    }
    positions.needsUpdate = true;
    colors.needsUpdate = true;
    experienceState.pointerPulse = Math.max(0, pulse - delta * 0.52);
    if (field.current) {
      field.current.rotation.y = Math.sin(clock.elapsedTime * 0.16) * 0.022 * (1 - ringAmount);
    }
    const breath = 0.88 + Math.sin(clock.elapsedTime * 1.35) * 0.12;
    if (material.current) {
      const visibility = 0.24 + activation * 0.48 + networkAmount * 0.18 + ringAmount * 0.08;
      material.current.opacity = visibility * breath;
      material.current.size = (quality === "full" ? 0.018 : 0.026) + pulse * 0.009;
    }
    if (glowMaterial.current) {
      glowMaterial.current.opacity = (0.07 + activation * 0.14 + networkAmount * 0.1 + ringAmount * 0.06) * breath;
      glowMaterial.current.size = (quality === "full" ? 0.052 : 0.074) + pulse * 0.018;
    }
  });

  return (
    <group ref={field}>
      <points geometry={data.geometry}>
        <pointsMaterial ref={glowMaterial} color="#ffffff" vertexColors size={quality === "full" ? 0.052 : 0.074} transparent opacity={0.07} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
      </points>
      <points geometry={data.geometry}>
        <pointsMaterial ref={material} color="#ffffff" vertexColors size={quality === "full" ? 0.018 : 0.026} transparent opacity={0.24} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
      </points>
    </group>
  );
}

function IntelligenceNetwork() {
  const material = useRef<THREE.LineBasicMaterial>(null);
  const geometry = useMemo(() => {
    const positions: number[] = [];
    for (let index = 1; index < networkHubs.length; index += 1) positions.push(...networkHubs[index - 1], ...networkHubs[index]);
    positions.push(...networkHubs[0], ...networkHubs[3], ...networkHubs[3], ...networkHubs[6], ...networkHubs[1], ...networkHubs[4], ...networkHubs[2], ...networkHubs[5]);
    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return result;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    const rawReset = smoothstep(phaseProgress(experienceState.progress, activationSequence.loopReset));
    const reset = rawReset > 0.98 ? 1 : rawReset;
    const amount = smoothstep(phaseProgress(experienceState.progress, activationSequence.intelligence)) * (1 - reset);
    if (material.current) material.current.opacity = amount * 0.46;
  });
  return <lineSegments geometry={geometry}><lineBasicMaterial ref={material} color={sceneTokens.colors.cobalt} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} /></lineSegments>;
}

function Audience({ quality }: { quality: SceneQuality }) {
  const points = useRef<THREE.Points>(null);
  const material = useRef<THREE.PointsMaterial>(null);
  const geometry = useMemo(() => {
    const count = qualityProfiles[quality].audiencePoints;
    const positions: number[] = [];
    for (let index = 0; index < count; index += 1) {
      const lane = index % 3;
      const angle = (index / count) * Math.PI * 1.72 + 0.22;
      const radius = 4.15 + lane * 0.7 + Math.sin(index * 4.73) * 0.35;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius * 0.62 + 0.65;
      const height = 0.72 + (index % 4) * 0.035;
      positions.push(x, height, z, x, height - 0.18, z, x - 0.075, height - 0.26, z, x + 0.075, height - 0.26, z, x - 0.045, height - 0.54, z, x + 0.045, height - 0.54, z);
    }
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return buffer;
  }, [quality]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }) => {
    const rawReset = smoothstep(phaseProgress(experienceState.progress, activationSequence.loopReset));
    const reset = rawReset > 0.98 ? 1 : rawReset;
    const amount = phaseProgress(experienceState.progress, activationSequence.audience) * (1 - reset);
    if (material.current) material.current.opacity = amount * 0.58;
    if (points.current) points.current.rotation.y = Math.sin(clock.elapsedTime * 0.11) * 0.012;
  });
  return <points ref={points} geometry={geometry}><pointsMaterial ref={material} color={sceneTokens.colors.cobalt} size={quality === "full" ? 0.052 : 0.075} transparent opacity={0} sizeAttenuation depthWrite={false} /></points>;
}

function PostProcessing({ quality }: { quality: SceneQuality }) {
  const { gl, scene, camera, size } = useThree();
  const pipeline = useMemo(() => {
    const composer = new EffectComposer(gl);
    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      quality === "full" ? 0.72 : 0.48,
      quality === "full" ? 0.52 : 0.36,
      0.78,
    );
    const bokehPass = new BokehPass(scene, camera, {
      focus: experienceState.focusDistance,
      aperture: quality === "full" ? 0.00022 : 0.00012,
      maxblur: quality === "full" ? 0.018 : 0.01,
    });
    const outputPass = new OutputPass();
    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composer.addPass(bokehPass);
    composer.addPass(outputPass);
    return { composer, renderPass, bloomPass, bokehPass, outputPass };
  }, [camera, gl, quality, scene, size.height, size.width]);

  useEffect(() => {
    pipeline.composer.setPixelRatio(gl.getPixelRatio());
    pipeline.composer.setSize(size.width, size.height);
  }, [gl, pipeline, size.height, size.width]);

  useEffect(() => () => {
    pipeline.renderPass.dispose();
    pipeline.bloomPass.dispose();
    pipeline.bokehPass.dispose();
    pipeline.outputPass.dispose();
    pipeline.composer.dispose();
  }, [pipeline]);

  useFrame((_, delta) => {
    const focusUniform = pipeline.bokehPass.materialBokeh.uniforms.focus;
    focusUniform.value = THREE.MathUtils.lerp(focusUniform.value as number, experienceState.focusDistance, 0.08);
    const revealEnergy = smoothstep(phaseProgress(experienceState.progress, activationSequence.totalReveal));
    const assemblyEnergy = 1 - Math.abs(experienceState.assemblyProgress * 2 - 1);
    pipeline.bloomPass.strength = (quality === "full" ? 0.58 : 0.38) + Math.max(revealEnergy * 0.28, assemblyEnergy * 0.42);
    pipeline.composer.render(delta);
  }, 1);

  return null;
}

function ExhibitionWorld({ quality, projects, onFirstFrame, onProjectSelect }: { quality: SceneQuality; projects: SceneProject[]; onFirstFrame?: () => void; onProjectSelect?: (index: number) => void }) {
  const { camera, scene, size } = useThree();
  const trailMaterials = useRef<Array<THREE.LineBasicMaterial | null>>([]);
  const trailObjects = useRef<Array<THREE.LineSegments | null>>([]);
  const revealLight = useRef<THREE.PointLight>(null);
  const magentaLight = useRef<THREE.PointLight>(null);
  const amberLight = useRef<THREE.PointLight>(null);
  const interactionLight = useRef<THREE.PointLight>(null);
  const pointer = useRef(new THREE.Vector2());
  const target = useRef(new THREE.Vector3());
  const quietBackground = useMemo(() => new THREE.Color("#e1e4e4"), []);
  const activeBackground = useMemo(() => new THREE.Color("#cfd9e7"), []);
  const background = useMemo(() => new THREE.Color(), []);
  const trails = useMemo(() => [
    makeTrail([[-7, 0.025, 5.8], [-4.2, 0.03, 3.4], [-2.2, 0.035, 1.9], [0, 0.04, 1.1]]),
    makeTrail([[7, 0.026, 4.7], [4.7, 0.03, 3.2], [2.4, 0.035, 1.9], [0.5, 0.04, 1.0]]),
    makeTrail([[-5.8, 0.024, -0.8], [-4, 0.03, -0.2], [-2.6, 0.035, 0.7], [-1.2, 0.04, 0.8]]),
  ], []);
  useEffect(() => () => trails.forEach((trail) => trail.dispose()), [trails]);

  useFrame(({ clock }) => {
    const progress = experienceState.progress;
    const mobile = size.width <= 760 || size.height > size.width * 1.35;
    const cameraSample = sampleCamera(progress, mobile);
    pointer.current.lerp(new THREE.Vector2(experienceState.pointerX, experienceState.pointerY), 0.045);
    const parallax = mobile ? 0 : sceneTokens.pointerParallax.desktop;
    camera.position.copy(cameraSample.position);
    camera.position.x += pointer.current.x * parallax;
    camera.position.y -= pointer.current.y * parallax * 0.45;
    target.current.copy(cameraSample.target);
    target.current.x += pointer.current.x * parallax * 0.2;
    experienceState.focusDistance = camera.position.distanceTo(target.current);
    camera.lookAt(target.current);
    camera.rotateZ(cameraSample.roll);
    if (camera instanceof THREE.PerspectiveCamera && Math.abs(camera.fov - cameraSample.fov) > 0.01) {
      camera.fov = cameraSample.fov;
      camera.updateProjectionMatrix();
    }

    const rawReset = smoothstep(phaseProgress(progress, activationSequence.loopReset));
    const reset = rawReset > 0.98 ? 1 : rawReset;
    const trailAmount = smoothstep(phaseProgress(progress, activationSequence.lightTrails)) * (1 - reset);
    const reveal = smoothstep(phaseProgress(progress, activationSequence.totalReveal)) * (1 - reset);
    trails.forEach((geometry, index) => {
      const line = trailObjects.current[index];
      const material = trailMaterials.current[index];
      const count = geometry.getAttribute("position").count;
      line?.geometry.setDrawRange(0, Math.max(0, Math.floor(count * Math.max(0, trailAmount - index * 0.08))));
      if (material) material.opacity = (0.22 + reveal * 0.72) * trailAmount;
    });
    if (revealLight.current) revealLight.current.intensity = (0.15 + reveal * 5.2) * experienceState.lightScale;
    if (magentaLight.current) magentaLight.current.intensity = reveal * (1.5 + Math.sin(clock.elapsedTime * 0.72) * 0.22) * experienceState.lightScale;
    if (amberLight.current) amberLight.current.intensity = reveal * (1.05 + Math.cos(clock.elapsedTime * 0.58) * 0.16) * experienceState.lightScale;
    if (interactionLight.current) {
      interactionLight.current.position.set(pointer.current.x * 7, 3.7 - pointer.current.y * 2.8, 4.5);
      interactionLight.current.intensity = (0.18 + reveal * 0.55 + experienceState.pointerPulse * 1.4) * experienceState.lightScale;
    }
    background.copy(quietBackground).lerp(activeBackground, reveal * 0.72);
    scene.background = background;
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(background);
  });

  return (
    <>
      <fog attach="fog" args={[sceneTokens.colors.fog, 13, 40]} />
      <ambientLight intensity={0.58} color="#fffdf8" />
      <hemisphereLight args={["#ffffff", "#8895a4", 0.9]} />
      <directionalLight castShadow position={[4, 10, 7]} intensity={2.35} color="#fff8ea" shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[-7, 4, 4]} intensity={0.65} color="#b8dfff" />
      <pointLight ref={revealLight} position={[0, 4.2, 1]} intensity={0.15} distance={18} color={sceneTokens.colors.cyan} />
      <pointLight ref={magentaLight} position={[-5.5, 3.1, 1.8]} intensity={0} distance={13} color={sceneTokens.colors.magenta} />
      <pointLight ref={amberLight} position={[5.8, 2.4, 2.6]} intensity={0} distance={12} color={sceneTokens.colors.amber} />
      <pointLight ref={interactionLight} position={[0, 3.7, 4.5]} intensity={0.18} distance={8} color={sceneTokens.colors.cyan} />

      <Suspense fallback={null}>
        <MandegarModel projects={projects} onFirstFrame={onFirstFrame} onProjectSelect={onProjectSelect} />
      </Suspense>
      <SignalField quality={quality} />
      <IntelligenceNetwork />
      {trails.map((geometry, index) => (
        <lineSegments key={index} ref={(value) => { trailObjects.current[index] = value; }} geometry={geometry}>
          <lineBasicMaterial ref={(value) => { trailMaterials.current[index] = value; }} color={index === 1 ? sceneTokens.colors.cyan : sceneTokens.colors.cobalt} transparent opacity={0} depthWrite={false} />
        </lineSegments>
      ))}
      <Audience quality={quality} />
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

export function ExperienceCanvas({ className, enabledByCms = true, projects = [], onProjectSelect, onRuntimeReady, onFirstFrame }: ExperienceCanvasProps) {
  const [runtime, setRuntime] = useState<RuntimeState>("pending");
  const [pageVisible, setPageVisible] = useState(true);

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
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pointermove", onPointerMove);
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
    <CanvasErrorBoundary fallback={<CanvasFallback className={className} />}>
      <Canvas
        className={className}
        data-experience-canvas="true"
        data-particle-system="signal-network"
        data-interaction-system="pointer-touch"
        data-color-mode="aces"
        data-postprocessing="bloom-dof"
        aria-hidden="true"
        dpr={[profile.dpr[0], profile.dpr[1]]}
        frameloop={pageVisible ? "always" : "never"}
        camera={{ position: [0, 4, 27], fov: 48, near: 0.1, far: 60 }}
        shadows={runtime === "full"}
        gl={{ alpha: false, antialias: profile.antialias, powerPreference: runtime === "full" ? "high-performance" : "low-power" }}
        onPointerDown={() => { experienceState.pointerPulse = 1; }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.04;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <ExhibitionWorld quality={runtime} projects={projects} onFirstFrame={onFirstFrame} onProjectSelect={onProjectSelect} />
        <PostProcessing quality={runtime} />
      </Canvas>
    </CanvasErrorBoundary>
  );
}
