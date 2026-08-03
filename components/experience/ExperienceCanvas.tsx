"use client";

/* eslint-disable react-hooks/immutability -- R3F render-loop callbacks intentionally mutate Three.js scene objects. */

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Component, Suspense, type ErrorInfo, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { activationSequence, assetSlots, cameraKeyframes, phaseProgress, qualityProfiles, sceneTokens, type SceneQuality } from "./scene-config";
import { experienceState } from "./experience-state";

type RuntimeState = "pending" | "fallback" | SceneQuality;
type ExperienceCanvasProps = {
  className?: string;
  enabledByCms?: boolean;
  onRuntimeReady?: (runtime: RuntimeState) => void;
  onFirstFrame?: () => void;
};

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  varying vec2 vUv;
  uniform float uEnergy;
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
    eventColor += cyan * signal * 0.34 + vec3(1.0, 0.36, 0.08) * pow(max(0.0, wave - 0.82), 2.0) * uEnergy;
    vec3 color = mix(quiet, eventColor, uEnergy);
    float vignette = smoothstep(0.02, 0.16, vUv.x * (1.0 - vUv.x) * vUv.y * (1.0 - vUv.y));
    gl_FragColor = vec4(color * (0.72 + vignette * 0.42), 0.38 + uEnergy * 0.62);
  }
