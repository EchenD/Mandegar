"use client";

import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { heroModelLoader } from "./hero-loading";
import { experienceState } from "./experience-state";
import { cameraKeyframes, sceneTokens } from "./scene-config";
import { getCameraLoopSampleProgress } from "./camera-timeline";
import { heroTimeline } from "./hero-timeline-config";
import { compileHeroTimeline } from "./hero-timeline";
import handoff from "../../Docs/CreativeProduction/camera-timing-handoff.template.json";

function smoothstep(value: number) {
  const safe = Math.min(1, Math.max(0, value));
  return safe * safe * (3 - 2 * safe);
}

function sampleCamera(
  progress: number,
  mobile: boolean,
  position: THREE.Vector3,
  target: THREE.Vector3,
) {
  let left = cameraKeyframes[0];
  let right = cameraKeyframes[cameraKeyframes.length - 1];
  for (let index = 1; index < cameraKeyframes.length; index += 1) {
    if (progress <= cameraKeyframes[index].progress) {
      left = cameraKeyframes[index - 1];
      right = cameraKeyframes[index];
      break;
    }
  }
  const span = Math.max(0.0001, right.progress - left.progress);
  let mix = Math.min(1, Math.max(0, (progress - left.progress) / span));
  mix = right.ease === "reveal" ? 1 - Math.pow(1 - mix, 3) : right.ease === "loop" ? mix : smoothstep(mix);
  const from = mobile ? left.mobilePosition : left.position;
  const to = mobile ? right.mobilePosition : right.position;
  position.set(
    THREE.MathUtils.lerp(from[0], to[0], mix),
    THREE.MathUtils.lerp(from[1], to[1], mix),
    THREE.MathUtils.lerp(from[2], to[2], mix),
  );
  target.set(
    THREE.MathUtils.lerp(left.target[0], right.target[0], mix),
    THREE.MathUtils.lerp(left.target[1], right.target[1], mix),
    THREE.MathUtils.lerp(left.target[2], right.target[2], mix),
  );
  return {
    roll: THREE.MathUtils.lerp(mobile ? left.mobileRoll : left.roll, mobile ? right.mobileRoll : right.roll, mix),
    fov: THREE.MathUtils.lerp(left.fov, right.fov, mix),
  };
}

export function syncPerspectiveCameraProjection(
  camera: THREE.PerspectiveCamera,
  projection: { fov: number; near: number; far: number },
) {
  const nextFov = Number.isFinite(projection.fov) && projection.fov > 0 && projection.fov < 180
    ? projection.fov
    : camera.fov;
  const nextNear = Number.isFinite(projection.near) && projection.near > 0
    ? projection.near
    : camera.near;
  const nextFar = Number.isFinite(projection.far) && projection.far > nextNear
    ? projection.far
    : camera.far;
  const changed = Math.abs(camera.fov - nextFov) > 0.001
    || Math.abs(camera.near - nextNear) > 0.00001
    || Math.abs(camera.far - nextFar) > 0.001;
  if (!changed) return false;
  camera.fov = nextFov;
  camera.near = nextNear;
  camera.far = nextFar;
  camera.updateProjectionMatrix();
  return true;
}

export function getResponsiveCameraFov(fov: number, width: number, height: number) {
  if (width <= 0 || height <= 0 || !Number.isFinite(fov)) return fov;
  const aspect = width / height;
  if (width > 760 && aspect >= 1) return fov;
  // Preserve the authored landscape shot's horizontal view on portrait screens.
  // Only the lens changes; camera transforms and animation remain untouched.
  const framingAspect = Math.max(aspect, 16 / 9);
  return THREE.MathUtils.radToDeg(2 * Math.atan(
    Math.tan(THREE.MathUtils.degToRad(fov) / 2) * framingAspect / aspect,
  ));
}

