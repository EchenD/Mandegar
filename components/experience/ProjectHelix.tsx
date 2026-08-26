"use client";

import { Canvas, type ThreeEvent, useFrame, useLoader, useThree } from "@react-three/fiber";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import { localizedPath, type Locale } from "@/lib/i18n";
import styles from "./ProjectHelix.module.css";

type HelixProject = {
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  mediaSrc: string;
  isPlaceholder?: boolean;
};

const instructions: Record<Locale, string> = {
  fa: "برای حرکت در پروژه‌ها اسکرول کنید",
  en: "Scroll to move through the projects",
  ar: "مرّر للتنقل بين المشاريع",
};

const viewLabels: Record<Locale, string> = {
  fa: "مشاهده پروژه",
  en: "View project",
  ar: "عرض المشروع",
};

const sampleLabels: Record<Locale, string> = {
  fa: "نمونه مفهومی",
  en: "Concept sample",
  ar: "نموذج مفاهيمي",
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number) {
  const safe = clamp01(value);
  return safe * safe * (3 - 2 * safe);
}

const projectHoldDuration = 1;
const projectTransitionDuration = 0.38;

function getTimelineDuration(count: number) {
  return count * projectHoldDuration + Math.max(0, count - 1) * projectTransitionDuration;
}

/** Gives every project a full reading pause, including the first and last. */
function getHeldProgress(progress: number, count: number) {
  if (count <= 1) return 0;
  let timelinePosition = clamp01(progress) * getTimelineDuration(count);

  for (let index = 0; index < count; index += 1) {
    if (timelinePosition <= projectHoldDuration || index === count - 1) {
      return index / (count - 1);
    }
    timelinePosition -= projectHoldDuration;

    if (timelinePosition <= projectTransitionDuration) {
      const transition = smoothstep(timelinePosition / projectTransitionDuration);
      return (index + transition) / (count - 1);
    }
    timelinePosition -= projectTransitionDuration;
  }

  return 1;
}

function getProjectScrollProgress(index: number, count: number) {
  if (count <= 1) return 0;
  const projectStart = index * (projectHoldDuration + projectTransitionDuration);
  return (projectStart + projectHoldDuration / 2) / getTimelineDuration(count);
}

