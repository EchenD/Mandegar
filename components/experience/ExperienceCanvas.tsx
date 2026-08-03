"use client";

/* eslint-disable react-hooks/immutability -- R3F render-loop callbacks intentionally mutate Three.js scene objects. */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, type ErrorInfo, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { activationSequence, cameraKeyframes, phaseProgress, qualityProfiles, sceneTokens, type SceneQuality } from "./scene-config";
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
    float ribbon = smoothstep(0.72, 1.0, sin((vUv.x * 7.0 - vUv.y * 4.0) + uTime * 0.5 + uOffset) * 0.5 + 0.5);
    float signal = smoothstep(0.86, 1.0, sin((vUv.x + vUv.y) * 18.0 - uTime * 1.15 + uOffset) * 0.5 + 0.5);
    vec3 eventColor = mix(cobalt, cyan, vUv.y + ribbon * 0.22);
    eventColor = mix(eventColor, magenta, ribbon * uEnergy * 0.32);
    vec3 color = mix(quiet, eventColor + signal * 0.18, uEnergy);
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

function ActivationScreen({
  position,
  rotation = [0, 0, 0],
  size,
  wake,
  offset,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  size: [number, number];
  wake: readonly [number, number];
  offset: number;
}) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    vertexShader,
    fragmentShader,
    uniforms: {
      uEnergy: { value: 0 },
      uTime: { value: 0 },
      uOffset: { value: offset },
    },
  }), [offset]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ clock }) => {
    const reset = phaseProgress(experienceState.progress, activationSequence.loopReset);
    material.uniforms.uEnergy.value = smoothstep(phaseProgress(experienceState.progress, wake)) * (1 - reset);
    material.uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={size} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function Booth({ position, screenWake, side }: { position: [number, number, number]; screenWake: readonly [number, number]; side: -1 | 1 }) {
  const rotationY = side * -0.12;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.72, 0]}><boxGeometry args={[1.68, 1.55, 0.52]} /><meshStandardMaterial color="#eef0ef" roughness={0.78} metalness={0.02} /></mesh>
      <mesh position={[0, 0.68, 0.275]}><planeGeometry args={[1.32, 0.92]} /><meshBasicMaterial color="#d9dcdb" /></mesh>
      <ActivationScreen position={[0, 0.68, 0.284]} size={[1.2, 0.8]} wake={screenWake} offset={side * 1.7} />
      <mesh position={[0, -0.08, 0.14]}><cylinderGeometry args={[0.9, 1.02, 0.18, 32]} /><meshStandardMaterial color="#f7f7f4" roughness={0.65} /></mesh>
      <pointLight position={[0, 0.6, 0.7]} color={side < 0 ? sceneTokens.colors.cyan : sceneTokens.colors.amber} intensity={0.16} distance={3.4} />
    </group>
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
  const haloMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const innerHaloMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const haloGroup = useRef<THREE.Group>(null);
  const trailMaterials = useRef<Array<THREE.LineBasicMaterial | null>>([]);
  const trailObjects = useRef<Array<THREE.LineSegments | null>>([]);
  const revealLight = useRef<THREE.PointLight>(null);
  const stageMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const firstFrame = useRef(false);
  const pointer = useRef(new THREE.Vector2());
  const target = useRef(new THREE.Vector3());
  const quietBackground = useMemo(() => new THREE.Color(sceneTokens.colors.fog), []);
  const activeBackground = useMemo(() => new THREE.Color("#dce5f4"), []);
  const trails = useMemo(() => [
    makeTrail([[-7, 0.025, 5.8], [-4.2, 0.03, 3.4], [-2.2, 0.035, 1.9], [0, 0.04, 1.1]]),
    makeTrail([[7, 0.026, 4.7], [4.7, 0.03, 3.2], [2.4, 0.035, 1.9], [0.5, 0.04, 1.0]]),
    makeTrail([[-5.8, 0.024, -0.8], [-4, 0.03, -0.2], [-2.6, 0.035, 0.7], [-1.2, 0.04, 0.8]]),
  ], []);
  useEffect(() => () => trails.forEach((trail) => trail.dispose()), [trails]);

  useFrame(({ clock }) => {
    if (!firstFrame.current) {
      firstFrame.current = true;
      onFirstFrame?.();
    }
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
    if (haloGroup.current) haloGroup.current.rotation.y = Math.sin(clock.elapsedTime * 0.16) * 0.025 + reveal * 0.04;
    if (haloMaterial.current) {
      haloMaterial.current.emissiveIntensity = (0.08 + trailAmount * 0.24 + reveal * 2.15) * experienceState.lightScale;
      haloMaterial.current.color.lerpColors(new THREE.Color("#e7e4dc"), new THREE.Color(sceneTokens.colors.cyan), reveal * 0.6);
    }
    if (innerHaloMaterial.current) innerHaloMaterial.current.emissiveIntensity = (0.04 + reveal * 1.35) * experienceState.lightScale;
    if (stageMaterial.current) stageMaterial.current.emissiveIntensity = reveal * 0.3;
    if (revealLight.current) revealLight.current.intensity = (0.15 + reveal * 5.2) * experienceState.lightScale;
    scene.background = quietBackground.clone().lerp(activeBackground, reveal * 0.72);
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(scene.background as THREE.Color);
  });

  return (
    <>
      <fog attach="fog" args={[sceneTokens.colors.fog, 12, 31]} />
      <ambientLight intensity={1.25} color="#fffdf8" />
      <hemisphereLight args={["#ffffff", "#b7c2cc", 1.05]} />
      <directionalLight position={[4, 10, 7]} intensity={1.75} color="#fff8ea" />
      <pointLight ref={revealLight} position={[0, 4.2, 1]} intensity={0.15} distance={18} color={sceneTokens.colors.cyan} />

      <group name="hall_shell_placeholder">
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 1]}><planeGeometry args={[34, 30, 1, 1]} /><meshStandardMaterial color="#e9eae7" roughness={0.46} metalness={0.04} /></mesh>
        <mesh position={[0, 6.2, -8.5]}><boxGeometry args={[29, 12, 0.3]} /><meshStandardMaterial color="#f1f1ee" roughness={0.9} /></mesh>
        <mesh position={[-12.8, 5, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[20, 10]} /><meshStandardMaterial color="#eff0ed" roughness={0.94} /></mesh>
        <mesh position={[12.8, 5, 0]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[20, 10]} /><meshStandardMaterial color="#eff0ed" roughness={0.94} /></mesh>
        {[-10, -6, -2, 2, 6, 10].map((x) => <mesh key={x} position={[x, 6.6, -1.4]} rotation={[0, 0, 0.08 * Math.sign(x)]}><boxGeometry args={[0.06, 0.06, 15]} /><meshBasicMaterial color="#d5d7d4" /></mesh>)}
      </group>

      <group name="hero_zone_placeholder">
        <mesh position={[0, 0.015, 0.2]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[5.2, qualityProfiles[quality].radialSegments]} /><meshBasicMaterial color="#657078" transparent opacity={0.055} depthWrite={false} /></mesh>
        <mesh position={[0, 0.16, 0]}><cylinderGeometry args={[3.7, 4.2, 0.34, qualityProfiles[quality].radialSegments]} /><meshStandardMaterial ref={stageMaterial} color="#f2f1ed" emissive={sceneTokens.colors.cyan} emissiveIntensity={0} roughness={0.62} metalness={0.03} /></mesh>
        <mesh position={[0, 0.35, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[3.45, 0.022, 8, qualityProfiles[quality].radialSegments]} /><meshBasicMaterial color="#9ca5aa" transparent opacity={0.48} /></mesh>
        <mesh position={[0, 0.36, -0.25]}><cylinderGeometry args={[2.75, 3.15, 0.18, qualityProfiles[quality].radialSegments]} /><meshStandardMaterial color="#faf9f5" roughness={0.58} /></mesh>
        <mesh position={[0, 2.02, -0.72]}><boxGeometry args={[5.8, 3.0, 0.34]} /><meshStandardMaterial color="#efefeb" roughness={0.72} /></mesh>
        <ActivationScreen position={[0, 2.02, -0.535]} size={[5.22, 2.42]} wake={activationSequence.mediaWall} offset={0.2} />
        <Booth position={[-4.45, 0.28, 0.25]} screenWake={activationSequence.screens[0]} side={-1} />
        <Booth position={[4.45, 0.28, 0.25]} screenWake={activationSequence.screens[1]} side={1} />
        <group position={[0, 0.52, 2.05]}>
          <mesh><cylinderGeometry args={[1.05, 1.24, 0.48, qualityProfiles[quality].radialSegments]} /><meshStandardMaterial color="#efefeb" roughness={0.7} /></mesh>
          <ActivationScreen position={[0, 0.255, 0]} rotation={[-Math.PI / 2, 0, 0]} size={[1.55, 1.1]} wake={activationSequence.screens[2]} offset={3.1} />
        </group>
      </group>

      <group ref={haloGroup} name="ring_signature_placeholder" position={[0, 4.85, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh><torusGeometry args={[3.55, 0.105, 14, qualityProfiles[quality].radialSegments * 2]} /><meshStandardMaterial ref={haloMaterial} color="#e7e4dc" emissive={sceneTokens.colors.cyan} emissiveIntensity={0.08} roughness={0.42} metalness={0.22} /></mesh>
        <mesh><torusGeometry args={[2.92, 0.038, 10, qualityProfiles[quality].radialSegments]} /><meshStandardMaterial ref={innerHaloMaterial} color="#f5f3ed" emissive={sceneTokens.colors.amber} emissiveIntensity={0.04} roughness={0.4} /></mesh>
      </group>

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
        gl={{ alpha: false, antialias: profile.antialias, powerPreference: runtime === "full" ? "high-performance" : "low-power" }}
      >
        <ExhibitionWorld quality={runtime} onFirstFrame={onFirstFrame} />
      </Canvas>
    </CanvasErrorBoundary>
  );
}
