"use client";

/* eslint-disable react-hooks/immutability -- R3F frame callbacks update GPU uniforms directly. */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { bakedSceneContract, type BakedSectionId } from "./baked-scene-contract";
import { experienceState } from "./experience-state";
import { sceneTokens, type SceneQuality } from "./scene-config";
import { getStageFrame } from "./stage-presets";

type SampleSource = {
  mesh: THREE.Mesh;
  sampler: MeshSurfaceSampler;
  weight: number;
};

const sectionIds: readonly BakedSectionId[] = ["environment", "central", "left", "right"];

const vertexShader = /* glsl */ `
  attribute float aSection;
  attribute float aOrder;
  attribute float aSeed;
  attribute vec3 aNormal;
  uniform vec4 uReveal;
  uniform vec4 uParticleReveal;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uSize;
  uniform float uTurbulence;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying float vSeed;

  float sectionValue(float section) {
    if (section < 0.5) return uReveal.x;
    if (section < 1.5) return uReveal.y;
    if (section < 2.5) return uReveal.z;
    return uReveal.w;
  }

  float particleSectionValue(float section) {
    if (section < 0.5) return uParticleReveal.x;
    if (section < 1.5) return uParticleReveal.y;
    if (section < 2.5) return uParticleReveal.z;
    return uParticleReveal.w;
  }

  void main() {
    float reveal = sectionValue(aSection);
    float particleReveal = particleSectionValue(aSection);
    float particleFront = min(1.0, particleReveal + 0.16);
    float boundary = 1.0 - smoothstep(0.035, 0.19, abs(aOrder - particleFront));
    // particleFront is spatially ahead of the solid boundary. It must not be
    // used as the activation gate or an entirely hidden section emits dust.
    float startGate = smoothstep(0.001, 0.045, particleReveal);
    float finishGate = 1.0 - smoothstep(0.91, 1.0, reveal);
    vAlpha = clamp(boundary * startGate * finishGate * uIntensity, 0.0, 1.0);
    vSeed = aSeed;

    float flutter = sin(uTime * (0.45 + aSeed * 0.55) + aSeed * 31.0)
      * mix(0.008, 0.11, uTurbulence)
      * boundary;
    vec3 displaced = position + aNormal * flutter;
    vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    float perspective = clamp(250.0 / max(1.0, -viewPosition.z), 0.55, 4.0);
    gl_PointSize = mix(0.42, 2.05, uSize) * uPixelRatio * perspective;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  varying float vSeed;

  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float distanceToCenter = length(point);
    if (distanceToCenter > 0.5) discard;
    float glow = 1.0 - smoothstep(0.04, 0.5, distanceToCenter);
    float core = 1.0 - smoothstep(0.0, 0.13, distanceToCenter);
    vec3 color = uColor * (0.55 + vSeed * 0.25 + core * 1.4);
    gl_FragColor = vec4(color, (glow * 0.58 + core * 0.42) * vAlpha);
    #include <colorspace_fragment>
  }
`;

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function collectSources(root: THREE.Object3D | null | undefined) {
  const sources: SampleSource[] = [];
  if (!root) return sources;
  root.updateMatrixWorld(true);
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.geometry.getAttribute("position")) return;
    child.geometry.computeBoundingBox();
    const size = child.geometry.boundingBox?.getSize(new THREE.Vector3()) ?? new THREE.Vector3(1, 1, 1);
    const weight = Math.max(0.001, size.x * size.y + size.x * size.z + size.y * size.z);
    sources.push({
      mesh: child,
      sampler: new MeshSurfaceSampler(child).build(),
      weight,
    });
  });
  return sources;
}

function chooseSource(sources: SampleSource[], random: () => number) {
  const total = sources.reduce((sum, source) => sum + source.weight, 0);
  let cursor = random() * total;
  for (const source of sources) {
    cursor -= source.weight;
    if (cursor <= 0) return source;
  }
  return sources[sources.length - 1];
}

