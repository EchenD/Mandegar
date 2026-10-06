"use client";

/* eslint-disable react-hooks/immutability -- R3F frame callbacks update GPU uniforms directly. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { experienceState } from "./experience-state";
import { sceneTokens, type SceneQuality } from "./scene-config";

const vertexShader = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uScrollImpulse;
  uniform float uSize;
  varying float vAlpha;
  varying float vSeed;

  void main() {
    float slowTime = uTime * (0.055 + aSeed * 0.045);
    vec3 displaced = position;
    displaced.x += sin(slowTime + aSeed * 31.0) * (0.08 + aSeed * 0.16);
    displaced.y += cos(slowTime * 0.73 + aSeed * 19.0) * (0.045 + aSeed * 0.09);
    displaced.y += uScrollImpulse * (0.04 + aSeed * 0.07);
    displaced.z += sin(slowTime * 0.61 + aSeed * 43.0) * (0.07 + aSeed * 0.13);

    vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    float perspective = clamp(220.0 / max(1.0, -viewPosition.z), 0.62, 2.2);
    gl_PointSize = uSize * mix(0.72, 1.22, aSeed) * uPixelRatio * perspective;
    vAlpha = mix(0.34, 0.78, aSeed);
    vSeed = aSeed;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  varying float vSeed;

  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float radius = length(point);
    if (radius > 0.5) discard;
    float softParticle = 1.0 - smoothstep(0.08, 0.5, radius);
    float center = 1.0 - smoothstep(0.0, 0.14, radius);
    vec3 color = uColor * mix(0.78, 1.08, vSeed) + center * 0.05;
    gl_FragColor = vec4(color, softParticle * vAlpha * uOpacity);
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

function buildDustGeometry(
  exhibition: THREE.Object3D,
  count: number,
  foregroundDepth: number,
  foregroundBias: number,
) {
  exhibition.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(exhibition);
  const size = bounds.getSize(new THREE.Vector3());
  const minimum = bounds.min.clone().add(new THREE.Vector3(
    size.x * 0.04,
    size.y * 0.12,
    size.z * 0.04,
  ));
  const maximum = bounds.max.clone().sub(new THREE.Vector3(
    size.x * 0.04,
    size.y * 0.08,
    0,
  ));
  maximum.z += size.z * foregroundDepth;
  const random = seededRandom(91827364);
  const positions: number[] = [];
  const seeds: number[] = [];

  for (let index = 0; index < count; index += 1) {
    const depthDistribution = Math.pow(random(), foregroundBias);
    positions.push(
      THREE.MathUtils.lerp(minimum.x, maximum.x, random()),
      THREE.MathUtils.lerp(minimum.y, maximum.y, random()),
      THREE.MathUtils.lerp(minimum.z, maximum.z, depthDistribution),
    );
    seeds.push(random());
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.Float32BufferAttribute(seeds, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

export function AmbientDust({
  exhibition,
  quality,
}: {
  exhibition: THREE.Object3D;
  quality: SceneQuality;
}) {
  const points = useRef<THREE.Points>(null);
  const previousProgress = useRef(experienceState.progress);
  const scrollImpulse = useRef(0);
  const { gl } = useThree();
  const settings = sceneTokens.bakedScene.ambientDust;
  const geometry = useMemo(
    () => buildDustGeometry(
      exhibition,
      settings.count[quality],
      settings.foregroundDepth,
      settings.foregroundBias,
    ),
    [
      exhibition,
      quality,
      settings.count,
      settings.foregroundBias,
      settings.foregroundDepth,
    ],
  );
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(gl.getPixelRatio(), 1.5) },
      uScrollImpulse: { value: 0 },
      uSize: { value: settings.size },
      uColor: { value: new THREE.Color(settings.color) },
      uOpacity: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    blending: THREE.NormalBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  }), [gl, settings.color, settings.size]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame(({ clock }, delta) => {
    const progress = experienceState.progress;
    const progressVelocity = (progress - previousProgress.current) / Math.max(delta, 0.001);
    previousProgress.current = progress;
    const targetImpulse = THREE.MathUtils.clamp(progressVelocity * 0.12, -1, 1);
    scrollImpulse.current = THREE.MathUtils.lerp(
      scrollImpulse.current,
      targetImpulse,
      1 - Math.exp(-delta * 4.2),
    );
    const environmentPresence = experienceState.sequence === "loading"
      ? 0
      : experienceState.sequence === "intro"
        ? experienceState.intro.assemblyProgress
        : experienceState.stage.production.environmentReveal;
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uPixelRatio.value = Math.min(gl.getPixelRatio(), 1.5);
    material.uniforms.uScrollImpulse.value = scrollImpulse.current;
    material.uniforms.uOpacity.value = settings.opacity * THREE.MathUtils.smoothstep(
      environmentPresence,
      0.18,
      0.72,
    ) * (1 - experienceState.handoffProgress);
    if (points.current) points.current.visible = material.uniforms.uOpacity.value > 0.002;
  });

  return (
    <points
      ref={points}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      raycast={() => undefined}
    />
  );
}
