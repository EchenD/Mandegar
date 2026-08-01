"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

function SparkScene() {
  const group = useRef<THREE.Group>(null);
  const satellites = useMemo(() => Array.from({ length: 28 }, (_, index) => {
    const angle = (index / 28) * Math.PI * 2;
    const radius = 0.55 + (index % 5) * 0.12;
    return { angle, radius, y: Math.sin(angle * 2.2) * 0.13, scale: 0.008 + (index % 4) * 0.004 };
  }), []);

  useFrame(({ clock, pointer }) => {
    if (!group.current) return;
    group.current.rotation.z = clock.getElapsedTime() * 0.035;
    group.current.rotation.x = pointer.y * 0.03;
    group.current.rotation.y = pointer.x * 0.04;
  });

  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[0.075, 16, 16]} />
        <meshBasicMaterial color="#1664ff" />
      </mesh>
      <mesh scale={1.85}>
        <sphereGeometry args={[0.075, 16, 16]} />
        <meshBasicMaterial color="#3b7cff" transparent opacity={0.16} />
      </mesh>
      {satellites.map((satellite, index) => (
        <mesh key={index} position={[Math.cos(satellite.angle) * satellite.radius, satellite.y, Math.sin(satellite.angle) * satellite.radius * 0.25]}>
          <sphereGeometry args={[satellite.scale, 8, 8]} />
          <meshBasicMaterial color={index % 3 === 0 ? "#9ebeff" : "#d9e5ff"} transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
}

export function ExperienceCanvas() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const lowPower = window.matchMedia("(max-width: 760px)").matches || (navigator.hardwareConcurrency || 8) < 4;
      const supportsWebGL = Boolean(document.createElement("canvas").getContext("webgl"));
      setEnabled(!reduce && !lowPower && supportsWebGL);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (!enabled) return <div className="canvasFallback" aria-hidden="true"><span /></div>;

  return (
    <Canvas className="experienceCanvas" dpr={[1, 1.5]} camera={{ position: [0, 0, 2.5], fov: 40 }} gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}>
      <SparkScene />
    </Canvas>
  );
}
