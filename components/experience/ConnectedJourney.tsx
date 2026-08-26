"use client";

import { Canvas, type ThreeEvent, useFrame, useLoader, useThree } from "@react-three/fiber";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import * as THREE from "three";
import { localizedPath, type Locale } from "@/lib/i18n";
import { warpNarrativeProgress } from "./narrative-progress-curve";
import { getHeroHandoffProgress } from "./scene-config";
import {
  FinaleParticleWordmark,
  JourneyDepthField,
  ProcessParticleSculpture,
  type JourneyProgressRef,
} from "./JourneyParticles";
import styles from "./ConnectedJourney.module.css";

export type JourneyProject = {
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  mediaSrc: string;
  isPlaceholder?: boolean;
};

export type JourneyVoice = {
  quote: string;
  person: string;
  role: string;
  organization: string;
  isPlaceholder?: boolean;
};

export type JourneyClient = {
  name: string;
  logo?: string;
};

type JourneyCopy = {
  projectKicker: string;
  projectTitle: string;
  projectBody: string;
  viewProject: string;
  projectsEmpty: string;
  aboutKicker: string;
  aboutTitle: string;
  aboutBody: string;
  aboutLink: string;
  testimonialsKicker: string;
  testimonialsTitle: string;
  testimonialsPlaceholder: string;
  finalTitle: string;
  finalBody: string;
  finalCta: string;
};

type ConnectedJourneyProps = {
  locale: Locale;
  projects: JourneyProject[];
  voices: JourneyVoice[];
  clients: JourneyClient[];
  copy: JourneyCopy;
  aboutHref: string;
  ctaHref: string;
};

type ProcessItem = {
  label: string;
  shortLabel: string;
  description: string;
};

type JourneyStop = {
  id: string;
  kind: "project" | "process" | "voice" | "finale";
  itemIndex?: number;
};

const HOLD_DURATION = 0.76;
const TRANSITION_DURATION = 0.36;

const processCopy: Record<Locale, { instruction: string; system: string; conclusion: string; items: ProcessItem[] }> = {
  fa: {
    instruction: "برای کشف مسیر، روی هر بخش حرکت کنید",
    system: "یک مسیر یکپارچه",
    conclusion: "ماندگار ایده، فضا، فناوری و اجرا را به یک سیستم زنده تبدیل می‌کند.",
    items: [
      { label: "ایده", shortLabel: "جهت", description: "یک ایده روشن، تمام تصمیم‌هایی را که بعد از آن می‌آیند هم‌جهت می‌کند." },
      { label: "فضا", shortLabel: "محیط", description: "مکان به روایتی تبدیل می‌شود که مخاطب آن را قدم‌به‌قدم تجربه می‌کند." },
      { label: "فناوری", shortLabel: "تعامل", description: "رسانه و فناوری در خدمت مشارکت قرار می‌گیرند، نه فقط نمایش." },
      { label: "اجرا", shortLabel: "تحویل", description: "ایده اصلی از طراحی تا تولید و لحظه زنده، یکپارچه باقی می‌ماند." },
    ],
  },
  en: {
    instruction: "Hover or tap to inspect the process",
    system: "One connected process",
    conclusion: "Mandegar turns idea, space, technology and delivery into one living system.",
    items: [
      { label: "Idea", shortLabel: "Direction", description: "A clear creative idea aligns every decision that follows." },
      { label: "Space", shortLabel: "Environment", description: "The venue becomes a story people experience one step at a time." },
      { label: "Technology", shortLabel: "Interaction", description: "Media and technology serve participation, not spectacle alone." },
      { label: "Delivery", shortLabel: "Realisation", description: "The original idea remains intact through production and the live moment." },
    ],
  },
  ar: {
    instruction: "مرّر أو اضغط لاستكشاف المسار",
    system: "مسار واحد متكامل",
    conclusion: "تحوّل ماندگار الفكرة والمكان والتقنية والتنفيذ إلى نظام حي واحد.",
    items: [
      { label: "الفكرة", shortLabel: "الاتجاه", description: "فكرة إبداعية واضحة توحّد كل القرارات التي تليها." },
      { label: "المكان", shortLabel: "البيئة", description: "يتحوّل المكان إلى قصة يعيشها الجمهور خطوة بعد خطوة." },
      { label: "التقنية", shortLabel: "التفاعل", description: "تخدم الوسائط والتقنية المشاركة، لا الاستعراض وحده." },
      { label: "التنفيذ", shortLabel: "التحقيق", description: "تبقى الفكرة الأصلية حاضرة من التصميم حتى لحظة التنفيذ الحية." },
    ],
  },
};

const interfaceCopy: Record<Locale, {
  scroll: string;
  inspect: string;
  sample: string;
  approved: string;
  preview: string;
  previous: string;
  next: string;
  chooseVoice: string;
  projectNavigation: string;
}> = {
  fa: {
    scroll: "برای ادامه مسیر اسکرول کنید",
    inspect: "برای بررسی نزدیک‌تر حرکت کنید",
    sample: "نمونه مفهومی",
    approved: "فقط روایت‌های تأییدشده",
    preview: "پیش‌نمایش جایگاه محتوای تأییدشده",
    previous: "روایت قبلی",
    next: "روایت بعدی",
    chooseVoice: "انتخاب روایت مشتری",
    projectNavigation: "انتخاب پروژه",
  },
  en: {
    scroll: "Scroll to continue the journey",
    inspect: "Move to inspect the work",
    sample: "Concept sample",
    approved: "Approved voices only",
    preview: "Preview position for approved content",
    previous: "Previous voice",
    next: "Next voice",
    chooseVoice: "Choose a client voice",
    projectNavigation: "Choose a project",
  },
  ar: {
    scroll: "مرّر لمتابعة الرحلة",
    inspect: "تحرّك لاستكشاف العمل",
    sample: "نموذج مفاهيمي",
    approved: "آراء معتمدة فقط",
    preview: "معاينة لموضع المحتوى المعتمد",
    previous: "الرأي السابق",
    next: "الرأي التالي",
    chooseVoice: "اختر رأي عميل",
    projectNavigation: "اختر مشروعاً",
  },
};

