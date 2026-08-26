"use client";

/* eslint-disable react-hooks/immutability -- R3F frame callbacks update GPU uniforms directly. */

import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { publicAssetPath } from "@/lib/public-asset-path";

export type JourneyProgressRef = { current: number };
const finaleLogoSrc = publicAssetPath("/images/mandegar-finale-logo.webp");

const depthVertexShader = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uEntry;
  uniform float uCursor;
  uniform vec2 uPointer;
  varying float vAlpha;
  varying float vSeed;
  varying float vEntry;

  void main() {
    vec3 displaced = position;
    float drift = uTime * mix(0.035, 0.09, aSeed);
    displaced.x += sin(drift + aSeed * 31.0 + uCursor * 0.18) * mix(0.04, 0.18, aSeed);
    displaced.y += cos(drift * 0.71 + aSeed * 19.0) * mix(0.035, 0.14, aSeed);
    displaced.z += (1.0 - uEntry) * 4.4;

    vec4 pointerViewPosition = modelViewMatrix * vec4(displaced, 1.0);
    vec4 pointerClipPosition = projectionMatrix * pointerViewPosition;
    vec2 screenPosition = pointerClipPosition.xy / max(abs(pointerClipPosition.w), 0.001);
    vec2 away = screenPosition - uPointer;
    float pointerDistance = max(length(away), 0.001);
    float pointerInfluence = (1.0 - smoothstep(0.0, 0.24, pointerDistance)) * uEntry;
    displaced.xy += normalize(away) * pointerInfluence * mix(0.08, 0.32, aSeed);

    vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    float perspective = clamp(230.0 / max(1.0, -viewPosition.z), 0.58, 2.8);
    gl_PointSize = mix(0.8, 2.15, aSeed) * uPixelRatio * perspective;
    vAlpha = mix(0.18, 0.68, aSeed) * mix(0.78, 1.0, uEntry);
    vSeed = aSeed;
    vEntry = uEntry;
  }
`;

const depthFragmentShader = /* glsl */ `
  varying float vAlpha;
  varying float vSeed;
  varying float vEntry;

  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float radius = length(point);
    if (radius > 0.5) discard;
    float glow = 1.0 - smoothstep(0.05, 0.5, radius);
    float core = 1.0 - smoothstep(0.0, 0.13, radius);
    vec3 warm = vec3(0.61, 0.43, 0.27);
    vec3 cool = vec3(0.34, 0.73, 1.0);
    vec3 color = mix(warm, cool, vEntry) * mix(0.72, 1.16, vSeed) + core * 0.16;
    gl_FragColor = vec4(color, (glow * 0.72 + core * 0.28) * vAlpha);
    #include <colorspace_fragment>
  }
`;

const processVertexShader = /* glsl */ `
  attribute vec3 aSpace;
  attribute vec3 aTechnology;
  attribute vec3 aDelivery;
  attribute float aSeed;
  uniform float uTime;
  uniform float uMorph;
  uniform float uOpacity;
  uniform float uPixelRatio;
  uniform vec2 uPointer;
  varying float vAlpha;
  varying float vEnergy;

  vec3 processPosition(float state) {
    if (state < 1.0) return mix(position, aSpace, smoothstep(0.0, 1.0, state));
    if (state < 2.0) return mix(aSpace, aTechnology, smoothstep(1.0, 2.0, state));
    return mix(aTechnology, aDelivery, smoothstep(2.0, 3.0, state));
  }

  void main() {
    vec3 displaced = processPosition(uMorph);
    float breath = sin(uTime * mix(0.32, 0.78, aSeed) + aSeed * 27.0);
    displaced.z += breath * mix(0.018, 0.085, aSeed);

    vec4 pointerViewPosition = modelViewMatrix * vec4(displaced, 1.0);
    vec4 pointerClipPosition = projectionMatrix * pointerViewPosition;
    vec2 screenPosition = pointerClipPosition.xy / max(abs(pointerClipPosition.w), 0.001);
    vec2 away = screenPosition - uPointer;
    float pointerDistance = max(length(away), 0.001);
    float pointerInfluence = 1.0 - smoothstep(0.0, 0.24, pointerDistance);
    displaced.xy += normalize(away) * pointerInfluence * mix(0.12, 0.42, aSeed) * uOpacity;
    displaced.z += pointerInfluence * mix(0.08, 0.38, aSeed) * uOpacity;

    vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    float perspective = clamp(260.0 / max(1.0, -viewPosition.z), 0.72, 3.2);
    gl_PointSize = mix(1.15, 3.25, aSeed) * uPixelRatio * perspective;
    vAlpha = uOpacity * mix(0.34, 0.96, aSeed);
    vEnergy = clamp(uMorph / 3.0 + aSeed * 0.18, 0.0, 1.0);
  }