function buildGeometry(
  environment: THREE.Object3D,
  exhibition: THREE.Object3D,
  count: number,
) {
  const roots = {
    environment: environment.getObjectByName(bakedSceneContract.environment.section),
    central: exhibition.getObjectByName(bakedSceneContract.exhibition.sections.central.root),
    left: exhibition.getObjectByName(bakedSceneContract.exhibition.sections.left.root),
    right: exhibition.getObjectByName(bakedSceneContract.exhibition.sections.right.root),
  };
  const anchors = {
    environment: environment.getObjectByName(bakedSceneContract.environment.revealAnchor),
    central: exhibition.getObjectByName(bakedSceneContract.exhibition.sections.central.revealAnchor),
    left: exhibition.getObjectByName(bakedSceneContract.exhibition.sections.left.revealAnchor),
    right: exhibition.getObjectByName(bakedSceneContract.exhibition.sections.right.revealAnchor),
  };
  const distribution = { environment: 0.22, central: 0.3, left: 0.24, right: 0.24 };
  const positions: number[] = [];
  const normals: number[] = [];
  const sections: number[] = [];
  const orders: number[] = [];
  const seeds: number[] = [];
  const random = seededRandom(24681357);
  const localPosition = new THREE.Vector3();
  const localNormal = new THREE.Vector3();
  const worldPosition = new THREE.Vector3();
  const worldNormal = new THREE.Vector3();
  const anchorPosition = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();

  sectionIds.forEach((sectionId, sectionIndex) => {
    const sources = collectSources(roots[sectionId]);
    if (sources.length === 0) return;
    anchors[sectionId]?.getWorldPosition(anchorPosition);
    const sectionCount = Math.max(1, Math.round(count * distribution[sectionId]));
    const startIndex = orders.length;
    let maximumDistance = 0;
    for (let index = 0; index < sectionCount; index += 1) {
      const source = chooseSource(sources, random);
      source.sampler.sample(localPosition, localNormal);
      worldPosition.copy(localPosition).applyMatrix4(source.mesh.matrixWorld);
      normalMatrix.getNormalMatrix(source.mesh.matrixWorld);
      worldNormal.copy(localNormal).applyMatrix3(normalMatrix).normalize();
      positions.push(worldPosition.x, worldPosition.y, worldPosition.z);
      normals.push(worldNormal.x, worldNormal.y, worldNormal.z);
      sections.push(sectionIndex);
      const distance = worldPosition.distanceTo(anchorPosition);
      orders.push(distance);
      maximumDistance = Math.max(maximumDistance, distance);
      seeds.push(random());
    }
    for (let index = startIndex; index < orders.length; index += 1) {
      orders[index] = orders[index] / Math.max(0.001, maximumDistance);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aNormal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("aSection", new THREE.Float32BufferAttribute(sections, 1));
  geometry.setAttribute("aOrder", new THREE.Float32BufferAttribute(orders, 1));
  geometry.setAttribute("aSeed", new THREE.Float32BufferAttribute(seeds, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

export function TransitionParticleField({
  environment,
  exhibition,
  quality,
}: {
  environment: THREE.Object3D;
  exhibition: THREE.Object3D;
  quality: SceneQuality;
}) {
  const points = useRef<THREE.Points>(null);
  const { gl } = useThree();
  const geometry = useMemo(
    () => buildGeometry(environment, exhibition, sceneTokens.bakedScene.particleCount[quality]),
    [environment, exhibition, quality],
  );
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uReveal: { value: new THREE.Vector4() },
      uParticleReveal: { value: new THREE.Vector4() },
      uTime: { value: 0 },
      uIntensity: { value: 1 },
      uSize: { value: 0.5 },
      uTurbulence: { value: 0.4 },
      uPixelRatio: { value: Math.min(gl.getPixelRatio(), 1.5) },
      uColor: { value: new THREE.Color(sceneTokens.bakedScene.material.particleColor) },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  }), [gl]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame(({ clock }) => {
    const production = experienceState.stage.production;
    const particleProduction = getStageFrame(
      Math.min(1, experienceState.progress + sceneTokens.bakedScene.particleLeadProgress),
    ).production;
    const environmentReveal = experienceState.sequence === "intro"
      ? experienceState.intro.assemblyProgress
      : production.environmentReveal;
    material.uniforms.uReveal.value.set(
      environmentReveal,
      production.centralReveal,
      production.leftReveal,
      production.rightReveal,
    );
    material.uniforms.uParticleReveal.value.set(
      environmentReveal,
      particleProduction.centralReveal,
      particleProduction.leftReveal,
      particleProduction.rightReveal,
    );
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uIntensity.value = production.transitionParticles;
    material.uniforms.uSize.value = production.transitionParticleSize;
    material.uniforms.uTurbulence.value = production.transitionTurbulence;
    if (points.current) points.current.visible = production.transitionParticles > 0.002;
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />;
}
