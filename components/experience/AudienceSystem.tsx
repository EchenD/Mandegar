"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { experienceState } from "./experience-state";
import { rangeProgress } from "./narrative-score";
import { qualityProfiles, sceneTokens, type SceneQuality } from "./scene-config";

function smoothstep(value: number) {
  const safe = Math.min(1, Math.max(0, value));
  return safe * safe * (3 - 2 * safe);
}

function seededNoise(value: number) {
  const raw = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
  return raw - Math.floor(raw);
}

export function AudienceSystem({ quality }: { quality: SceneQuality }) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const bodyMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const headMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const aura = useRef<THREE.Points>(null);
  const auraMaterial = useRef<THREE.PointsMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const figures = useMemo(() => {
    const count = qualityProfiles[quality].audiencePoints;
    return Array.from({ length: count }, (_, index) => {
      const lane = index % 3;
      const angle = (index / count) * Math.PI * 2 + 0.19;
      const radius = 4.35 + lane * 0.72 + Math.sin(index * 4.73) * 0.3;
      let x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius * 0.68 + 0.42;
      if (z > 2.45 && Math.abs(x) < 1.35) x += x < 0 ? -1.5 : 1.5;
      return {
        angle,
        radius,
        x,
        z,
        height: 1.46 + (index % 5) * 0.055 + seededNoise(index * 8.17) * 0.08,
        width: 0.86 + seededNoise(index * 5.31) * 0.2,
        phase: seededNoise(index * 11.73) * Math.PI * 2,
        color: new THREE.Color(sceneTokens.visualStory.audience.palette[index % sceneTokens.visualStory.audience.palette.length]),
      };
    });
  }, [quality]);
  const auraGeometry = useMemo(() => {
    const buffer = new THREE.BufferGeometry();
    const positions = new Float32Array(figures.length * 3);
    figures.forEach((figure, index) => {
      positions[index * 3] = figure.x;
      positions[index * 3 + 1] = figure.height * 0.86;
      positions[index * 3 + 2] = figure.z;
    });
    const attribute = new THREE.BufferAttribute(positions, 3);
    attribute.setUsage(THREE.DynamicDrawUsage);
    buffer.setAttribute("position", attribute);
    return buffer;
  }, [figures]);

  useEffect(() => {
    const bodyMesh = bodies.current;
    const headMesh = heads.current;
    if (!bodyMesh || !headMesh) return;
    bodyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    headMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    figures.forEach((figure, index) => {
      bodyMesh.setColorAt(index, figure.color);
      headMesh.setColorAt(index, figure.color.clone().offsetHSL(0, -0.08, 0.07));
    });
    if (bodyMesh.instanceColor) bodyMesh.instanceColor.needsUpdate = true;
    if (headMesh.instanceColor) headMesh.instanceColor.needsUpdate = true;
  }, [figures]);

  useEffect(() => () => auraGeometry.dispose(), [auraGeometry]);

  useFrame(({ clock }) => {
    const story = experienceState.narrative;
    const audienceConfig = sceneTokens.visualStory.audience;
    const enter = smoothstep(rangeProgress(experienceState.progress, audienceConfig.enter));
    const exit = smoothstep(rangeProgress(experienceState.progress, audienceConfig.exit));
    const amount = enter * (1 - exit) * (1 - story.reset);
    const opacity = amount * (audienceConfig.opacity[quality] + story.peak * audienceConfig.peakBoost);
    if (bodyMaterial.current) bodyMaterial.current.opacity = opacity;
    if (headMaterial.current) headMaterial.current.opacity = opacity * 0.94;
    if (auraMaterial.current) auraMaterial.current.opacity = amount * (0.16 + story.energy * 0.16 + story.peak * 0.18);
    if (bodies.current) bodies.current.visible = amount > 0.002;
    if (heads.current) heads.current.visible = amount > 0.002;
    if (aura.current) aura.current.visible = amount > 0.002;
    const auraPositions = auraGeometry.getAttribute("position") as THREE.BufferAttribute;
    figures.forEach((figure, index) => {
      const scale = figure.height / 1.62;
      const gatherOffset = (1 - amount) * audienceConfig.gatherDistance / Math.max(figure.radius, 0.001);
      const lateralMotion = Math.sin(clock.elapsedTime * 0.34 + figure.phase) * audienceConfig.motion * amount;
      const x = figure.x * (1 + gatherOffset) - Math.sin(figure.angle) * lateralMotion;
      const z = figure.z * (1 + gatherOffset) + Math.cos(figure.angle) * lateralMotion;
      const step = Math.abs(Math.sin(clock.elapsedTime * 0.48 + figure.phase)) * 0.012 * amount;

      dummy.position.set(x, 0.68 * scale + step, z);
      dummy.rotation.set(0, -figure.angle + Math.PI * 0.5, 0);
      dummy.scale.set(scale * figure.width, scale, scale * 0.64);
      dummy.updateMatrix();
      bodies.current?.setMatrixAt(index, dummy.matrix);

      dummy.position.set(x, 1.36 * scale + step, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(scale * (0.92 + (index % 3) * 0.035));
      dummy.updateMatrix();
      heads.current?.setMatrixAt(index, dummy.matrix);
      auraPositions.setXYZ(index, x, 1.42 * scale + step, z);
    });
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true;
    if (heads.current) heads.current.instanceMatrix.needsUpdate = true;
    auraPositions.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={bodies} args={[undefined, undefined, figures.length]} frustumCulled={false} renderOrder={2}>
        <capsuleGeometry args={[0.12, 0.7, 2, 6]} />
        <meshBasicMaterial ref={bodyMaterial} vertexColors transparent opacity={0} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, figures.length]} frustumCulled={false} renderOrder={2}>
        <sphereGeometry args={[0.13, 8, 6]} />
        <meshBasicMaterial ref={headMaterial} vertexColors transparent opacity={0} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <points ref={aura} geometry={auraGeometry} frustumCulled={false} renderOrder={3}>
        <pointsMaterial
          ref={auraMaterial}
          color={sceneTokens.colors.cyan}
          size={quality === "full" ? 0.105 : 0.13}
          transparent
          opacity={0}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </group>
  );
}