export function CameraRig({ source }: { source: string }) {
  const gltf = useLoader(heroModelLoader, source);
  const { camera, size } = useThree();
  const fallbackProjection = useRef({
    near: camera instanceof THREE.PerspectiveCamera ? camera.near : 0.1,
    far: camera instanceof THREE.PerspectiveCamera ? camera.far : 60,
  });
  const cameraTarget = useRef(new THREE.Vector3());
  const sampledPosition = useRef(new THREE.Vector3());
  const sampledTarget = useRef(new THREE.Vector3());
  const authoredPosition = useRef(new THREE.Vector3());
  const authoredQuaternion = useRef(new THREE.Quaternion());
  const introCameraOffset = useRef(new THREE.Vector3());
  const debugRoot = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") debugRoot.current = document.querySelector("[data-experience-root]");
  }, []);

  const authored = useMemo(() => {
    const root = gltf.scene.clone(true);
    const source = root.getObjectByName(sceneTokens.authoredCamera.node);
    const authoredCamera = source?.type === "PerspectiveCamera" ? source as THREE.PerspectiveCamera : null;
    const clip = THREE.AnimationClip.findByName(gltf.animations, sceneTokens.authoredCamera.clip) ?? null;
    const mixer = authoredCamera && clip ? new THREE.AnimationMixer(root) : null;
    const action = mixer && clip ? mixer.clipAction(clip) : null;
    if (clip) compileHeroTimeline(handoff, { cameraNode: sceneTokens.authoredCamera.node, clipName: clip.name, durationSeconds: clip.duration });
    return { root, camera: authoredCamera, clip, mixer, action };
  }, [gltf.animations, gltf.scene]);

  useEffect(() => {
    if (!authored.clip || !authored.mixer) return;
    const action = authored.mixer.clipAction(authored.clip);
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    authored.mixer.setTime(0);
    authored.root.updateMatrixWorld(true);
    return () => {
      action.stop();
      authored.mixer?.stopAllAction();
    };
  }, [authored]);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production"
      && sceneTokens.authoredCamera.enabled
      && (!authored.camera || !authored.clip || !authored.mixer)
    ) {
      console.warn("Mandegar authored camera unavailable; using procedural fallback", {
        cameraFound: Boolean(authored.camera),
        clipFound: Boolean(authored.clip),
        clipNames: gltf.animations.map((clip) => clip.name),
      });
    }
  }, [authored, gltf.animations]);

  /* eslint-disable react-hooks/immutability -- Three.js camera transforms are intentionally updated inside the render loop. */
  useFrame(() => {
    const progress = experienceState.progress;
    const cameraProgress = getCameraLoopSampleProgress(progress);
    const introActive = experienceState.sequence === "intro";
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    let baseFov = perspectiveCamera.fov;
    let baseNear = fallbackProjection.current.near;
    let baseFar = fallbackProjection.current.far;
    const mobile = size.width <= 760 || size.height > size.width * 1.35;

    if (
      sceneTokens.authoredCamera.enabled
      && (!mobile || sceneTokens.authoredCamera.enabledOnMobile)
      && authored.camera
      && authored.clip
      && authored.mixer
    ) {
      if (authored.action) authored.action.paused = false;
      authored.mixer.setTime(cameraProgress * authored.clip.duration);
      authored.root.updateMatrixWorld(true);
      authored.camera.getWorldPosition(authoredPosition.current);
      authored.camera.getWorldQuaternion(authoredQuaternion.current);
      camera.position.copy(authoredPosition.current);
      camera.quaternion.copy(authoredQuaternion.current);
      cameraTarget.current.fromArray(sceneTokens.authoredCamera.focusTarget);
      baseFov = authored.camera.fov;
      baseNear = authored.camera.near;
      baseFar = authored.camera.far;
    } else {
      const sample = sampleCamera(cameraProgress, mobile, sampledPosition.current, sampledTarget.current);
      camera.position.copy(sampledPosition.current);
      cameraTarget.current.copy(sampledTarget.current);
      camera.lookAt(cameraTarget.current);
      camera.rotateZ(sample.roll);
      baseFov = sample.fov;
    }

    if (introActive) {
      introCameraOffset.current.fromArray(experienceState.intro.cameraLocalOffset).applyQuaternion(camera.quaternion);
      camera.position.add(introCameraOffset.current);
    }

    if (perspectiveCamera.isPerspectiveCamera) {
      syncPerspectiveCameraProjection(perspectiveCamera, {
        fov: getResponsiveCameraFov(baseFov, size.width, size.height),
        near: baseNear,
        far: baseFar,
      });
    }

    experienceState.focusDistance = camera.position.distanceTo(cameraTarget.current);
    if (process.env.NODE_ENV !== "production") {
      const root = debugRoot.current;
      if (root) {
        root.dataset.cameraFrame = String(heroTimeline.firstFrame + (heroTimeline.lastFrame - heroTimeline.firstFrame) * cameraProgress);
        root.dataset.cameraPose = JSON.stringify([...camera.position.toArray(), ...camera.quaternion.toArray()]);
      }
    }
  });
  /* eslint-enable react-hooks/immutability */

  return null;
}
