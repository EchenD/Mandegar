"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { experienceState } from "./experience-state";
import { bakedSceneContract } from "./baked-scene-contract";
import { interactionRuntime } from "./interactions/interaction-runtime";
import type { InteractionAnchorRuntime } from "./interactions/interaction-anchors";
import {
  getFocusedIntelligenceStation,
  getIntelligenceSnapshot,
  updateIntelligenceStations,
  type IntelligenceStationId,
  type IntelligenceStationPoint,
} from "./intelligence-inspector-store";

const stations: readonly IntelligenceStationId[] = ["photo", "touch", "stage", "game", "draw"];
const cardWidth = 218;
const cardHeight = 150;

export function canInspectIntelligenceStations() {
  return experienceState.sequence === "loop"
    && experienceState.narrative.phase === "intelligence"
    && interactionRuntime.activeStation === null
    && !document.hidden;
}

/** Only projected UI follows the camera; the authored booth and monitors stay untouched. */
export function IntelligenceStationAnchors({ anchors, exhibition, getSurfacePoint }: {
  anchors: InteractionAnchorRuntime;
  exhibition: THREE.Object3D;
  getSurfacePoint: (object: THREE.Object3D, u: number, v: number) => THREE.Vector3 | null;
}) {
  const { camera, gl } = useThree();
  const point = useMemo(() => new THREE.Vector3(), []);
  const monitorPoint = useMemo(() => new THREE.Vector3(), []);
  const monitorTargets = useMemo(() => {
    const screens = bakedSceneContract.exhibition.screens;
    return [
      { id: "touch", object: exhibition.getObjectByName(screens.interactive) },
      { id: "stage", object: exhibition.getObjectByName(screens.videoWall) },
      { id: "game", object: exhibition.getObjectByName(screens.game) },
      { id: "draw", object: exhibition.getObjectByName(screens.main) },
    ];
  }, [exhibition]);
  const nextProjection = useRef(0);

  useEffect(() => () => updateIntelligenceStations([]), []);

  useFrame(({ clock }) => {
    if (!canInspectIntelligenceStations()) {
      updateIntelligenceStations([]);
      nextProjection.current = 0;
      return;
    }
    const bounds = gl.domElement.getBoundingClientRect();
    const available: IntelligenceStationPoint[] = [];
    const inspector = document.querySelector<HTMLElement>("[data-intelligence-inspector]");
    for (const station of stations) {
      anchors.stations[station].object.getWorldPosition(point);
      point.project(camera);
      const x = (point.x * 0.5 + 0.5) * bounds.width;
      const y = (-point.y * 0.5 + 0.5) * bounds.height;
      const inFrame = point.z >= -1 && point.z <= 1 && x >= 24 && x <= bounds.width - 24 && y >= 24 && y <= bounds.height - 24;
      if (!inFrame) continue;
      available.push({ id: station, x: bounds.left + x, y: bounds.top + y });
      const marker = inspector?.querySelector<HTMLElement>(`[data-intelligence-station-target="${station}"]`);
      if (marker) {
        marker.style.left = `${bounds.left + x}px`;
        marker.style.top = `${bounds.top + y}px`;
      }
    }
    if (clock.elapsedTime >= nextProjection.current) {
      updateIntelligenceStations(available);
      if (process.env.NODE_ENV !== "production" && inspector) {
        const surfaces = monitorTargets.flatMap(({ id, object }) => {
          if (!object) return [];
          const surfacePoint = getSurfacePoint(object, 0.5, 0.77);
          if (!surfacePoint) return [];
          monitorPoint.copy(surfacePoint).project(camera);
          if (monitorPoint.z < -1 || monitorPoint.z > 1 || Math.abs(monitorPoint.x) > 1 || Math.abs(monitorPoint.y) > 1) return [];
          return [{ id, x: bounds.left + (monitorPoint.x * 0.5 + 0.5) * bounds.width, y: bounds.top + (-monitorPoint.y * 0.5 + 0.5) * bounds.height }];
        });
        inspector.dataset.stationSurfaces = JSON.stringify(surfaces);
      }
      nextProjection.current = clock.elapsedTime + 0.2;
    }
    const selected = getIntelligenceSnapshot().available ? getFocusedIntelligenceStation() : null;
    const anchor = available.find((station) => station.id === selected);
    const card = inspector?.querySelector<HTMLElement>("[data-station-readout]");
    if (!card || !anchor) {
      if (card) card.style.visibility = "hidden";
      return;
    }
    const width = Math.min(cardWidth, bounds.width - 24);
    const anchorX = anchor.x - bounds.left;
    const anchorY = anchor.y - bounds.top;
    const side = anchorX <= bounds.width / 2 ? 1 : -1;
    const left = THREE.MathUtils.clamp(side === 1 ? anchorX + 26 : anchorX - width - 26, 12, bounds.width - width - 12);
    const top = THREE.MathUtils.clamp(anchorY - cardHeight + 24, 12, bounds.height - cardHeight - 12);
    card.style.left = `${bounds.left + left}px`;
    card.style.top = `${bounds.top + top}px`;
    card.style.width = `${width}px`;
    card.style.visibility = "visible";
    const line = inspector?.querySelector<SVGLineElement>("[data-station-leader]");
    if (line) {
      line.setAttribute("x1", String(anchor.x));
      line.setAttribute("y1", String(anchor.y));
      line.setAttribute("x2", String(bounds.left + (side === 1 ? left : left + width)));
      line.setAttribute("y2", String(bounds.top + top + cardHeight - 24));
    }
    if (process.env.NODE_ENV !== "production" && inspector) {
      inspector.dataset.stationReadoutRect = JSON.stringify({ x: bounds.left + left, y: bounds.top + top, width, height: cardHeight });
    }
  });

  return null;
}