function ProjectPlane({
  index,
  count,
  texture,
  progress,
  onSelect,
}: {
  index: number;
  count: number;
  texture: THREE.Texture;
  progress: { current: number };
  onSelect: (index: number) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const imageMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const frameMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const hovered = useRef(false);
  const { size } = useThree();

  useEffect(() => () => {
    document.body.style.cursor = "";
  }, []);

  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    const mobile = size.width <= 760;
    const focus = index - progress.current * Math.max(1, count - 1);
    const angle = focus * (mobile ? 0.74 : 0.86);
    const distance = Math.min(2.5, Math.abs(focus));
    const targetX = Math.sin(angle) * (mobile ? 2.15 : 3.7);
    const targetY = -focus * (mobile ? 2.15 : 2.45);
    const targetZ = (Math.cos(angle) - 1) * (mobile ? 1.45 : 2.15);
    const targetScale = (mobile ? 0.64 : 1)
      * Math.max(0.62, 1.08 - distance * 0.2)
      * (hovered.current ? 1.035 : 1);
    const damping = 7.5;

    node.position.x = THREE.MathUtils.damp(node.position.x, targetX, damping, delta);
    node.position.y = THREE.MathUtils.damp(node.position.y, targetY, damping, delta);
    node.position.z = THREE.MathUtils.damp(node.position.z, targetZ, damping, delta);
    node.rotation.y = THREE.MathUtils.damp(node.rotation.y, -angle * 0.34, damping, delta);
    node.rotation.z = THREE.MathUtils.damp(node.rotation.z, -angle * 0.055, damping, delta);
    node.scale.setScalar(THREE.MathUtils.damp(node.scale.x, targetScale, damping, delta));

    const opacity = Math.max(0.08, 1 - distance * 0.38);
    if (imageMaterial.current) imageMaterial.current.opacity = opacity;
    if (frameMaterial.current) frameMaterial.current.opacity = opacity * 0.72;
  });

  const handlePointer = (event: ThreeEvent<PointerEvent>, active: boolean) => {
    event.stopPropagation();
    hovered.current = active;
    document.body.style.cursor = active ? "pointer" : "";
  };

  return (
    <group ref={group}>
      <mesh position={[0.08, -0.1, -0.12]} scale={[1.075, 1.11, 1]}>
        <planeGeometry args={[4.25, 2.7]} />
        <meshBasicMaterial color="#020306" transparent opacity={0.8} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, -0.04]} scale={[1.035, 1.055, 1]}>
        <planeGeometry args={[4.25, 2.7]} />
        <meshBasicMaterial ref={frameMaterial} color="#75d8ff" transparent opacity={0.5} depthWrite={false} />
      </mesh>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect(index);
        }}
        onPointerOver={(event) => handlePointer(event, true)}
        onPointerOut={(event) => handlePointer(event, false)}
      >
        <planeGeometry args={[4.2, 2.64]} />
        <meshBasicMaterial
          ref={imageMaterial}
          map={texture}
          color="#ffffff"
          transparent
          opacity={1}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function HelixScene({
  projects,
  progress,
  compositionDirection,
  onSelect,
}: {
  projects: HelixProject[];
  progress: { current: number };
  compositionDirection: 1 | -1;
  onSelect: (index: number) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const textures = useLoader(
    THREE.TextureLoader,
    projects.map((project) => project.mediaSrc),
  ) as THREE.Texture[];
  const preparedTextures = useMemo(() => textures.map((source) => {
    const texture = source.clone();
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
  }), [textures]);

  useEffect(() => () => {
    preparedTextures.forEach((texture) => texture.dispose());
  }, [preparedTextures]);

  const rail = useMemo(() => {
    const points = Array.from({ length: 181 }, (_, index) => {
      const focus = THREE.MathUtils.lerp(-3.2, 3.2, index / 180);
      const angle = focus * 0.86;
      return new THREE.Vector3(
        Math.sin(angle) * 3.7,
        -focus * 2.45,
        (Math.cos(angle) - 1) * 2.15 - 0.18,
      );
    });
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: "#225cff",
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    return new THREE.Line(geometry, material);
  }, []);

  useEffect(() => () => {
    rail.geometry.dispose();
    (rail.material as THREE.Material).dispose();
  }, [rail]);

  useFrame(({ pointer, size }, delta) => {
    if (!group.current) return;
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, pointer.y * 0.055, 5, delta);
    group.current.rotation.z = THREE.MathUtils.damp(group.current.rotation.z, -pointer.x * 0.045, 5, delta);
    group.current.position.x = THREE.MathUtils.damp(
      group.current.position.x,
      size.width <= 760 ? 0 : 1.35 * compositionDirection,
      5,
      delta,
    );
  });

  return (
    <>
      <color attach="background" args={["#090c12"]} />
      <fog attach="fog" args={["#090c12", 8, 17]} />
      <group ref={group}>
        <primitive object={rail} />
        {projects.map((project, index) => (
          <ProjectPlane
            key={project.slug}
            index={index}
            count={projects.length}
            texture={preparedTextures[index]}
            progress={progress}
            onSelect={onSelect}
          />
        ))}
      </group>
    </>
  );
}

