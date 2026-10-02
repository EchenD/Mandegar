"use client";

/* eslint-disable react-hooks/immutability -- R3F frames animate reusable tile meshes and materials. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { bakedSceneContract } from "./baked-scene-contract";
import { createPuzzleScreenFrame, createPuzzleTableFrame, createPuzzleTileGeometry, getPuzzleWorldPoint, projectPuzzlePoint } from "./composer-puzzle-geometry";
import { experienceState } from "./experience-state";
import { getPuzzleSlotCenter } from "./interactions/puzzle-engine";
import { puzzleArtworkUrl } from "./interactions/puzzle-artwork";
import { beginPuzzleDrag, cancelPuzzleDrag, finishPuzzleDrag, getPuzzleState, setPuzzleFocusedSlot, subscribePuzzle, updatePuzzleDrag } from "./interactions/puzzle-store";
import { interactionRuntime, requestInteraction } from "./interactions/interaction-runtime";
import { getVisitorCreation } from "./interactions/visitor-creation";
import { getVisitorPresentation } from "./interactions/visitor-presentation";

type CapturedTile = {
  pointerId: number;
  sourceSlot: number;
  capture: { setPointerCapture: (id: number) => void; releasePointerCapture: (id: number) => void };
  plane: THREE.Plane;
  offset: { x: number; y: number };
};

export function ComposerObjects({ root }: { root: THREE.Object3D }) {
  const { camera, gl } = useThree();
  const capture = useRef<CapturedTile | null>(null);
  const hovered = useRef<number | null>(null);
  const semantic = useRef<HTMLElement | null>(null);
  const reveal = useRef(0);
  const reducedMotion = useMemo(() => typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)") : null, []);
  const scratch = useMemo(() => ({ point: new THREE.Vector3(), target: new THREE.Vector3(), projected: new THREE.Vector3(), corner: new THREE.Vector3() }), []);
  const rig = useMemo(() => {
    const screen = root.getObjectByName(bakedSceneContract.exhibition.screens.interactive);
    const screenFrame = screen ? createPuzzleScreenFrame(screen) : null;
    const frame = screenFrame ? createPuzzleTableFrame(root, screenFrame) : null;
    const group = new THREE.Group();
    group.name = "fxInteraction_picture_puzzle";
    group.visible = false;
    const width = frame?.width ?? 0.9;
    const height = frame?.height ?? 0.6;
    const bodyGeometry = new THREE.BoxGeometry(width / 3, height / 3, 0.022);
    const edgeGeometry = new THREE.EdgesGeometry(bodyGeometry);
    const geometries = Array.from({ length: 9 }, (_, piece) => createPuzzleTileGeometry(width, height, piece, 0));
    const tiles = geometries.map((geometry, piece) => {
      const tile = new THREE.Group();
      tile.name = `puzzle_piece_${piece}`;
      const bodyMaterial = new THREE.MeshBasicMaterial({ color: "#594a3e", transparent: true, toneMapped: false });
      const faceMaterial = new THREE.MeshBasicMaterial({ color: "#25333c", transparent: true, toneMapped: false });
      const lineMaterial = new THREE.LineBasicMaterial({ color: "#75d8ff", transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      const face = new THREE.Mesh(geometry, faceMaterial);
      const edge = new THREE.LineSegments(edgeGeometry, lineMaterial);
      face.position.z = 0.0112;
      body.userData.puzzlePiece = face.userData.puzzlePiece = piece;
      edge.raycast = () => {};
      tile.add(body, face, edge);
      if (frame) {
        tile.quaternion.copy(frame.rotation);
        const slot = getPuzzleState().tiles.indexOf(piece);
        const point = getPuzzleSlotCenter(slot)!;
        getPuzzleWorldPoint(frame, point.x, point.y, tile.position);
      }
      group.add(tile);
      return { tile, faceMaterial, bodyMaterial, lineMaterial };
    });
    const shadowGeometry = new THREE.PlaneGeometry(width + 0.018, height + 0.018);
    const shadowMaterial = new THREE.MeshBasicMaterial({ color: "#090d12", transparent: true, opacity: 0.28, depthWrite: false });
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.raycast = () => {};
    if (frame) {
      shadow.quaternion.copy(frame.rotation);
      shadow.position.copy(frame.center).addScaledVector(frame.normal, 0.002);
    }
    group.add(shadow);
    return { frame, screenFrame, group, tiles, geometries, bodyGeometry, edgeGeometry, shadowGeometry, shadowMaterial };
  }, [root]);

  const releaseCapture = () => {
    const current = capture.current;
    capture.current = null;
    if (current && gl.domElement.hasPointerCapture(current.pointerId)) current.capture.releasePointerCapture(current.pointerId);
    hovered.current = null;
    if (["grab", "grabbing"].includes(document.body.style.cursor)) document.body.style.cursor = "";
  };

  useEffect(() => {
    let disposed = false;
    let artwork: THREE.Texture | null = null;
    new THREE.TextureLoader().load(puzzleArtworkUrl, (texture) => {
      if (disposed) { texture.dispose(); return; }
      artwork = texture;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
      rig.tiles.forEach(({ faceMaterial }) => {
        faceMaterial.map = texture;
        faceMaterial.color.set("#ffffff");
        faceMaterial.needsUpdate = true;
      });
    }, undefined, () => {});
    const cancel = () => {
      const current = capture.current;
      capture.current = null;
      if (current) {
        cancelPuzzleDrag(current.pointerId);
        if (gl.domElement.hasPointerCapture(current.pointerId)) current.capture.releasePointerCapture(current.pointerId);
      }
      hovered.current = null;
      if (["grab", "grabbing"].includes(document.body.style.cursor)) document.body.style.cursor = "";
    };
    const hidden = () => { if (document.hidden) cancel(); };
    const lost = (event: PointerEvent) => { if (capture.current?.pointerId === event.pointerId) cancel(); };
    const unsubscribe = subscribePuzzle(() => { if (capture.current && !getPuzzleState().dragging) cancel(); });
    const toggle = document.querySelector("header button[aria-controls='primary-navigation']");
    const menu = new MutationObserver(() => { if (toggle?.getAttribute("aria-expanded") === "true") cancel(); });
    if (toggle) menu.observe(toggle, { attributes: true, attributeFilter: ["aria-expanded"] });
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", hidden);
    gl.domElement.addEventListener("pointercancel", lost);
    gl.domElement.addEventListener("lostpointercapture", lost);
    return () => {
      disposed = true;
      unsubscribe();
      menu.disconnect();
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", hidden);
      gl.domElement.removeEventListener("pointercancel", lost);
      gl.domElement.removeEventListener("lostpointercapture", lost);
      cancel();
      artwork?.dispose();
      rig.geometries.forEach((geometry) => geometry.dispose());
      rig.tiles.forEach(({ faceMaterial, bodyMaterial, lineMaterial }) => { faceMaterial.dispose(); bodyMaterial.dispose(); lineMaterial.dispose(); });
      rig.bodyGeometry.dispose();
      rig.edgeGeometry.dispose();
      rig.shadowGeometry.dispose();
      rig.shadowMaterial.dispose();
    };
  }, [gl, rig]);

  useFrame((_, delta) => {
    if (!rig.frame) return;
    const state = getPuzzleState();
    const inTouch = interactionRuntime.activeStation === "touch";
    const savedVisibility = experienceState.sequence === "loop" && getVisitorCreation().puzzle.started
      ? getVisitorPresentation(experienceState.progress).composerVisibility : 0;
    const visibility = inTouch ? Math.max(interactionRuntime.touchVisibility, savedVisibility) : savedVisibility;
    const reduced = reducedMotion?.matches ?? false;
    const smoothing = reduced ? 1 : 1 - Math.exp(-Math.min(delta, 0.1) * 16);
    reveal.current += ((state.solved ? 1 : 0) - reveal.current) * smoothing;
    rig.group.visible = visibility > 0.002;
    rig.tiles.forEach(({ tile, faceMaterial, bodyMaterial, lineMaterial }, piece) => {
      const slot = state.previewTiles.indexOf(piece);
      const point = getPuzzleSlotCenter(slot)!;
      const dragging = state.dragging && state.tiles[state.dragging.sourceSlot] === piece;
      const selected = state.selectedSlot !== null && state.tiles[state.selectedSlot] === piece;
      const focused = hovered.current === piece || state.focusedSlot === slot || selected;
      getPuzzleWorldPoint(rig.frame!, dragging ? state.dragging!.x : point.x, dragging ? state.dragging!.y : point.y, scratch.target, dragging ? 0.075 : selected ? 0.035 : 0.015);
      tile.position.lerp(scratch.target, dragging ? 1 : smoothing);
      tile.scale.set(1 - (1 - reveal.current) * 0.024, 1 - (1 - reveal.current) * 0.035, 1);
      faceMaterial.opacity = bodyMaterial.opacity = visibility;
      lineMaterial.opacity = visibility * (1 - reveal.current) * (focused || dragging ? 0.75 : 0.12);
    });
    rig.shadowMaterial.opacity = visibility * 0.28;
    if (!semantic.current?.isConnected) semantic.current = document.querySelector<HTMLElement>("[data-touch-spatial-controls]");
    if (process.env.NODE_ENV === "production") return;
    const element = semantic.current;
    if (!element) return;
    camera.updateMatrixWorld(true);
    const bounds = gl.domElement.getBoundingClientRect();
    const centers = state.previewTiles.map((piece, slot) => {
      const tile = rig.tiles[piece].tile;
      scratch.projected.copy(tile.position).project(camera);
      let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
      const vertices = rig.bodyGeometry.getAttribute("position");
      for (let vertex = 0; vertex < vertices.count; vertex += 1) {
        scratch.corner.fromBufferAttribute(vertices, vertex).multiply(tile.scale).applyQuaternion(tile.quaternion).add(tile.position).project(camera);
        minX = Math.min(minX, scratch.corner.x); maxX = Math.max(maxX, scratch.corner.x);
        minY = Math.min(minY, scratch.corner.y); maxY = Math.max(maxY, scratch.corner.y);
      }
      return { slot, piece, x: Math.round(bounds.left + (scratch.projected.x * 0.5 + 0.5) * bounds.width), y: Math.round(bounds.top + (-scratch.projected.y * 0.5 + 0.5) * bounds.height), width: Math.round((maxX - minX) * 0.5 * bounds.width), height: Math.round((maxY - minY) * 0.5 * bounds.height), position: tile.position.toArray().map((value) => Number(value.toFixed(3))) };
    });
    const values = {
      puzzleObjectCenters: JSON.stringify(centers), puzzleObjectsVisible: String(rig.group.visible),
      puzzleObjectDragging: state.dragging ? String(state.dragging.sourceSlot) : "none",
      puzzleTableFit: String(rig.frame.cornersFit), puzzleObjectArtwork: puzzleArtworkUrl,
    };
    for (const [key, value] of Object.entries(values)) if (element.dataset[key] !== value) element.dataset[key] = value;
    if (rig.screenFrame) {
      const screen = rig.screenFrame;
      const project = (x: number, y: number) => {
        scratch.projected.copy(screen.center).addScaledVector(screen.right, (x - 0.5) * screen.width)
          .addScaledVector(screen.up, (0.5 - y) * screen.height).project(camera);
        return { x: bounds.left + (scratch.projected.x * 0.5 + 0.5) * bounds.width, y: bounds.top + (-scratch.projected.y * 0.5 + 0.5) * bounds.height };
      };
      const monitorPoints = JSON.stringify({
        slots: Array.from({ length: 9 }, (_, slot) => ({ slot, ...project((170.5 + (slot % 3 + 0.5) * 230) / 1031, (14 + (Math.floor(slot / 3) + 0.5) * 460 / 3) / 540) })),
        controls: { reset: project(128 / 1031, 507 / 540), close: project(970 / 1031, 35 / 540), continue: project(892 / 1031, 507 / 540) },
      });
      if (element.dataset.puzzleMonitorPoints !== monitorPoints) element.dataset.puzzleMonitorPoints = monitorPoints;
    }
  });

  const down = (event: ThreeEvent<PointerEvent>) => {
    const piece = event.object.userData.puzzlePiece as number | undefined;
    if (piece === undefined || interactionRuntime.activeStation !== "touch" || event.button !== 0) return;
    event.stopPropagation();
    if (!rig.frame || document.querySelector("header button[aria-expanded='true']")) return;
    const slot = getPuzzleState().tiles.indexOf(piece);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(rig.frame.normal, rig.frame.center);
    const start = event.ray.intersectPlane(plane, scratch.point);
    if (!start) return;
    const normalized = projectPuzzlePoint(rig.frame, start);
    const center = getPuzzleSlotCenter(slot)!;
    if (!beginPuzzleDrag(slot, event.pointerId, center.x, center.y, "table")) return;
    const target = event.target as unknown as CapturedTile["capture"];
    capture.current = { sourceSlot: slot, pointerId: event.pointerId, capture: target, plane, offset: { x: center.x - normalized.x, y: center.y - normalized.y } };
    target.setPointerCapture(event.pointerId);
    document.body.style.cursor = "grabbing";
  };
  const move = (event: ThreeEvent<PointerEvent>) => {
    const current = capture.current;
    if (current && rig.frame) {
      event.stopPropagation();
      if (event.pointerId !== current.pointerId || !event.ray.intersectPlane(current.plane, scratch.point)) return;
      const point = projectPuzzlePoint(rig.frame, scratch.point);
      updatePuzzleDrag(event.pointerId, point.x + current.offset.x, point.y + current.offset.y);
      return;
    }
    if (!getPuzzleState().interactive || getPuzzleState().dragging) return;
    event.stopPropagation();
    hovered.current = event.object.userData.puzzlePiece as number;
    document.body.style.cursor = "grab";
  };
  const up = (event: ThreeEvent<PointerEvent>) => {
    const current = capture.current;
    if (!current || event.pointerId !== current.pointerId) return;
    event.stopPropagation();
    if (event.type === "pointercancel" || !event.ray.intersectPlane(current.plane, scratch.point)) cancelPuzzleDrag(event.pointerId);
    else {
      move(event);
      const focusSlot = getPuzzleState().dragging?.targetSlot ?? current.sourceSlot;
      finishPuzzleDrag(event.pointerId);
      setPuzzleFocusedSlot(focusSlot);
      if (window.matchMedia("(min-width: 761px)").matches) {
        const selector = getPuzzleState().solved ? "[data-interaction-continue]" : `[data-puzzle-slot="${focusSlot}"]`;
        semantic.current?.querySelector<HTMLButtonElement>(selector)?.focus({ preventScroll: true });
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
    if (interactionRuntime.activeStation === "touch") event.stopPropagation();
    else if (!interactionRuntime.activeStation && interactionRuntime.availableStation === "touch") {
      event.stopPropagation();
      requestInteraction("touch", "pointer");
    }
  };

  return <primitive object={rig.group} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerOut={out} onClick={click} />;
}
