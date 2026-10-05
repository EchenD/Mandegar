"use client";

/* eslint-disable react-hooks/immutability -- The R3F readout updates its reusable GPU objects in frame callbacks. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Locale } from "@/lib/i18n";
import { getCrowdReadoutPoint, type CrowdPersonRuntime } from "./crowd-person-inspection";
import { crowdSignalHeight, crowdSignalWidth, getCrowdSignalHead, getCrowdSignalLayout, type CrowdSignalLayout } from "./crowd-signal-geometry";
import { getIntelligencePersonProfile } from "./intelligence-person-profile";
import {
  getFocusedIntelligencePerson,
  getIntelligenceSnapshot,
  subscribeIntelligenceInspector,
} from "./intelligence-inspector-store";

const resolution = 2;
const paintInterval = 1 / 24;
const noRaycast = () => {};

type ReadoutRuntime = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  sprite: THREE.Sprite;
  line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  dots: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  positions: THREE.BufferAttribute;
  person: string | null;
  entryAge: number;
  fadeAge: number | null;
  animationAge: number;
  nextPaint: number;
  paintedProgress: number;
  paintedOriginX: number;
  paintedOriginY: number;
  dirty: boolean;
  reducedMotion: boolean;
  element: HTMLElement | null;
  paintCount: number;
  locale: Locale;
};

function paintSignal(runtime: ReadoutRuntime, layout: CrowdSignalLayout, progress: number) {
  const width = layout.rect.width;
  const height = crowdSignalHeight;
  if (runtime.canvas.width !== width * resolution) runtime.canvas.width = width * resolution;
  const context = runtime.context;
  const profile = getIntelligencePersonProfile(runtime.person ?? "Human_0", runtime.locale);
  context.clearRect(0, 0, runtime.canvas.width, runtime.canvas.height);
  context.save();
  context.scale(resolution, resolution);
  // A warm, translucent plaque follows the real head without intercepting hits.
  context.beginPath();
  context.rect(0, height * (1 - progress), width, height * progress);
  context.clip();
  context.lineJoin = "round";
  context.beginPath();
  context.roundRect(1, 1, width - 2, height - 2, 10);
  context.fillStyle = "rgba(28, 30, 29, .88)";
  context.fill();
  context.strokeStyle = "rgba(205, 183, 143, .65)";
  context.stroke();
  const rtl = runtime.locale !== "en";
  const textX = rtl ? width - 14 : 14;
  context.direction = rtl ? "rtl" : "ltr";
  context.textAlign = rtl ? "right" : "left";
  context.fillStyle = "#ceb991";
  context.font = '600 11px "Vazirmatn Variable", sans-serif';
  context.fillText(profile.copy.title, textX, 22, width - 28);
  profile.lines.forEach((line, index) => {
    context.fillStyle = index === 0 ? "#f4f0e6" : "#d1cec3";
    context.font = `${index === 0 ? 600 : 500} ${index === 0 ? 15 : 13}px "Vazirmatn Variable", sans-serif`;
    context.fillText(line, textX, 48 + index * 24, width - 28);
  });
  context.restore();
  runtime.texture.needsUpdate = true;
  runtime.paintedProgress = progress;
  runtime.paintedOriginX = layout.origin.x;
  runtime.paintedOriginY = layout.origin.y;
  runtime.dirty = false;
  runtime.paintCount += 1;
}

function publishPresentation(runtime: ReadoutRuntime, person: string | null, state: string, layout?: CrowdSignalLayout, bounds?: DOMRect) {
  if (process.env.NODE_ENV === "production") return;
  runtime.element ??= document.querySelector<HTMLElement>("[data-intelligence-inspector]");
  const element = runtime.element;
  if (!element) return;
  const rect = layout && bounds ? { ...layout.rect, x: bounds.left + layout.rect.x, y: bounds.top + layout.rect.y } : null;
  const line = layout && bounds ? {
    start: { x: bounds.left + layout.start.x, y: bounds.top + layout.start.y },
    end: { x: bounds.left + layout.end.x, y: bounds.top + layout.end.y },
    points: 2,
  } : null;
  const values = {
    worldReadoutPerson: person ?? "none",
    worldReadoutState: state,
    worldReadoutRect: rect ? JSON.stringify(rect) : "",
    worldReadoutLeader: line ? JSON.stringify(line) : "",
    worldReadoutKind: "person-insight",
    worldReadoutFontSize: "15",
    worldReadoutText: person ? getIntelligencePersonProfile(person, runtime.locale).lines.join(" | ") : "none",
    worldReadoutSide: layout?.side === -1 ? "left" : "right",
    worldReadoutPaintCount: String(runtime.paintCount),
    worldReadoutMotion: runtime.reducedMotion ? "reduced" : "animated",
  };
  for (const [key, value] of Object.entries(values)) {
    if (element.dataset[key] !== value) element.dataset[key] = value;
  }
}

/** One compact signal follows the chosen head; its geometry never intercepts a person hit. */
export function CrowdPersonReadout({ locale, getPeople, getPointerHit }: {
  locale: Locale;
  getPeople: () => readonly CrowdPersonRuntime[];
  getPointerHit: (id: string) => THREE.Vector3 | undefined;
}) {
  const group = useMemo(() => new THREE.Group(), []);
  const runtimeRef = useRef<ReadoutRuntime | null>(null);
  const { camera, gl } = useThree();
  const scratch = useMemo(() => ({
    bounds: new THREE.Box3(),
    head: new THREE.Vector3(),
    projected: new THREE.Vector3(),
    start: new THREE.Vector3(),
    end: new THREE.Vector3(),
    edge: new THREE.Vector3(),
  }), []);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = crowdSignalWidth * resolution;
    canvas.height = crowdSignalHeight * resolution;
    const context = canvas.getContext("2d");
    if (!context) return;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
    const geometry = new THREE.BufferGeometry();
    const positions = new THREE.BufferAttribute(new Float32Array(6), 3).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", positions);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: "#ceb991", transparent: true, opacity: 0.85, depthTest: false, depthWrite: false, toneMapped: false }));
    const dots = new THREE.Points(geometry, new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 1 }, uPixelRatio: { value: gl.getPixelRatio() }, uColor: { value: new THREE.Color("#e2d7bd") } },
      vertexShader: "uniform float uPixelRatio; void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = 4.5 * uPixelRatio; }",
      fragmentShader: "uniform float uOpacity; uniform vec3 uColor; void main() { float radius = length(gl_PointCoord - 0.5); if (radius > 0.5) discard; gl_FragColor = vec4(uColor, (1.0 - smoothstep(0.28, 0.5, radius)) * uOpacity);\n#include <colorspace_fragment>\n }",
      transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    }));
    sprite.raycast = line.raycast = dots.raycast = noRaycast;
    sprite.renderOrder = 22;
    dots.renderOrder = 21;
    line.renderOrder = 20;
    sprite.frustumCulled = line.frustumCulled = dots.frustumCulled = false;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const runtime: ReadoutRuntime = {
      canvas, context, texture, sprite, line, dots, positions, locale,
      person: null, entryAge: 0, fadeAge: null, animationAge: 0, nextPaint: 0,
      paintedProgress: -1, paintedOriginX: -1, paintedOriginY: -1, dirty: true, reducedMotion: motion.matches, element: null, paintCount: 0,
    };
    runtimeRef.current = runtime;
    void document.fonts.ready.then(() => { if (runtimeRef.current === runtime) runtime.dirty = true; });
    group.visible = false;
    group.add(line, dots, sprite);
    const updateMotion = () => { runtime.reducedMotion = motion.matches; runtime.dirty = true; };
    const hide = () => {
      runtime.person = null;
      runtime.fadeAge = null;
      group.visible = false;
      publishPresentation(runtime, null, "hidden");
    };
    const hidden = () => { if (document.hidden) hide(); };
    const unsubscribe = subscribeIntelligenceInspector(() => { if (!getIntelligenceSnapshot().available) hide(); });
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", hidden);
    motion.addEventListener("change", updateMotion);
    return () => {
      unsubscribe();
      window.removeEventListener("blur", hide);
      document.removeEventListener("visibilitychange", hidden);
      motion.removeEventListener("change", updateMotion);
      runtimeRef.current = null;
      publishPresentation(runtime, null, "hidden");
      group.remove(line, dots, sprite);
      geometry.dispose();
      dots.material.dispose();
      line.material.dispose();
      sprite.material.dispose();
      texture.dispose();
    };
  }, [gl, group, locale]);

  useFrame((_, delta) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const snapshot = getIntelligenceSnapshot();
    const desired = snapshot.available && !document.hidden ? getFocusedIntelligencePerson() : null;
    const elapsed = Math.min(Math.max(delta, 0), 1);
    runtime.animationAge += elapsed;
    if (desired !== runtime.person) {
      if (!runtime.person || runtime.reducedMotion) runtime.fadeAge = 0.06;
      else runtime.fadeAge ??= 0;
      runtime.fadeAge += elapsed;
      if (runtime.fadeAge >= 0.06) {
        // Latest target wins; intermediate hovers never queue their animations.
        runtime.person = desired;
        runtime.entryAge = 0;
        runtime.fadeAge = null;
        runtime.paintedProgress = -1;
        runtime.dirty = true;
      }
    } else runtime.fadeAge = null;
    if (!runtime.person) {
      group.visible = false;
      publishPresentation(runtime, null, "hidden");
      return;
    }
    const person = getPeople().find((candidate) => candidate.id === runtime.person);
    if (!person || !getCrowdReadoutPoint(person.point, camera, getPointerHit(person.id), scratch.projected)
      || !getCrowdSignalHead(person.object, scratch.head, scratch.bounds)) {
      group.visible = false;
      publishPresentation(runtime, null, "hidden");
      return;
    }
    scratch.projected.copy(scratch.head).project(camera);
    const bounds = gl.domElement.getBoundingClientRect();
    const layout = getCrowdSignalLayout(scratch.projected, bounds.width, bounds.height);
    if (!layout) {
      group.visible = false;
      publishPresentation(runtime, null, "hidden");
      return;
    }
    runtime.entryAge += elapsed;
    const lineProgress = runtime.reducedMotion ? 1 : THREE.MathUtils.clamp(runtime.entryAge / 0.1, 0, 1);
    const graphProgress = runtime.reducedMotion ? 1 : THREE.MathUtils.clamp((runtime.entryAge - 0.05) / 0.15, 0, 1);
    const opacity = runtime.fadeAge === null ? 1 : Math.max(0, 1 - runtime.fadeAge / 0.06);
    const toWorld = (x: number, y: number, target: THREE.Vector3) => target.set(x / bounds.width * 2 - 1, 1 - y / bounds.height * 2, scratch.projected.z).unproject(camera);
    toWorld(layout.start.x, layout.start.y, scratch.start);
    toWorld(THREE.MathUtils.lerp(layout.start.x, layout.end.x, lineProgress), THREE.MathUtils.lerp(layout.start.y, layout.end.y, lineProgress), scratch.end);
    runtime.positions.setXYZ(0, scratch.start.x, scratch.start.y, scratch.start.z);
    runtime.positions.setXYZ(1, scratch.end.x, scratch.end.y, scratch.end.z);
    runtime.positions.needsUpdate = true;
    toWorld(layout.rect.x + layout.rect.width / 2, layout.rect.y + layout.rect.height / 2, runtime.sprite.position);
    toWorld(layout.rect.x + layout.rect.width, layout.rect.y + layout.rect.height / 2, scratch.edge);
    const worldWidth = runtime.sprite.position.distanceTo(scratch.edge) * 2;
    runtime.sprite.scale.set(worldWidth, worldWidth * crowdSignalHeight / layout.rect.width, 1);
    runtime.sprite.material.opacity = opacity * graphProgress;
    runtime.line.material.opacity = opacity * 0.85;
    runtime.dots.material.uniforms.uOpacity.value = opacity * 0.9;
    runtime.dots.material.uniforms.uPixelRatio.value = gl.getPixelRatio();
    if (runtime.animationAge >= runtime.nextPaint && (runtime.dirty || runtime.paintedProgress !== graphProgress)) {
      paintSignal(runtime, layout, graphProgress);
      runtime.nextPaint = runtime.animationAge + paintInterval;
    }
    group.visible = true;
    publishPresentation(runtime, runtime.person, graphProgress >= 1 && runtime.paintedProgress >= 1 ? "ready" : graphProgress > 0 ? "signal" : "line", layout, bounds);
  });

  return <primitive object={group} />;
}