`;

function smoothstep(value: number) {
  return value * value * (3 - 2 * value);
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
  mix = right.ease === "reveal" ? 1 - Math.pow(1 - mix, 3) : smoothstep(mix);
  const from = mobile ? left.mobilePosition : left.position;
  const to = mobile ? right.mobilePosition : right.position;
  return {
    position: new THREE.Vector3(...from).lerp(new THREE.Vector3(...to), mix),
    target: new THREE.Vector3(...left.target).lerp(new THREE.Vector3(...right.target), mix),
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
  material: THREE.ShaderMaterial;
  wake: readonly [number, number];
};

function createScreenMaterial(offset: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    vertexShader,
    fragmentShader,
    uniforms: {
      uEnergy: { value: 0 },
      uTime: { value: 0 },
      uOffset: { value: offset },
    },
  });
}

function MandegarModel({ onFirstFrame }: { onFirstFrame?: () => void }) {
  const gltf = useLoader(GLTFLoader, assetSlots.assembled);
  const firstFrame = useRef(false);
  const runtime = useMemo(() => {
    const scene = gltf.scene.clone(true);
    const ownedMaterials: THREE.Material[] = [];
    const screens: ScreenBinding[] = [];
    const standardMaterials = new Map<string, THREE.MeshStandardMaterial>();
    const screenConfig: Record<string, { wake: readonly [number, number]; offset: number }> = {
      led_left_screen_16x9: { wake: activationSequence.screens[0], offset: -1.7 },
      led_right_screen_16x9: { wake: activationSequence.screens[1], offset: 1.7 },
      led_central_media_21x9: { wake: activationSequence.mediaWall, offset: 0.2 },
    };

    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = object.name === "hero_canopy"
        || object.name === "stage_front_rise"
        || object.name.endsWith("_shell");
      object.receiveShadow = object.name === "hall_floor" || object.name === "stage_base";
      if (object.name === "ring_signature_halo" || object.name === "ring_signal_surface") {
        object.visible = false;
      }
      const config = screenConfig[object.name];
      if (config) {
        const material = createScreenMaterial(config.offset);
        object.material = material;
        ownedMaterials.push(material);
        screens.push({ material, wake: config.wake });
        return;
      }
      const sourceMaterial = Array.isArray(object.material) ? object.material[0] : object.material;
      const material = sourceMaterial.clone();
      object.material = material;
      ownedMaterials.push(material);
      if (material instanceof THREE.MeshStandardMaterial) {
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
        standardMaterials.set(object.name, material);
      }
    });

    const haloSignal = scene.getObjectByName("ring_signal_surface") as THREE.Mesh | undefined;
    if (haloSignal) haloSignal.scale.setScalar(1.018);

    return { scene, ownedMaterials, screens, standardMaterials, haloSignal };
  }, [gltf.scene]);

  useEffect(() => () => runtime.ownedMaterials.forEach((material) => material.dispose()), [runtime]);

  useFrame(({ clock }) => {
    if (!firstFrame.current) {
      firstFrame.current = true;
      onFirstFrame?.();
    }
    const progress = experienceState.progress;
    const reset = smoothstep(phaseProgress(progress, activationSequence.loopReset));
    const reveal = smoothstep(phaseProgress(progress, activationSequence.totalReveal)) * (1 - reset);
    const trails = smoothstep(phaseProgress(progress, activationSequence.lightTrails)) * (1 - reset);
    const booths = smoothstep(phaseProgress(progress, activationSequence.booths)) * (1 - reset);
    const media = smoothstep(phaseProgress(progress, activationSequence.mediaWall)) * (1 - reset);

    runtime.screens.forEach(({ material, wake }) => {
      material.uniforms.uEnergy.value = smoothstep(phaseProgress(progress, wake)) * (1 - reset);
      material.uniforms.uTime.value = clock.elapsedTime;
    });

    runtime.standardMaterials.forEach((material, nodeName) => {
      if (nodeName === "ring_signature_halo") {
        material.emissive.set(sceneTokens.colors.cyan);
        material.emissiveIntensity = (0.08 + trails * 0.18 + reveal * 2.2) * experienceState.lightScale;
        material.color.lerpColors(new THREE.Color("#f0eee8"), new THREE.Color("#dbe7ff"), reveal * 0.5);
      } else if (nodeName === "ring_signal_surface") {
        material.transparent = true;
        material.opacity = Math.min(0.92, trails * 0.3 + reveal * 0.82);
        material.emissive.set(sceneTokens.colors.cobalt);
        material.emissiveIntensity = (0.4 + reveal * 2.8) * experienceState.lightScale;
      } else if (nodeName === "hero_canopy_light" || nodeName === "stage_signal_edge" || nodeName.startsWith("wing_") && nodeName.endsWith("_signal")) {
        material.emissive.set(sceneTokens.colors.cyan);
        material.emissiveIntensity = (trails * 0.3 + reveal * 1.35) * experienceState.lightScale;
      } else if (nodeName.startsWith("touch_")) {
        const focused = experienceState.focusZone === "touch"
          || (experienceState.focusZone === "photo" && nodeName.includes("left"))
          || (experienceState.focusZone === "game" && nodeName.includes("right"));
        material.emissive.set(sceneTokens.colors.cobalt);
        material.emissiveIntensity = booths * (focused ? 3.2 : 1.15) * experienceState.lightScale;
      } else if (nodeName.startsWith("booth_") && nodeName.endsWith("_portal")) {
        const focused = (experienceState.focusZone === "photo" && nodeName.includes("left"))
          || (experienceState.focusZone === "game" && nodeName.includes("right"));
        material.emissive.set(sceneTokens.colors.cyan);
        material.emissiveIntensity = booths * (focused ? 1.1 : 0.16) * experienceState.lightScale;
      } else if (nodeName === "hero_rear_veil") {
        material.transparent = true;
        material.opacity = 0.2 + media * 0.24;
        material.emissive.set(sceneTokens.colors.cyan);
        material.emissiveIntensity = media * 0.22;
      }
    });

    if (runtime.haloSignal) runtime.haloSignal.visible = false;
  });

  return <primitive object={runtime.scene} />;
}

function SignatureHalo() {
  const core = useRef<THREE.MeshStandardMaterial>(null);
  const signal = useRef<THREE.MeshBasicMaterial>(null);
  const particles = useRef<THREE.PointsMaterial>(null);
  const particleGeometry = useMemo(() => {
    const positions: number[] = [];
    for (let index = 0; index < 260; index += 1) {
      const angle = index * 2.399963;
      const radius = 5.18 + Math.sin(index * 4.71) * 0.16;
      positions.push(Math.cos(angle) * radius, Math.sin(index * 7.13) * 0.11, Math.sin(angle) * radius);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }, []);

  useEffect(() => () => particleGeometry.dispose(), [particleGeometry]);
  useFrame(({ clock }) => {
    const reset = smoothstep(phaseProgress(experienceState.progress, activationSequence.loopReset));
    const trails = smoothstep(phaseProgress(experienceState.progress, activationSequence.lightTrails)) * (1 - reset);
    const reveal = smoothstep(phaseProgress(experienceState.progress, activationSequence.totalReveal)) * (1 - reset);
    if (core.current) core.current.emissiveIntensity = (1.2 + reveal * 3.8) * experienceState.lightScale;
    if (signal.current) {
      signal.current.opacity = (0.08 + trails * 0.28 + reveal * 0.74) * (1 - reset);
      signal.current.color.set(reveal > 0.68 ? sceneTokens.colors.magenta : sceneTokens.colors.cyan);
    }
    if (particles.current) particles.current.opacity = reveal * 0.72;
    if (particles.current) particles.current.size = 0.018 + Math.sin(clock.elapsedTime * 0.8) * 0.004;
  });

  return (
    <group position={[0, 5.85, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[5.2, 0.055, 12, 192]} />
        <meshStandardMaterial ref={core} color="#fffaf0" emissive="#fff6dc" emissiveIntensity={1.2} roughness={0.22} metalness={0.08} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} scale={1.012}>
        <torusGeometry args={[5.2, 0.018, 8, 192]} />
        <meshBasicMaterial ref={signal} color={sceneTokens.colors.cyan} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <points geometry={particleGeometry}>
        <pointsMaterial ref={particles} color="#fff9e9" size={0.02} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>
    </group>
  );
}

function EnergyField({ quality }: { quality: SceneQuality }) {
  const material = useRef<THREE.PointsMaterial>(null);
  const geometry = useMemo(() => {
    const count = quality === "full" ? 480 : 180;
    const positions: number[] = [];
    for (let index = 0; index < count; index += 1) {
      const x = ((index * 37) % 101) / 100 * 22 - 11;
      const y = ((index * 53) % 97) / 96 * 6.6 + 0.45;
      const z = -5.9 + Math.sin(index * 2.17) * 1.2;
      positions.push(x, y, z);
    }
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return buffer;
  }, [quality]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }) => {
    const reveal = phaseProgress(experienceState.progress, activationSequence.totalReveal);
    const reset = phaseProgress(experienceState.progress, activationSequence.loopReset);
    if (material.current) {
      material.current.opacity = reveal * (1 - reset) * 0.5;
      material.current.size = 0.025 + Math.sin(clock.elapsedTime * 0.55) * 0.004;
    }
  });
  return <points geometry={geometry}><pointsMaterial ref={material} color={sceneTokens.colors.cyan} size={0.025} transparent opacity={0} depthWrite={false} /></points>;
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
      positions.push(
        x, height, z,
        x, height - 0.18, z,
        x - 0.075, height - 0.26, z,
        x + 0.075, height - 0.26, z,
        x - 0.045, height - 0.54, z,
        x + 0.045, height - 0.54, z,
      );
    }
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return buffer;
  }, [quality]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }) => {
    const reset = phaseProgress(experienceState.progress, activationSequence.loopReset);
    const amount = phaseProgress(experienceState.progress, activationSequence.audience) * (1 - reset);
    if (material.current) material.current.opacity = amount * 0.58;
    if (points.current) points.current.rotation.y = Math.sin(clock.elapsedTime * 0.11) * 0.012;
  });
  return <points ref={points} geometry={geometry}><pointsMaterial ref={material} color={sceneTokens.colors.cobalt} size={quality === "full" ? 0.052 : 0.075} transparent opacity={0} sizeAttenuation depthWrite={false} /></points>;
}

function ExhibitionWorld({ quality, onFirstFrame }: { quality: SceneQuality; onFirstFrame?: () => void }) {
  const { camera, scene, size } = useThree();
  const trailMaterials = useRef<Array<THREE.LineBasicMaterial | null>>([]);
  const trailObjects = useRef<Array<THREE.LineSegments | null>>([]);
  const revealLight = useRef<THREE.PointLight>(null);
  const pointer = useRef(new THREE.Vector2());
  const target = useRef(new THREE.Vector3());
  const quietBackground = useMemo(() => new THREE.Color("#e1e4e4"), []);
  const activeBackground = useMemo(() => new THREE.Color("#cfd9e7"), []);
  const trails = useMemo(() => [
    makeTrail([[-7, 0.025, 5.8], [-4.2, 0.03, 3.4], [-2.2, 0.035, 1.9], [0, 0.04, 1.1]]),
    makeTrail([[7, 0.026, 4.7], [4.7, 0.03, 3.2], [2.4, 0.035, 1.9], [0.5, 0.04, 1.0]]),
    makeTrail([[-5.8, 0.024, -0.8], [-4, 0.03, -0.2], [-2.6, 0.035, 0.7], [-1.2, 0.04, 0.8]]),
  ], []);
  useEffect(() => () => trails.forEach((trail) => trail.dispose()), [trails]);

  useFrame(() => {
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
    camera.lookAt(target.current);

    const reset = phaseProgress(progress, activationSequence.loopReset);
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
    scene.background = quietBackground.clone().lerp(activeBackground, reveal * 0.72);
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(scene.background as THREE.Color);
  });

  return (
    <>
      <fog attach="fog" args={[sceneTokens.colors.fog, 16, 38]} />
      <ambientLight intensity={0.58} color="#fffdf8" />
      <hemisphereLight args={["#ffffff", "#8895a4", 0.9]} />
      <directionalLight castShadow position={[4, 10, 7]} intensity={2.35} color="#fff8ea" shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[-7, 4, 4]} intensity={0.65} color="#b8dfff" />
      <pointLight ref={revealLight} position={[0, 4.2, 1]} intensity={0.15} distance={18} color={sceneTokens.colors.cyan} />

      <group name="hall_atmosphere">
        <mesh position={[0, 6.2, -8.5]}><boxGeometry args={[29, 12, 0.3]} /><meshStandardMaterial color="#f1f1ee" roughness={0.9} /></mesh>
        <mesh position={[-12.8, 5, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[20, 10]} /><meshStandardMaterial color="#eff0ed" roughness={0.94} /></mesh>
        <mesh position={[12.8, 5, 0]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[20, 10]} /><meshStandardMaterial color="#eff0ed" roughness={0.94} /></mesh>
        {[-10, -6, -2, 2, 6, 10].map((x) => <mesh key={x} position={[x, 6.6, -1.4]} rotation={[0, 0, 0.08 * Math.sign(x)]}><boxGeometry args={[0.06, 0.06, 15]} /><meshBasicMaterial color="#d5d7d4" /></mesh>)}
      </group>

      <Suspense fallback={null}>
        <MandegarModel onFirstFrame={onFirstFrame} />
      </Suspense>
      <SignatureHalo />
      <EnergyField quality={quality} />

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

export function ExperienceCanvas({ className, enabledByCms = true, onRuntimeReady, onFirstFrame }: ExperienceCanvasProps) {
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
    };
  }, [enabledByCms, onFirstFrame, onRuntimeReady]);

  if (runtime === "pending" || runtime === "fallback") return <CanvasFallback className={className} />;
  const profile = qualityProfiles[runtime];
  return (
    <CanvasErrorBoundary fallback={<CanvasFallback className={className} />}>
      <Canvas
        className={className}
        data-experience-canvas="true"
        aria-hidden="true"
        dpr={[profile.dpr[0], profile.dpr[1]]}
        frameloop={pageVisible ? "always" : "never"}
        camera={{ position: [0, 2.35, 12.8], fov: 43, near: 0.1, far: 60 }}
        shadows={runtime === "full"}
        gl={{ alpha: false, antialias: profile.antialias, powerPreference: runtime === "full" ? "high-performance" : "low-power" }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.08;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <ExhibitionWorld quality={runtime} onFirstFrame={onFirstFrame} />
      </Canvas>
    </CanvasErrorBoundary>
  );
}
