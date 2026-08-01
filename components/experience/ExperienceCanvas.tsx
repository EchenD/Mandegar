"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Component, type ErrorInfo, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { experienceState, type ExperienceQuality } from "./experience-state";

type RuntimeState = "pending" | "fallback" | ExperienceQuality;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function buildLineGeometry(quality: ExperienceQuality) {
  const geometry = new THREE.BufferGeometry();
  const points: number[] = [];
  const frames = quality === "full"
    ? [
        [-1.45, -0.62, 0, 1.45, -0.62, 0],
        [-1.45, -0.62, 0, -1.45, 0.58, 0],
        [1.45, -0.62, 0, 1.45, 0.58, 0],
        [-1.45, 0.58, 0, 1.45, 0.58, 0],
        [-1.05, -0.62, -0.12, -1.05, 0.58, -0.12],
        [0.15, -0.62, -0.12, 0.15, 0.58, -0.12],
        [1.05, -0.62, -0.12, 1.05, 0.58, -0.12],
        [-1.05, 0.35, -0.12, 1.05, 0.35, -0.12],
        [-1.05, -0.18, -0.12, 1.05, -0.18, -0.12],
        [-0.62, -0.62, -0.18, -0.62, 0.58, -0.18],
        [0.62, -0.62, -0.18, 0.62, 0.58, -0.18],
      ]
    : [
        [-1.25, -0.58, 0, 1.25, -0.58, 0],
        [-1.25, -0.58, 0, -1.25, 0.45, 0],
        [1.25, -0.58, 0, 1.25, 0.45, 0],
        [-1.25, 0.45, 0, 1.25, 0.45, 0],
        [-0.82, -0.58, -0.12, -0.82, 0.45, -0.12],
        [0.82, -0.58, -0.12, 0.82, 0.45, -0.12],
      ];
  frames.forEach((frame) => points.push(...frame));
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  return geometry;
}

function buildParticleGeometry(quality: ExperienceQuality) {
  const geometry = new THREE.BufferGeometry();
  const count = quality === "full" ? 54 : 22;
  const points: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    const radius = 0.85 + (index % 5) * 0.12;
    points.push(
      Math.cos(angle) * radius,
      Math.sin(angle * 1.7) * 0.46,
      Math.sin(angle) * 0.28 - 0.18,
    );
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  return geometry;
}

