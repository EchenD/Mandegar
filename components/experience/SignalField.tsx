"use client";

/* eslint-disable react-hooks/immutability -- R3F render-loop callbacks intentionally mutate Three.js scene objects. */

import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { experienceState } from "./experience-state";
import {
  narrativeCueRanges as activationSequence,
  rangeProgress as phaseProgress,
} from "./narrative-score";
import { assetSlots, sceneTokens, type SceneQuality } from "./scene-config";
import { createSignalFieldData } from "./signal-field-data";
import { signalFieldFragmentShader, signalFieldVertexShader } from "./signal-field-shaders";

function smoothstep(value: number) {
  const safe = Math.min(1, Math.max(0, value));
  return safe * safe * (3 - 2 * safe);
}

export function SignalField({ quality }: { quality: SceneQuality }) {
  const gltf = useLoader(GLTFLoader, assetSlots.assembled);
  const { camera, gl, size } = useThree();
  const data = useMemo(() => createSignalFieldData(sceneTokens.particles.count[quality], gltf.scene), [gltf.scene, quality]);
  const pointerNdc = useRef(new THREE.Vector2());
  const pointerWorld = useRef(data.focus.clone());
  const focusWorld = useRef(data.focus.clone());
  const pointerPlane = useRef(new THREE.Plane());
  const pointerNormal = useRef(new THREE.Vector3());
  const raycaster = useRef(new THREE.Raycaster());
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uReset: { value: 0 },
      uSignalAmount: { value: 0 },
      uRingAmount: { value: 0 },
      uActivation: { value: 0 },
      uEnergyAmount: { value: 0 },
      uCelebration: { value: 0 },
      uPeak: { value: 0 },
      uResponse: { value: 0.26 },
      uPointer: { value: data.focus.clone() },
      uPointerNormal: { value: new THREE.Vector3(0, 0, 1) },
      uPointerPulse: { value: 0 },
      uModelScale: { value: 1 },
      uModelYOffset: { value: 0 },
      uPointSize: { value: sceneTokens.particles.size[quality].glow },
      uCoreRatio: { value: sceneTokens.particles.size[quality].core / sceneTokens.particles.size[quality].glow },
      uMaximumPointSize: { value: sceneTokens.particles.screenSize.maximum[quality] },
      uViewportHeight: { value: size.height },
      uPixelRatio: { value: gl.getPixelRatio() },
      uCoreOpacityIdle: { value: sceneTokens.particles.opacity.core.idle },
      uCoreOpacityActive: { value: sceneTokens.particles.opacity.core.active },
      uGlowOpacityIdle: { value: sceneTokens.particles.opacity.glow.idle },
      uGlowOpacityActive: { value: sceneTokens.particles.opacity.glow.active },
    },
    vertexShader: signalFieldVertexShader,
    fragmentShader: signalFieldFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }), [data.focus, gl, quality, size.height]);

  useEffect(() => () => {
    data.geometry.dispose();
    material.dispose();
  }, [data, material]);

  useFrame(({ clock }, delta) => {
    const progress = experienceState.progress;
    const story = experienceState.narrative;
    const reset = smoothstep(phaseProgress(progress, activationSequence.loopReset));
    const signalAmount = smoothstep(phaseProgress(progress, activationSequence.intelligence)) * (1 - reset);
    const ringAmount = smoothstep(phaseProgress(progress, activationSequence.haloCondense)) * (1 - reset);
    const activation = smoothstep(phaseProgress(progress, activationSequence.lightTrails)) * (1 - reset);
    const pulse = experienceState.pointerPulse;
    const response = 0.26 + activation * 0.74;
    const modelScale = 0.965 + experienceState.assemblyProgress * 0.035;
    const modelYOffset = -0.16 * (1 - experienceState.assemblyProgress);
    pointerNdc.current.set(experienceState.pointerX, -experienceState.pointerY);
    camera.getWorldDirection(pointerNormal.current);
    focusWorld.current.copy(data.focus).multiplyScalar(modelScale);
    focusWorld.current.y += modelYOffset;
    pointerPlane.current.setFromNormalAndCoplanarPoint(pointerNormal.current, focusWorld.current);
    raycaster.current.setFromCamera(pointerNdc.current, camera);
    raycaster.current.ray.intersectPlane(pointerPlane.current, pointerWorld.current);
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uProgress.value = progress;
    material.uniforms.uReset.value = reset;
    material.uniforms.uSignalAmount.value = signalAmount;
    material.uniforms.uRingAmount.value = ringAmount;
    material.uniforms.uActivation.value = activation;
    material.uniforms.uEnergyAmount.value = story.energy;
    material.uniforms.uCelebration.value = story.energy;
    material.uniforms.uPeak.value = story.peak;
    material.uniforms.uResponse.value = response;
    material.uniforms.uPointer.value.copy(pointerWorld.current);
    material.uniforms.uPointerNormal.value.copy(pointerNormal.current);
    material.uniforms.uPointerPulse.value = pulse;
    material.uniforms.uModelScale.value = modelScale;
    material.uniforms.uModelYOffset.value = modelYOffset;
    material.uniforms.uViewportHeight.value = size.height;
    material.uniforms.uPixelRatio.value = gl.getPixelRatio();
    experienceState.pointerPulse = Math.max(0, pulse - delta * 0.52);
  });

  return <points geometry={data.geometry} material={material} frustumCulled={false} />;
}
