"use client";

/* eslint-disable react-hooks/immutability -- R3F render-loop callbacks intentionally mutate Three.js scene objects. */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { experienceState } from "./experience-state";
import {
  narrativeCueRanges as activationSequence,
  rangeProgress as phaseProgress,
} from "./narrative-score";
import { sceneTokens } from "./scene-config";

function smoothstep(value: number) {
  const safe = Math.min(1, Math.max(0, value));
  return safe * safe * (3 - 2 * safe);
}

function makeTrail(points: Array<[number, number, number]>) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  const samples = curve.getPoints(80);
  const positions: number[] = [];
  for (let index = 1; index < samples.length; index += 1) {
    positions.push(...samples[index - 1].toArray(), ...samples[index].toArray());
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setDrawRange(0, 0);
  return geometry;
}

export function WorldEnvironment() {
  const { scene } = useThree();
  const trailMaterials = useRef<Array<THREE.LineBasicMaterial | null>>([]);
  const trailObjects = useRef<Array<THREE.LineSegments | null>>([]);
  const ambientLight = useRef<THREE.AmbientLight>(null);
  const hemisphereLight = useRef<THREE.HemisphereLight>(null);
  const keyLight = useRef<THREE.DirectionalLight>(null);
  const fillLight = useRef<THREE.DirectionalLight>(null);
  const revealLight = useRef<THREE.PointLight>(null);
  const magentaLight = useRef<THREE.PointLight>(null);
  const amberLight = useRef<THREE.PointLight>(null);
  const interactionLight = useRef<THREE.PointLight>(null);
  const pointer = useRef(new THREE.Vector2());
  const pointerTarget = useRef(new THREE.Vector2());
  const quietBackground = useMemo(() => new THREE.Color(sceneTokens.environment.background.quiet), []);
  const activeBackground = useMemo(() => new THREE.Color(sceneTokens.environment.background.active), []);
  const peakBackground = useMemo(() => new THREE.Color(sceneTokens.environment.background.peak), []);
  const background = useMemo(() => new THREE.Color(), []);
  const trails = useMemo(() => [
    makeTrail([[-7, 0.025, 5.8], [-4.2, 0.03, 3.4], [-2.2, 0.035, 1.9], [0, 0.04, 1.1]]),
    makeTrail([[7, 0.026, 4.7], [4.7, 0.03, 3.2], [2.4, 0.035, 1.9], [0.5, 0.04, 1.0]]),
    makeTrail([[-5.8, 0.024, -0.8], [-4, 0.03, -0.2], [-2.6, 0.035, 0.7], [-1.2, 0.04, 0.8]]),
    makeTrail([[6.2, 0.027, -1.25], [4.8, 0.032, -0.45], [3.1, 0.036, 0.35], [1.25, 0.041, 0.78]]),
    makeTrail([[-7.4, 0.023, 2.1], [-5.1, 0.029, 1.3], [-3.3, 0.035, 1.45], [-1.65, 0.042, 0.9]]),
    makeTrail([[7.6, 0.024, 1.7], [5.6, 0.03, 1.05], [3.7, 0.036, 1.38], [1.85, 0.042, 0.84]]),
  ], []);

  useEffect(() => () => trails.forEach((trail) => trail.dispose()), [trails]);

  useFrame(({ clock }) => {
    const progress = experienceState.progress;
    const story = experienceState.narrative;
    pointerTarget.current.set(experienceState.pointerX, experienceState.pointerY);
    pointer.current.lerp(pointerTarget.current, 0.045);
    const rawReset = smoothstep(phaseProgress(progress, activationSequence.loopReset));
    const reset = rawReset > 0.98 ? 1 : rawReset;
    const trailAmount = smoothstep(phaseProgress(progress, activationSequence.lightTrails)) * (1 - reset);
    const storyOpacity = Math.max(
      story.living * sceneTokens.visualStory.trails.livingOpacity,
      story.peak * sceneTokens.visualStory.trails.peakOpacity,
    );
    trails.forEach((geometry, index) => {
      const line = trailObjects.current[index];
      const material = trailMaterials.current[index];
      const count = geometry.getAttribute("position").count;
      line?.geometry.setDrawRange(0, Math.max(0, Math.floor(count * Math.max(0, trailAmount - index * 0.045))));
      if (material) {
        material.opacity = Math.min(1, (0.22 + storyOpacity) * trailAmount);
      }
    });
    if (ambientLight.current) ambientLight.current.intensity = sceneTokens.environment.lights.ambient * (1 - story.living * 0.12 - story.peak * 0.24);
    if (hemisphereLight.current) hemisphereLight.current.intensity = sceneTokens.environment.lights.hemisphere * (1 - story.living * 0.08 - story.peak * 0.18);
    if (keyLight.current) keyLight.current.intensity = sceneTokens.environment.lights.key * (1 - story.living * 0.1 - story.peak * 0.18);
    if (fillLight.current) fillLight.current.intensity = sceneTokens.environment.lights.fill * (1 + story.living * 0.24 + story.peak * 0.22);
    if (revealLight.current) revealLight.current.intensity = (0.15 + story.energy * 6.4 + story.peak * 2.2) * experienceState.lightScale;
    if (magentaLight.current) magentaLight.current.intensity = (story.energy * 2.4 + story.peak * 2.1 + Math.sin(clock.elapsedTime * 0.72) * story.energy * 0.2) * experienceState.lightScale;
    if (amberLight.current) amberLight.current.intensity = (story.energy * 1.85 + story.peak * 2.35 + Math.cos(clock.elapsedTime * 0.58) * story.energy * 0.16) * experienceState.lightScale;
    if (interactionLight.current) {
      interactionLight.current.position.set(pointer.current.x * 7, 3.7 - pointer.current.y * 2.8, 4.5);
      interactionLight.current.intensity = (0.18 + story.energy * 0.72 + experienceState.pointerPulse * 1.4) * experienceState.lightScale;
    }
    background.copy(quietBackground)
      .lerp(activeBackground, story.living * 0.82)
      .lerp(peakBackground, story.peak * 0.78);
    scene.background = background;
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(background);
      scene.fog.near = sceneTokens.environment.fog.near + story.energy * 3.5;
      scene.fog.far = sceneTokens.environment.fog.far + story.energy * 12;
    }
  });

  return (
    <>
      <fog attach="fog" args={[sceneTokens.colors.fog, sceneTokens.environment.fog.near, sceneTokens.environment.fog.far]} />
      <ambientLight ref={ambientLight} intensity={sceneTokens.environment.lights.ambient} color="#fffdf8" />
      <hemisphereLight ref={hemisphereLight} args={["#f7f9fa", "#778592", sceneTokens.environment.lights.hemisphere]} />
      <directionalLight ref={keyLight} castShadow position={[4, 10, 7]} intensity={sceneTokens.environment.lights.key} color="#fff8ea" shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight ref={fillLight} position={[-7, 4, 4]} intensity={sceneTokens.environment.lights.fill} color="#b8dfff" />
      <pointLight ref={revealLight} position={[0, 4.2, 1]} intensity={0.15} distance={20} color={sceneTokens.colors.cyan} />
      <pointLight ref={magentaLight} position={[-5.5, 3.1, 1.8]} intensity={0} distance={16} color={sceneTokens.colors.magenta} />
      <pointLight ref={amberLight} position={[5.8, 2.4, 2.6]} intensity={0} distance={16} color={sceneTokens.colors.amber} />
      <pointLight ref={interactionLight} position={[0, 3.7, 4.5]} intensity={0.18} distance={8} color={sceneTokens.colors.cyan} />
      {trails.map((geometry, index) => (
        <lineSegments key={index} ref={(value) => { trailObjects.current[index] = value; }} geometry={geometry}>
          <lineBasicMaterial ref={(value) => { trailMaterials.current[index] = value; }} color={sceneTokens.visualStory.trails.colors[index]} transparent opacity={0} depthWrite={false} />
        </lineSegments>
      ))}
    </>
  );
}
