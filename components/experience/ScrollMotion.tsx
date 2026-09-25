"use client";

import Lenis from "lenis";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type CSSProperties, useRef } from "react";
import { experienceState } from "./experience-state";
import { directNarrative, resetNarrative } from "./narrative-director";
import { getNarrativeCopyTiming } from "./narrative-copy-timing";
import { warpNarrativeProgress } from "./narrative-progress-curve";
import {
  getNarrativePreview,
  narrativeScore,
  type ScenePhaseId,
} from "./narrative-score";
import { getHeroHandoffProgress, sceneTokens } from "./scene-config";

gsap.registerPlugin(ScrollTrigger);

type CopyState = {
  copy: HTMLElement;
  lines: HTMLElement[];
  phase: ScenePhaseId;
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function ease(value: number) {
  const safe = clamp01(value);
  return safe * safe * (3 - 2 * safe);
}

function rangeProgress(progress: number, start: number, end: number) {
  return clamp01((progress - start) / Math.max(0.0001, end - start));
}

function renderCopyState(state: CopyState, progress: number) {
  const phase = narrativeScore.find((item) => item.id === state.phase);
  if (!phase) return;
  const timing = getNarrativeCopyTiming(phase.id);
  let highestOpacity = 0;

  state.lines.forEach((line, index) => {
    const sequence = state.lines.length > 1 ? index / (state.lines.length - 1) : 0;
    const enterOffset = sequence * timing.enterStagger;
    const exitOffset = sequence * timing.exitStagger;
    const entered = ease(rangeProgress(progress, timing.enterStart + enterOffset, timing.enterEnd));
    const exited = ease(rangeProgress(progress, timing.exitStart + exitOffset, timing.exitEnd));
    const opacity = entered * (1 - exited);
    const y = (1 - entered) * 24 - exited * 15;
    const z = (1 - entered) * -78 + exited * 48;
    const blur = (1 - entered) * 11 + exited * 7;
    highestOpacity = Math.max(highestOpacity, opacity);
    line.style.opacity = opacity.toFixed(4);
    line.style.transform = `translate3d(0, ${y.toFixed(2)}px, ${z.toFixed(2)}px)`;
    line.style.filter = `blur(${blur.toFixed(2)}px)`;
    line.style.clipPath = exited > 0.001
      ? `inset(${(exited * 100).toFixed(2)}% 0 0 0)`
      : `inset(0 0 ${((1 - entered) * 100).toFixed(2)}% 0)`;
    line.style.visibility = opacity > 0.002 ? "visible" : "hidden";
  });

  state.copy.style.opacity = highestOpacity > 0.002 ? "1" : "0";
  state.copy.style.visibility = highestOpacity > 0.002 ? "visible" : "hidden";
}

export function ScrollMotion({
  children,
  className,
  enabled = true,
  lenisEnabled = false,
  onPhaseChange,
}: {
  children: React.ReactNode;
  className?: string;
  enabled?: boolean;
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
    const previousBehavior = document.documentElement.style.scrollBehavior;
    const preview = getNarrativePreview(new URLSearchParams(window.location.search).get("phase"));
    const phaseRail = root.querySelector<HTMLElement>("[data-phase-rail]");
    const scrollCue = root.querySelector<HTMLElement>("[data-scroll-cue]");
    const copyStates: CopyState[] = Array.from(root.querySelectorAll<HTMLElement>("[data-scene-copy]")).map((copy) => ({
      copy,
      lines: Array.from(copy.querySelectorAll<HTMLElement>("[data-copy-line]")),
      phase: copy.dataset.sceneCopy as ScenePhaseId,
    }));
    root.dataset.arrivalEnterProgress = getNarrativeCopyTiming("arrival").enterStart.toFixed(4);
    let smooth: Lenis | undefined;
    let lenisTick: ((time: number) => void) | undefined;
    let lenisScroll: (() => void) | undefined;
    let activePhase: ScenePhaseId = "arrival";

    const showPhaseRail = () => {
      if (root.dataset.scrollEngaged === "true") return;
      root.dataset.scrollEngaged = "true";
      phaseRail?.removeAttribute("inert");
      phaseRail?.setAttribute("aria-hidden", "false");
      scrollCue?.setAttribute("aria-hidden", "true");
    };

    root.dataset.scrollEngaged = "false";
    phaseRail?.setAttribute("inert", "");
    phaseRail?.setAttribute("aria-hidden", "true");
    scrollCue?.setAttribute("aria-hidden", "false");
    if (preview !== undefined) showPhaseRail();

    const getScrollDistance = () => Math.max(1, root.offsetHeight - window.innerHeight);
    const getNativeProgress = () => {
      return clamp01((window.scrollY - root.offsetTop) / getScrollDistance());
    };

    const syncNativePresentation = (nativeProgress: number) => {
      root.dataset.nativeProgress = nativeProgress.toFixed(4);
      root.dataset.copyProgress = nativeProgress.toFixed(4);
      root.style.setProperty("--scroll-progress", nativeProgress.toFixed(4));
      copyStates.forEach((state) => renderCopyState(state, nativeProgress));
    };

    const syncExperience = (progress: number) => {
      if (root.hasAttribute("data-interaction-active")) return;
      const timelineProgress = clamp01(progress);
      const nativeProgress = reduced || saveData ? timelineProgress : getNativeProgress();
      const safeProgress = reduced ? timelineProgress : warpNarrativeProgress(timelineProgress);
      const narrative = directNarrative(safeProgress);
      const phase = narrative.phase;
      root.dataset.narrativeProgress = safeProgress.toFixed(4);
      root.style.setProperty("--scene-progress", safeProgress.toFixed(4));
      root.style.setProperty("--hero-handoff", getHeroHandoffProgress(safeProgress).toFixed(4));
      root.dataset.storyStage = phase;
      const texturePeak = Math.max(
        experienceState.stage.production.environmentPeak,
        experienceState.stage.production.centralPeak,
        experienceState.stage.production.leftPeak,
        experienceState.stage.production.rightPeak,
      );
      root.dataset.uiTone = texturePeak > 0.42 ? "light" : "dark";
      const quietVignette = [219, 219, 216] as const;
      const peakVignette = [5, 7, 10] as const;
      const vignetteRgb = quietVignette.map((channel, index) => Math.round(
        channel + (peakVignette[index] - channel) * texturePeak,
      ));
      root.style.setProperty("--vignette-rgb", vignetteRgb.join(" "));
      root.style.setProperty("--vignette-opacity", (0.82 + texturePeak * 0.18).toFixed(3));
      syncNativePresentation(nativeProgress);
      if (phase !== activePhase) {
        activePhase = phase;
        onPhaseChange?.(phase);
      }
    };

    if (!enabled) {
      directNarrative(0);
      root.style.setProperty("--scene-progress", "0");
      return () => {
        resetNarrative();
      };
    }

    if (reduced || saveData) {
      root.dataset.reducedMotion = "true";
      showPhaseRail();
      syncExperience(preview ?? narrativeScore.find((phase) => phase.id === "reveal")?.preview ?? 0.409091);
      document.documentElement.style.scrollBehavior = previousBehavior;
      return () => {
        resetNarrative();
        root.removeAttribute("data-story-stage");
      };
    }

    if (lenisEnabled && supportsSmooth) {
      smooth = new Lenis({ autoRaf: false, smoothWheel: true, syncTouch: false, lerp: 0.05 });
      lenisScroll = () => ScrollTrigger.update();
      smooth.on("scroll", lenisScroll);
      lenisTick = (time) => smooth?.raf(time * 1000);
      gsap.ticker.add(lenisTick);
    }

    const playhead = { progress: 0 };
    const motionTimeline = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: root,
        start: "top top",
        end: "bottom bottom",
        // The scene follows the page directly and releases into the content
        // below when the experience root reaches its natural end.
        scrub: true,
        invalidateOnRefresh: true,
      },
    });
    motionTimeline.to(playhead, {
      progress: 1,
      duration: 1,
      ease: "none",
      onUpdate: () => syncExperience(playhead.progress),
    }, 0);

    const goToProgress = (progress: number, syncTimeline = false) => {
      const safeProgress = clamp01(progress);
      const distance = Math.max(0, root.offsetHeight - window.innerHeight);
      const target = root.offsetTop + distance * safeProgress;
      if (smooth) {
        smooth.scrollTo(target, { immediate: true, force: true });
      } else {
        document.documentElement.style.scrollBehavior = "auto";
        window.scrollTo({ top: target, left: 0, behavior: "auto" });
      }
      if (syncTimeline) {
        playhead.progress = safeProgress;
        motionTimeline.progress(safeProgress, false);
        syncExperience(safeProgress);
      }
      ScrollTrigger.update();
    };

    const seekExperience = (event: Event) => {
      const requested = (event as CustomEvent<{ progress?: number }>).detail?.progress;
      if (typeof requested === "number") goToProgress(requested);
    };
    root.addEventListener("mandegar:seek", seekExperience);
    const onNativeScroll = () => {
      if (root.hasAttribute("data-interaction-active")) return;
      const currentProgress = getNativeProgress();
      syncNativePresentation(currentProgress);
      if (currentProgress > 0.0008) showPhaseRail();
    };
    window.addEventListener("scroll", onNativeScroll, { passive: true });

    syncExperience(preview ?? getNativeProgress());
    ScrollTrigger.refresh();
    const initialFrame = window.requestAnimationFrame(() => {
      if (preview !== undefined) {
        goToProgress(preview, true);
      } else {
        syncExperience(getNativeProgress());
        ScrollTrigger.update();
      }
    });
    const restoreBehaviorFrame = window.requestAnimationFrame(() => {
      document.documentElement.style.scrollBehavior = previousBehavior;
    });

    return () => {
      window.cancelAnimationFrame(initialFrame);
      window.cancelAnimationFrame(restoreBehaviorFrame);
      if (lenisScroll) smooth?.off("scroll", lenisScroll);
      if (lenisTick) gsap.ticker.remove(lenisTick);
      smooth?.destroy();
      root.removeEventListener("mandegar:seek", seekExperience);
      window.removeEventListener("scroll", onNativeScroll);
      copyStates.forEach(({ copy, lines }) => {
        copy.removeAttribute("style");
        lines.forEach((line) => line.removeAttribute("style"));
      });
      root.removeAttribute("data-scroll-engaged");
      phaseRail?.removeAttribute("inert");
      phaseRail?.removeAttribute("aria-hidden");
      scrollCue?.removeAttribute("aria-hidden");
      document.documentElement.style.scrollBehavior = previousBehavior;
      resetNarrative();
      root.removeAttribute("data-story-stage");
      root.removeAttribute("data-native-progress");
      root.removeAttribute("data-narrative-progress");
      root.removeAttribute("data-copy-progress");
      root.removeAttribute("data-arrival-enter-progress");
    };
  }, { scope, dependencies: [enabled, lenisEnabled, onPhaseChange] });

  return (
    <div
      ref={scope}
      className={className}
      data-experience-root
      data-intro-active={enabled ? undefined : "true"}
      data-story-stage="arrival"
      data-ui-tone="dark"
      style={{
        "--scene-progress": 0,
        "--scroll-progress": 0,
        "--experience-scroll-height-desktop": `${sceneTokens.scrollLengthVh.desktop}svh`,
        "--experience-scroll-height-mobile": `${sceneTokens.scrollLengthVh.mobile}svh`,
      } as CSSProperties}
    >
      {children}
    </div>
  );
}
