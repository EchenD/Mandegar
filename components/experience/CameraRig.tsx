"use client";

import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { heroModelLoader } from "./hero-loading";
import { experienceState } from "./experience-state";
import { interactionRuntime } from "./interactions/interaction-runtime";
import { cameraKeyframes, getHeroHandoffProgress, sceneTokens } from "./scene-config";
import { getCameraLoopSampleProgress } from "./stage-presets";

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
  const cameraPointer = useRef(new THREE.Vector2());
  const cameraPointerInput = useRef(new THREE.Vector2());
  const cameraPointerVelocity = useRef(new THREE.Vector2());
  const cameraTarget = useRef(new THREE.Vector3());
  const sampledPosition = useRef(new THREE.Vector3());
  const sampledTarget = useRef(new THREE.Vector3());
  const authoredPosition = useRef(new THREE.Vector3());
  const authoredQuaternion = useRef(new THREE.Quaternion());
  const introCameraOffset = useRef(new THREE.Vector3());
  const cameraRight = useRef(new THREE.Vector3());
  const cameraUp = useRef(new THREE.Vector3());
  const cameraForward = useRef(new THREE.Vector3());
  const cameraLifeEuler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const cameraLifeQuaternion = useRef(new THREE.Quaternion());
  const handoffBaseQuaternion = useRef(new THREE.Quaternion());
  const handoffLookQuaternion = useRef(new THREE.Quaternion());
  const cameraLifeTime = useRef(0);
  const cameraLifeBlend = useRef(0);
  const touchFraming = useRef({ amount: 0, from: 0, target: 0, elapsed: 0 });
  const reducedMotion = useMemo(() => typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)") : null, []);

  const authored = useMemo(() => {
    const source = gltf.scene.getObjectByName(sceneTokens.authoredCamera.node);
    const authoredCamera = source?.type === "PerspectiveCamera"
      ? source.clone() as THREE.PerspectiveCamera
      : null;
    const root = new THREE.Group();
    if (authoredCamera) root.add(authoredCamera);
    const clip = THREE.AnimationClip.findByName(gltf.animations, sceneTokens.authoredCamera.clip) ?? null;
    const mixer = authoredCamera && clip ? new THREE.AnimationMixer(root) : null;
    return { root, camera: authoredCamera, clip, mixer };
  }, [gltf.animations, gltf.scene]);

  useEffect(() => {
    if (!authored.clip || !authored.mixer) return;
    const action = authored.mixer.clipAction(authored.clip);
    action.reset();
    action.setLoop(THREE.LoopRepeat, Infinity);
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
  useFrame((_, delta) => {
    const progress = experienceState.progress;
    const cameraProgress = getCameraLoopSampleProgress(progress);
    const introActive = experienceState.sequence === "intro";
    const interactionActive = interactionRuntime.activeStation !== null;
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    let baseFov = perspectiveCamera.fov;
    let baseNear = fallbackProjection.current.near;
    let baseFar = fallbackProjection.current.far;
    const mobile = size.width <= 760 || size.height > size.width * 1.35;
    const pointerMotion = sceneTokens.cameraMotion.pointer;
    const pointerInputScale = mobile ? pointerMotion.mobileScale : 1;
    cameraPointerInput.current.set(
      introActive || interactionActive ? 0 : experienceState.pointerX * pointerInputScale,
      introActive || interactionActive ? 0 : experienceState.pointerY * pointerInputScale,
    );
    const springDelta = Math.min(delta, pointerMotion.maximumDelta);
    const springDamping = Math.exp(-pointerMotion.damping * springDelta);
    cameraPointerVelocity.current.x += (cameraPointerInput.current.x - cameraPointer.current.x) * pointerMotion.stiffness * springDelta;
    cameraPointerVelocity.current.y += (cameraPointerInput.current.y - cameraPointer.current.y) * pointerMotion.stiffness * springDelta;
    cameraPointerVelocity.current.multiplyScalar(springDamping);
    cameraPointer.current.addScaledVector(cameraPointerVelocity.current, springDelta);
    cameraPointer.current.x = THREE.MathUtils.clamp(cameraPointer.current.x, -1.05, 1.05);
    cameraPointer.current.y = THREE.MathUtils.clamp(cameraPointer.current.y, -1.05, 1.05);

    if (
      sceneTokens.authoredCamera.enabled
      && (!mobile || sceneTokens.authoredCamera.enabledOnMobile)
      && authored.camera
      && authored.clip
      && authored.mixer
    ) {
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

    const handoffProgress = introActive ? 0 : getHeroHandoffProgress(progress);
    // Descend while progressively locking the view onto the center monitor.
    camera.position.y -= handoffProgress * 4;
    if (handoffProgress > 0) {
      handoffBaseQuaternion.current.copy(camera.quaternion);
      cameraTarget.current.fromArray(sceneTokens.authoredCamera.focusTarget);
      camera.lookAt(cameraTarget.current);
      handoffLookQuaternion.current.copy(camera.quaternion);
      camera.quaternion.copy(handoffBaseQuaternion.current).slerp(
        handoffLookQuaternion.current,
        handoffProgress,
      );
    }
    // Keep the tabletop above the shared controls while retaining the authored
    // shot. Mobile uses its accessible puzzle grid and keeps the original view.
    const framing = touchFraming.current;
    const framingTarget = !mobile && !introActive && interactionRuntime.activeStation === "touch" ? 1 : 0;
    if (framing.target !== framingTarget) {
      framing.from = framing.amount;
      framing.target = framingTarget;
      framing.elapsed = 0;
    }
    framing.elapsed += Math.min(delta, 0.1);
    const framingDuration = framingTarget === 1 ? 0.55 : 0.4;
    const framingProgress = reducedMotion?.matches ? 1 : smoothstep(framing.elapsed / framingDuration);
    framing.amount = THREE.MathUtils.lerp(framing.from, framing.target, framingProgress);
    if (!mobile && framing.amount > 0) camera.rotateX(-0.05 * framing.amount);
    if (perspectiveCamera.isPerspectiveCamera) {
      syncPerspectiveCameraProjection(perspectiveCamera, {
        fov: getResponsiveCameraFov(baseFov, size.width, size.height),
        near: baseNear,
        far: baseFar,
      });
    }

    const breathing = sceneTokens.cameraMotion.breathing;
    const stage = experienceState.stage;
    // Let controls settle while preserving the authored shot and easing motion back after exit.
    cameraLifeBlend.current = introActive
      ? 0
      : THREE.MathUtils.damp(cameraLifeBlend.current, interactionActive ? 0 : 1, interactionActive ? 8 : 1, springDelta);
    const lifeBlend = cameraLifeBlend.current;
    const heroPresence = 1 - handoffProgress;
    const breathingScale = (mobile ? breathing.mobileScale : 1) * lifeBlend * stage.cameraLife * heroPresence;
    const pointerScale = lifeBlend * stage.cameraPointer * heroPresence;
    cameraLifeTime.current += springDelta;
    const elapsed = cameraLifeTime.current;
    const turn = Math.PI * 2;
    const breathX = (
      Math.sin(elapsed * breathing.frequency[0] * turn)
      + Math.sin(elapsed * breathing.frequency[2] * turn + 1.7) * 0.35
    ) * breathing.position[0] * breathingScale;
    const breathY = (
      Math.cos(elapsed * breathing.frequency[1] * turn + 0.8)
      + Math.sin(elapsed * breathing.frequency[0] * turn * 0.47 + 2.1) * 0.25
    ) * breathing.position[1] * breathingScale;
    const breathZ = Math.sin(elapsed * breathing.frequency[2] * turn + 1.4) * breathing.position[2] * breathingScale;
    cameraRight.current.set(1, 0, 0).applyQuaternion(camera.quaternion);
    cameraUp.current.set(0, 1, 0).applyQuaternion(camera.quaternion);
    cameraForward.current.set(0, 0, -1).applyQuaternion(camera.quaternion);
    camera.position.addScaledVector(cameraRight.current, breathX + cameraPointer.current.x * pointerMotion.position[0] * pointerScale);
    camera.position.addScaledVector(cameraUp.current, breathY + cameraPointer.current.y * pointerMotion.position[1] * pointerScale);
    camera.position.addScaledVector(cameraForward.current, breathZ);
    const breathPitch = Math.sin(elapsed * breathing.frequency[1] * turn + 0.35) * breathing.rotation[0] * breathingScale;
    const breathYaw = (
      Math.sin(elapsed * breathing.frequency[0] * turn + 1.1)
      + Math.sin(elapsed * breathing.frequency[2] * turn + 2.4) * 0.28
    ) * breathing.rotation[1] * breathingScale;
    const breathRoll = Math.cos(elapsed * breathing.frequency[2] * turn + 0.6) * breathing.rotation[2] * breathingScale;
    cameraLifeEuler.current.set(
      breathPitch + cameraPointer.current.y * pointerMotion.rotation[0] * pointerScale,
      breathYaw - cameraPointer.current.x * pointerMotion.rotation[1] * pointerScale,
      breathRoll,
      "YXZ",
    );
    cameraLifeQuaternion.current.setFromEuler(cameraLifeEuler.current);
    camera.quaternion.multiply(cameraLifeQuaternion.current);
    experienceState.focusDistance = camera.position.distanceTo(cameraTarget.current);
  });
  /* eslint-enable react-hooks/immutability */

  return null;
}