const sampleVoices: Record<Locale, JourneyVoice[]> = {
  fa: [
    { quote: "اینجا روایت تأییدشده‌ای درباره وضوح ایده و مسیر خلاق قرار می‌گیرد.", person: "", role: "پیش‌نمایش چیدمان / ۰۱", organization: "", isPlaceholder: true },
    { quote: "این فضا برای روایت واقعی مشتری از همکاری، ارتباط و تصمیم‌گیری آماده است.", person: "", role: "پیش‌نمایش چیدمان / ۰۲", organization: "", isPlaceholder: true },
    { quote: "نتیجه‌ای که مشتری اجازه انتشار آن را داده، اینجا با نام و جایگاه واقعی نمایش داده می‌شود.", person: "", role: "پیش‌نمایش چیدمان / ۰۳", organization: "", isPlaceholder: true },
  ],
  en: [
    { quote: "An approved quote about creative clarity will take this position in the final content.", person: "", role: "Layout preview / 01", organization: "", isPlaceholder: true },
    { quote: "This space is ready for a real client account of collaboration, communication and decisions.", person: "", role: "Layout preview / 02", organization: "", isPlaceholder: true },
    { quote: "A client-approved outcome will appear here with the real person, role and organisation.", person: "", role: "Layout preview / 03", organization: "", isPlaceholder: true },
  ],
  ar: [
    { quote: "سيظهر هنا اقتباس معتمد عن وضوح الفكرة والاتجاه الإبداعي.", person: "", role: "معاينة التخطيط / ٠١", organization: "", isPlaceholder: true },
    { quote: "هذه المساحة جاهزة لرواية عميل حقيقية عن التعاون والتواصل واتخاذ القرار.", person: "", role: "معاينة التخطيط / ٠٢", organization: "", isPlaceholder: true },
    { quote: "ستظهر هنا نتيجة وافق العميل على نشرها مع الاسم والدور والجهة الحقيقية.", person: "", role: "معاينة التخطيط / ٠٣", organization: "", isPlaceholder: true },
  ],
};

const processNodePositions = [
  { x: 52, y: 17 },
  { x: 84, y: 28 },
  { x: 85, y: 62 },
  { x: 53, y: 82 },
];

const voiceNodePositions = [
  { x: 78, y: 18 },
  { x: 88, y: 46 },
  { x: 79, y: 75 },
  { x: 57, y: 17 },
  { x: 91, y: 78 },
  { x: 62, y: 82 },
];

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number) {
  const safe = clamp01(value);
  return safe * safe * (3 - 2 * safe);
}

