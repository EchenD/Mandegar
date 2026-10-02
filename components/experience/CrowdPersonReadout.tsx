"use client";

/* eslint-disable react-hooks/immutability -- The R3F readout updates its reusable GPU objects in frame callbacks. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Locale } from "@/lib/i18n";
import { getCrowdReadoutPoint, type CrowdPersonRuntime } from "./crowd-person-inspection";
import { getIntelligenceCopy, getIntelligenceExample } from "./intelligence-inspector-copy";
import {
  getFocusedIntelligencePerson,
  getIntelligenceSnapshot,
  subscribeIntelligenceInspector,
} from "./intelligence-inspector-store";

const width = 280;
const height = 112;
const resolution = 2;
const noRaycast = () => {};

type ReadoutRuntime = {
  canvas: HTMLCanvasElement;
  source: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  sprite: THREE.Sprite;
  line: THREE.Line;
  positions: THREE.BufferAttribute;
  person: string | null;
  entryAge: number;
  fadeAge: number | null;
  paintedProgress: number;
  dirty: boolean;
  reducedMotion: boolean;
  element: HTMLElement | null;
};

function paintSource(runtime: ReadoutRuntime, id: string, locale: Locale) {
  const context = runtime.source.getContext("2d");
  if (!context) return;
  const copy = getIntelligenceCopy(locale);
  const example = getIntelligenceExample(id, locale);
  const rtl = locale !== "en";
  context.clearRect(0, 0, width * resolution, height * resolution);
  context.save();
  context.scale(resolution, resolution);
  context.direction = rtl ? "rtl" : "ltr";
  context.textAlign = rtl ? "right" : "left";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.strokeStyle = "rgba(9, 22, 32, .88)";
  context.lineWidth = 2.2;
  const x = rtl ? width - 6 : 6;
  const text = (value: string, y: number, color: string) => {
    context.strokeText(value, x, y, width - 12);
    context.fillStyle = color;
    context.fillText(value, x, y, width - 12);
  };
  context.font = '650 11.5px "Vazirmatn Variable", Tahoma, sans-serif';
  text(copy.example, 16, "#87e3ff");
  context.font = '550 15px "Vazirmatn Variable", Tahoma, sans-serif';
  const lines: string[] = [];
  for (const name of example.activityNames) {
    const previous = lines[lines.length - 1];
    const joined = previous ? `${previous} · ${name}` : name;
    if (previous && context.measureText(joined).width < width - 14) lines[lines.length - 1] = joined;
    else lines.push(name);
  }
  // These fixed examples fit two rows without truncating connected RTL glyphs.
  text(lines[0] ?? "", 44, "#f6f7f3");
  text(lines.slice(1).join(" · "), 66, "#f6f7f3");
  text(`${copy.time} · ${example.time}`, 96, "#f6f7f3");
  context.restore();
  runtime.dirty = true;
}

function revealText(runtime: ReadoutRuntime, progress: number, rtl: boolean) {
  if (!runtime.dirty && Math.abs(runtime.paintedProgress - progress) < 0.015) return;
  const context = runtime.context;
  context.clearRect(0, 0, width * resolution, height * resolution);
  // Reveal complete shaped lines through a clip, rather than slicing Arabic/Persian text.
  [0, 30, 55, 80].forEach((top, index) => {
    const rowProgress = THREE.MathUtils.clamp(progress * 1.3 - index * 0.1, 0, 1);
    const revealWidth = width * resolution * rowProgress;
    context.save();
    context.beginPath();
    context.rect(rtl ? width * resolution - revealWidth : 0, top * resolution, revealWidth, (index === 3 ? 32 : index === 0 ? 30 : 25) * resolution);
    context.clip();
    context.drawImage(runtime.source, 0, 0);
    context.restore();
  });
  runtime.texture.needsUpdate = true;
  runtime.paintedProgress = progress;
  runtime.dirty = false;
}

function publishPresentation(runtime: ReadoutRuntime, person: string | null, state: string, rect?: { x: number; y: number; width: number; height: number }) {
  if (process.env.NODE_ENV === "production") return;
  runtime.element ??= document.querySelector<HTMLElement>("[data-intelligence-inspector]");
  const element = runtime.element;
  if (!element) return;
  const values = {
    worldReadoutPerson: person ?? "none",
    worldReadoutState: state,
    worldReadoutRect: rect ? JSON.stringify(rect) : "",
    worldReadoutFontSize: String(rect ? 15 * rect.width / width : 0),
  };
  for (const [key, value] of Object.entries(values)) {
    if (element.dataset[key] !== value) element.dataset[key] = value;
  }
}

/** One camera-facing 3D annotation follows the selected figure; it never intercepts a person hit. */
export function CrowdPersonReadout({ locale, getPeople, getPointerHit }: {
  locale: Locale;
  getPeople: () => readonly CrowdPersonRuntime[];
  getPointerHit: (id: string) => THREE.Vector3 | undefined;
}) {
  const group = useMemo(() => new THREE.Group(), []);
  const runtimeRef = useRef<ReadoutRuntime | null>(null);
  const { camera, gl } = useThree();
  const scratch = useMemo(() => ({
    projected: new THREE.Vector3(),
    start: new THREE.Vector3(),
    elbow: new THREE.Vector3(),
    end: new THREE.Vector3(),
    point: new THREE.Vector3(),
    edge: new THREE.Vector3(),
  }), []);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    const source = document.createElement("canvas");
    canvas.width = source.width = width * resolution;
    canvas.height = source.height = height * resolution;
    const context = canvas.getContext("2d");
    if (!context) return;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
    const geometry = new THREE.BufferGeometry();
    const positions = new THREE.BufferAttribute(new Float32Array(9), 3).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", positions);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: "#62cfff", transparent: true, opacity: 0.85, depthTest: false, depthWrite: false, toneMapped: false }));
    sprite.raycast = line.raycast = noRaycast;
    sprite.renderOrder = 21;
    line.renderOrder = 20;
    sprite.frustumCulled = line.frustumCulled = false;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const runtime: ReadoutRuntime = { canvas, source, context, texture, sprite, line, positions, person: null, entryAge: 0, fadeAge: null, paintedProgress: -1, dirty: true, reducedMotion: motion.matches, element: null };
    runtimeRef.current = runtime;
    group.visible = false;
    group.add(line, sprite);
    const updateMotion = () => { runtime.reducedMotion = motion.matches; };
    const unsubscribe = subscribeIntelligenceInspector(() => {
      if (getIntelligenceSnapshot().available) return;
      runtime.person = null;
      runtime.fadeAge = null;
      group.visible = false;
      publishPresentation(runtime, null, "hidden");
    });
    motion.addEventListener("change", updateMotion);
    let mounted = true;
    void document.fonts.ready.then(() => {
      if (mounted && runtime.person) paintSource(runtime, runtime.person, locale);
    });
    return () => {
      mounted = false;
      unsubscribe();
      motion.removeEventListener("change", updateMotion);
      runtimeRef.current = null;
      publishPresentation(runtime, null, "hidden");
      group.remove(line, sprite);
      geometry.dispose();
      line.material.dispose();
      sprite.material.dispose();
      texture.dispose();
    };
  }, [group, locale]);

  useFrame((_, delta) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const snapshot = getIntelligenceSnapshot();
    const desired = snapshot.available ? getFocusedIntelligencePerson() : null;
    const elapsed = Math.min(delta, 0.5);
    if (desired !== runtime.person) {
      if (!runtime.person || runtime.reducedMotion) runtime.fadeAge = 0.06;
      else runtime.fadeAge ??= 0;
      runtime.fadeAge += elapsed;
      if (runtime.fadeAge >= 0.06) {
        // Always choose the latest pointer target; rapid movement never queues old labels.
        runtime.person = desired;
        runtime.entryAge = 0;
        runtime.fadeAge = null;
        runtime.paintedProgress = -1;
        if (desired) paintSource(runtime, desired, locale);
      }
    } else runtime.fadeAge = null;
    if (!runtime.person) {
      group.visible = false;
      publishPresentation(runtime, null, "hidden");
      return;
    }
    const person = getPeople().find((candidate) => candidate.id === runtime.person);
    if (!person) {
      group.visible = false;
      publishPresentation(runtime, null, "hidden");
      return;
    }
    const anchor = getCrowdReadoutPoint(person.point, camera, getPointerHit(person.id), scratch.projected);
    if (!anchor) {
      group.visible = false;
      publishPresentation(runtime, null, "hidden");
      return;
    }
    runtime.entryAge += elapsed;
    const lineProgress = runtime.reducedMotion ? 1 : THREE.MathUtils.clamp(runtime.entryAge / 0.12, 0, 1);
    const textProgress = runtime.reducedMotion ? 1 : THREE.MathUtils.clamp((runtime.entryAge - 0.1) / 0.18, 0, 1);
    const opacity = runtime.fadeAge === null ? 1 : 1 - runtime.fadeAge / 0.06;
    const bounds = gl.domElement.getBoundingClientRect();
    if (bounds.width <= 40 || bounds.height <= height) {
      group.visible = false;
      publishPresentation(runtime, null, "hidden");
      return;
    }
    const pixelWidth = Math.min(width, bounds.width - 40);
    const pixelHeight = height * pixelWidth / width;
    const anchorX = (scratch.projected.x * 0.5 + 0.5) * bounds.width;
    const anchorY = (-scratch.projected.y * 0.5 + 0.5) * bounds.height - (anchor === person.point ? 14 : 0);
    const onLeft = anchorX > bounds.width * 0.5;
    const left = THREE.MathUtils.clamp(onLeft ? anchorX - pixelWidth - 30 : anchorX + 30, 20, bounds.width - pixelWidth - 20);
    const top = THREE.MathUtils.clamp(anchorY - pixelHeight - 24, 82, Math.max(82, bounds.height * 0.58 - pixelHeight));
    const toWorld = (x: number, y: number, target: THREE.Vector3) => target.set(x / bounds.width * 2 - 1, 1 - y / bounds.height * 2, scratch.projected.z).unproject(camera);
    toWorld(anchorX, anchorY, scratch.start);
    const endX = onLeft ? left + pixelWidth : left;
    const endY = top + 19;
    toWorld(endX + (onLeft ? 14 : -14), endY, scratch.elbow);
    toWorld(endX, endY, scratch.end);
    runtime.positions.setXYZ(0, scratch.start.x, scratch.start.y, scratch.start.z);
    scratch.point.lerpVectors(scratch.start, scratch.elbow, Math.min(1, lineProgress / 0.72));
    runtime.positions.setXYZ(1, scratch.point.x, scratch.point.y, scratch.point.z);
    scratch.point.lerpVectors(scratch.point, scratch.end, Math.max(0, (lineProgress - 0.72) / 0.28));
    runtime.positions.setXYZ(2, scratch.point.x, scratch.point.y, scratch.point.z);
    runtime.positions.needsUpdate = true;
    toWorld(left + pixelWidth / 2, top + pixelHeight / 2, runtime.sprite.position);
    toWorld(left + pixelWidth, top + pixelHeight / 2, scratch.edge);
    const worldWidth = runtime.sprite.position.distanceTo(scratch.edge) * 2;
    runtime.sprite.scale.set(worldWidth, worldWidth * height / width, 1);
    runtime.sprite.material.opacity = opacity;
    (runtime.line.material as THREE.LineBasicMaterial).opacity = opacity * 0.85;
    revealText(runtime, textProgress, locale !== "en");
    group.visible = true;
    publishPresentation(runtime, runtime.person, textProgress >= 1 ? "ready" : textProgress > 0 ? "text" : "line", {
      x: Math.round(bounds.left + left), y: Math.round(bounds.top + top), width: Math.round(pixelWidth), height: Math.round(pixelHeight),
    });
  });

  return <primitive object={group} />;
}