`;

const processFragmentShader = /* glsl */ `
  varying float vAlpha;
  varying float vEnergy;

  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float radius = length(point);
    if (radius > 0.5) discard;
    float glow = 1.0 - smoothstep(0.04, 0.5, radius);
    float core = 1.0 - smoothstep(0.0, 0.12, radius);
    vec3 warm = vec3(1.0, 0.72, 0.42);
    vec3 cool = vec3(0.42, 0.82, 1.0);
    vec3 color = mix(warm, cool, vEnergy) + core * 0.22;
    gl_FragColor = vec4(color, (glow * 0.66 + core * 0.34) * vAlpha);
    #include <colorspace_fragment>
  }
`;

const wordmarkVertexShader = /* glsl */ `
  attribute vec3 aStart;
  attribute float aSeed;
  uniform float uTime;
  uniform float uReveal;
  uniform float uOpacity;
  uniform float uPixelRatio;
  uniform vec2 uPointer;
  uniform vec2 uPointerTail;
  uniform float uInteraction;
  varying float vAlpha;
  varying float vSeed;
  varying float vEnergy;

  void main() {
    float resolve = smoothstep(0.0, 1.0, uReveal);
    vec3 displaced = mix(aStart, position, resolve);
    displaced.z += sin(uTime * 0.42 + aSeed * 31.0) * 0.018 * resolve;

    vec4 pointerViewPosition = modelViewMatrix * vec4(displaced, 1.0);
    vec4 pointerClipPosition = projectionMatrix * pointerViewPosition;
    vec2 screenPosition = pointerClipPosition.xy / max(abs(pointerClipPosition.w), 0.001);
    vec2 flow = uPointer - uPointerTail;
    float flowLength = max(length(flow), 0.001);
    vec2 flowDirection = flow / flowLength;
    vec2 flowNormal = vec2(-flowDirection.y, flowDirection.x);
    float trailPosition = fract(aSeed * 7.137 + aSeed * aSeed * 3.71);
    float curveEnvelope = sin(trailPosition * 3.14159265);
    float curl = sin(aSeed * 31.0 + uTime * 2.4 + trailPosition * 9.0);
    vec2 trailPoint = mix(uPointerTail, uPointer, trailPosition);
    trailPoint += flowNormal * curl * curveEnvelope * mix(0.06, 0.23, uInteraction);
    float particleRadius = mix(0.09, 0.2, uInteraction) * mix(0.72, 1.28, fract(aSeed * 19.73));
    float trailInfluence = 1.0 - smoothstep(0.0, particleRadius, length(screenPosition - trailPoint));
    float headInfluence = 1.0 - smoothstep(0.0, particleRadius * 1.28, length(screenPosition - uPointer));
    float influence = max(trailInfluence * 0.82, headInfluence) * resolve * uInteraction;
    vec2 pullTarget = mix(trailPoint, uPointer, headInfluence);
    vec2 towardWake = pullTarget - screenPosition;
    float wake = sin(uTime * 4.0 + aSeed * 41.0) * curveEnvelope;
    displaced.xy += towardWake * influence * mix(1.5, 3.2, aSeed);
    displaced.xy += flowNormal * wake * influence * mix(0.08, 0.28, aSeed);
    displaced.xy += flowDirection * influence * (aSeed - 0.5) * 0.18;
    displaced.z += influence * mix(0.12, 0.62, aSeed);

    vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    float perspective = clamp(255.0 / max(1.0, -viewPosition.z), 0.75, 3.0);
    gl_PointSize = mix(1.0, 2.7, aSeed) * uPixelRatio * perspective * (1.0 + influence * 0.42);
    vAlpha = uOpacity * mix(0.38, 0.96, aSeed);
    vSeed = aSeed;
    vEnergy = influence;
  }
