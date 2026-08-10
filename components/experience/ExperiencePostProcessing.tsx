"use client";

/* eslint-disable react-hooks/immutability -- R3F render-loop callbacks intentionally mutate Three.js scene objects. */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { experienceState } from "./experience-state";
import { sceneTokens, type SceneQuality } from "./scene-config";

export function ExperiencePostProcessing({ quality }: { quality: SceneQuality }) {
  const { gl, scene, camera, size } = useThree();
  const postprocessing = sceneTokens.environment.postprocessing[quality];
  const pipeline = useMemo(() => {
    const composer = new EffectComposer(gl);
    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      postprocessing.bloomStrength,
      postprocessing.bloomRadius,
      postprocessing.bloomThreshold,
    );
    const bokehPass = new BokehPass(scene, camera, {
      focus: experienceState.focusDistance,
      aperture: postprocessing.aperture,
      maxblur: postprocessing.maxBlur,
    });
    const outputPass = new OutputPass();
    bloomPass.enabled = postprocessing.bloom;
    bokehPass.enabled = postprocessing.depthOfField;
    composer.addPass(renderPass);
    composer.addPass(bokehPass);
    composer.addPass(bloomPass);
    composer.addPass(outputPass);
    return { composer, renderPass, bloomPass, bokehPass, outputPass };
  }, [camera, gl, postprocessing, scene, size.height, size.width]);

  useEffect(() => {
    pipeline.composer.setPixelRatio(gl.getPixelRatio());
    pipeline.composer.setSize(size.width, size.height);
  }, [gl, pipeline, size.height, size.width]);

  useEffect(() => () => {
    pipeline.renderPass.dispose();
    pipeline.bloomPass.dispose();
    pipeline.bokehPass.dispose();
    pipeline.outputPass.dispose();
    pipeline.composer.dispose();
  }, [pipeline]);

  useFrame((_, delta) => {
    const focusUniform = pipeline.bokehPass.materialBokeh.uniforms.focus;
    focusUniform.value = THREE.MathUtils.lerp(focusUniform.value as number, experienceState.focusDistance, 0.08);
    const story = experienceState.narrative;
    const assemblyEnergy = 1 - Math.abs(experienceState.assemblyProgress * 2 - 1);
    pipeline.bloomPass.strength = postprocessing.bloomStrength + Math.max(
      story.energy * postprocessing.bloomRevealBoost + story.peak * postprocessing.bloomPeakBoost,
      assemblyEnergy * postprocessing.bloomAssemblyBoost,
    ) + (experienceState.sequence === "intro" ? experienceState.intro.bloomBoost : 0);
    pipeline.composer.render(delta);
  }, 1);

  return null;
}