function seededValue(index: number, offset: number) {
  const value = Math.sin(index * 12.9898 + offset * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function timelineDuration(count: number) {
  return count * HOLD_DURATION + Math.max(0, count - 1) * TRANSITION_DURATION;
}

function timelineState(progress: number, count: number) {
  if (count <= 1) return { cursor: 0, activeIndex: 0 };
  let remaining = clamp01(progress) * timelineDuration(count);
  for (let index = 0; index < count; index += 1) {
    if (remaining <= HOLD_DURATION || index === count - 1) {
      return { cursor: index, activeIndex: index };
    }
    remaining -= HOLD_DURATION;
    if (remaining <= TRANSITION_DURATION) {
      const transition = smoothstep(remaining / TRANSITION_DURATION);
      return {
        cursor: index + transition,
        activeIndex: transition < 0.5 ? index : index + 1,
      };
    }
    remaining -= TRANSITION_DURATION;
  }
  return { cursor: count - 1, activeIndex: count - 1 };
}

function stopProgress(index: number, count: number) {
  return (index * (HOLD_DURATION + TRANSITION_DURATION) + HOLD_DURATION * 0.5) / timelineDuration(count);
}

function ProjectPortal({
  project,
  texture,
  index,
  position,
  progress,
  entryProgress,
  projectStart,
  lastProjectStop,
  onInspect,
  onSelect,
}: {
  project: JourneyProject;
  texture: THREE.Texture;
  index: number;
  position: THREE.Vector3;
  progress: JourneyProgressRef;
  entryProgress: JourneyProgressRef;
  projectStart: number;
  lastProjectStop: number;
  onInspect: (index: number | null) => void;
  onSelect: (index: number) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const image = useRef<THREE.MeshBasicMaterial>(null);
  const frame = useRef<THREE.MeshBasicMaterial>(null);
  const shadow = useRef<THREE.MeshBasicMaterial>(null);
  const halo = useRef<THREE.PointsMaterial>(null);
  const hover = useRef({ x: 0, y: 0, active: false });
  const haloGeometry = useMemo(() => {
    const positions = new Float32Array(180 * 3);
    for (let particle = 0; particle < 180; particle += 1) {
      const edge = particle % 4;
      const along = seededValue(particle + index * 211, 7) * 2 - 1;
      const scatter = (seededValue(particle + index * 211, 8) - 0.5) * 0.24;
      positions[particle * 3] = edge < 2 ? along * 2.82 : (edge === 2 ? -2.78 : 2.78) + scatter;
      positions[particle * 3 + 1] = edge < 2 ? (edge === 0 ? -1.76 : 1.76) + scatter : along * 1.72;
      positions[particle * 3 + 2] = (seededValue(particle + index * 211, 9) - 0.5) * 0.42;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, [index]);

  useEffect(() => () => {
    document.body.style.cursor = "";
    haloGeometry.dispose();
  }, [haloGeometry]);

  useFrame(({ camera, clock }, delta) => {
    const node = group.current;
    if (!node) return;
    const projectCursor = progress.current - projectStart;
    const distance = Math.abs(projectCursor - index);
    const focus = 1 - smoothstep(clamp01((distance - 0.12) / 0.9));
    const entry = smoothstep(entryProgress.current);
    const exit = 1 - smoothstep(clamp01((progress.current - lastProjectStop) / 0.85));
    const opacity = Math.max(0.035, focus) * entry * exit;
    const activeLift = focus * 0.3 + (hover.current.active ? 0.18 : 0);
    const targetScale = (0.78 + focus * 0.34 + (hover.current.active ? 0.035 : 0)) * 0.78;

    node.position.x = THREE.MathUtils.damp(node.position.x, position.x, 6, delta);
    node.position.y = THREE.MathUtils.damp(node.position.y, position.y + activeLift, 6, delta);
    node.position.z = THREE.MathUtils.damp(
      node.position.z,
      position.z + focus * 0.18 - (1 - entry) * 2.4,
      6,
      delta,
    );
    node.quaternion.copy(camera.quaternion);
    node.rotateY(hover.current.x * 0.045);
    node.rotateX(hover.current.y * -0.035);
    node.rotateZ(Math.sin(clock.elapsedTime * 0.35 + index) * 0.002);
    node.scale.setScalar(THREE.MathUtils.damp(node.scale.x, targetScale, 7, delta));
    node.visible = opacity > 0.004;
    if (image.current) image.current.opacity = opacity;
    if (frame.current) frame.current.opacity = opacity * (0.35 + focus * 0.65);
    if (shadow.current) shadow.current.opacity = opacity * 0.8;
    if (halo.current) halo.current.opacity = opacity * (0.16 + focus * 0.52 + (hover.current.active ? 0.24 : 0));
  });

  const canInspect = () => Math.abs(progress.current - projectStart - index) < 0.62;

  return (
    <group ref={group} position={position.toArray()}>
      <mesh position={[0.08, -0.09, -0.14]} scale={[1.04, 1.08, 1]}>
        <planeGeometry args={[5.5, 3.45]} />
        <meshBasicMaterial ref={shadow} color="#02040a" transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, -0.045]} scale={[1.025, 1.045, 1]}>
        <planeGeometry args={[5.5, 3.45]} />
        <meshBasicMaterial ref={frame} color="#75d8ff" transparent opacity={0.5} depthWrite={false} />
      </mesh>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          if (canInspect()) onSelect(index);
        }}
        onPointerMove={(event: ThreeEvent<PointerEvent>) => {
          if (!canInspect()) return;
          event.stopPropagation();
          const uv = event.uv ?? new THREE.Vector2(0.5, 0.5);
          hover.current.x = (uv.x - 0.5) * 2;
          hover.current.y = (uv.y - 0.5) * 2;
        }}
        onPointerOver={(event) => {
          if (!canInspect()) return;
          event.stopPropagation();
          hover.current.active = true;
          document.body.style.cursor = "pointer";
          onInspect(index);
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          hover.current = { x: 0, y: 0, active: false };
          document.body.style.cursor = "";
          onInspect(null);
        }}
      >
        <planeGeometry args={[5.42, 3.36, 18, 12]} />
        <meshBasicMaterial
          ref={image}
          map={texture}
          color="#ffffff"
          transparent
          opacity={1}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, -1.92, 0]}>
        <boxGeometry args={[1.15, 0.025, 0.025]} />
        <meshBasicMaterial color={project.isPlaceholder ? "#d95cff" : "#75d8ff"} transparent opacity={0.72} />
      </mesh>
      <points geometry={haloGeometry} raycast={() => undefined}>
        <pointsMaterial
          ref={halo}
          color={project.isPlaceholder ? "#ffc78b" : "#75d8ff"}
          size={0.035}
          sizeAttenuation
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

function ProjectWorld({
  projects,
  positions,
  progress,
  entryProgress,
  projectStart,
  lastProjectStop,
  onInspect,
  onSelect,
}: {
  projects: JourneyProject[];
  positions: THREE.Vector3[];
  progress: JourneyProgressRef;
  entryProgress: JourneyProgressRef;
  projectStart: number;
  lastProjectStop: number;
  onInspect: (index: number | null) => void;
  onSelect: (index: number) => void;
}) {
  const sourceTextures = useLoader(THREE.TextureLoader, projects.map((project) => project.mediaSrc)) as THREE.Texture[];
  const textures = useMemo(() => sourceTextures.map((source) => {
    const texture = source.clone();
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
  }), [sourceTextures]);

  const route = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(positions, false, "catmullrom", 0.42);
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(Math.max(48, projects.length * 32)));
    const material = new THREE.LineBasicMaterial({ color: "#225cff", transparent: true, opacity: 0.42, depthWrite: false });
    return new THREE.Line(geometry, material);
  }, [positions, projects.length]);

  useEffect(() => () => {
    textures.forEach((texture) => texture.dispose());
    route.geometry.dispose();
    (route.material as THREE.Material).dispose();
  }, [route, textures]);

  return (
    <group>
      <primitive object={route} />
      {projects.map((project, index) => (
        <ProjectPortal
          key={project.slug}
          project={project}
          texture={textures[index]}
          index={index}
          position={positions[index]}
          progress={progress}
          entryProgress={entryProgress}
          projectStart={projectStart}
          lastProjectStop={lastProjectStop}
          onInspect={onInspect}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

function VoiceNode({
  index,
  position,
  centerZ,
  progress,
  voiceStart,
  finalStop,
  activeIndex,
}: {
  index: number;
  position: THREE.Vector3;
  centerZ: number;
  progress: JourneyProgressRef;
  voiceStart: number;
  finalStop: number;
  activeIndex: number;
}) {
  const group = useRef<THREE.Group>(null);
  const material = useRef<THREE.PointsMaterial>(null);
  const geometry = useMemo(() => {
    const positions = new Float32Array(120 * 3);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let particle = 0; particle < 120; particle += 1) {
      const normalized = (particle + 0.5) / 120;
      const y = 1 - normalized * 2;
      const radius = Math.sqrt(Math.max(0, 1 - y * y));
      const angle = particle * goldenAngle + index;
      const shell = 0.18 + seededValue(particle + index * 97, 12) * 0.16;
      positions[particle * 3] = Math.cos(angle) * radius * shell;
      positions[particle * 3 + 1] = y * shell;
      positions[particle * 3 + 2] = Math.sin(angle) * radius * shell;
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return result;
  }, [index]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }, delta) => {
    const node = group.current;
    if (!node) return;
    const enter = smoothstep(clamp01(progress.current - (voiceStart - 0.9)));
    const converge = smoothstep(clamp01(progress.current - (finalStop - 0.9)));
    const selected = activeIndex === index ? 1 : 0;
    const drift = Math.sin(clock.elapsedTime * 0.38 + index * 1.7) * 0.08 * (1 - converge);
    const targetX = THREE.MathUtils.lerp(position.x, 0, converge);
    const targetY = THREE.MathUtils.lerp(position.y + drift, 0, converge);
    const targetZ = THREE.MathUtils.lerp(position.z, centerZ, converge);
    node.position.x = THREE.MathUtils.damp(node.position.x, targetX, 6, delta);
    node.position.y = THREE.MathUtils.damp(node.position.y, targetY, 6, delta);
    node.position.z = THREE.MathUtils.damp(node.position.z, targetZ + selected * 0.35, 6, delta);
    node.scale.setScalar(THREE.MathUtils.damp(node.scale.x, (0.35 + enter * 0.65) * (1 + selected * 0.62), 7, delta));
    node.visible = enter > 0.003;
    if (material.current) {
      material.current.opacity = enter * (0.34 + selected * 0.66) * (1 - converge);
      material.current.size = 0.028 + selected * 0.018 + converge * 0.01;
    }
  });

  return (
    <group ref={group} position={position.toArray()}>
      <points geometry={geometry} raycast={() => undefined}>
        <pointsMaterial
          ref={material}
          color={activeIndex === index ? "#dff5ff" : "#75d8ff"}
          size={0.028}
          sizeAttenuation
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

function ClientConstellation({
  count,
  centerZ,
  progress,
  voiceStart,
  finalStop,
  activeIndex,
  compositionDirection,
}: {
  count: number;
  centerZ: number;
  progress: JourneyProgressRef;
  voiceStart: number;
  finalStop: number;
  activeIndex: number;
  compositionDirection: 1 | -1;
}) {
  const positions = useMemo(() => Array.from({ length: count }, (_, index) => {
    const point = voiceNodePositions[index % voiceNodePositions.length];
    return new THREE.Vector3(compositionDirection * (point.x - 50) * 0.075, (50 - point.y) * 0.052, centerZ + ((index % 3) - 1) * 0.5);
  }), [centerZ, compositionDirection, count]);
  const lines = useMemo(() => {
    const points = positions.flatMap((position) => [new THREE.Vector3(0, 0, centerZ), position]);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: "#225cff", transparent: true, opacity: 0, depthWrite: false });
    return new THREE.LineSegments(geometry, material);
  }, [centerZ, positions]);

  useEffect(() => () => {
    lines.geometry.dispose();
    (lines.material as THREE.Material).dispose();
  }, [lines]);

  useFrame((_, delta) => {
    const enter = smoothstep(clamp01(progress.current - (voiceStart - 0.9)));
    const converge = smoothstep(clamp01(progress.current - (finalStop - 0.9)));
    const material = lines.material as THREE.LineBasicMaterial;
    // Three.js materials are intentionally updated per frame outside React's render cycle.
    // eslint-disable-next-line react-hooks/immutability
    material.opacity = THREE.MathUtils.damp(
      material.opacity,
      enter * (1 - converge) * 0.18,
      6,
      delta,
    );
  });

  return (
    <group>
      <primitive object={lines} />
      {positions.map((position, index) => (
        <VoiceNode
          key={index}
          index={index}
          position={position}
          centerZ={centerZ}
          progress={progress}
          voiceStart={voiceStart}
          finalStop={finalStop}
          activeIndex={activeIndex}
        />
      ))}
    </group>
  );
}

function JourneyScene({
  projects,
  voiceCount,
  progress,
  entryProgress,
  projectStart,
  processStart,
  voiceStart,
  finalStop,
  activeProcess,
  activeVoice,
  compositionDirection,
  onProjectInspect,
  onProjectSelect,
}: {
  projects: JourneyProject[];
  voiceCount: number;
  progress: JourneyProgressRef;
  entryProgress: JourneyProgressRef;
  projectStart: number;
  processStart: number;
  voiceStart: number;
  finalStop: number;
  activeProcess: number;
  activeVoice: number;
  compositionDirection: 1 | -1;
  onProjectInspect: (index: number | null) => void;
  onProjectSelect: (index: number) => void;
}) {
  const { camera, scene, size } = useThree();
  const target = useRef(new THREE.Vector3());
  const darkBackground = useMemo(() => new THREE.Color("#080b10"), []);
  const projectPositions = useMemo(() => projects.map((_, index) => {
    const curveOffset = 1.8 + Math.sin(index * 0.92) * 0.65;
    return new THREE.Vector3(compositionDirection * curveOffset, Math.sin(index * 0.72) * 0.62, -index * 7);
  }), [compositionDirection, projects]);
  const cameraPoints = useMemo(() => {
    const points = projectPositions.map((position, index) => new THREE.Vector3(
      position.x * -0.23 + compositionDirection * Math.sin(index * 0.8) * 0.55,
      position.y + 0.18,
      position.z + (size.width <= 760 ? 7.4 : 5.7),
    ));
    if (points.length === 1) points.push(points[0].clone().add(new THREE.Vector3(0, 0, -0.01)));
    if (!points.length) points.push(new THREE.Vector3(0, 0, 7), new THREE.Vector3(0, 0, 6.99));
    return points;
  }, [compositionDirection, projectPositions, size.width]);
  const cameraCurve = useMemo(() => new THREE.CatmullRomCurve3(cameraPoints, false, "catmullrom", 0.5), [cameraPoints]);
  const targetPoints = useMemo(() => {
    const points = projectPositions.length
      ? projectPositions.map((position) => position.clone().add(new THREE.Vector3(-compositionDirection * 1.85, 0, 0)))
      : [new THREE.Vector3(0, 0, 0)];
    if (points.length === 1) return [points[0], points[0].clone().add(new THREE.Vector3(0, 0, -0.01))];
    return points;
  }, [compositionDirection, projectPositions]);
  const targetCurve = useMemo(() => new THREE.CatmullRomCurve3(targetPoints, false, "catmullrom", 0.5), [targetPoints]);
  const lastProjectStop = projectStart + Math.max(0, projects.length - 1);
  const coreZ = -(Math.max(1, projects.length) - 1) * 7 - 8.5;
  const constellationZ = coreZ - 9;

  useFrame(({ pointer }, delta) => {
    const cursor = progress.current;
    const projectCursor = clamp01((cursor - projectStart) / Math.max(1, projects.length - 1));
    const pathPosition = cameraCurve.getPointAt(projectCursor);
    const pathTarget = targetCurve.getPointAt(projectCursor);
    pathPosition.z += (1 - entryProgress.current) * 4.2;

    const coreMix = smoothstep(clamp01(cursor - lastProjectStop));
    const voiceMix = smoothstep(clamp01(cursor - (voiceStart - 1)));
    const coreCamera = new THREE.Vector3(size.width <= 760 ? 0 : 0.4, 0.1, coreZ + (size.width <= 760 ? 9.6 : 7.6));
    const voiceCamera = new THREE.Vector3(0, 0, constellationZ + (size.width <= 760 ? 10.2 : 8.2));
    const coreTarget = new THREE.Vector3(0, 0, coreZ);
    const voiceTarget = new THREE.Vector3(0, 0, constellationZ);
    const desiredPosition = pathPosition.clone().lerp(coreCamera, coreMix).lerp(voiceCamera, voiceMix);
    const desiredTarget = pathTarget.clone().lerp(coreTarget, coreMix).lerp(voiceTarget, voiceMix);
    desiredPosition.x += pointer.x * (size.width <= 760 ? 0 : 0.16);
    desiredPosition.y += pointer.y * (size.width <= 760 ? 0 : 0.08);

    camera.position.lerp(desiredPosition, 1 - Math.exp(-delta * 4.8));
    target.current.lerp(desiredTarget, 1 - Math.exp(-delta * 5.4));
    camera.lookAt(target.current);
    if (scene.background instanceof THREE.Color) scene.background.copy(darkBackground);
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(darkBackground);
  });

  return (
    <>
      <color attach="background" args={["#080b10"]} />
      <fog attach="fog" args={["#080b10", 8, 92]} />
      <ambientLight intensity={0.62} color="#a9c8ff" />
      <directionalLight position={[5, 8, 8]} intensity={1.25} color="#f7f7f4" />
      <pointLight position={[-4, 2, coreZ + 3]} intensity={11} distance={16} color="#225cff" />
      <pointLight position={[4, -1, constellationZ + 2]} intensity={8} distance={15} color="#50c7ff" />
      <JourneyDepthField progress={progress} entryProgress={entryProgress} />
      {projects.length ? (
        <ProjectWorld
          projects={projects}
          positions={projectPositions}
          progress={progress}
          entryProgress={entryProgress}
          projectStart={projectStart}
          lastProjectStop={lastProjectStop}
          onInspect={onProjectInspect}
          onSelect={onProjectSelect}
        />
      ) : null}
      <ProcessParticleSculpture
        centerZ={coreZ}
        progress={progress}
        processStart={processStart}
        voiceStart={voiceStart}
        activeIndex={activeProcess}
        offsetX={compositionDirection * 0.72}
        direction={compositionDirection}
      />
      <ClientConstellation
        count={voiceCount}
        centerZ={constellationZ}
        progress={progress}
        voiceStart={voiceStart}
        finalStop={finalStop}
        activeIndex={activeVoice}
        compositionDirection={compositionDirection}
      />
      <FinaleParticleWordmark centerZ={constellationZ} progress={progress} finalStop={finalStop} />
    </>
  );
}

type JourneyStyle = CSSProperties & {
  "--journey-scroll-height": string;
};

type NodeStyle = CSSProperties & {
  "--node-x": string;
  "--node-y": string;
};

export function ConnectedJourney({
  locale,
  projects,
  voices,
  clients,
  copy,
  aboutHref,
  ctaHref,
}: ConnectedJourneyProps) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const entryProgress = useRef(0);
  const frame = useRef<number | undefined>(undefined);
  const [motionMode, setMotionMode] = useState<"pending" | "full" | "reduced">("pending");
  const [nearViewport, setNearViewport] = useState(false);
  const [activeStopIndex, setActiveStopIndex] = useState(0);
  const [inspectedProject, setInspectedProject] = useState<number | null>(null);
  const [inspectedProcess, setInspectedProcess] = useState<number | null>(null);
  const [inspectedVoice, setInspectedVoice] = useState<number | null>(null);
  const safeProjects = useMemo(() => projects.filter((project) => project.mediaSrc), [projects]);
  const displayVoices = useMemo(() => voices.length ? voices : sampleVoices[locale], [locale, voices]);
  const stops = useMemo<JourneyStop[]>(() => [
    ...safeProjects.map((project, index) => ({ id: `project-${project.slug}`, kind: "project" as const, itemIndex: index })),
    ...processCopy[locale].items.map((item, index) => ({ id: `process-${item.label}`, kind: "process" as const, itemIndex: index })),
    ...displayVoices.map((_, index) => ({ id: `voice-${index}`, kind: "voice" as const, itemIndex: index })),
    { id: "finale", kind: "finale" },
  ], [displayVoices, locale, safeProjects]);
  const projectStart = 0;
  const processStart = projectStart + safeProjects.length;
  const voiceStart = processStart + processCopy[locale].items.length;
  const finalStop = stops.length - 1;
  const activeStop = stops[Math.min(activeStopIndex, stops.length - 1)] ?? stops[0];
  const scrollProjectIndex = activeStop.kind === "project"
    ? activeStop.itemIndex ?? 0
    : activeStopIndex < projectStart ? 0 : Math.max(0, safeProjects.length - 1);
  const activeProjectIndex = Math.min(safeProjects.length - 1, inspectedProject ?? Math.round(scrollProjectIndex));
  const scrollProcessIndex = activeStop.kind === "process"
    ? activeStop.itemIndex ?? 0
    : activeStopIndex < processStart ? 0 : 3;
  const activeProcessIndex = Math.min(3, inspectedProcess ?? scrollProcessIndex);
  const scrollVoiceIndex = activeStop.kind === "voice" ? activeStop.itemIndex ?? 0 : 0;
  const activeVoiceIndex = Math.min(displayVoices.length - 1, inspectedVoice ?? scrollVoiceIndex);
  const activeProject = safeProjects[Math.max(0, activeProjectIndex)];
  const activeProcess = processCopy[locale].items[activeProcessIndex];
  const activeVoice = displayVoices[Math.max(0, activeVoiceIndex)];
  const ui = interfaceCopy[locale];
  const isProjectActive = activeStop.kind === "project";
  const isProcessActive = activeStop.kind === "process";
  const isVoiceActive = activeStop.kind === "voice";

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setMotionMode(preference.matches ? "reduced" : "full");
    syncPreference();
    preference.addEventListener("change", syncPreference);
    return () => preference.removeEventListener("change", syncPreference);
  }, []);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setNearViewport(entry.isIntersecting), { rootMargin: "400% 0px", threshold: 0 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (motionMode !== "full") return;
    const sync = () => {
      frame.current = undefined;
      const node = root.current;
      if (!node) return;
      const bounds = node.getBoundingClientRect();
      const entryLead = window.innerHeight;
      const travel = Math.max(1, node.offsetHeight - window.innerHeight - entryLead);
      const rawProgress = clamp01((-bounds.top - entryLead) / travel);
      const hero = document.querySelector<HTMLElement>("[data-experience-root]");
      const heroTravel = Math.max(1, (hero?.offsetHeight ?? window.innerHeight) - window.innerHeight);
      const heroNativeProgress = hero
        ? clamp01((window.scrollY - hero.offsetTop) / heroTravel)
        : 1;
      const nextEntryProgress = bounds.top <= -entryLead
        ? 1
        : getHeroHandoffProgress(warpNarrativeProgress(heroNativeProgress));
      const journeyReveal = smoothstep(nextEntryProgress);
      const next = timelineState(rawProgress, stops.length);
      progress.current = next.cursor;
      entryProgress.current = nextEntryProgress;
      node.style.setProperty("--journey-cursor", next.cursor.toFixed(4));
      node.style.setProperty("--journey-entry", nextEntryProgress.toFixed(4));
      node.style.setProperty("--journey-reveal", journeyReveal.toFixed(4));
      node.style.setProperty("--journey-progress", rawProgress.toFixed(4));
      setActiveStopIndex((current) => current === next.activeIndex ? current : next.activeIndex);
    };
    const requestSync = () => {
      setInspectedProject(null);
      if (frame.current !== undefined) return;
      frame.current = window.requestAnimationFrame(sync);
    };
    sync();
    window.addEventListener("scroll", requestSync, { passive: true });
    window.addEventListener("resize", requestSync);
    return () => {
      window.removeEventListener("scroll", requestSync);
      window.removeEventListener("resize", requestSync);
      if (frame.current !== undefined) window.cancelAnimationFrame(frame.current);
    };
  }, [motionMode, stops.length]);

  const seekStop = useCallback((index: number) => {
    const node = root.current;
    if (!node || motionMode !== "full") return;
    const entryLead = window.innerHeight;
    const travel = Math.max(1, node.offsetHeight - window.innerHeight - entryLead);
    const top = node.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + entryLead + travel * stopProgress(index, stops.length), behavior: "smooth" });
  }, [motionMode, stops.length]);

  const chooseProcess = (index: number, seek = false) => {
    setInspectedProcess(index);
    if (seek) seekStop(processStart + index);
  };

  const chooseVoice = (index: number, seek = false) => {
    setInspectedVoice(index);
    if (seek) seekStop(voiceStart + index);
  };

  const moveVoice = (direction: number) => {
    const next = (activeVoiceIndex + direction + displayVoices.length) % displayVoices.length;
    chooseVoice(next, motionMode === "full");
  };

  const selectProject = useCallback((index: number) => {
    const project = safeProjects[index];
    if (project) router.push(localizedPath(locale, `projects/${project.slug}`));
  }, [locale, router, safeProjects]);

  return (
    <div
      ref={root}
      className={styles.root}
      data-post-experience
      data-connected-journey
      data-project-helix
      data-motion={motionMode}
      data-journey-stage={activeStop.kind}
      style={{ "--journey-scroll-height": `${Math.max(8, timelineDuration(stops.length)) * 100}svh` } as JourneyStyle}
    >
      <div className={styles.sticky}>
        <div className={styles.projectExperience}>
          <div className={styles.projectViewport} data-project-helix-sticky>
            <div className={styles.canvas} aria-hidden="true">
              {motionMode === "full" && nearViewport ? (
                <Canvas
                  camera={{ position: [0, 0, 11], fov: 43, near: 0.1, far: 140 }}
                  dpr={[1, 1.4]}
                  gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
                >
                  <Suspense fallback={null}>
                    <JourneyScene
                      projects={safeProjects}
                      voiceCount={Math.max(displayVoices.length, clients.length, 3)}
                      progress={progress}
                      entryProgress={entryProgress}
                      projectStart={projectStart}
                      processStart={processStart}
                      voiceStart={voiceStart}
                      finalStop={finalStop}
                      activeProcess={activeProcessIndex}
                      activeVoice={activeVoiceIndex}
                      compositionDirection={locale === "en" ? 1 : -1}
                      onProjectInspect={setInspectedProject}
                      onProjectSelect={selectProject}
                    />
                  </Suspense>
                </Canvas>
              ) : null}
            </div>

            <div className={styles.atmosphericWash} aria-hidden="true" />
            <section className={styles.projectLayer} data-active={isProjectActive ? "true" : "false"} aria-labelledby="journey-project-title">
              <div className={styles.chapterIntro}>
                <span>{copy.projectKicker}</span>
                <p>{copy.projectBody}</p>
              </div>
              {activeProject ? (
                <article key={activeProject.slug} className={styles.projectCopy}>
                  <div>
                    <span>{String(activeProjectIndex + 1).padStart(2, "0")} / {String(safeProjects.length).padStart(2, "0")}</span>
                    <small>{activeProject.eyebrow}</small>
                    {activeProject.isPlaceholder ? <em>{ui.sample}</em> : null}
                  </div>
                  <h3 id="journey-project-title">{activeProject.title}</h3>
                  <p>{activeProject.summary}</p>
                  <Link href={localizedPath(locale, `projects/${activeProject.slug}`)}>{copy.viewProject} <span aria-hidden="true">↗</span></Link>
                </article>
              ) : (
                <p className={styles.emptyProjects}>{copy.projectsEmpty}</p>
              )}
            </section>

            <div
              className={styles.projectNav}
              data-active={isProjectActive ? "true" : "false"}
              role="group"
              aria-label={ui.projectNavigation}
            >
              {safeProjects.map((project, index) => (
                <button
                  key={project.slug}
                  type="button"
                  data-active={isProjectActive && index === activeProjectIndex ? "true" : "false"}
                  aria-label={project.title}
                  onClick={() => seekStop(projectStart + index)}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </button>
              ))}
            </div>

            <div className={styles.reducedProjects} aria-labelledby="reduced-projects-title">
              <span>{copy.projectKicker}</span>
              <h2 id="reduced-projects-title">{copy.projectTitle}</h2>
              <p>{copy.projectBody}</p>
              <div>
                {safeProjects.map((project, index) => (
                  <Link key={project.slug} href={localizedPath(locale, `projects/${project.slug}`)}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{project.title}</strong>
                    <small>{project.eyebrow}</small>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <section
          className={`${styles.layer} ${styles.aboutLayer}`}
          data-about-system
          data-active={isProcessActive ? "true" : "false"}
          aria-labelledby="home-about-title"
        >
          <header className={styles.aboutIntro}>
            <span>{copy.aboutKicker}</span>
            <h2 id="home-about-title">{copy.aboutTitle}</h2>
            <p>{copy.aboutBody}</p>
          </header>
          <span className={styles.processInstruction}>{processCopy[locale].instruction}</span>
          <div className={styles.processDetail}>
            <span>{String(activeProcessIndex + 1).padStart(2, "0")} / 04 · {activeProcess.shortLabel}</span>
            {motionMode !== "full" || isProcessActive ? <h3>{activeProcess.label}</h3> : null}
            <p>{activeProcess.description}</p>
          </div>
          <div className={styles.processNodes} role="group" aria-label={processCopy[locale].system}>
            {processCopy[locale].items.map((item, index) => {
              const position = processNodePositions[index];
              const nodeX = locale === "en" ? position.x : 100 - position.x;
              return (
                <button
                  key={item.label}
                  type="button"
                  style={{ "--node-x": `${nodeX}%`, "--node-y": `${position.y}%` } as NodeStyle}
                  data-active={index === activeProcessIndex ? "true" : "false"}
                  aria-pressed={index === activeProcessIndex}
                  onPointerEnter={() => chooseProcess(index)}
                  onPointerLeave={() => setInspectedProcess(null)}
                  onFocus={() => chooseProcess(index)}
                  onClick={() => chooseProcess(index, true)}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{item.label}</strong>
                  <small>{item.shortLabel}</small>
                </button>
              );
            })}
          </div>
          <div className={styles.processConclusion}>
            <p>{processCopy[locale].conclusion}</p>
            <Link href={aboutHref}>{copy.aboutLink} <span aria-hidden="true">↗</span></Link>
          </div>
        </section>

        <section
          className={`${styles.layer} ${styles.voicesLayer}`}
          data-client-voices
          data-empty={voices.length ? "false" : "true"}
          data-active={isVoiceActive ? "true" : "false"}
          aria-labelledby="home-testimonials-title"
        >
          <header className={styles.voicesIntro}>
            <span>{copy.testimonialsKicker}</span>
            <h2 id="home-testimonials-title">{copy.testimonialsTitle}</h2>
            <small><i /> {ui.approved}</small>
          </header>
          <article key={`${activeVoice.role}-${activeVoiceIndex}`} className={styles.voiceCopy} data-sample={activeVoice.isPlaceholder ? "true" : "false"}>
            <span aria-hidden="true">“</span>
            <blockquote>{activeVoice.quote || copy.testimonialsPlaceholder}</blockquote>
            <footer>
              <strong>{activeVoice.person || (activeVoice.isPlaceholder ? ui.preview : "")}</strong>
              <small>{[activeVoice.role, activeVoice.organization].filter(Boolean).join(" / ")}</small>
            </footer>
          </article>
          <div className={styles.clientNodes} role="group" aria-label={ui.chooseVoice}>
            {displayVoices.map((voice, index) => {
              const client = clients[index % Math.max(1, clients.length)];
              const point = voiceNodePositions[index % voiceNodePositions.length];
              const nodeX = locale === "en" ? point.x : 100 - point.x;
              const label = client?.name || voice.organization || voice.person || `${locale === "en" ? "Voice" : locale === "fa" ? "روایت" : "رأي"} ${index + 1}`;
              return (
                <button
                  key={`${label}-${index}`}
                  type="button"
                  style={{ "--node-x": `${nodeX}%`, "--node-y": `${point.y}%` } as NodeStyle}
                  data-active={index === activeVoiceIndex ? "true" : "false"}
                  aria-label={label}
                  onPointerEnter={() => chooseVoice(index)}
                  onPointerLeave={() => setInspectedVoice(null)}
                  onFocus={() => chooseVoice(index)}
                  onClick={() => chooseVoice(index, true)}
                >
                  <i aria-hidden="true" />
                  {client?.logo ? <Image src={client.logo} alt="" width={112} height={42} sizes="112px" /> : <span>{label}</span>}
                </button>
              );
            })}
          </div>
          <div className={styles.voiceControls}>
            <button type="button" onClick={() => moveVoice(-1)} aria-label={ui.previous}>←</button>
            <span>{String(activeVoiceIndex + 1).padStart(2, "0")} / {String(displayVoices.length).padStart(2, "0")}</span>
            <button type="button" onClick={() => moveVoice(1)} aria-label={ui.next}>→</button>
          </div>
        </section>

        <section className={`${styles.layer} ${styles.finaleLayer}`} data-active={activeStop.kind === "finale" ? "true" : "false"}>
          <div>
            <strong className={styles.finaleWordmark} aria-hidden="true">MANDEGAR</strong>
            <h2 className={styles.finaleHeading}>{copy.finalTitle}</h2>
            <Link href={ctaHref}>{copy.finalCta} <span aria-hidden="true">↗</span></Link>
          </div>
        </section>

        <div className={styles.journeyHud} aria-hidden="true">
          <span><i /> MANDEGAR / JOURNEY</span>
          <small>{ui.scroll}</small>
          <strong>{String(activeStopIndex + 1).padStart(2, "0")} / {String(stops.length).padStart(2, "0")}</strong>
        </div>
      </div>
    </div>
  );
}
