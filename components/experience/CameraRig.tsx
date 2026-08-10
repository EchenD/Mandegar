"use client";

/* eslint-disable react-hooks/immutability -- R3F render-loop callbacks intentionally mutate the active Three.js camera. */

import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { experienceState } from "./experience-state";
import { assetSlots, cameraKeyframes, sceneTokens } from "./scene-config";

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

export function CameraRig() {
  const gltf = useLoader(GLTFLoader, assetSlots.assembled);
  const { camera, size } = useThree();
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
  const cameraLifeTime = useRef(0);

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

  useFrame((_, delta) => {
    const progress = experienceState.progress;
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    let baseFov = perspectiveCamera.fov;
    const mobile = size.width <= 760 || size.height > size.width * 1.35;
    const pointerMotion = sceneTokens.cameraMotion.pointer;
    const pointerInputScale = mobile ? pointerMotion.mobileScale : 1;
    cameraPointerInput.current.set(
      experienceState.pointerX * pointerInputScale,
      experienceState.pointerY * pointerInputScale,
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
      authored.mixer.setTime(progress * authored.clip.duration);
      authored.root.updateMatrixWorld(true);
      authored.camera.getWorldPosition(authoredPosition.current);
      authored.camera.getWorldQuaternion(authoredQuaternion.current);
      camera.position.copy(authoredPosition.current);
      camera.quaternion.copy(authoredQuaternion.current);
      cameraTarget.current.fromArray(sceneTokens.authoredCamera.focusTarget);
      baseFov = authored.camera.fov;
    } else {
      const sample = sampleCamera(progress, mobile, sampledPosition.current, sampledTarget.current);
      camera.position.copy(sampledPosition.current);
      cameraTarget.current.copy(sampledTarget.current);
      camera.lookAt(cameraTarget.current);
      camera.rotateZ(sample.roll);
      baseFov = sample.fov;
    }

    if (experienceState.sequence === "intro") {
      introCameraOffset.current.fromArray(experienceState.intro.cameraLocalOffset).applyQuaternion(camera.quaternion);
      camera.position.add(introCameraOffset.current);
    }
    const introFovOffset = experienceState.sequence === "intro" ? experienceState.intro.cameraFovOffset : 0;
    const renderedFov = baseFov + introFovOffset;
    if (perspectiveCamera.isPerspectiveCamera && Math.abs(perspectiveCamera.fov - renderedFov) > 0.001) {
      perspectiveCamera.fov = renderedFov;
      perspectiveCamera.updateProjectionMatrix();
    }

    const breathing = sceneTokens.cameraMotion.breathing;
    const breathingScale = mobile ? breathing.mobileScale : 1;
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
    camera.position.addScaledVector(cameraRight.current, breathX + cameraPointer.current.x * pointerMotion.position[0]);
    camera.position.addScaledVector(cameraUp.current, breathY - cameraPointer.current.y * pointerMotion.position[1]);
    camera.position.addScaledVector(cameraForward.current, breathZ);
    const breathPitch = Math.sin(elapsed * breathing.frequency[1] * turn + 0.35) * breathing.rotation[0] * breathingScale;
    const breathYaw = (
      Math.sin(elapsed * breathing.frequency[0] * turn + 1.1)
      + Math.sin(elapsed * breathing.frequency[2] * turn + 2.4) * 0.28
    ) * breathing.rotation[1] * breathingScale;
    const breathRoll = Math.cos(elapsed * breathing.frequency[2] * turn + 0.6) * breathing.rotation[2] * breathingScale;
    cameraLifeEuler.current.set(
      breathPitch - cameraPointer.current.y * pointerMotion.rotation[0],
      breathYaw - cameraPointer.current.x * pointerMotion.rotation[1],
      breathRoll,
      "YXZ",
    );
    cameraLifeQuaternion.current.setFromEuler(cameraLifeEuler.current);
    camera.quaternion.multiply(cameraLifeQuaternion.current);
    experienceState.focusDistance = camera.position.distanceTo(cameraTarget.current);
  });

  return null;
}
