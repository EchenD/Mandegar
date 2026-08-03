"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Component, type ErrorInfo, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { experienceState, type ExperienceQuality } from "./experience-state";

type RuntimeState = "pending" | "fallback" | ExperienceQuality;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const range = (progress: number, start: number, end: number) => clamp((progress - start) / (end - start));

function createSegments(points: number[]) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  geometry.setDrawRange(0, 0);
  return geometry;
}

function densifySegments(points: number[], subdivisions: number) {
  const dense: number[] = [];
  for (let index = 0; index < points.length; index += 6) {
    const start = new THREE.Vector3(points[index], points[index + 1], points[index + 2]);
    const end = new THREE.Vector3(points[index + 3], points[index + 4], points[index + 5]);
    for (let step = 0; step < subdivisions; step += 1) {
      dense.push(...start.clone().lerp(end, step / subdivisions).toArray(), ...start.clone().lerp(end, (step + 1) / subdivisions).toArray());
    }
  }
  return dense;
}

function curveSegments(points: Array<[number, number, number]>, segments: number) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  const sampled = curve.getPoints(segments);
  const output: number[] = [];
  for (let index = 1; index < sampled.length; index += 1) output.push(...sampled[index - 1].toArray(), ...sampled[index].toArray());
  return output;
}

function SparkScene({ quality }: { quality: ExperienceQuality }) {
  const spark = useRef<THREE.Group>(null);
  const sparkCoreMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const sparkHaloMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const trail = useRef<THREE.LineSegments>(null);
  const structure = useRef<THREE.LineSegments>(null);
  const grid = useRef<THREE.GridHelper>(null);
  const planes = useRef<THREE.Group>(null);
  const eventEnvironment = useRef<THREE.Group>(null);
  const intelligence = useRef<THREE.Group>(null);
  const intelligencePoints = useRef<THREE.Points>(null);
  const intelligenceMaterial = useRef<THREE.PointsMaterial>(null);
  const memoryCore = useRef<THREE.Mesh>(null);
  const smoothPointer = useRef(new THREE.Vector2());
  const pointerTarget = useRef(new THREE.Vector2());
  const trailGeometry = useMemo(() => createSegments([
    ...curveSegments([[-1.28, -.12, 0], [-.96, -.08, 0], [-.62, .14, 0], [-.3, .34, 0], [.12, .02, 0], [.58, .04, 0]], 64),
    ...curveSegments([[-.76, -.24, -.02], [-.45, -.03, -.02], [-.14, -.16, -.02], [.24, .18, -.02], [.62, .1, -.02]], 46),
  ]), []);
  const structureGeometry = useMemo(() => createSegments(densifySegments([
    -1.35, -0.7, 0, 1.35, -0.7, 0, -1.35, -0.7, 0, -1.35, 0.64, 0, 1.35, -0.7, 0, 1.35, 0.64, 0, -1.35, 0.64, 0, 1.35, 0.64, 0,
    -1.04, -0.7, -0.12, -1.04, 0.64, -0.12, -0.32, -0.7, -0.12, -0.32, 0.64, -0.12, .32, -0.7, -0.12, .32, 0.64, -0.12, 1.04, -0.7, -0.12, 1.04, 0.64, -0.12,
    -1.04, .29, -.12, 1.04, .29, -.12, -1.04, -.24, -.12, 1.04, -.24, -.12,
    -1.52, -.7, .22, -1.08, -.34, .22, -1.08, -.34, .22, -.7, -.7, .22, .7, -.7, .22, 1.08, -.34, .22, 1.08, -.34, .22, 1.52, -.7, .22,
  ], 10)), []);
  const intelligenceGeometry = useMemo(() => {
    const points: number[] = [];
    const count = quality === "full" ? 72 : 32;
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 8;
      const radius = .22 + (index % 9) * .075;
      points.push(Math.cos(angle) * radius, Math.sin(angle) * radius * .62, ((index % 5) - 2) * .06);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    return geometry;
  }, [quality]);

  useEffect(() => () => { trailGeometry.dispose(); structureGeometry.dispose(); intelligenceGeometry.dispose(); }, [trailGeometry, structureGeometry, intelligenceGeometry]);

  useFrame(({ camera, clock }) => {
    const progress = experienceState.progress;
    const sparkPhase = range(progress, 0, .18);
    const construction = range(progress, .12, .48);
    const environment = range(progress, .42, .68);
    const mediaFocus = range(progress, .54, .61);
    const data = range(progress, .79, .855) * (1 - range(progress, .865, .94));
    const memory = range(progress, .90, .97);
    const time = clock.getElapsedTime();
    const finalSparkX = quality === "lite" ? -.62 : -.72;
    // The DOM spark and guided paths take ownership of the early beats. The
    // WebGL version stays a restrained depth layer, then returns subtly for
    // the memory state instead of remaining as a giant diagram over media.
    const sparkPresence = Math.max((1 - range(progress, .27, .42)) * .42, range(progress, .875, .945) * .34);
    const trailPresence = (1 - range(progress, .25, .42)) * .56;
    const structurePresence = range(progress, .12, .37) * (1 - range(progress, .38, .54));
    pointerTarget.current.set(experienceState.pointerX, experienceState.pointerY);
    smoothPointer.current.lerp(pointerTarget.current, .045);
    const pointerX = smoothPointer.current.x * .008;
    const pointerY = smoothPointer.current.y * .006;

    // The scroll path owns the camera. Pointer input only adds a tiny depth offset.
    camera.position.set(0.05 + environment * .1 + pointerX, .04 + pointerY, 3.05 - environment * .62);
    camera.lookAt(0, -.06 + environment * -.08, 0);

    if (spark.current) {
      const forwardX = -1.28 + sparkPhase * 1.86;
      spark.current.position.set(THREE.MathUtils.lerp(forwardX, finalSparkX, memory), -.12 + sparkPhase * .17 * (1 - memory) + Math.sin(time * 1.6) * .018, .08);
      spark.current.visible = sparkPresence > .002;
      spark.current.scale.setScalar((.46 + sparkPhase * .54 + construction * .06) * (1 - memory * .55));
    }
    if (sparkCoreMaterial.current) sparkCoreMaterial.current.opacity = sparkPresence;
    if (sparkHaloMaterial.current) sparkHaloMaterial.current.opacity = sparkPresence * .16;
    if (trail.current) {
      const vertexCount = trail.current.geometry.getAttribute("position").count;
      trail.current.geometry.setDrawRange(0, Math.max(2, Math.floor(vertexCount * sparkPhase)));
      const material = trail.current.material as THREE.LineBasicMaterial;
      material.opacity = (.04 + sparkPhase * .42) * trailPresence;
    }
    if (structure.current) {
      const vertexCount = structure.current.geometry.getAttribute("position").count;
      structure.current.geometry.setDrawRange(0, Math.max(2, Math.floor(vertexCount * construction)));
      const material = structure.current.material as THREE.LineBasicMaterial;
      material.opacity = (.035 + construction * .24) * structurePresence;
    }
    if (grid.current) {
      const materials = Array.isArray(grid.current.material) ? grid.current.material : [grid.current.material];
      materials.forEach((material) => {
        const transparentMaterial = material as THREE.Material & { opacity: number; transparent: boolean };
        transparentMaterial.transparent = true;
        transparentMaterial.opacity = (construction * .09 + environment * .035) * (1 - range(progress, .36, .52));
      });
      grid.current.scale.setScalar(.8 + construction * .2);
    }
    if (eventEnvironment.current) {
      const scale = .16 + environment * .84;
      eventEnvironment.current.scale.setScalar(scale);
      eventEnvironment.current.position.y = .12 - environment * .12;
    }
    planes.current?.traverse((object) => {
      const material = (object as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
      if (material) material.opacity = range(construction, .2, .62) * .08 * (1 - range(progress, .36, .52));
    });
    eventEnvironment.current?.traverse((object) => {
      const material = (object as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
      if (material) material.opacity = environment * (object.position.y < -.4 ? .66 : .42) * (1 - mediaFocus * .99);
    });
    if (intelligence.current) {
      intelligence.current.rotation.z = time * .08;
      intelligence.current.rotation.y = smoothPointer.current.x * .02;
      intelligence.current.scale.setScalar(Math.max(.12, .45 + data * .9 - memory * .42));
      intelligence.current.position.set(finalSparkX * memory, .04, .1);
    }
    if (intelligenceMaterial.current) intelligenceMaterial.current.opacity = data * (1 - memory) * .82;
    if (memoryCore.current) {
      memoryCore.current.position.set(finalSparkX, -.02, .1);
      memoryCore.current.scale.setScalar(.05 + memory * (quality === "lite" ? .32 : .44));
      const material = memoryCore.current.material as THREE.MeshBasicMaterial;
      material.opacity = memory * .9;
    }
  });

  return (
    <group>
      <ambientLight intensity={.8} />
      <group ref={spark}>
        <mesh><sphereGeometry args={[.055, quality === "full" ? 20 : 12, quality === "full" ? 20 : 12]} /><meshBasicMaterial ref={sparkCoreMaterial} color="#145eff" transparent opacity={0} /></mesh>
        <mesh scale={2.2}><sphereGeometry args={[.055, 16, 16]} /><meshBasicMaterial ref={sparkHaloMaterial} color="#91b5ff" transparent opacity={0} depthWrite={false} /></mesh>
      </group>
      <lineSegments ref={trail} geometry={trailGeometry}><lineBasicMaterial color="#145eff" transparent opacity={0} depthWrite={false} /></lineSegments>
      <lineSegments ref={structure} geometry={structureGeometry}><lineBasicMaterial color="#286cff" transparent opacity={0} depthWrite={false} /></lineSegments>
      <gridHelper ref={grid} args={[3.3, quality === "full" ? 14 : 9, "#7aa0ff", "#d4e0fa"]} position={[0, -.71, .2]} />

      {/* Planes materialise just after their framing lines are drawn. */}
      <group ref={planes}>{[[[-.68, .03, -.14], [.54, .5]], [[.02, .18, -.2], [.48, .88]], [[.72, -.02, -.1], [.48, .62]]].map(([position, size], index) => (
        <mesh key={index} position={position as [number, number, number]}><planeGeometry args={size as [number, number]} /><meshBasicMaterial color="#8eb0ff" transparent opacity={0} depthWrite={false} /></mesh>
      ))}</group>

      {/* The same construction resolves into a stage, screen, booths and audience zones. */}
      <group ref={eventEnvironment}>
        <mesh position={[0, -.47, .12]}><boxGeometry args={[2.7, .07, .88]} /><meshBasicMaterial color="#123b98" transparent opacity={0} /></mesh>
        <mesh position={[0, .06, -.34]}><boxGeometry args={[1.62, .92, .05]} /><meshBasicMaterial color="#286cff" transparent opacity={0} /></mesh>
        <mesh position={[-.92, .04, -.3]}><boxGeometry args={[.045, .98, .05]} /><meshBasicMaterial color="#8eb0ff" transparent opacity={0} /></mesh>
        <mesh position={[.92, .04, -.3]}><boxGeometry args={[.045, .98, .05]} /><meshBasicMaterial color="#8eb0ff" transparent opacity={0} /></mesh>
        <mesh position={[0, .56, -.3]}><boxGeometry args={[1.9, .045, .05]} /><meshBasicMaterial color="#8eb0ff" transparent opacity={0} /></mesh>
        <mesh position={[-1.18, -.1, .18]}><boxGeometry args={[.35, .5, .34]} /><meshBasicMaterial color="#dce8ff" transparent opacity={0} /></mesh>
        <mesh position={[1.18, -.1, .18]}><boxGeometry args={[.35, .5, .34]} /><meshBasicMaterial color="#dce8ff" transparent opacity={0} /></mesh>
        {[-.8, -.4, 0, .4, .8].slice(0, quality === "full" ? 5 : 3).map((x, index) => <mesh key={x} position={[x, -.32, .52 + (index % 2) * .12]}><sphereGeometry args={[.07, 10, 10]} /><meshBasicMaterial color="#145eff" transparent opacity={0} /></mesh>)}
      </group>
      <group ref={intelligence} position={[0, .04, .1]}>
        <points ref={intelligencePoints} geometry={intelligenceGeometry}><pointsMaterial ref={intelligenceMaterial} color="#145eff" size={quality === "full" ? .03 : .045} transparent opacity={0} sizeAttenuation /></points>
      </group>
      <mesh ref={memoryCore} position={[.12, .04, .12]}><sphereGeometry args={[.09, 18, 18]} /><meshBasicMaterial color="#145eff" transparent opacity={0} /></mesh>
    </group>
  );
}

class CanvasErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { if (process.env.NODE_ENV !== "production") console.warn("Mandegar immersive canvas fallback", error, info.componentStack); }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

function CanvasFallback() { return <div className="canvasFallback" data-webgl="fallback" aria-hidden="true"><span /><i /><b /></div>; }

export function ExperienceCanvas({ enabledByCms = true }: { enabledByCms?: boolean }) {
  const [runtime, setRuntime] = useState<RuntimeState>("pending");
  const [pageVisible, setPageVisible] = useState(true);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
      const supportsWebGL = Boolean(document.createElement("canvas").getContext("webgl"));
      const lite = window.matchMedia("(max-width: 760px)").matches || (navigator.hardwareConcurrency || 8) < 4;
      experienceState.quality = lite ? "lite" : "full";
      setRuntime(enabledByCms && !reduced && !saveData && supportsWebGL ? experienceState.quality : "fallback");
    });
    const onVisibilityChange = () => setPageVisible(document.visibilityState === "visible");
    const onPointerMove = (event: PointerEvent) => { experienceState.pointerX = (event.clientX / Math.max(window.innerWidth, 1) - .5) * 2; experienceState.pointerY = (event.clientY / Math.max(window.innerHeight, 1) - .5) * 2; };
    document.addEventListener("visibilitychange", onVisibilityChange); window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => { window.cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", onVisibilityChange); window.removeEventListener("pointermove", onPointerMove); experienceState.progress = 0; experienceState.pointerX = 0; experienceState.pointerY = 0; };
  }, [enabledByCms]);
  if (runtime === "pending" || runtime === "fallback") return <CanvasFallback />;
  return <CanvasErrorBoundary fallback={<CanvasFallback />}><Canvas className="experienceCanvas" data-experience-canvas="true" aria-hidden="true" dpr={runtime === "full" ? [1, 1.5] : [1, 1.15]} frameloop={pageVisible ? "always" : "never"} camera={{ position: [0, 0, 3.05], fov: 42 }} gl={{ alpha: true, antialias: runtime === "full", powerPreference: "low-power" }}><SparkScene quality={runtime} /></Canvas></CanvasErrorBoundary>;
}
