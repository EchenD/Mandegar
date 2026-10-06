"use client";

/* eslint-disable react-hooks/immutability -- Three.js objects are updated in the render loop. */

import { useEffect, useMemo } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { bakedSceneContract } from "./baked-scene-contract";
import { createPuzzleScreenFrame, createPuzzleTableFrame, getPuzzleWorldPoint } from "./composer-puzzle-geometry";
import { experienceState } from "./experience-state";
import { getInstallationState, installationViews, selectInstallationView } from "./interactions/installation-demo";
import { interactionRuntime } from "./interactions/interaction-runtime";

export function ComposerObjects({ root }: { root: THREE.Object3D }) {
  const { camera, gl } = useThree();
  const rig = useMemo(() => {
    const screen = root.getObjectByName(bakedSceneContract.exhibition.screens.interactive);
    const screenFrame = screen ? createPuzzleScreenFrame(screen) : null;
    const frame = screenFrame ? createPuzzleTableFrame(root, screenFrame) : null;
    const group = new THREE.Group();
    group.name = "fxInteraction_installation_buttons";
    const geometry = new THREE.BoxGeometry((frame?.width ?? 1.2) * 0.215, (frame?.height ?? 0.8) * 0.55, 0.035);
    const buttons = installationViews.map((view, index) => {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#182332";
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = "#d4c4ad";
      ctx.lineWidth = 8;
      ctx.strokeRect(10, 10, 236, 236);
      ctx.fillStyle = "#faf5ec";
      ctx.font = "500 100px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(index + 1).padStart(2, "0"), 128, 130);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `installation_button_${view}`;
      mesh.userData.installationView = view;
      if (frame) {
        mesh.quaternion.copy(frame.rotation);
        getPuzzleWorldPoint(frame, 0.125 + index * 0.25, 0.5, mesh.position, 0.035);
      }
      group.add(mesh);
      return { view, mesh, texture, material };
    });
    return { group, buttons, geometry, frame, projected: new THREE.Vector3() };
  }, [root]);

  useEffect(() => () => {
    rig.geometry.dispose();
    rig.buttons.forEach(({ texture, material }) => { texture.dispose(); material.dispose(); });
    document.body.style.cursor = "";
  }, [rig]);

  useFrame(() => {
    const enabled = interactionRuntime.activeStation === "touch";
    const visible = experienceState.narrative.phase === "engagement" && interactionRuntime.touchVisibility > 0.01;
    rig.group.visible = Boolean(rig.frame) && visible;
    const view = getInstallationState().view;
    rig.buttons.forEach(({ mesh, material, view: buttonView }) => {
      material.color.set(buttonView === view ? "#75d8ff" : "#ffffff");
      if (!visible) return;
      rig.projected.copy(mesh.position).project(camera);
      const button = document.querySelector<HTMLElement>(`[data-installation-button="${buttonView}"]`);
      if (!button) return;
      const bounds = gl.domElement.getBoundingClientRect();
      button.dataset.projectedX = String(bounds.left + (rig.projected.x * 0.5 + 0.5) * bounds.width);
      button.dataset.projectedY = String(bounds.top + (-rig.projected.y * 0.5 + 0.5) * bounds.height);
      button.dataset.physicalEnabled = String(enabled);
    });
  });

  const press = (event: ThreeEvent<PointerEvent>) => {
    if (interactionRuntime.activeStation !== "touch") return;
    const view = event.object.userData.installationView;
    if (!installationViews.includes(view)) return;
    event.stopPropagation();
    selectInstallationView(view);
  };

  return <primitive object={rig.group} onPointerDown={press}
    onPointerOver={(event: ThreeEvent<PointerEvent>) => {
      if (interactionRuntime.activeStation === "touch") { event.stopPropagation(); document.body.style.cursor = "pointer"; }
    }} onPointerOut={() => { if (document.body.style.cursor === "pointer") document.body.style.cursor = ""; }} />;
}
