"use client";

import Lenis from "lenis";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type CSSProperties, useRef } from "react";
import { experienceState } from "./experience-state";
import { directNarrative, resetNarrative } from "./narrative-director";
import { getNarrativeCopyTiming } from "./narrative-copy-timing";
import { getInteractionDepartureTarget, sampleHeroTimeline } from "./hero-timeline";
import { heroTimeline } from "./hero-timeline-config";
import {
  getNarrativePreview,
  narrativeScore,
  type ScenePhaseId,
} from "./narrative-score";
import { sceneTokens } from "./scene-config";
import { heroEnding } from "./hero-ending";
import styles from "./ScrollMotion.module.css";

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
  const cameraTrack = useRef<HTMLDivElement>(null);
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
    let finishMotion: { from: number; target: number; startedAt: number } | null = null;
    let nativeScrollFraction = 0;
    let handingOffInteraction = false;
    let activePhase: ScenePhaseId = "arrival";
    let previousNativeProgress: number | null = null;
    let directionProgress: number | null = null;
    let suspended = Boolean(resume);
    let pendingRuntime: ExperienceRuntime | null = null;
    let initialPositionCancelled = false;
    let applySeek: ((request: SeekRequest) => void) | undefined;
    let viewportInitialized = false;
    let viewportFrame: number | null = null;
    let resizeCheckpoint: ScrollCheckpoint | null = null;
    let restoreViewport: (() => void) | undefined;

    const showPhaseRail = () => {
      if (root.dataset.scrollEngaged === "true") return;
      root.dataset.scrollEngaged = "true";
      phaseRail?.removeAttribute("inert");
      phaseRail?.setAttribute("aria-hidden", "false");
      scrollCue?.setAttribute("aria-hidden", "false");
    };

    root.dataset.scrollEngaged = "false";
    root.dataset.scrollDirection = resume ? "backward" : "forward";
    phaseRail?.setAttribute("inert", "");
    phaseRail?.setAttribute("aria-hidden", "true");
    scrollCue?.setAttribute("aria-hidden", "false");
    if (preview !== undefined) showPhaseRail();

    // Keep the authored frame clock independent of the original ending's
    // additional scroll distance. Frame 2500 is reached before that ending.
    const getScrollDistance = () => Math.max(1, (cameraTrack.current?.offsetHeight ?? root.offsetHeight) - window.innerHeight);
    const syncViewport = () => {
      if (viewportInitialized && !staticMode && !suspended && previousNativeProgress !== null) {
        const relativeTop = window.scrollY - root.offsetTop;
        const previousDistance = Number(root.dataset.cameraScrollDistance) || getScrollDistance();
        if (relativeTop >= 0 && relativeTop <= previousDistance) {
          // Save the displayed frame before resizing changes the scroll track.
          resizeCheckpoint = { progress: previousNativeProgress, overflow: 0 };
          suspended = true;
        }
      }
      root.style.setProperty("--experience-viewport-height", `${window.innerHeight}px`);
      root.dataset.cameraScrollDistance = String(getScrollDistance());
      viewportInitialized = true;
      if (resizeCheckpoint && restoreViewport) {
        if (viewportFrame !== null) window.cancelAnimationFrame(viewportFrame);
        viewportFrame = window.requestAnimationFrame(restoreViewport);
      }
    };
    syncViewport();
    window.addEventListener("resize", syncViewport);
    const getNativeProgress = () => {
      // DOM scroll positions can round away the subpixel tail of Lenis's
      // deceleration. All scene consumers must follow the same fractional clock.
      return clamp01(((smooth?.animatedScroll ?? window.scrollY) + nativeScrollFraction - root.offsetTop) / getScrollDistance());
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
        checkpoint.current = resizeCheckpoint ?? {
          progress: Number.isFinite(lockedProgress) ? clamp01(lockedProgress) : previousNativeProgress ?? getNativeProgress(),
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
      // An explicit destination supersedes a resize queued in the same frame.
      resizeCheckpoint = null;
      if (viewportFrame !== null) window.cancelAnimationFrame(viewportFrame);
      viewportFrame = null;
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
      root.dataset.nativeProgress = String(nativeProgress);
      root.dataset.copyProgress = nativeProgress.toFixed(4);
      root.style.setProperty("--scroll-progress", nativeProgress.toFixed(4));
      copyStates.forEach((state) => renderCopyState(state, nativeProgress, staticMode));
    };

    const syncExperience = (progress: number, force = false) => {
      if (suspended || (!force && handingOffInteraction)) return;
      const timelineProgress = clamp01(progress);
      root.dataset.scrollVelocity = String(smooth?.velocity ?? 0);
      const safeProgress = timelineProgress;
      if (timelineProgress === previousNativeProgress && experienceState.progress === safeProgress && root.dataset.narrativeProgress !== undefined) return;
      const nativeProgress = timelineProgress;
      if (directionProgress === null) directionProgress = nativeProgress;
      else {
        const movement = (nativeProgress - directionProgress) * getScrollDistance();
        // Native rounding and the last fractional Lenis correction are not a
        // reverse visit. Accumulate a meaningful pixel before changing direction.
        if (Math.abs(movement) > 1) {
          root.dataset.scrollDirection = movement > 0 ? "forward" : "backward";
          directionProgress = nativeProgress;
        }
      }
      previousNativeProgress = nativeProgress;
      const narrative = directNarrative(safeProgress);
      const phase = narrative.phase;
      const sample = sampleHeroTimeline(heroTimeline, safeProgress);
      root.dataset.heroFrame = sample.frame.toFixed(3);
      root.dataset.inViewingWindow = String(sample.inViewingWindow);
      root.dataset.windowProgress = String(sample.windowProgress);
      root.dataset.narrativeProgress = String(safeProgress);
      root.style.setProperty("--scene-progress", safeProgress.toFixed(4));
      if (root.dataset.storyStage !== phase) root.dataset.storyStage = phase;
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
        window.removeEventListener("resize", syncViewport);
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
      syncExperience(staticProgress, true);
      applySeek = (request) => {
        window.scrollTo({ top: request.top ?? 0, left: 0, behavior: "instant" });
      };
      if (pendingSeek.current) {
        applySeek(pendingSeek.current);
        pendingSeek.current = null;
      }
      document.documentElement.style.scrollBehavior = previousBehavior;
      return () => {
        window.removeEventListener("resize", syncViewport);
        root.removeEventListener("mandegar:runtime-change", prepareRuntimeChange);
        root.removeEventListener("mandegar:seek", seekExperience);
        resetNarrative();
        root.removeAttribute("data-story-stage");
        root.removeAttribute("data-reduced-motion");
      };
    }

    if (lenisEnabled && supportsSmooth) {
      smooth = new Lenis({ autoRaf: false, smoothWheel: true, syncTouch: false, lerp: 0.05 });
      lenisScroll = () => {
        ScrollTrigger.update();
        const progress = getNativeProgress();
        syncExperience(progress);
        if (progress > 0.0008) showPhaseRail();
      };
      smooth.on("scroll", lenisScroll);
    }

    // Finish moves the real page through every authored frame. Scroll input
    // cancels it immediately and retains the current page position.
    const finishPhase = (event: Event) => {
      const phase = (event as CustomEvent<{ phase?: ScenePhaseId }>).detail?.phase;
      if (!phase) return;
      const target = getInteractionDepartureTarget(heroTimeline, phase, getNativeProgress());
      if (target === null) return;
      if (finishMotion?.target === target) return;
      finishMotion = { from: getNativeProgress(), target, startedAt: performance.now() };
      root.dataset.finishScrolling = "true";
    };
    const cancelFinish = () => {
      finishMotion = null;
      root.removeAttribute("data-finish-scrolling");
    };
    root.addEventListener("mandegar:finish-phase", finishPhase);
    root.addEventListener("mandegar:cancel-finish-phase", cancelFinish);
    lenisTick = () => {
      // GSAP's lag smoothing adjusts ticker time after slow frames. Lenis
      // needs real elapsed time so a wheel tail cannot stretch under load.
      smooth?.raf(performance.now());
      if (suspended || !finishMotion) return;
      const amount = Math.min(1, (performance.now() - finishMotion.startedAt) / 850);
      const progress = finishMotion.from + (finishMotion.target - finishMotion.from) * ease(amount);
      const top = root.offsetTop + getScrollDistance() * progress;
      handingOffInteraction = true;
      nativeScrollFraction = 0;
      if (smooth) smooth.scrollTo(top, { immediate: true, force: true });
      else window.scrollTo({ top, behavior: "instant" });
      nativeScrollFraction = top - (smooth?.animatedScroll ?? window.scrollY);
      handingOffInteraction = false;
      syncExperience(progress, true);
      ScrollTrigger.update();
      if (amount === 1) {
        cancelFinish();
        root.dispatchEvent(new Event("mandegar:phase-finished"));
      }
    };
    gsap.ticker.add(lenisTick);

    const continueScroll = (event: Event) => {
      const detail = (event as CustomEvent<{ delta?: number; immediate?: boolean }>).detail;
      const delta = detail?.delta;
      cancelFinish();
      if (typeof delta !== "number" || !Number.isFinite(delta) || delta === 0) return;
      if (detail?.immediate) {
        // All released touch packets share this owner. Cancel old easing even
        // when Lenis rounds the new target to its existing target, and carry
        // subpixel movement after its immediate scroll/start resets.
        const currentTop = (smooth?.animatedScroll ?? window.scrollY) + nativeScrollFraction;
        const limit = smooth?.limit ?? Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const target = Math.max(0, Math.min(limit, currentTop + delta));
        handingOffInteraction = true;
        nativeScrollFraction = 0;
        if (smooth) {
          smooth.stop();
          smooth.scrollTo(target, { immediate: true, force: true });
          smooth.start();
        } else window.scrollTo({ top: target, behavior: "instant" });
        nativeScrollFraction = target - (smooth?.animatedScroll ?? window.scrollY);
        handingOffInteraction = false;
        syncExperience(getNativeProgress(), true);
        ScrollTrigger.update();
        return;
      }
      if (smooth) smooth.scrollTo(window.scrollY + delta, { force: true });
      else window.scrollBy({ top: delta, behavior: "smooth" });
    };
    root.addEventListener("mandegar:continue-scroll", continueScroll);

    const playhead = { progress: 0 };
    const motionTimeline = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: root,
        start: "top top",
        end: () => root.offsetTop + getScrollDistance(),
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
      onUpdate: () => syncExperience(getNativeProgress()),
    }, 0);

    const goToScrollTop = (target: number) => {
      nativeScrollFraction = 0;
      if (smooth) {
        smooth.scrollTo(target, { immediate: true, force: true });
      } else {
        document.documentElement.style.scrollBehavior = "auto";
        window.scrollTo({ top: target, left: 0, behavior: "auto" });
      }
      nativeScrollFraction = target - (smooth?.animatedScroll ?? window.scrollY);
    };

    const goToProgress = (progress: number, syncTimeline = false) => {
      const safeProgress = clamp01(progress);
      const distance = getScrollDistance();
      goToScrollTop(root.offsetTop + distance * safeProgress);
      if (syncTimeline) {
        playhead.progress = safeProgress;
        motionTimeline.progress(safeProgress, false);
        syncExperience(safeProgress);
      }
      ScrollTrigger.update();
    };

    restoreViewport = () => {
      viewportFrame = null;
      if (!resizeCheckpoint || pendingRuntime !== null || resumeRequested.current) return;
      const position = resizeCheckpoint;
      // Refresh pinned content as well as the camera's scroll distance. The
      // canvas must measure the new viewport before its DPR is recalculated.
      ScrollTrigger.refresh();
      suspended = false;
      goToProgress(position.progress, true);
      resizeCheckpoint = null;
    };

    applySeek = (detail) => {
      cancelFinish();
      if (typeof detail.progress === "number") goToProgress(detail.progress, detail.sync);
      else if (typeof detail.top === "number") {
        goToScrollTop(detail.top);
        ScrollTrigger.update();
      }
      syncExperience(getNativeProgress(), true);
    };
    const onNativeScroll = () => {
      if (suspended) return;
      initialPositionCancelled = true;
      // Lenis publishes on every fractional step, including steps too small
      // to generate a native scroll event. Do not overwrite it with DOM rounding.
      if (smooth?.isScrolling === "smooth") return;
      const currentProgress = getNativeProgress();
      syncExperience(currentProgress);
      if (currentProgress > 0.0008) showPhaseRail();
    };
    window.addEventListener("scroll", onNativeScroll, { passive: true });
    const cancelInitialPosition = () => { initialPositionCancelled = true; cancelFinish(); };
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
      directionProgress = resume.progress;
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
      window.removeEventListener("resize", syncViewport);
      if (viewportFrame !== null) window.cancelAnimationFrame(viewportFrame);
      window.cancelAnimationFrame(initialFrame);
      window.cancelAnimationFrame(restoreBehaviorFrame);
      cancelFinish();
      root.removeEventListener("mandegar:finish-phase", finishPhase);
      root.removeEventListener("mandegar:cancel-finish-phase", cancelFinish);
      // The explicit release runs before the leaving wheel event reaches Lenis.
      if (lenisScroll) smooth?.off("scroll", lenisScroll);
      if (lenisTick) gsap.ticker.remove(lenisTick);
      smooth?.destroy();
      root.removeEventListener("mandegar:seek", seekExperience);
      root.removeEventListener("mandegar:runtime-change", prepareRuntimeChange);
      root.removeEventListener("mandegar:continue-scroll", continueScroll);
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
      root.removeAttribute("data-scroll-velocity");
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
        "--hero-ending-overlap-desktop": `${heroEnding.desktop.overlapVh}svh`,
        "--hero-ending-overlap-mobile": `${heroEnding.mobile.overlapVh}svh`,
      } as CSSProperties}
    >
      {runtime !== "fallback" && <div ref={cameraTrack} className={styles.cameraTrack} data-camera-scroll-track aria-hidden="true" />}
      {children}
    </div>
  );
}
