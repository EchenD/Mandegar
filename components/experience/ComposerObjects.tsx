"use client";

/* eslint-disable react-hooks/immutability -- Three.js objects are updated in the render loop. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { publicAssetPath } from "@/lib/public-asset-path";
import { bakedSceneContract } from "./baked-scene-contract";
import { createPuzzleScreenFrame, createPuzzleTableFrame, getPuzzleWorldPoint } from "./composer-puzzle-geometry";
import { experienceState } from "./experience-state";
import { heroModelLoader } from "./hero-loading";
import { getNarrativeCopyTiming } from "./narrative-copy-timing";
import { getInstallationState, installationViews, selectInstallationView } from "./interactions/installation-demo";
import { interactionRuntime } from "./interactions/interaction-runtime";

function iconTexture(index: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#efe4d1";
  ctx.font = "700 104px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(index + 1).padStart(2, "0"), 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function ComposerObjects({ root }: { root: THREE.Object3D }) {
  const { camera, gl } = useThree();
  const [model, setModel] = useState<THREE.Group | null>(null);
  const revealedVisibility = useRef(0);
  const revealAge = useRef<number | null>(null);
  const reversing = useRef(false);
  const previousProgress = useRef(experienceState.progress);
  useEffect(() => {
    let mounted = true;
    let owned: THREE.Group | null = null;
    const dispose = (group: THREE.Group) => {
      group.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => material.dispose());
      });
    };
    heroModelLoader.load(publicAssetPath("/models/mandegar/mandegar_touch_button.glb"), (asset) => {
      if (!mounted) { dispose(asset.scene); return; }
      owned = asset.scene;
      setModel(asset.scene);
    }, undefined, () => {
      if (mounted) console.warn("[Mandegar] Touch button model could not be loaded.");
    });
    return () => { mounted = false; if (owned) dispose(owned); };
  }, []);
  const rig = useMemo(() => {
    const screen = root.getObjectByName(bakedSceneContract.exhibition.screens.interactive);
    const screenFrame = screen ? createPuzzleScreenFrame(screen) : null;
    const frame = screenFrame ? createPuzzleTableFrame(root, screenFrame) : null;
    const group = new THREE.Group();
    group.name = "fxInteraction_installation_buttons";
    const buttons = installationViews.map((view, index) => {
      const assembly = new THREE.Group();
      assembly.name = `installation_button_${view}`;
      assembly.userData.installationView = view;
      // Widen the 160 mm master to 220 mm for this table; keep its height and
      // five millimetre cap travel unchanged along the actual surface normal.
      assembly.scale.set(1.375, 1.375, 1);
      const body = model?.clone(true) ?? new THREE.Group();
      body.rotation.x = Math.PI / 2;
      assembly.add(body);
      const materials: THREE.MeshBasicMaterial[] = [];
      body.traverse((object) => {
        object.userData.installationView = view;
        if (!(object instanceof THREE.Mesh)) return;
        const material = new THREE.MeshBasicMaterial({
          vertexColors: object.name !== "touch_button_ring",
          color: object.name === "touch_button_ring" ? "#143d48" : "#ffffff",
          transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
        });
        object.material = material;
        materials.push(material);
      });
      const cap = body.getObjectByName("touch_button_cap");
      const ring = body.getObjectByName("touch_button_ring") as THREE.Mesh | undefined;
      const texture = iconTexture(index);
      const iconMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
      materials.push(iconMaterial);
      const icon = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.085), iconMaterial);
      icon.rotation.x = -Math.PI / 2;
      icon.position.y = 0.0232;
      icon.userData.installationView = view;
      cap?.add(icon);
      if (frame) assembly.quaternion.copy(frame.rotation);
      group.add(assembly);
      return { view, assembly, cap, ring, icon, texture, materials, pressElapsed: 0.55, hovered: false };
    });
    return { group, buttons, frame, projected: new THREE.Vector3(), edge: new THREE.Vector3(), lastRevision: getInstallationState().revision };
  }, [model, root]);

  useEffect(() => () => {
    rig.buttons.forEach(({ texture, materials, icon }) => {
      texture.dispose(); icon.geometry.dispose(); materials.forEach((material) => material.dispose());
    });
    document.body.style.cursor = "";
  }, [rig]);

  useFrame((_state, delta) => {
    const visibility = interactionRuntime.touchVisibility;
    const timing = getNarrativeCopyTiming("engagement");
    const progress = experienceState.progress;
    const direction = document.querySelector<HTMLElement>("[data-experience-root]")?.dataset.scrollDirection;
    const backward = direction === "backward" && progress < previousProgress.current;
    const forward = direction === "forward" && progress > previousProgress.current;
    previousProgress.current = progress;
    const revealDelta = Math.min(delta, 0.16);
    const phaseEntrance = THREE.MathUtils.clamp(
      (progress - timing.enterStart) / Math.max(0.0001, timing.enterEnd - timing.enterStart),
      0,
      1,
    );
    if (revealAge.current !== null
      && (progress < timing.enterStart || backward && progress < timing.enterEnd)) reversing.current = true;
    if (forward && progress >= timing.enterStart && reversing.current) {
      reversing.current = false;
      revealAge.current = revealedVisibility.current * 0.8;
    }
    // Reverse fades remain visible while catching up with a rapid wheel jump.
    // Frame deltas also preserve the reveal when tab suspension resets the clock.
    if (reversing.current) {
      revealedVisibility.current = Math.min(revealedVisibility.current, Math.max(
        phaseEntrance,
        revealedVisibility.current - revealDelta / 0.8,
      ));
      if (revealedVisibility.current <= 0.001 && progress <= timing.enterStart) {
        revealedVisibility.current = 0;
        revealAge.current = null;
      }
    } else if (progress >= timing.enterStart) {
      revealAge.current = revealAge.current === null ? 0 : revealAge.current + revealDelta;
      const timedEntrance = THREE.MathUtils.clamp(revealAge.current / 0.8, 0, 1);
      revealedVisibility.current = Math.max(revealedVisibility.current, phaseEntrance, timedEntrance);
    }
    const departing = document.querySelector("[data-experience-root]")?.hasAttribute("data-interaction-departing");
    const enabled = interactionRuntime.activeStation === "touch" && visibility > 0.85 && !departing;
    const visible = Boolean(model && rig.frame) && revealedVisibility.current > 0.001;
    rig.group.visible = visible;
    const state = getInstallationState();
    if (state.revision !== rig.lastRevision) {
      rig.lastRevision = state.revision;
      const button = rig.buttons.find((item) => item.view === state.view);
      if (button) button.pressElapsed = 0;
    }
    const canvasBounds = gl.domElement.getBoundingClientRect();
    const controls = document.querySelector<HTMLElement>("[data-installation-controls]");
    const controlBounds = controls?.getBoundingClientRect();
    rig.buttons.forEach((button, index) => {
      const { assembly, cap, ring, materials, view } = button;
      const control = document.querySelector<HTMLButtonElement>(`[data-installation-button="${view}"]`);
      const amount = Math.max(0, Math.min(1, (revealedVisibility.current - index * 0.07) / 0.79));
      const eased = amount * amount * (3 - 2 * amount);
      materials.forEach((material) => { material.opacity = eased; });
      if (rig.frame) getPuzzleWorldPoint(rig.frame, 0.125 + index * 0.25, 0.5, assembly.position, 0.0015 + (1 - eased) * 0.018);
      // A slow render frame must still display the press, rather than jumping
      // directly from the raised pose back to the raised pose.
      button.pressElapsed = Math.min(0.55, button.pressElapsed + Math.min(delta, 0.05));
      const elapsed = button.pressElapsed;
      const press = elapsed < 0.12 ? Math.max(0, elapsed / 0.12)
        : elapsed < 0.24 ? 1 : elapsed < 0.55 ? 1 - (elapsed - 0.24) / 0.31 : 0;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (cap) cap.position.y = reduced ? 0 : -0.005 * Math.sin(press * Math.PI / 2);
      const focused = Boolean(control?.matches(":focus-visible"));
      if (ring) (ring.material as THREE.MeshBasicMaterial).color.set(focused ? "#e4f8ff" : state.view === view || button.hovered || control?.matches(":hover") ? "#75d8ff" : "#143d48");
      if (!control) return;
      control.disabled = !enabled;
      control.setAttribute("aria-disabled", String(!enabled));
      control.dataset.physicalEnabled = String(enabled && visible);
      control.dataset.pressProgress = press.toFixed(3);
      control.dataset.tableFit = String(rig.frame?.cornersFit ?? false);
      if (!visible || !controlBounds || !rig.frame) return;
      rig.projected.copy(assembly.position).addScaledVector(rig.frame.normal, 0.023).project(camera);
      rig.edge.copy(assembly.position).addScaledVector(rig.frame.right, 0.11).project(camera);
      const x = canvasBounds.left + (rig.projected.x * 0.5 + 0.5) * canvasBounds.width;
      const y = canvasBounds.top + (-rig.projected.y * 0.5 + 0.5) * canvasBounds.height;
      const diameter = Math.abs(rig.edge.x - rig.projected.x) * canvasBounds.width;
      // Keep adjacent targets separate on narrow screens. Extra vertical room
      // improves touch access without showing a second set of controls.
      const width = Math.max(1, diameter * 1.25);
      control.style.left = `${x - controlBounds.left}px`;
      control.style.top = `${y - controlBounds.top}px`;
      control.style.width = `${width}px`;
      control.style.height = `${Math.max(44, diameter)}px`;
      control.dataset.projectedX = String(x);
      control.dataset.projectedY = String(y);
    });
    gl.domElement.dataset.installationButtonsOpacity = (visible ? rig.buttons[0]?.materials[0]?.opacity ?? 0 : 0).toFixed(3);
    if (!enabled && document.body.style.cursor === "pointer") document.body.style.cursor = "";
  });

  const press = (event: ThreeEvent<PointerEvent>) => {
    if (interactionRuntime.activeStation !== "touch" || interactionRuntime.touchVisibility < 0.85
      || document.querySelector("[data-experience-root]")?.hasAttribute("data-interaction-departing")) return;
    const view = event.object.userData.installationView;
    if (!installationViews.includes(view)) return;
    event.stopPropagation();
    selectInstallationView(view);
  };
  return <primitive object={rig.group} onPointerDown={press}
    onPointerOver={(event: ThreeEvent<PointerEvent>) => {
      const button = rig.buttons.find((item) => item.view === event.object.userData.installationView);
      if (interactionRuntime.activeStation === "touch" && button) {
        event.stopPropagation(); button.hovered = true; document.body.style.cursor = "pointer";
      }
    }}
    onPointerOut={() => { rig.buttons.forEach((button) => { button.hovered = false; }); document.body.style.cursor = ""; }} />;
}
