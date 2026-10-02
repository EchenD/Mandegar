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

type ExperienceRuntime = "pending" | "fallback" | "adaptive" | "full";

type ScrollCheckpoint = {
  progress: number;
  overflow: number;
};

type SeekRequest = {
  progress?: number;
  sync?: boolean;
  top?: number;
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

function renderCopyState(state: CopyState, progress: number, reducedMotion: boolean) {
  const phase = narrativeScore.find((item) => item.id === state.phase);
  if (!phase) return;
  const timing = getNarrativeCopyTiming(phase.id);
  let highestOpacity = 0;

  state.lines.forEach((line, index) => {
    const sequence = state.lines.length > 1 ? index / (state.lines.length - 1) : 0;
    const enterOffset = sequence * timing.enterStagger;
    const exitOffset = sequence * timing.exitStagger;
    // The intro reveals the opening message; reading it needs no extra scroll.
    const entered = state.phase === "arrival"
      ? 1
      : ease(rangeProgress(progress, timing.enterStart + enterOffset, timing.enterEnd));
    const exited = ease(rangeProgress(progress, timing.exitStart + exitOffset, timing.exitEnd));
    const opacity = entered * (1 - exited);
    const y = reducedMotion ? 0 : (1 - entered) * 8 - exited * 6;
    const z = reducedMotion ? 0 : (1 - entered) * -8 + exited * 6;
    highestOpacity = Math.max(highestOpacity, opacity);
    line.style.opacity = opacity.toFixed(4);
    line.style.transform = `translate3d(0, ${y.toFixed(2)}px, ${z.toFixed(2)}px)`;
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
  runtime = "full",
  onPhaseChange,
}: {
  children: React.ReactNode;
  className?: string;
  enabled?: boolean;
  lenisEnabled?: boolean;
  runtime?: ExperienceRuntime;
  onPhaseChange?: (phase: ScenePhaseId) => void;
}) {
  const scope = useRef<HTMLDivElement>(null);
  const checkpoint = useRef<ScrollCheckpoint | null>(null);
  const resumeRequested = useRef(false);
  const pendingSeek = useRef<SeekRequest | null>(null);

  useGSAP(() => {
    const root = scope.current;
    if (!root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
    const staticMode = runtime === "fallback" || reduced || saveData;
    const resume = enabled && !staticMode && resumeRequested.current ? checkpoint.current : null;
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
    let smooth: Lenis | undefined;
    let lenisTick: ((time: number) => void) | undefined;
    let lenisScroll: (() => void) | undefined;
    let interactionObserver: MutationObserver | undefined;
    let activePhase: ScenePhaseId = "arrival";
    let previousNativeProgress: number | null = null;
    let suspended = Boolean(resume);
    let pendingRuntime: ExperienceRuntime | null = null;
    let initialPositionCancelled = false;
    let applySeek: ((request: SeekRequest) => void) | undefined;

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

    const prepareRuntimeChange = (event: Event) => {
      const nextRuntime = (event as CustomEvent<{ runtime?: ExperienceRuntime }>).detail?.runtime;
      if (!nextRuntime || runtime === "pending") return;
      if (nextRuntime === runtime) {
        // Rapid opposite changes can be batched into the current runtime, so
        // there will be no React effect update to resume the existing timeline.
        if (pendingRuntime !== null) {
          pendingRuntime = null;
          suspended = false;
          resumeRequested.current = false;
          previousNativeProgress = getNativeProgress();
          root.dataset.scrollDirection = "backward";
          syncExperience(previousNativeProgress);
        }
        return;
      }
      if (!staticMode) {
        const relativeTop = window.scrollY - root.offsetTop;
        const distance = getScrollDistance();
        const lockedProgress = root.hasAttribute("data-interaction-active")
          ? Number(root.dataset.nativeProgress)
          : Number.NaN;
        checkpoint.current = {
          progress: Number.isFinite(lockedProgress) ? clamp01(lockedProgress) : getNativeProgress(),
          overflow: Number.isFinite(lockedProgress)
            ? 0
            : relativeTop < 0 ? relativeTop : Math.max(0, relativeTop - distance),
        };
      } else if (!checkpoint.current) {
        checkpoint.current = { progress: preview ?? 0, overflow: 0 };
      }
      // Stop the old timeline before the semantic fallback changes the track's
      // height and the browser clamps its native scroll position.
      suspended = true;
      pendingRuntime = nextRuntime;
      resumeRequested.current = true;
    };
    root.addEventListener("mandegar:runtime-change", prepareRuntimeChange);

    const seekExperience = (event: Event) => {
      const detail = (event as CustomEvent<SeekRequest>).detail;
      const validProgress = typeof detail?.progress === "number" && Number.isFinite(detail.progress);
      const validTop = typeof detail?.top === "number" && Number.isFinite(detail.top);
      if (!validProgress && !validTop) return;
      const request: SeekRequest = validProgress
        ? { progress: clamp01(detail.progress!), sync: detail.sync }
        : { top: detail.top };
      initialPositionCancelled = true;
      root.dataset.scrollSeekRequested = "true";
      if (applySeek && pendingRuntime === null) {
        suspended = false;
        pendingSeek.current = null;
        applySeek(request);
      } else {
        // Runtime readiness can precede the intro releasing scroll. Keep the
        // latest request until the native timeline is actually installed.
        pendingSeek.current = request;
      }
    };
    root.addEventListener("mandegar:seek", seekExperience);

    const syncNativePresentation = (nativeProgress: number) => {
      root.dataset.nativeProgress = nativeProgress.toFixed(4);
      root.dataset.copyProgress = nativeProgress.toFixed(4);
      root.style.setProperty("--scroll-progress", nativeProgress.toFixed(4));
      copyStates.forEach((state) => renderCopyState(state, nativeProgress, staticMode));
    };

    const syncExperience = (progress: number) => {
      if (suspended || root.hasAttribute("data-interaction-active")) return;
      const timelineProgress = clamp01(staticMode ? progress : getNativeProgress());
      const nativeProgress = timelineProgress;
      if (previousNativeProgress !== null) {
        const movement = nativeProgress - previousNativeProgress;
        if (movement > 0.0001) root.dataset.scrollDirection = "forward";
        else if (movement < -0.0001) root.dataset.scrollDirection = "backward";
      }
      previousNativeProgress = nativeProgress;
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

    if (!enabled || runtime === "pending") {
      directNarrative(0);
      root.style.setProperty("--scene-progress", "0");
      return () => {
        root.removeEventListener("mandegar:runtime-change", prepareRuntimeChange);
        root.removeEventListener("mandegar:seek", seekExperience);
        resetNarrative();
      };
    }

    if (staticMode) {
      root.dataset.reducedMotion = "true";
      showPhaseRail();
      const staticProgress = checkpoint.current?.progress
        ?? preview
        ?? narrativeScore.find((phase) => phase.id === "reveal")?.preview
        ?? 0.409091;
      checkpoint.current ??= { progress: staticProgress, overflow: 0 };
      syncExperience(staticProgress);
      document.documentElement.style.scrollBehavior = previousBehavior;
      return () => {
        root.removeEventListener("mandegar:runtime-change", prepareRuntimeChange);
        root.removeEventListener("mandegar:seek", seekExperience);
        resetNarrative();
        root.removeAttribute("data-story-stage");
        root.removeAttribute("data-reduced-motion");
      };
    }

    if (lenisEnabled && supportsSmooth) {
      smooth = new Lenis({ autoRaf: false, smoothWheel: true, syncTouch: false, lerp: 0.05 });
      lenisScroll = () => ScrollTrigger.update();
      smooth.on("scroll", lenisScroll);
      lenisTick = (time) => smooth?.raf(time * 1000);
      gsap.ticker.add(lenisTick);
      const syncInteractionLock = () => {
        if (root.hasAttribute("data-interaction-active")) {
          smooth?.stop();
          return;
        }
        smooth?.scrollTo(window.scrollY, { immediate: true, force: true });
        smooth?.start();
      };
      interactionObserver = new MutationObserver(syncInteractionLock);
      interactionObserver.observe(root, {
        attributes: true,
        attributeFilter: ["data-interaction-active"],
      });
      syncInteractionLock();
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

    const goToScrollTop = (target: number) => {
      if (smooth) {
        smooth.scrollTo(target, { immediate: true, force: true });
      } else {
        document.documentElement.style.scrollBehavior = "auto";
        window.scrollTo({ top: target, left: 0, behavior: "auto" });
      }
    };

    const goToProgress = (progress: number, syncTimeline = false) => {
      const safeProgress = clamp01(progress);
      const distance = Math.max(0, root.offsetHeight - window.innerHeight);
      goToScrollTop(root.offsetTop + distance * safeProgress);
      if (syncTimeline) {
        playhead.progress = safeProgress;
        motionTimeline.progress(safeProgress, false);
        syncExperience(safeProgress);
      }
      ScrollTrigger.update();
    };

    applySeek = (detail) => {
      if (typeof detail.progress === "number") goToProgress(detail.progress, detail.sync);
      else if (typeof detail.top === "number") {
        goToScrollTop(detail.top);
        ScrollTrigger.update();
      }
    };
    const onNativeScroll = () => {
      if (suspended || root.hasAttribute("data-interaction-active")) return;
      initialPositionCancelled = true;
      const currentProgress = getNativeProgress();
      syncExperience(currentProgress);
      if (currentProgress > 0.0008) showPhaseRail();
    };
    window.addEventListener("scroll", onNativeScroll, { passive: true });
    const cancelInitialPosition = () => { initialPositionCancelled = true; };
    const cancelOnScrollKey = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) cancelInitialPosition();
    };
    window.addEventListener("wheel", cancelInitialPosition, { passive: true });
    window.addEventListener("touchstart", cancelInitialPosition, { passive: true });
    window.addEventListener("keydown", cancelOnScrollKey);

    const restoreCheckpoint = () => {
      if (!resume || pendingRuntime !== null) return;
      // A preference change resumes the same reading position; it is not a
      // forward arrival at a station and must not automatically open one.
      previousNativeProgress = resume.progress;
      root.dataset.scrollDirection = "backward";
      goToScrollTop(root.offsetTop + getScrollDistance() * resume.progress + resume.overflow);
      suspended = false;
      playhead.progress = resume.progress;
      motionTimeline.progress(resume.progress, false);
      syncExperience(resume.progress);
      if (resume.progress > 0.0008) showPhaseRail();
      ScrollTrigger.update();
    };

    if (!resume) syncExperience(preview ?? getNativeProgress());
    ScrollTrigger.refresh();
    if (pendingSeek.current) {
      const request = pendingSeek.current;
      pendingSeek.current = null;
      suspended = false;
      initialPositionCancelled = true;
      applySeek(request);
      resumeRequested.current = false;
    } else if (resume) {
      restoreCheckpoint();
      resumeRequested.current = false;
    }
    const initialFrame = window.requestAnimationFrame(() => {
      if (pendingRuntime !== null || initialPositionCancelled) return;
      if (resume) {
        restoreCheckpoint();
      } else if (preview !== undefined) {
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
      interactionObserver?.disconnect();
      if (lenisScroll) smooth?.off("scroll", lenisScroll);
      if (lenisTick) gsap.ticker.remove(lenisTick);
      smooth?.destroy();
      root.removeEventListener("mandegar:seek", seekExperience);
      root.removeEventListener("mandegar:runtime-change", prepareRuntimeChange);
      window.removeEventListener("scroll", onNativeScroll);
      window.removeEventListener("wheel", cancelInitialPosition);
      window.removeEventListener("touchstart", cancelInitialPosition);
      window.removeEventListener("keydown", cancelOnScrollKey);
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
      root.removeAttribute("data-scroll-direction");
      root.removeAttribute("data-copy-progress");
    };
  }, { scope, dependencies: [enabled, lenisEnabled, onPhaseChange, runtime], revertOnUpdate: true });

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