`;

const wordmarkFragmentShader = /* glsl */ `
  varying float vAlpha;
  varying float vSeed;
  varying float vEnergy;

  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float radius = length(point);
    if (radius > 0.5) discard;
    float glow = 1.0 - smoothstep(0.04, 0.5, radius);
    float core = 1.0 - smoothstep(0.0, 0.12, radius);
    vec3 baseColor = mix(vec3(0.34, 0.68, 1.0), vec3(0.88, 0.97, 1.0), vSeed);
    vec3 color = mix(baseColor, vec3(1.0), vEnergy * 0.72);
    gl_FragColor = vec4(color + core * 0.22, (glow * 0.7 + core * 0.3) * vAlpha);
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

function buildDepthGeometry(count: number, aspect: number) {
  const random = seededRandom(7251943);
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const halfFov = THREE.MathUtils.degToRad(43 * 0.5);
  for (let index = 0; index < count; index += 1) {
    const depth = Math.pow(random(), 0.72);
    const distance = THREE.MathUtils.lerp(0.8, 135, depth);
    const spreadY = Math.max(4.8, Math.tan(halfFov) * distance * 2.5);
    const spreadX = spreadY * Math.max(1, aspect);
    positions[index * 3] = (random() - 0.5) * spreadX;
    positions[index * 3 + 1] = (random() - 0.5) * spreadY;
    positions[index * 3 + 2] = 5.1 - distance + (random() - 0.5) * 1.8;
    seeds[index] = random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

function buildProcessGeometry(count: number) {
  const random = seededRandom(48151623);
  const idea = new Float32Array(count * 3);
  const space = new Float32Array(count * 3);
  const technology = new Float32Array(count * 3);
  const delivery = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const gridSide = Math.ceil(Math.sqrt(count));

  for (let index = 0; index < count; index += 1) {
    const seed = random();
    const normalized = (index + 0.5) / count;
    const sphereY = 1 - normalized * 2;
    const sphereRadius = Math.sqrt(Math.max(0, 1 - sphereY * sphereY));
    const sphereAngle = goldenAngle * index;
    const shell = 0.34 + Math.pow(random(), 0.34) * 1.22;
    idea[index * 3] = Math.cos(sphereAngle) * sphereRadius * shell;
    idea[index * 3 + 1] = sphereY * shell;
    idea[index * 3 + 2] = Math.sin(sphereAngle) * sphereRadius * shell * 0.72;

    const architectureFace = index % 5;
    if (architectureFace === 0 || architectureFace === 1) {
      space[index * 3] = architectureFace === 0 ? -1.75 : 1.75;
      space[index * 3 + 1] = THREE.MathUtils.lerp(-1.35, 1.45, random());
      space[index * 3 + 2] = THREE.MathUtils.lerp(-0.9, 0.9, random());
    } else if (architectureFace === 2) {
      space[index * 3] = THREE.MathUtils.lerp(-1.75, 1.75, random());
      space[index * 3 + 1] = 1.45;
      space[index * 3 + 2] = THREE.MathUtils.lerp(-0.9, 0.9, random());
    } else {
      const depth = THREE.MathUtils.lerp(-1.1, 1.1, random());
      space[index * 3] = THREE.MathUtils.lerp(-1.75, 1.75, random());
      space[index * 3 + 1] = -1.35 + Math.abs(space[index * 3]) * 0.08;
      space[index * 3 + 2] = depth;
    }

    const column = index % gridSide;
    const row = Math.floor(index / gridSide);
    const techX = THREE.MathUtils.lerp(-2.05, 2.05, column / Math.max(1, gridSide - 1));
    const techY = THREE.MathUtils.lerp(-1.35, 1.35, row / Math.max(1, gridSide - 1));
    technology[index * 3] = techX;
    technology[index * 3 + 1] = techY;
    technology[index * 3 + 2] = Math.sin(techX * 2.15 + techY * 1.45) * 0.36 + (seed - 0.5) * 0.08;

    if (seed < 0.64) {
      const travel = random();
      delivery[index * 3] = THREE.MathUtils.lerp(-2.05, 0.9, travel);
      delivery[index * 3 + 1] = (random() - 0.5) * (0.12 + travel * 0.18);
      delivery[index * 3 + 2] = (random() - 0.5) * 0.42;
    } else {
      const wing = random();
      const sign = index % 2 === 0 ? 1 : -1;
      delivery[index * 3] = THREE.MathUtils.lerp(0.55, 2.05, wing);
      delivery[index * 3 + 1] = sign * THREE.MathUtils.lerp(1.22, 0, wing) + (random() - 0.5) * 0.08;
      delivery[index * 3 + 2] = (random() - 0.5) * 0.42;
    }
    seeds[index] = seed;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(idea, 3));
  geometry.setAttribute("aSpace", new THREE.BufferAttribute(space, 3));
  geometry.setAttribute("aTechnology", new THREE.BufferAttribute(technology, 3));
  geometry.setAttribute("aDelivery", new THREE.BufferAttribute(delivery, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

function buildWordmarkGeometry(image: CanvasImageSource) {
  const geometry = new THREE.BufferGeometry();
  if (typeof document === "undefined") return geometry;

  const source = image as CanvasImageSource & {
    naturalWidth?: number;
    naturalHeight?: number;
    videoWidth?: number;
    videoHeight?: number;
    width?: number;
    height?: number;
  };
  const sourceWidth = source.naturalWidth ?? source.videoWidth ?? source.width ?? 1;
  const sourceHeight = source.naturalHeight ?? source.videoHeight ?? source.height ?? 1;
  const aspect = sourceWidth / Math.max(1, sourceHeight);
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = Math.max(1, Math.round(canvas.width / aspect));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return geometry;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const samples: Array<[number, number]> = [];
  for (let y = 0; y < canvas.height; y += 5) {
    for (let x = 0; x < canvas.width; x += 5) {
      if (pixels[(y * canvas.width + x) * 4 + 3] > 96) samples.push([x, y]);
    }
  }

  const random = seededRandom(3141592);
  const positions = new Float32Array(samples.length * 3);
  const starts = new Float32Array(samples.length * 3);
  const seeds = new Float32Array(samples.length);
  const worldWidth = 9.5;
  const worldHeight = worldWidth / aspect;
  samples.forEach(([x, y], index) => {
    const seed = random();
    const angle = index * 2.399963 + seed * 0.35;
    const radius = 2.8 + seed * 4.6;
    positions[index * 3] = (x / canvas.width - 0.5) * worldWidth;
    positions[index * 3 + 1] = (0.5 - y / canvas.height) * worldHeight;
    positions[index * 3 + 2] = 0;
    starts[index * 3] = Math.cos(angle) * radius;
    starts[index * 3 + 1] = Math.sin(angle) * radius * 0.72;
    starts[index * 3 + 2] = (random() - 0.5) * 10;
    seeds[index] = seed;
  });
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aStart", new THREE.BufferAttribute(starts, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

function smoothstep(value: number) {
  const safe = Math.min(1, Math.max(0, value));
  return safe * safe * (3 - 2 * safe);
}

export function JourneyDepthField({
  progress,
  entryProgress,
}: {
  progress: JourneyProgressRef;
  entryProgress: JourneyProgressRef;
}) {
  const { gl, size } = useThree();
  const geometry = useMemo(
    () => buildDepthGeometry(size.width <= 760 ? 900 : 1650, size.width / Math.max(1, size.height)),
    [size.height, size.width],
  );
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(gl.getPixelRatio(), 1.5) },
      uEntry: { value: 0 },
      uCursor: { value: 0 },
      uPointer: { value: new THREE.Vector2() },
    },
    vertexShader: depthVertexShader,
    fragmentShader: depthFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: false,
  }), [gl]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame(({ clock, pointer }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uPixelRatio.value = Math.min(gl.getPixelRatio(), 1.5);
    material.uniforms.uEntry.value = entryProgress.current;
    material.uniforms.uCursor.value = progress.current;
    material.uniforms.uPointer.value.lerp(pointer, 0.08);
  });

  return <points geometry={geometry} material={material} frustumCulled={false} raycast={() => undefined} />;
}

export function ProcessParticleSculpture({
  centerZ,
  progress,
  processStart,
  voiceStart,
  activeIndex,
  offsetX,
  direction,
}: {
  centerZ: number;
  progress: JourneyProgressRef;
  processStart: number;
  voiceStart: number;
  activeIndex: number;
  offsetX: number;
  direction: 1 | -1;
}) {
  const { gl, size } = useThree();
  const morph = useRef(0);
  const geometry = useMemo(() => buildProcessGeometry(size.width <= 760 ? 1250 : 2300), [size.width]);
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMorph: { value: 0 },
      uOpacity: { value: 0 },
      uPixelRatio: { value: Math.min(gl.getPixelRatio(), 1.5) },
      uPointer: { value: new THREE.Vector2() },
    },
    vertexShader: processVertexShader,
    fragmentShader: processFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }), [gl]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame(({ clock, pointer }, delta) => {
    const enter = smoothstep(progress.current - (processStart - 0.9));
    const exit = 1 - smoothstep(progress.current - (voiceStart - 0.78));
    morph.current = THREE.MathUtils.damp(morph.current, activeIndex, 5.8, delta);
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uMorph.value = morph.current;
    material.uniforms.uOpacity.value = enter * exit;
    material.uniforms.uPixelRatio.value = Math.min(gl.getPixelRatio(), 1.5);
    material.uniforms.uPointer.value.lerp(pointer, 1 - Math.exp(-delta * 7));
  });

  return (
    <points
      geometry={geometry}
      material={material}
      position={[offsetX, 0, centerZ]}
      scale={[direction, 1, 1]}
      frustumCulled={false}
      raycast={() => undefined}
    />
  );
}

