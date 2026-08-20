"use client";

/* eslint-disable react-hooks/immutability -- R3F frame callbacks update GPU uniforms directly. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { experienceState } from "./experience-state";
import { phaseProgress, sceneTokens } from "./scene-config";

const vertexShader = /* glsl */ `
  attribute float aKind;
  attribute float aProgress;
  attribute float aSeed;
  uniform float uTime;
  uniform float uStrength;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying float vKind;
  varying float vSeed;

  void main() {
    float travel = fract(aProgress - uTime * 0.17 - aSeed * 0.21);
    float packet = 1.0 - smoothstep(0.0, 0.12, abs(travel - 0.5));
    float nodePulse = sin(uTime * 1.8 + aSeed * 12.0) * 0.5 + 0.5;
    vAlpha = mix(0.34 + packet * 0.66, 0.88 + nodePulse * 0.12, aKind) * uStrength;
    vKind = aKind;
    vSeed = aSeed;

    vec3 displaced = position;
    displaced.y += aKind * sin(uTime * 1.35 + aSeed * 16.0) * 0.018;
    vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = mix(1.0 + packet * 1.35, 4.25 + nodePulse * 1.1, aKind)
      * uPixelRatio;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vAlpha;
  varying float vKind;
  varying float vSeed;

  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float radius = length(point);
    if (radius > 0.5) discard;
    float core = 1.0 - smoothstep(0.04, 0.5, radius);
    vec3 signal = mix(vec3(0.19, 0.58, 1.0), vec3(0.47, 0.91, 1.0), vSeed);
    signal = mix(signal, vec3(0.38, 1.0, 1.0), vKind * 0.9);
    gl_FragColor = vec4(signal, core * vAlpha);
    #include <colorspace_fragment>
  }
`;

function getCrowdActors(crowd: THREE.Object3D) {
  crowd.updateMatrixWorld(true);
  const root = crowd.getObjectByName("root_crowd") ?? crowd;
  const candidates = root.children.flatMap((child) => (
    child.name.startsWith("crowd_") && child.children.length > 0
      ? child.children
      : [child]
  ));
  return candidates.filter((candidate) => {
    let hasGeometry = false;
    candidate.traverse((object) => {
      if (object instanceof THREE.Mesh) hasGeometry = true;
    });
    return hasGeometry;
  });
}

function getHeadPositions(crowd: THREE.Object3D) {
  const bounds = new THREE.Box3();
  const center = new THREE.Vector3();
  return getCrowdActors(crowd).flatMap((actor) => {
    bounds.setFromObject(actor);
    if (bounds.isEmpty() || bounds.max.y - bounds.min.y < 0.3) return [];
    bounds.getCenter(center);
    return [new THREE.Vector3(center.x, bounds.max.y + 0.22, center.z)];
  });
}

function buildCrowdNetwork(crowd: THREE.Object3D) {
  const heads = getHeadPositions(crowd);
  const positions: number[] = [];
  const kinds: number[] = [];
  const progressValues: number[] = [];
  const seeds: number[] = [];
  const edgeKeys = new Set<string>();
  const point = new THREE.Vector3();

  const pushPoint = (
    position: THREE.Vector3,
    kind: number,
    progress: number,
    seed: number,
  ) => {
    positions.push(position.x, position.y, position.z);
    kinds.push(kind);
    progressValues.push(progress);
    seeds.push(seed);
  };

  heads.forEach((head, index) => {
    pushPoint(head, 1, 0, (index * 0.61803398875) % 1);
    for (let orbit = 0; orbit < 5; orbit += 1) {
      const angle = orbit / 5 * Math.PI * 2 + index * 0.37;
      point.set(
        head.x + Math.cos(angle) * 0.045,
        head.y + Math.sin(angle * 2) * 0.018,
        head.z + Math.sin(angle) * 0.045,
      );
      pushPoint(point, 1, orbit / 5, ((index + 1) * (orbit + 3) * 0.137) % 1);
    }

    heads
      .map((candidate, candidateIndex) => ({
        candidateIndex,
        distance: candidateIndex === index ? Number.POSITIVE_INFINITY : head.distanceTo(candidate),
      }))
      .sort((first, second) => first.distance - second.distance)
      .slice(0, 4)
      .forEach(({ candidateIndex }) => {
        const fromIndex = Math.min(index, candidateIndex);
        const toIndex = Math.max(index, candidateIndex);
        edgeKeys.add(`${fromIndex}:${toIndex}`);
      });
  });

  Array.from(edgeKeys).forEach((key, edgeIndex) => {
    const [fromIndex, toIndex] = key.split(":").map(Number);
    const start = heads[fromIndex];
    const end = heads[toIndex];
    if (!start || !end) return;
    const distance = start.distanceTo(end);
    const count = THREE.MathUtils.clamp(Math.ceil(distance * 48), 42, 132);
    for (let index = 0; index < count; index += 1) {
      const progress = index / Math.max(1, count - 1);
      point.lerpVectors(start, end, progress);
      point.y += Math.sin(progress * Math.PI) * Math.min(0.22, distance * 0.035);
      pushPoint(point, 0, progress, ((edgeIndex + 1) * 0.173 + index * 0.031) % 1);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aKind", new THREE.Float32BufferAttribute(kinds, 1));
  geometry.setAttribute("aProgress", new THREE.Float32BufferAttribute(progressValues, 1));
  geometry.setAttribute("aSeed", new THREE.Float32BufferAttribute(seeds, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

export function CrowdIntelligenceNetwork({ crowd }: { crowd: THREE.Object3D }) {
  const points = useRef<THREE.Points>(null);
  const { gl } = useThree();
  const geometry = useMemo(() => buildCrowdNetwork(crowd), [crowd]);
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uStrength: { value: 0 },
      uPixelRatio: { value: Math.min(gl.getPixelRatio(), 1.5) },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  }), [gl]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame(({ clock }) => {
    const timing = phaseProgress(
      experienceState.progress,
      sceneTokens.bakedScene.dataFlowRange,
    );
    const easedTiming = timing * timing * (3 - 2 * timing);
    const strength = experienceState.stage.production.dataFlow
      * experienceState.stage.production.crowdPresence
      * easedTiming
      * 1.35;
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uStrength.value = strength;
    if (points.current) points.current.visible = strength > 0.002;
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />;
}
