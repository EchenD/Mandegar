"use client";

/* eslint-disable react-hooks/immutability -- R3F frames update the reusable prop meshes and materials. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { bakedSceneContract } from "./baked-scene-contract";
import { createComposerRibbonGeometry, createComposerScreenFrame, createComposerTableFrame, getComposerObjectPosition, getComposerRestHeight, projectComposerDrag } from "./composer-object-geometry";
import { experienceState } from "./experience-state";
import {
  beginComposerObjectDrag,
  cancelComposerObjectDrag,
  composerObjectDefinitions,
  finishComposerObjectDrag,
  getComposerObjectState,
  subscribeComposerObjects,
  updateComposerObjectPose,
  type ComposerObjectPose,
} from "./interactions/composer-object-store";
import { interactionRuntime, requestInteraction } from "./interactions/interaction-runtime";
import { getVisitorCreation } from "./interactions/visitor-creation";
import { getVisitorPresentation } from "./interactions/visitor-presentation";

type CapturedProp = {
  pointerId: number;
  index: number;
  capture: { setPointerCapture: (pointerId: number) => void; releasePointerCapture: (pointerId: number) => void };
  plane: THREE.Plane;
  start: THREE.Vector3;
  pose: ComposerObjectPose;
};

function shadeGeometry(geometry: THREE.BufferGeometry, color: string) {
  const normals = geometry.getAttribute("normal");
  const colors = new Float32Array(normals.count * 3);
  const base = new THREE.Color(color);
  const light = new THREE.Vector3(-0.4, 0.8, 0.7).normalize();
  const normal = new THREE.Vector3();
  const shaded = new THREE.Color();
  for (let index = 0; index < normals.count; index += 1) {
    normal.fromBufferAttribute(normals, index);
    shaded.copy(base).multiplyScalar(0.56 + Math.max(0, normal.dot(light)) * 0.44);
    colors.set([shaded.r, shaded.g, shaded.b], index * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

export function ComposerObjects({ root }: { root: THREE.Object3D }) {
  const { camera, gl } = useThree();
  const capture = useRef<CapturedProp | null>(null);
  const hovered = useRef<number | null>(null);
  const semantic = useRef<HTMLElement | null>(null);
  const scratch = useMemo(() => ({ point: new THREE.Vector3(), movement: new THREE.Vector3(), target: new THREE.Vector3(), projected: new THREE.Vector3(), corner: new THREE.Vector3() }), []);
  const rig = useMemo(() => {
    const screen = root.getObjectByName(bakedSceneContract.exhibition.screens.interactive);
    const screenFrame = screen ? createComposerScreenFrame(screen) : null;
    const frame = screenFrame ? createComposerTableFrame(root, screenFrame) : null;
    const group = new THREE.Group();
    group.name = "fxInteraction_composer_objects";
    group.visible = false;
    const materials = composerObjectDefinitions.map(() => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide, toneMapped: false }));
    const geometries = [
      shadeGeometry(new THREE.BoxGeometry(0.18, 0.18, 0.18), "#3e77ff"),
      shadeGeometry(createComposerRibbonGeometry().scale(0.55, 0.55, 0.55), "#f7f7f4"),
      shadeGeometry(new THREE.IcosahedronGeometry(0.1, 2), "#75d8ff"),
    ];
    const targetGeometry = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    const targetMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
    const props = composerObjectDefinitions.map((definition, index) => {
      const prop = new THREE.Group();
      prop.name = `composer_prop_${definition.id}`;
      const mesh = new THREE.Mesh(geometries[index], materials[index]);
      mesh.name = `composer_mesh_${definition.id}`;
      mesh.rotation.set(index === 0 ? 0.15 : 0, index === 0 ? 0.35 : 0, index === 1 ? -0.08 : 0);
      const target = new THREE.Mesh(targetGeometry, targetMaterial);
      target.name = `composer_hit_${definition.id}`;
      mesh.userData.composerIndex = target.userData.composerIndex = index;
      prop.add(mesh, target);
      if (frame) {
        prop.quaternion.copy(frame.rotation);
        getComposerObjectPosition(frame, index, getComposerObjectState().poses[index], prop.position, getComposerRestHeight(mesh.geometry, mesh.quaternion, 1));
      }
      group.add(prop);
      return { prop, mesh };
    });
    return { frame, group, props, materials, geometries, targetGeometry, targetMaterial };
  }, [root]);

  const releaseCapture = () => {
    const current = capture.current;
    capture.current = null;
    if (current && gl.domElement.hasPointerCapture(current.pointerId)) current.capture.releasePointerCapture(current.pointerId);
    hovered.current = null;
    if (document.body.style.cursor === "grab" || document.body.style.cursor === "grabbing") document.body.style.cursor = "";
  };
  const cancelDrag = () => {
    cancelComposerObjectDrag();
    releaseCapture();
  };

  useEffect(() => {
    const cancel = () => {
      cancelComposerObjectDrag();
      const current = capture.current;
      capture.current = null;
      if (current && gl.domElement.hasPointerCapture(current.pointerId)) current.capture.releasePointerCapture(current.pointerId);
      hovered.current = null;
      if (document.body.style.cursor === "grab" || document.body.style.cursor === "grabbing") document.body.style.cursor = "";
    };
    const hidden = () => { if (document.hidden) cancel(); };
    const lost = (event: PointerEvent) => { if (capture.current?.pointerId === event.pointerId) cancel(); };
    const unsubscribe = subscribeComposerObjects(() => {
      if (capture.current && !getComposerObjectState().dragging) cancel();
    });
    const toggle = document.querySelector("header button[aria-controls='primary-navigation']");
    const menu = new MutationObserver(() => { if (toggle?.getAttribute("aria-expanded") === "true") cancel(); });
    if (toggle) menu.observe(toggle, { attributes: true, attributeFilter: ["aria-expanded"] });
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", hidden);
    gl.domElement.addEventListener("pointercancel", lost);
    gl.domElement.addEventListener("lostpointercapture", lost);
    return () => {
      unsubscribe();
      menu.disconnect();
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", hidden);
      gl.domElement.removeEventListener("pointercancel", lost);
      gl.domElement.removeEventListener("lostpointercapture", lost);
      cancel();
      rig.geometries.forEach((geometry) => geometry.dispose());
      rig.materials.forEach((material) => material.dispose());
      rig.targetGeometry.dispose();
      rig.targetMaterial.dispose();
    };
  }, [gl, rig]);

  useFrame((_, delta) => {
    if (!rig.frame) return;
    const state = getComposerObjectState();
    const inTouch = interactionRuntime.activeStation === "touch";
    const saved = getVisitorCreation().composer;
    const savedVisibility = experienceState.sequence === "loop" && saved.some(Boolean)
      ? getVisitorPresentation(experienceState.progress).composerVisibility : 0;
    const visibility = inTouch ? Math.max(interactionRuntime.touchVisibility, savedVisibility) : savedVisibility;
    rig.group.visible = visibility > 0.002;
    rig.props.forEach(({ prop, mesh }, index) => {
      const pose = state.poses[index];
      mesh.rotation.y = (index === 0 ? 0.35 : 0) + pose.x * 0.5;
      mesh.rotation.z = (index === 1 ? -0.08 : 0) + (index === 1 ? pose.y * 0.32 : 0);
      mesh.scale.setScalar(index === 2 ? 1 + pose.y * 0.12 : 1);
      getComposerObjectPosition(rig.frame!, index, pose, scratch.target, getComposerRestHeight(mesh.geometry, mesh.quaternion, mesh.scale.x));
      prop.position.lerp(scratch.target, state.dragging?.index === index ? 1 : 1 - Math.exp(-Math.min(delta, 0.1) * 14));
      rig.materials[index].opacity = visibility;
      rig.materials[index].color.setScalar(hovered.current === index || saved[index] ? 1.12 : 1);
    });
    if (process.env.NODE_ENV === "production") return;
    semantic.current ??= document.querySelector<HTMLElement>("[data-touch-spatial-controls]");
    if (!semantic.current?.isConnected) semantic.current = document.querySelector<HTMLElement>("[data-touch-spatial-controls]");
    const element = semantic.current;
    if (!element) return;
    camera.updateMatrixWorld(true);
    const bounds = gl.domElement.getBoundingClientRect();
    const centers = rig.props.map(({ prop }, index) => {
      scratch.projected.copy(prop.position).project(camera);
      let minX = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      const vertices = rig.targetGeometry.getAttribute("position");
      for (let vertex = 0; vertex < vertices.count; vertex += 1) {
        scratch.corner.fromBufferAttribute(vertices, vertex).applyQuaternion(prop.quaternion).add(prop.position).project(camera);
        minX = Math.min(minX, scratch.corner.x); maxX = Math.max(maxX, scratch.corner.x);
        minY = Math.min(minY, scratch.corner.y); maxY = Math.max(maxY, scratch.corner.y);
      }
      return { id: composerObjectDefinitions[index].id, x: Math.round(bounds.left + (scratch.projected.x * 0.5 + 0.5) * bounds.width), y: Math.round(bounds.top + (-scratch.projected.y * 0.5 + 0.5) * bounds.height), width: Math.round((maxX - minX) * 0.5 * bounds.width), height: Math.round((maxY - minY) * 0.5 * bounds.height), position: prop.position.toArray().map((value) => Number(value.toFixed(3))), pose: state.poses[index] };
    });
    const values = { composerObjectCenters: JSON.stringify(centers), composerObjectsVisible: String(rig.group.visible), composerObjectDragging: state.dragging ? composerObjectDefinitions[state.dragging.index].id : "none" };
    for (const [key, value] of Object.entries(values)) if (element.dataset[key] !== value) element.dataset[key] = value;
  });

  const down = (event: ThreeEvent<PointerEvent>) => {
    const index = event.object.userData.composerIndex as number | undefined;
    if (index === undefined || interactionRuntime.activeStation !== "touch") return;
    event.stopPropagation();
    if (!rig.frame || !beginComposerObjectDrag(index, event.pointerId)) return;
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(rig.frame.normal, rig.props[index].prop.position);
    const start = event.ray.intersectPlane(plane, new THREE.Vector3());
    if (!start) { cancelDrag(); return; }
    const target = event.target as unknown as CapturedProp["capture"];
    capture.current = { index, pointerId: event.pointerId, capture: target, plane, start, pose: { ...getComposerObjectState().poses[index] } };
    target.setPointerCapture(event.pointerId);
    document.body.style.cursor = "grabbing";
  };
  const move = (event: ThreeEvent<PointerEvent>) => {
    const current = capture.current;
    if (current && rig.frame) {
      event.stopPropagation();
      if (event.pointerId !== current.pointerId || !event.ray.intersectPlane(current.plane, scratch.point)) return;
      scratch.movement.copy(scratch.point).sub(current.start);
      updateComposerObjectPose(current.index, projectComposerDrag(rig.frame, scratch.movement, current.pose));
      return;
    }
    if (!getComposerObjectState().interactive) return;
    event.stopPropagation();
    hovered.current = event.object.userData.composerIndex as number;
    document.body.style.cursor = "grab";
  };
  const up = (event: ThreeEvent<PointerEvent>) => {
    const current = capture.current;
    if (!current || event.pointerId !== current.pointerId) return;
    event.stopPropagation();
    if (event.type === "pointercancel") cancelComposerObjectDrag();
    else {
      move(event);
      finishComposerObjectDrag(current.pointerId);
      if (window.matchMedia("(min-width: 761px)").matches) {
        semantic.current?.querySelector<HTMLButtonElement>(`[data-touch-element="${composerObjectDefinitions[current.index].id}"]`)?.focus({ preventScroll: true });
      }
    }
    releaseCapture();
  };
  const out = () => {
    if (capture.current) return;
    hovered.current = null;
    if (document.body.style.cursor === "grab") document.body.style.cursor = "";
  };

  const click = (event: ThreeEvent<MouseEvent>) => {
    if (interactionRuntime.activeStation === "touch") {
      event.stopPropagation();
    } else if (interactionRuntime.activeStation === null && interactionRuntime.availableStation === "touch") {
      event.stopPropagation();
      requestInteraction("touch", "pointer");
    }
  };

  return <primitive object={rig.group} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerOut={out} onClick={click} />;
}
