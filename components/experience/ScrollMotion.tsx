"use client";

import Lenis from "lenis";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type CSSProperties, useRef } from "react";
import { experienceState } from "./experience-state";
import { getPreviewProgress, getScenePhase, scenePhases, type ScenePhaseId } from "./scene-config";

gsap.registerPlugin(ScrollTrigger);

export function ScrollMotion({
  children,
  className,
  lenisEnabled = false,
  onPhaseChange,
}: {
  children: React.ReactNode;
  className?: string;
  lenisEnabled?: boolean;
  onPhaseChange?: (phase: ScenePhaseId) => void;
}) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const root = scope.current;
    if (!root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
    const supportsSmooth = window.matchMedia("(pointer: fine)").matches;
    let smooth: Lenis | undefined;
    let lenisTick: ((time: number) => void) | undefined;
    let lenisScroll: (() => void) | undefined;
    let activePhase: ScenePhaseId = "arrival";

    const syncExperience = (progress: number) => {
      const safeProgress = Math.min(1, Math.max(0, progress));
      const phase = getScenePhase(safeProgress);
      experienceState.progress = safeProgress;
      root.style.setProperty("--scene-progress", safeProgress.toFixed(4));
      root.dataset.storyStage = phase;
      if (phase !== activePhase) {
        activePhase = phase;
        onPhaseChange?.(phase);
      }
    };

    if (reduced || saveData) {
      root.dataset.reducedMotion = "true";
      syncExperience(scenePhases.find((phase) => phase.id === "reveal")?.preview ?? 0.465);
      return () => {
        experienceState.progress = 0;
        root.removeAttribute("data-story-stage");
      };
    }

    if (lenisEnabled && supportsSmooth) {
      smooth = new Lenis({ autoRaf: false, smoothWheel: true, syncTouch: false, lerp: 0.075 });
      lenisScroll = () => ScrollTrigger.update();
      smooth.on("scroll", lenisScroll);
      lenisTick = (time) => smooth?.raf(time * 1000);
      gsap.ticker.add(lenisTick);
    }

    const timeline = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: root,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.4,
        invalidateOnRefresh: true,
        onUpdate: (self) => syncExperience(self.progress),
      },
    });

    const seekExperience = (event: Event) => {
      const requested = (event as CustomEvent<{ progress?: number }>).detail?.progress;
      if (typeof requested !== "number") return;
      const progress = Math.min(1, Math.max(0, requested));
      const distance = Math.max(0, root.offsetHeight - window.innerHeight);
      const target = root.offsetTop + distance * progress;
      if (smooth) {
        smooth.scrollTo(target, { immediate: true, force: true });
      } else {
        const previousBehavior = document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = "auto";
        window.scrollTo({ top: target, behavior: "auto" });
        window.requestAnimationFrame(() => {
          document.documentElement.style.scrollBehavior = previousBehavior;
        });
      }
      syncExperience(progress);
      ScrollTrigger.update();
    };
    root.addEventListener("mandegar:seek", seekExperience);

    const copyRanges = Object.fromEntries(scenePhases
      .filter((phase) => phase.id !== "arrival")
      .map((phase) => {
        const span = phase.end - phase.start;
        return [phase.id, [
          phase.start + span * 0.04,
          phase.start + span * 0.24,
          phase.end - span * 0.2,
          phase.end,
        ]] as const;
      })) as Record<Exclude<ScenePhaseId, "arrival">, readonly [number, number, number, number]>;

    root.querySelectorAll<HTMLElement>("[data-scene-copy]").forEach((copy) => {
      const phase = copy.dataset.sceneCopy as Exclude<ScenePhaseId, "arrival">;
      const timing = copyRanges[phase];
      if (!timing) return;
      const [enterStart, enterEnd, exitStart, exitEnd] = timing;
      gsap.set(copy, { autoAlpha: 0, y: 18, scale: 0.985, filter: "blur(8px)", clipPath: "inset(0 0 100% 0)" });
      timeline
        .fromTo(copy, { autoAlpha: 0, y: 18, scale: 0.985, filter: "blur(8px)", clipPath: "inset(0 0 100% 0)" }, {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          filter: "blur(0px)",
          clipPath: "inset(0 0 0% 0)",
          duration: enterEnd - enterStart,
          ease: "sine.out",
        }, enterStart)
        .to(copy, { autoAlpha: 1, duration: exitStart - enterEnd }, enterEnd)
        .to(copy, {
          autoAlpha: 0,
          y: -12,
          scale: 1.006,
          filter: "blur(5px)",
          clipPath: "inset(100% 0 0 0)",
          duration: exitEnd - exitStart,
          ease: "sine.inOut",
        }, exitStart);
    });

    syncExperience(timeline.scrollTrigger?.progress ?? 0);
    ScrollTrigger.refresh();

    const preview = getPreviewProgress(new URLSearchParams(window.location.search).get("phase"));
    const previewFrame = preview === undefined ? 0 : window.requestAnimationFrame(() => {
      const distance = Math.max(0, root.offsetHeight - window.innerHeight);
      window.scrollTo({ top: root.offsetTop + distance * preview, behavior: "auto" });
      ScrollTrigger.update();
    });

    return () => {
      if (previewFrame) window.cancelAnimationFrame(previewFrame);
      if (lenisScroll) smooth?.off("scroll", lenisScroll);
      if (lenisTick) gsap.ticker.remove(lenisTick);
      smooth?.destroy();
      root.removeEventListener("mandegar:seek", seekExperience);
      experienceState.progress = 0;
      root.removeAttribute("data-story-stage");
    };
  }, { scope, dependencies: [lenisEnabled, onPhaseChange] });

  return (
    <div
      ref={scope}
      className={className}
      data-experience-root
      data-story-stage="arrival"
      style={{ "--scene-progress": 0 } as CSSProperties}
    >
      {children}
    </div>
  );
}
