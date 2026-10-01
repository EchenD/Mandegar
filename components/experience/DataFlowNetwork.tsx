"use client";

/* eslint-disable react-hooks/immutability -- R3F frame callbacks update GPU uniforms directly. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { bakedSceneContract } from "./baked-scene-contract";
import { experienceState } from "./experience-state";
import { phaseProgress, sceneTokens } from "./scene-config";
import { interactionRuntime } from "./interactions/interaction-runtime";
import { getVisitorCreation } from "./interactions/visitor-creation";
import { getVisitorPresentation } from "./interactions/visitor-presentation";

const vertexShader = /* glsl */ `
  attribute float aRoute;
  attribute float aProgress;
  uniform float uTime;
  uniform float uStrength;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying float vRoute;

  void main() {
    float travel = fract(aProgress - uTime * 0.13 - aRoute * 0.29);
    float pulse = 1.0 - smoothstep(0.0, 0.16, abs(travel - 0.5));
    float secondary = 1.0 - smoothstep(0.0, 0.08, abs(fract(travel + 0.38) - 0.5));
    vAlpha = (0.1 + pulse + secondary * 0.42) * uStrength;
    vRoute = aRoute;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = (0.58 + pulse * 1.08) * uPixelRatio;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vAlpha;
  varying float vRoute;
  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float radius = length(point);
    if (radius > 0.5) discard;
    float alpha = (1.0 - smoothstep(0.08, 0.5, radius)) * vAlpha;
    vec3 cool = vec3(0.23, 0.68, 1.0);
    vec3 warm = vec3(1.0, 0.49, 0.18);
    gl_FragColor = vec4(mix(cool, warm, vRoute * 0.42), alpha);
    #include <colorspace_fragment>
  }
`;

function getAnchorPosition(root: THREE.Object3D, name: string) {
  const result = new THREE.Vector3();
  root.getObjectByName(name)?.getWorldPosition(result);
  return result;
}

function buildDataGeometry(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const center = getAnchorPosition(
    root,
    bakedSceneContract.exhibition.sections.central.signalAnchor,
  );
  const leftSignal = getAnchorPosition(
    root,
    bakedSceneContract.exhibition.sections.left.signalAnchor,
  );
  const rightSignal = getAnchorPosition(
    root,
    bakedSceneContract.exhibition.sections.right.signalAnchor,
  );
  const interactive = getAnchorPosition(
    root,
    bakedSceneContract.exhibition.screens.interactive,
  );
  const game = getAnchorPosition(root, bakedSceneContract.exhibition.screens.game);
  const main = getAnchorPosition(root, bakedSceneContract.exhibition.screens.main);
  const videoWall = getAnchorPosition(
    root,
    bakedSceneContract.exhibition.screens.videoWall,
  );
  const paths = [
    [leftSignal, interactive],
    [interactive, center],
    [rightSignal, game],
    [game, main],
    [main, center],
    [center, videoWall],
  ];
  const positions: number[] = [];
  const routes: number[] = [];
  const progressValues: number[] = [];
  const point = new THREE.Vector3();
  paths.forEach(([start, end], route) => {
    const count = 96;
    for (let index = 0; index < count; index += 1) {
      const progress = index / (count - 1);
      point.lerpVectors(start, end, progress);
      point.y += Math.sin(progress * Math.PI)
        * (0.2 + start.distanceTo(end) * 0.035);
      positions.push(point.x, point.y, point.z);
      routes.push(route / Math.max(1, paths.length - 1));
      progressValues.push(progress);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aRoute", new THREE.Float32BufferAttribute(routes, 1));
  geometry.setAttribute("aProgress", new THREE.Float32BufferAttribute(progressValues, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

export function DataFlowNetwork({ exhibition }: { exhibition: THREE.Object3D }) {
  const points = useRef<THREE.Points>(null);
  const { gl } = useThree();
  const geometry = useMemo(() => buildDataGeometry(exhibition), [exhibition]);
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
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  }), [gl]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame(({ clock }) => {
    const timing = phaseProgress(experienceState.progress, sceneTokens.bakedScene.dataFlowRange);
    const easedTiming = timing * timing * (3 - 2 * timing);
    const inComposer = interactionRuntime.activeStation === "touch";
    const spaceSelected = (inComposer ? interactionRuntime.touchElements : getVisitorCreation().composer)[0];
    const composerStrength = spaceSelected ? (inComposer ? interactionRuntime.touchVisibility * 0.8 : 0.3 * getVisitorPresentation(experienceState.progress).composerVisibility) : 0;
    const strength = Math.max(experienceState.stage.production.dataFlow * easedTiming, composerStrength);
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uStrength.value = strength;
    if (points.current) points.current.visible = strength > 0.002;
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />;
}