export function ProjectHelix({ projects, locale }: { projects: HelixProject[]; locale: Locale }) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const frame = useRef<number | undefined>(undefined);
  const [visible, setVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const safeProjects = useMemo(() => projects.filter((project) => project.mediaSrc), [projects]);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setReducedMotion(preference.matches);
    syncPreference();
    preference.addEventListener("change", syncPreference);
    return () => preference.removeEventListener("change", syncPreference);
  }, []);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "150% 0px", threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || reducedMotion || safeProjects.length < 2) return;
    const syncProgress = () => {
      frame.current = undefined;
      const node = root.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const travel = Math.max(1, rect.height - window.innerHeight);
      const rawProgress = clamp01(-rect.top / travel);
      const nextProgress = getHeldProgress(rawProgress, safeProjects.length);
      progress.current = nextProgress;
      const nextIndex = Math.round(nextProgress * (safeProjects.length - 1));
      setActiveIndex((current) => current === nextIndex ? current : nextIndex);
    };
    const requestSync = () => {
      if (frame.current !== undefined) return;
      frame.current = window.requestAnimationFrame(syncProgress);
    };
    syncProgress();
    window.addEventListener("scroll", requestSync, { passive: true });
    window.addEventListener("resize", requestSync);
    return () => {
      window.removeEventListener("scroll", requestSync);
      window.removeEventListener("resize", requestSync);
      if (frame.current !== undefined) window.cancelAnimationFrame(frame.current);
    };
  }, [reducedMotion, safeProjects.length, visible]);

  if (safeProjects.length < 2 || reducedMotion) return null;
  const activeProject = safeProjects[activeIndex] ?? safeProjects[0];

  const seekProject = (index: number) => {
    const node = root.current;
    if (!node) return;
    const travel = Math.max(1, node.offsetHeight - window.innerHeight);
    const rootTop = node.getBoundingClientRect().top + window.scrollY;
    const targetProgress = getProjectScrollProgress(index, safeProjects.length);
    window.scrollTo({
      top: rootTop + travel * targetProgress,
      behavior: "smooth",
    });
  };

  return (
    <div
      ref={root}
      className={styles.root}
      data-project-helix
      style={{ "--project-scroll-height": `${Math.max(4, safeProjects.length + 2) * 100}svh` } as CSSProperties}
    >
      <div className={styles.sticky} data-project-helix-sticky>
        <div className={styles.canvas} aria-hidden="true">
          {visible ? (
            <Canvas
              camera={{ position: [0, 0, 8.4], fov: 44, near: 0.1, far: 40 }}
              dpr={[1, 1.35]}
              gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
            >
              <Suspense fallback={null}>
                <HelixScene
                  projects={safeProjects}
                  progress={progress}
                  compositionDirection={locale === "en" ? 1 : -1}
                  onSelect={(index) => router.push(localizedPath(locale, `projects/${safeProjects[index].slug}`))}
                />
              </Suspense>
            </Canvas>
          ) : null}
        </div>

        <div className={styles.interface}>
          <span className={styles.instruction}>{instructions[locale]}</span>
          <div className={styles.counter} aria-hidden="true">
            <strong>{String(activeIndex + 1).padStart(2, "0")}</strong>
            <span>/ {String(safeProjects.length).padStart(2, "0")}</span>
          </div>
          <div className={styles.projectNav} aria-label={locale === "en" ? "Choose a project" : locale === "ar" ? "اختر مشروعاً" : "انتخاب پروژه"}>
            {safeProjects.map((project, index) => (
              <button
                key={project.slug}
                type="button"
                data-active={index === activeIndex ? "true" : "false"}
                aria-label={project.title}
                onClick={() => seekProject(index)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
              </button>
            ))}
          </div>
          <div className={styles.projectCopy}>
            <div key={activeProject.slug} className={styles.projectCopyInner}>
              <div className={styles.projectMeta}>
                <small>{activeProject.eyebrow}</small>
                {activeProject.isPlaceholder ? <span>{sampleLabels[locale]}</span> : null}
              </div>
              <h3>{activeProject.title}</h3>
              <p>{activeProject.summary}</p>
              <Link prefetch={false} href={localizedPath(locale, `projects/${activeProject.slug}`)}>
                {viewLabels[locale]} ↗
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
