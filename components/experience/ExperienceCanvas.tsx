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
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
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
  const { camera, size } = useThree();
  const projectSources = useMemo(() => defaultProjectMedia.map((fallback, index) => projects[index]?.src || fallback), [projects]);
  const textures = useLoader(THREE.TextureLoader, projectSources);
  const firstFrame = useRef(false);
  const cameraPointer = useRef(new THREE.Vector2());
  const cameraPointerInput = useRef(new THREE.Vector2());
  const cameraTarget = useRef(new THREE.Vector3());
  const authoredPosition = useRef(new THREE.Vector3());
  const authoredQuaternion = useRef(new THREE.Quaternion());
  const authoredRight = useRef(new THREE.Vector3());
  const authoredUp = useRef(new THREE.Vector3());
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
    const authoredCameraRoot = gltf.scene.clone(true);
    const authoredCameraObject = authoredCameraRoot.getObjectByName(sceneTokens.authoredCamera.node);
    const authoredCamera = authoredCameraObject?.type === "PerspectiveCamera"
      ? authoredCameraObject as THREE.PerspectiveCamera
      : null;
    const authoredCameraClip = THREE.AnimationClip.findByName(gltf.animations, sceneTokens.authoredCamera.clip) ?? null;
    const authoredCameraMixer = authoredCamera && authoredCameraClip
      ? new THREE.AnimationMixer(authoredCameraRoot)
      : null;
    const authoredCameraAction = authoredCameraMixer && authoredCameraClip
      ? authoredCameraMixer.clipAction(authoredCameraClip)
      : null;
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
    return {
      scene,
      wireScene,
      ownedMaterials,
      screens,
      standardMaterials,
      revealBindings,
      revealByName,
      authoredCameraRoot,
      authoredCamera,
      authoredCameraClip,
      authoredCameraMixer,
      authoredCameraAction,
    };
  }, [gltf.animations, gltf.scene, textures]);

  useEffect(() => {
    const action = runtime.authoredCameraAction;
    const mixer = runtime.authoredCameraMixer;
    if (action && mixer) {
      action.reset();
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.play();
      mixer.setTime(0);
      runtime.authoredCameraRoot.updateMatrixWorld(true);
    }
    return () => {
      action?.stop();
      mixer?.stopAllAction();
      runtime.ownedMaterials.forEach((material) => material.dispose());
    };
  }, [runtime]);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production"
      && sceneTokens.authoredCamera.enabled
      && (!runtime.authoredCamera || !runtime.authoredCameraClip || !runtime.authoredCameraMixer)
    ) {
      console.warn("Mandegar authored camera unavailable; using procedural fallback", {
        cameraFound: Boolean(runtime.authoredCamera),
        clipFound: Boolean(runtime.authoredCameraClip),
        clipNames: gltf.animations.map((clip) => clip.name),
      });
    }
  }, [gltf.animations, runtime]);

  useFrame(({ clock }) => {
    if (!firstFrame.current) {
      firstFrame.current = true;
      onFirstFrame?.();
    }
    const progress = experienceState.progress;
    const mobile = size.width <= 760 || size.height > size.width * 1.35;
    const cameraSample = sampleCamera(progress, mobile);
    cameraPointerInput.current.set(experienceState.pointerX, experienceState.pointerY);
    cameraPointer.current.lerp(cameraPointerInput.current, 0.045);
    const parallax = mobile ? sceneTokens.pointerParallax.mobile : sceneTokens.pointerParallax.desktop;
    const authoredCamera = runtime.authoredCamera;
    const authoredCameraClip = runtime.authoredCameraClip;
    const authoredCameraMixer = runtime.authoredCameraMixer;
    if (
      sceneTokens.authoredCamera.enabled
      && (!mobile || sceneTokens.authoredCamera.enabledOnMobile)
      && authoredCamera
      && authoredCameraClip
      && authoredCameraMixer
    ) {
      authoredCameraMixer.setTime(progress * authoredCameraClip.duration);
      runtime.authoredCameraRoot.updateMatrixWorld(true);
      authoredCamera.getWorldPosition(authoredPosition.current);
      authoredCamera.getWorldQuaternion(authoredQuaternion.current);
      camera.position.copy(authoredPosition.current);
      camera.quaternion.copy(authoredQuaternion.current);
      authoredRight.current.set(1, 0, 0).applyQuaternion(camera.quaternion);
      authoredUp.current.set(0, 1, 0).applyQuaternion(camera.quaternion);
      camera.position.addScaledVector(authoredRight.current, cameraPointer.current.x * parallax);
      camera.position.addScaledVector(authoredUp.current, -cameraPointer.current.y * parallax * 0.45);
      cameraTarget.current.fromArray(sceneTokens.authoredCamera.focusTarget);
      experienceState.focusDistance = camera.position.distanceTo(cameraTarget.current);
      const perspectiveCamera = camera as THREE.PerspectiveCamera;
      if (perspectiveCamera.isPerspectiveCamera && Math.abs(perspectiveCamera.fov - authoredCamera.fov) > 0.01) {
        perspectiveCamera.fov = authoredCamera.fov;
        perspectiveCamera.updateProjectionMatrix();
      }
    } else {
      camera.position.copy(cameraSample.position);
      camera.position.x += cameraPointer.current.x * parallax;
      camera.position.y -= cameraPointer.current.y * parallax * 0.45;
      cameraTarget.current.copy(cameraSample.target);
      cameraTarget.current.x += cameraPointer.current.x * parallax * 0.2;
      experienceState.focusDistance = camera.position.distanceTo(cameraTarget.current);
      camera.lookAt(cameraTarget.current);
      camera.rotateZ(cameraSample.roll);
      const perspectiveCamera = camera as THREE.PerspectiveCamera;
      if (perspectiveCamera.isPerspectiveCamera && Math.abs(perspectiveCamera.fov - cameraSample.fov) > 0.01) {
        perspectiveCamera.fov = cameraSample.fov;
        perspectiveCamera.updateProjectionMatrix();
      }
    }

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
        vVisibility = dustMask
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
        gl_PointSize = clamp(
          uPointSize * layerSize * pulseSize * uViewportHeight * uPixelRatio * 0.5 / max(1.0, -viewPosition.z),
          ${sceneTokens.particles.screenSize.minimum.toFixed(2)},
          uMaximumPointSize
        );
        vActivity = dustMask * (0.08 + uActivation * 0.12)
          + surfaceMask * surfaceReveal * (0.55 + uEnergyAmount * 0.45)
          + signalMask * signalVisibility * (0.72 + uSignalAmount * 0.28);
        float colorMix = dustMask * (0.035 + uActivation * 0.08)
          + surfaceMask * surfaceReveal * (0.5 + uEnergyAmount * 0.5)
          + signalMask * (0.68 + uSignalAmount * 0.32);
        vColor = mix(color, aEnergyColor, colorMix);
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
    const reset = smoothstep(phaseProgress(progress, activationSequence.loopReset));
    const signalAmount = smoothstep(phaseProgress(progress, activationSequence.intelligence)) * (1 - reset);
    const ringAmount = smoothstep(phaseProgress(progress, activationSequence.haloCondense)) * (1 - reset);
    const activation = smoothstep(phaseProgress(progress, activationSequence.lightTrails)) * (1 - reset);
    const energyAmount = smoothstep(phaseProgress(progress, activationSequence.totalReveal)) * (1 - reset);
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
  const postprocessing = sceneTokens.environment.postprocessing[quality];
  const pipeline = useMemo(() => {
    const composer = new EffectComposer(gl);
    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      postprocessing.bloomStrength,
      postprocessing.bloomRadius,
      postprocessing.bloomThreshold,
    );
    const bokehPass = new BokehPass(scene, camera, {
      focus: experienceState.focusDistance,
      aperture: postprocessing.aperture,
      maxblur: postprocessing.maxBlur,
    });
    const outputPass = new OutputPass();
    bloomPass.enabled = postprocessing.bloom;
    bokehPass.enabled = postprocessing.depthOfField;
    composer.addPass(renderPass);
    composer.addPass(bokehPass);
    composer.addPass(bloomPass);
    composer.addPass(outputPass);
    return { composer, renderPass, bloomPass, bokehPass, outputPass };
  }, [camera, gl, postprocessing, scene, size.height, size.width]);

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
    const reset = smoothstep(phaseProgress(experienceState.progress, activationSequence.loopReset));
    const revealEnergy = smoothstep(phaseProgress(experienceState.progress, activationSequence.totalReveal)) * (1 - reset);
    const assemblyEnergy = 1 - Math.abs(experienceState.assemblyProgress * 2 - 1);
    pipeline.bloomPass.strength = postprocessing.bloomStrength + Math.max(
      revealEnergy * postprocessing.bloomRevealBoost,
      assemblyEnergy * postprocessing.bloomAssemblyBoost,
    );
    pipeline.composer.render(delta);
  }, 1);

  return null;
}