function SparkScene({ quality }: { quality: ExperienceQuality }) {
  const spark = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);
  const structure = useRef<THREE.Group>(null);
  const eventKit = useRef<THREE.Group>(null);
  const eventRings = useRef<THREE.Group>(null);
  const particles = useRef<THREE.Points>(null);
  const screen = useRef<THREE.Mesh>(null);
  const lineMaterial = useRef<THREE.LineBasicMaterial>(null);
  const particleMaterial = useRef<THREE.PointsMaterial>(null);
  const screenMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const eventSurfaceMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const eventRingMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const eventRingAccentMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const lineGeometry = useMemo(() => buildLineGeometry(quality), [quality]);
  const particleGeometry = useMemo(() => buildParticleGeometry(quality), [quality]);

  useEffect(() => () => {
    lineGeometry.dispose();
    particleGeometry.dispose();
  }, [lineGeometry, particleGeometry]);

  useFrame(({ clock }) => {
    const progress = experienceState.progress;
    const formation = clamp((progress - 0.08) / 0.42);
    const event = clamp((progress - 0.34) / 0.38);
    const impact = clamp((progress - 0.72) / 0.28);
    const time = clock.getElapsedTime();

    if (spark.current) {
      spark.current.position.x = 1.05 - progress * 2.05;
      spark.current.position.y = 0.12 + Math.sin(time * 1.2) * 0.045 + experienceState.pointerY * 0.06;
      spark.current.position.z = 0.18 + experienceState.pointerX * 0.08;
      spark.current.rotation.z = time * 0.5;
      spark.current.scale.setScalar(0.78 + formation * 0.34 + event * 0.18);
    }
    if (halo.current) {
      halo.current.position.copy(spark.current?.position || new THREE.Vector3());
      halo.current.scale.setScalar(1.4 + formation * 2.1 + Math.sin(time * 1.4) * 0.08);
      const material = halo.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.08 + formation * 0.1 + impact * 0.08;
    }
    if (structure.current) {
      structure.current.scale.setScalar(0.25 + formation * 0.76 + event * 0.12);
      structure.current.rotation.y = experienceState.pointerX * 0.18 + Math.sin(time * 0.12) * 0.04;
      structure.current.rotation.x = experienceState.pointerY * 0.1;
      structure.current.position.y = (1 - formation) * 0.12;
    }
    if (eventKit.current) {
      eventKit.current.scale.setScalar(0.06 + event * 0.94);
      eventKit.current.position.y = -0.14 + event * 0.04;
      eventKit.current.position.x = experienceState.pointerX * 0.09;
      eventKit.current.position.z = experienceState.pointerY * 0.05;
      eventKit.current.rotation.y = experienceState.pointerX * 0.14;
    }
    if (eventRings.current) {
      eventRings.current.scale.setScalar(0.2 + impact * 0.8);
      eventRings.current.rotation.z = time * 0.04;
      eventRings.current.rotation.x = Math.sin(time * 0.2) * 0.04 + experienceState.pointerY * 0.08;
      eventRings.current.rotation.y = experienceState.pointerX * 0.12;
      eventRings.current.position.x = experienceState.pointerX * 0.12;
    }
    if (lineMaterial.current) {
      lineMaterial.current.opacity = 0.12 + formation * 0.52 + impact * 0.18;
    }
    if (particles.current) {
      particles.current.rotation.z = time * 0.025;
      particles.current.rotation.y = time * 0.018 + experienceState.pointerX * 0.12;
      particles.current.rotation.x = experienceState.pointerY * 0.06;
      particles.current.scale.setScalar(0.35 + formation * 0.75 + impact * 0.18);
    }
    if (particleMaterial.current) {
      particleMaterial.current.opacity = 0.16 + formation * 0.5 + impact * 0.2;
    }
    if (screen.current) {
      screen.current.scale.set(0.1 + event * 0.9, 0.1 + event * 0.9, 1);
      screen.current.position.z = -0.28 - impact * 0.12;
    }
    if (screenMaterial.current) {
      screenMaterial.current.opacity = event * 0.52 + impact * 0.24;
    }
    if (eventSurfaceMaterial.current) {
      eventSurfaceMaterial.current.color.set(impact > 0.45 ? "#dbe7ff" : "#286cff");
      eventSurfaceMaterial.current.opacity = 0.7 + impact * 0.16;
    }
    if (eventRingMaterial.current) {
      eventRingMaterial.current.color.set(impact > 0.45 ? "#eef4ff" : "#145eff");
    }
    if (eventRingAccentMaterial.current) {
      eventRingAccentMaterial.current.color.set(impact > 0.45 ? "#91b5ff" : "#b7ceff");
    }
  });

  return (
    <group>
      <group ref={spark}>
        <mesh>
          <sphereGeometry args={[0.065, quality === "full" ? 16 : 10, quality === "full" ? 16 : 10]} />
          <meshBasicMaterial color="#145eff" />
        </mesh>
        <mesh scale={1.7}>
          <sphereGeometry args={[0.065, 12, 12]} />
          <meshBasicMaterial color="#6f9dff" transparent opacity={0.2} />
        </mesh>
      </group>
      <mesh ref={halo}>
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshBasicMaterial color="#7da4ff" transparent opacity={0.1} depthWrite={false} />
      </mesh>
      <group ref={structure}>
        <lineSegments geometry={lineGeometry}>
          <lineBasicMaterial ref={lineMaterial} color="#4d82ff" transparent opacity={0.38} depthWrite={false} />
        </lineSegments>
        <mesh ref={screen} position={[0, 0.06, -0.28]}>
          <planeGeometry args={[1.2, 0.68]} />
          <meshBasicMaterial ref={screenMaterial} color="#145eff" transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      <group ref={eventKit} data-placeholder-3d="event-kit">
        {/* Generic event kit: replace these primitives with approved 3D assets later. */}
        <mesh position={[0, -0.42, 0.08]}>
          <boxGeometry args={[2.55, 0.055, 0.78]} />
          <meshBasicMaterial color="#1c2c54" transparent opacity={0.82} />
        </mesh>
        <mesh position={[0, 0.06, -0.33]}>
          <boxGeometry args={[1.55, 0.88, 0.045]} />
          <meshBasicMaterial ref={eventSurfaceMaterial} color="#286cff" transparent opacity={0.72} />
        </mesh>
        <mesh position={[-0.86, 0.04, -0.31]}>
          <boxGeometry args={[0.035, 0.92, 0.05]} />
          <meshBasicMaterial color="#86aaff" transparent opacity={0.88} />
        </mesh>
        <mesh position={[0.86, 0.04, -0.31]}>
          <boxGeometry args={[0.035, 0.92, 0.05]} />
          <meshBasicMaterial color="#86aaff" transparent opacity={0.88} />
        </mesh>
        <mesh position={[0, 0.52, -0.31]}>
          <boxGeometry args={[1.75, 0.035, 0.05]} />
          <meshBasicMaterial color="#86aaff" transparent opacity={0.88} />
        </mesh>
        {[[-0.98, -0.2, 0.08], [-0.62, -0.2, 0.08], [0.62, -0.2, 0.08], [0.98, -0.2, 0.08]].map(([x, y, z], index) => (
          <mesh key={index} position={[x, y, z]}>
            <boxGeometry args={[0.22, 0.32 + (index % 2) * 0.1, 0.22]} />
            <meshBasicMaterial color={index % 2 ? "#527ddd" : "#dbe6ff"} transparent opacity={0.78} />
          </mesh>
        ))}
        {(quality === "full" ? [-0.8, -0.4, 0, 0.4, 0.8] : [-0.6, 0, 0.6]).map((x, index) => (
          <mesh key={`audience-${index}`} position={[x, -0.3, 0.45 + (index % 2) * 0.1]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshBasicMaterial color="#145eff" transparent opacity={0.76} />
          </mesh>
        ))}
      </group>
      <group ref={eventRings} position={[0, -0.42, 0.16]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.82, 0.008, 6, 64]} />
          <meshBasicMaterial ref={eventRingMaterial} color="#145eff" transparent opacity={0.72} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={0.7}>
          <torusGeometry args={[0.82, 0.008, 6, 64]} />
          <meshBasicMaterial ref={eventRingAccentMaterial} color="#b7ceff" transparent opacity={0.72} />
        </mesh>
      </group>
      <points ref={particles} geometry={particleGeometry}>
        <pointsMaterial ref={particleMaterial} color="#5f8fff" size={quality === "full" ? 0.026 : 0.035} transparent opacity={0.2} sizeAttenuation />
      </points>
    </group>
  );
}

class CanvasErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== "production") console.warn("Mandegar immersive canvas fallback", error, info.componentStack);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function CanvasFallback() {
  return <div className="canvasFallback" data-webgl="fallback" aria-hidden="true"><span /><i /><b /></div>;
}

export function ExperienceCanvas({ enabledByCms = true }: { enabledByCms?: boolean }) {
  const [runtime, setRuntime] = useState<RuntimeState>("pending");
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
      const supportsWebGL = Boolean(document.createElement("canvas").getContext("webgl"));
      const lite = window.matchMedia("(max-width: 760px)").matches || (navigator.hardwareConcurrency || 8) < 4;
      experienceState.quality = lite ? "lite" : "full";
      setRuntime(enabledByCms && !reduced && !saveData && supportsWebGL ? experienceState.quality : "fallback");
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
  }, [enabledByCms]);

  if (runtime === "pending" || runtime === "fallback") return <CanvasFallback />;

  return (
    <CanvasErrorBoundary fallback={<CanvasFallback />}>
      <Canvas
        className="experienceCanvas"
        data-experience-canvas="true"
        aria-hidden="true"
        dpr={runtime === "full" ? [1, 1.5] : [1, 1.15]}
        frameloop={pageVisible ? "always" : "never"}
        camera={{ position: [0, 0, 2.8], fov: 42 }}
        gl={{ alpha: true, antialias: runtime === "full", powerPreference: "low-power" }}
      >
        <SparkScene quality={runtime} />
      </Canvas>
    </CanvasErrorBoundary>
  );
}