export function FinaleParticleWordmark({
  centerZ,
  progress,
  finalStop,
}: {
  centerZ: number;
  progress: JourneyProgressRef;
  finalStop: number;
}) {
  const { gl, size } = useThree();
  const logoTexture = useLoader(THREE.TextureLoader, finaleLogoSrc);
  const geometry = useMemo(() => buildWordmarkGeometry(logoTexture.image), [logoTexture]);
  const pointerHead = useRef(new THREE.Vector2());
  const pointerTail = useRef(new THREE.Vector2());
  const interaction = useRef(0);
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uOpacity: { value: 0 },
      uPixelRatio: { value: Math.min(gl.getPixelRatio(), 1.5) },
      uPointer: { value: new THREE.Vector2() },
      uPointerTail: { value: new THREE.Vector2() },
      uInteraction: { value: 0 },
    },
    vertexShader: wordmarkVertexShader,
    fragmentShader: wordmarkFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }), [gl]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame(({ clock, pointer }, delta) => {
    const reveal = smoothstep((progress.current - (finalStop - 0.72)) / 0.72);
    pointerHead.current.lerp(pointer, 1 - Math.exp(-delta * 20));
    pointerTail.current.lerp(pointerHead.current, 1 - Math.exp(-delta * 3.2));
    const flowEnergy = Math.min(1, pointerHead.current.distanceTo(pointerTail.current) * 7.5);
    interaction.current = THREE.MathUtils.damp(
      interaction.current,
      flowEnergy,
      flowEnergy > interaction.current ? 14 : 1.7,
      delta,
    );
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uReveal.value = THREE.MathUtils.damp(material.uniforms.uReveal.value, reveal, 5.5, delta);
    material.uniforms.uOpacity.value = THREE.MathUtils.damp(material.uniforms.uOpacity.value, reveal, 6, delta);
    material.uniforms.uPixelRatio.value = Math.min(gl.getPixelRatio(), 1.5);
    material.uniforms.uPointer.value.copy(pointerHead.current);
    material.uniforms.uPointerTail.value.copy(pointerTail.current);
    material.uniforms.uInteraction.value = interaction.current;
  });

  return (
    <points
      geometry={geometry}
      material={material}
      position={[0, 0, centerZ]}
      scale={size.width <= 760 ? 0.66 : 0.94}
      frustumCulled={false}
      raycast={() => undefined}
    />
  );
}