function ExhibitionWorld({ quality, projects, onFirstFrame, onProjectSelect }: { quality: SceneQuality; projects: SceneProject[]; onFirstFrame?: () => void; onProjectSelect?: (index: number) => void }) {
  const { scene } = useThree();
  const trailMaterials = useRef<Array<THREE.LineBasicMaterial | null>>([]);
  const trailObjects = useRef<Array<THREE.LineSegments | null>>([]);
  const revealLight = useRef<THREE.PointLight>(null);
  const magentaLight = useRef<THREE.PointLight>(null);
  const amberLight = useRef<THREE.PointLight>(null);
  const interactionLight = useRef<THREE.PointLight>(null);
  const pointer = useRef(new THREE.Vector2());
  const quietBackground = useMemo(() => new THREE.Color(sceneTokens.environment.background.quiet), []);
  const activeBackground = useMemo(() => new THREE.Color(sceneTokens.environment.background.active), []);
  const background = useMemo(() => new THREE.Color(), []);
  const trails = useMemo(() => [
    makeTrail([[-7, 0.025, 5.8], [-4.2, 0.03, 3.4], [-2.2, 0.035, 1.9], [0, 0.04, 1.1]]),
    makeTrail([[7, 0.026, 4.7], [4.7, 0.03, 3.2], [2.4, 0.035, 1.9], [0.5, 0.04, 1.0]]),
    makeTrail([[-5.8, 0.024, -0.8], [-4, 0.03, -0.2], [-2.6, 0.035, 0.7], [-1.2, 0.04, 0.8]]),
  ], []);
  useEffect(() => () => trails.forEach((trail) => trail.dispose()), [trails]);

  useFrame(({ clock }) => {
    const progress = experienceState.progress;
    pointer.current.lerp(new THREE.Vector2(experienceState.pointerX, experienceState.pointerY), 0.045);
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
      <fog attach="fog" args={[sceneTokens.colors.fog, sceneTokens.environment.fog.near, sceneTokens.environment.fog.far]} />
      <ambientLight intensity={sceneTokens.environment.lights.ambient} color="#fffdf8" />
      <hemisphereLight args={["#f7f9fa", "#778592", sceneTokens.environment.lights.hemisphere]} />
      <directionalLight castShadow position={[4, 10, 7]} intensity={sceneTokens.environment.lights.key} color="#fff8ea" shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[-7, 4, 4]} intensity={sceneTokens.environment.lights.fill} color="#b8dfff" />
      <pointLight ref={revealLight} position={[0, 4.2, 1]} intensity={0.15} distance={18} color={sceneTokens.colors.cyan} />
      <pointLight ref={magentaLight} position={[-5.5, 3.1, 1.8]} intensity={0} distance={13} color={sceneTokens.colors.magenta} />
      <pointLight ref={amberLight} position={[5.8, 2.4, 2.6]} intensity={0} distance={12} color={sceneTokens.colors.amber} />
      <pointLight ref={interactionLight} position={[0, 3.7, 4.5]} intensity={0.18} distance={8} color={sceneTokens.colors.cyan} />

      <Suspense fallback={null}>
        <MandegarModel projects={projects} onFirstFrame={onFirstFrame} onProjectSelect={onProjectSelect} />
        <SignalField quality={quality} />
      </Suspense>
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
        <ExhibitionWorld quality={runtime} projects={projects} onFirstFrame={onFirstFrame} onProjectSelect={onProjectSelect} />
        <PostProcessing quality={runtime} />
      </Canvas>
    </CanvasErrorBoundary>
  );
}
