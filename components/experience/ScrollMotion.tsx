"use client";

import Lenis from "lenis";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type CSSProperties, useRef } from "react";
import { experienceState } from "./experience-state";
import { directNarrative, resetNarrative } from "./narrative-director";
import { getNarrativeCopyTiming, narrativeLoopSeam } from "./narrative-copy-timing";
import { warpNarrativeProgress } from "./narrative-progress-curve";
import {
  getNarrativeBeat,
  getNarrativePreview,
  narrativeScore,
  type ScenePhaseId,
} from "./narrative-score";
import { sceneTokens } from "./scene-config";
import {
  getNearestNarrativeSnap,
  narrativeSnapTiming,
  shouldSnapNarrative,
} from "./scroll-snap";

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
    const previousRestoration = window.history.scrollRestoration;
    const previousBehavior = document.documentElement.style.scrollBehavior;
    const preview = getNarrativePreview(new URLSearchParams(window.location.search).get("phase"));
    const phaseRail = root.querySelector<HTMLElement>("[data-phase-rail]");
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
    let wrapping = false;
    let wrapSettleFrame: number | undefined;
    let wrapReleaseFrame: number | undefined;
    let touchStartY = 0;
    let lastIntentDirection = 0;
    let lastIntentAt = 0;
    let snapIdleTimer: number | undefined;
    let snapReadyTimer: number | undefined;
    let snapCompletionTimer: number | undefined;
    let snapTween: gsap.core.Tween | undefined;
    let snapping = false;
    let snapReady = false;
    let loopEndEnteredAt = 0;

    window.history.scrollRestoration = "manual";
    document.documentElement.style.scrollBehavior = "auto";
    if (preview === undefined) window.scrollTo({ top: root.offsetTop, left: 0, behavior: "auto" });

    const syncExperience = (progress: number) => {
      const nativeProgress = clamp01(progress);
      const safeProgress = reduced ? nativeProgress : warpNarrativeProgress(nativeProgress);
      const narrative = directNarrative(safeProgress);
      const phase = narrative.phase;
      root.dataset.nativeProgress = nativeProgress.toFixed(4);
      root.dataset.narrativeProgress = safeProgress.toFixed(4);
      root.dataset.copyProgress = nativeProgress.toFixed(4);
      root.style.setProperty("--scene-progress", safeProgress.toFixed(4));
      root.dataset.storyStage = phase;
      copyStates.forEach((state) => renderCopyState(state, nativeProgress));
      if (phaseRail) phaseRail.style.opacity = "1";
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
      syncExperience(narrativeScore.find((phase) => phase.id === "reveal")?.preview ?? 0.455);
      document.documentElement.style.scrollBehavior = previousBehavior;
      return () => {
        window.history.scrollRestoration = previousRestoration;
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
        // A duration-based scrub interpolates through the entire story when
        // the native scroll coordinate is rebased at a cyclic boundary.
        // Direct scrubbing keeps the matched 0/1 seam atomic; Lenis/native
        // scrolling still supplies the normal between-frame smoothness.
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

    const goToProgress = (progress: number, snapTimeline = false) => {
      const safeProgress = clamp01(progress);
      const distance = Math.max(0, root.offsetHeight - window.innerHeight);
      const target = root.offsetTop + distance * safeProgress;
      if (smooth) {
        smooth.scrollTo(target, { immediate: true, force: true });
      } else {
        document.documentElement.style.scrollBehavior = "auto";
        window.scrollTo({ top: target, left: 0, behavior: "auto" });
      }
      if (snapTimeline) {
        playhead.progress = safeProgress;
        motionTimeline.progress(safeProgress, false);
        syncExperience(safeProgress);
      }
      ScrollTrigger.update();
    };

    const finishSnap = (targetProgress: number) => {
      if (snapCompletionTimer !== undefined) window.clearTimeout(snapCompletionTimer);
      snapCompletionTimer = undefined;
      goToProgress(targetProgress, true);
      snapping = false;
      snapTween = undefined;
      root.removeAttribute("data-scroll-snap");
    };
    const cancelSnap = () => {
      if (snapIdleTimer !== undefined) window.clearTimeout(snapIdleTimer);
      snapIdleTimer = undefined;
      if (snapCompletionTimer !== undefined) window.clearTimeout(snapCompletionTimer);
      snapCompletionTimer = undefined;
      if (!snapping) return;
      snapTween?.kill();
      snapTween = undefined;
      if (smooth) smooth.scrollTo(window.scrollY, { immediate: true, force: true });
      snapping = false;
      root.removeAttribute("data-scroll-snap");
    };
    const snapToNearestStage = () => {
      snapIdleTimer = undefined;
      if (wrapping || snapping || document.visibilityState !== "visible") return;
      const activeElement = document.activeElement as HTMLElement | null;
      if (activeElement?.closest("a, button, input, textarea, select, [contenteditable='true']")) return;
      const progress = getNativeProgress();
      if (progress >= narrativeLoopSeam.terminalProgress) return;
      const target = getNearestNarrativeSnap(progress, lastIntentDirection);
      if (!shouldSnapNarrative(progress, target.preview)) return;
      const distance = getScrollDistance();
      const targetY = root.offsetTop + distance * target.preview;
      snapping = true;
      root.dataset.scrollSnap = target.id;
      snapCompletionTimer = window.setTimeout(
        () => finishSnap(target.preview),
        narrativeSnapTiming.durationSeconds * 1000 + 300,
      );
      if (smooth) {
        smooth.scrollTo(targetY, {
          duration: narrativeSnapTiming.durationSeconds,
          easing: (value) => value * value * (3 - 2 * value),
          force: true,
          onComplete: () => finishSnap(target.preview),
        });
        return;
      }
      const scrollState = { y: window.scrollY };
      snapTween = gsap.to(scrollState, {
        y: targetY,
        duration: narrativeSnapTiming.durationSeconds,
        ease: "power2.inOut",
        overwrite: true,
        onUpdate: () => window.scrollTo({ top: scrollState.y, left: 0, behavior: "auto" }),
        onComplete: () => finishSnap(target.preview),
      });
    };
    const scheduleSnap = () => {
      if (!snapReady || wrapping || snapping) return;
      if (snapIdleTimer !== undefined) window.clearTimeout(snapIdleTimer);
      snapIdleTimer = window.setTimeout(snapToNearestStage, narrativeSnapTiming.idleMs);
    };

    const seekExperience = (event: Event) => {
      cancelSnap();
      const requested = (event as CustomEvent<{ progress?: number }>).detail?.progress;
      if (typeof requested === "number") goToProgress(requested);
    };
    root.addEventListener("mandegar:seek", seekExperience);

    const getScrollDistance = () => Math.max(1, root.offsetHeight - window.innerHeight);
    const getNativeProgress = () => {
      return clamp01((window.scrollY - root.offsetTop) / getScrollDistance());
    };
    const projectForwardLoop = (deltaPixels = 0) => {
      const effectiveProgress = Math.max(experienceState.progress, getNativeProgress());
      const projectedProgress = effectiveProgress + Math.max(0, deltaPixels) / getScrollDistance();
      if (effectiveProgress < narrativeLoopSeam.wrapReadyProgress) {
        loopEndEnteredAt = 0;
        return null;
      }
      if (getNarrativeBeat(effectiveProgress).id !== "loop" || projectedProgress < 1) return null;
      if (narrativeLoopSeam.minimumHoldMs <= 0) return projectedProgress;
      if (loopEndEnteredAt === 0) {
        loopEndEnteredAt = performance.now();
        return null;
      }
      return performance.now() - loopEndEnteredAt >= narrativeLoopSeam.minimumHoldMs
        ? projectedProgress
        : null;
    };
    const projectBackwardLoop = (deltaPixels = 0) => {
      const effectiveProgress = Math.min(experienceState.progress, getNativeProgress());
      const projectedProgress = effectiveProgress + Math.min(0, deltaPixels) / getScrollDistance();
      return getNarrativeBeat(effectiveProgress).id === "arrival" && projectedProgress <= 0 ? projectedProgress : null;
    };
    const settleWrap = (progress: number) => {
      if (wrapSettleFrame !== undefined) window.cancelAnimationFrame(wrapSettleFrame);
      if (wrapReleaseFrame !== undefined) window.cancelAnimationFrame(wrapReleaseFrame);
      wrapSettleFrame = window.requestAnimationFrame(() => {
        playhead.progress = progress;
        motionTimeline.progress(progress, false);
        syncExperience(progress);
        ScrollTrigger.update();
        wrapReleaseFrame = window.requestAnimationFrame(() => { wrapping = false; });
      });
    };
    let lastNativeProgress = getNativeProgress();
    const wrapToArrival = () => {
      if (wrapping) return;
      wrapping = true;
      loopEndEnteredAt = 0;
      const targetProgress = 0.0005;
      lastNativeProgress = targetProgress;
      goToProgress(targetProgress, true);
      settleWrap(targetProgress);
    };
    const wrapToLoop = () => {
      if (wrapping) return;
      wrapping = true;
      const targetProgress = 0.9995;
      lastNativeProgress = targetProgress;
      goToProgress(targetProgress, true);
      settleWrap(targetProgress);
    };
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      cancelSnap();
      const deltaPixels = event.deltaY * (event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight : 1);
      if (deltaPixels !== 0) {
        lastIntentDirection = Math.sign(deltaPixels);
        lastIntentAt = performance.now();
      }
      if (wrapping) {
        event.preventDefault();
        return;
      }
      const forwardProjection = deltaPixels > 0 ? projectForwardLoop(deltaPixels) : null;
      const backwardProjection = deltaPixels < 0 ? projectBackwardLoop(deltaPixels) : null;
      if (forwardProjection !== null) {
        event.preventDefault();
        wrapToArrival();
      } else if (backwardProjection !== null) {
        event.preventDefault();
        wrapToLoop();
      } else {
        scheduleSnap();
      }
    };
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      cancelSnap();
      touchStartY = event.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const currentY = event.touches[0]?.clientY ?? touchStartY;
      const delta = touchStartY - currentY;
      if (Math.abs(delta) >= 4) {
        lastIntentDirection = Math.sign(delta);
        lastIntentAt = performance.now();
        scheduleSnap();
      }
      if (wrapping) {
        event.preventDefault();
        return;
      }
      const forwardProjection = delta >= 24 ? projectForwardLoop(delta * 1.6) : null;
      const backwardProjection = delta <= -24 ? projectBackwardLoop(delta * 1.6) : null;
      if (forwardProjection !== null) {
        event.preventDefault();
        wrapToArrival();
      } else if (backwardProjection !== null) {
        event.preventDefault();
        wrapToLoop();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("a, button, input, textarea, select")) return;
      const isForwardKey = ["ArrowDown", "PageDown"].includes(event.key) || (event.key === " " && !event.shiftKey);
      const isBackwardKey = ["ArrowUp", "PageUp"].includes(event.key) || (event.key === " " && event.shiftKey);
      const forwardDelta = event.key === "ArrowDown" ? 48 : window.innerHeight * 0.9;
      const backwardDelta = event.key === "ArrowUp" ? -48 : -window.innerHeight * 0.9;
      if (isForwardKey || isBackwardKey) {
        cancelSnap();
        lastIntentDirection = isForwardKey ? 1 : -1;
        lastIntentAt = performance.now();
        scheduleSnap();
      }
      const forwardProjection = isForwardKey ? projectForwardLoop(forwardDelta) : null;
      const backwardProjection = isBackwardKey ? projectBackwardLoop(backwardDelta) : null;
      if (wrapping && (isForwardKey || isBackwardKey)) {
        event.preventDefault();
      } else if (forwardProjection !== null) {
        event.preventDefault();
        wrapToArrival();
      } else if (backwardProjection !== null) {
        event.preventDefault();
        wrapToLoop();
      }
    };
    const onNativeScroll = () => {
      const currentProgress = getNativeProgress();
      const direction = Math.sign(currentProgress - lastNativeProgress);
      lastNativeProgress = currentProgress;
      if (snapping) return;
      scheduleSnap();
      if (wrapping || direction === 0) return;
      const followsRecentIntent = direction === lastIntentDirection && performance.now() - lastIntentAt < 2000;
      if (!followsRecentIntent) return;
      if (direction > 0 && projectForwardLoop() !== null) {
        wrapToArrival();
      } else if (direction < 0 && currentProgress <= 0.0001 && getNarrativeBeat(currentProgress).id === "arrival") {
        wrapToLoop();
      }
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && preview === undefined) goToProgress(0, true);
    };
    const onBeforeUnload = () => {
      if (preview === undefined) window.scrollTo({ top: root.offsetTop, left: 0, behavior: "auto" });
    };
    const onPointerDown = () => cancelSnap();
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", onNativeScroll, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("beforeunload", onBeforeUnload);

    syncExperience(0);
    ScrollTrigger.refresh();
    const initialFrame = window.requestAnimationFrame(() => goToProgress(preview ?? 0, true));
    const restoreBehaviorFrame = window.requestAnimationFrame(() => {
      document.documentElement.style.scrollBehavior = previousBehavior;
    });
    snapReadyTimer = window.setTimeout(() => { snapReady = true; }, 1_000);

    return () => {
      window.cancelAnimationFrame(initialFrame);
      window.cancelAnimationFrame(restoreBehaviorFrame);
      if (wrapSettleFrame !== undefined) window.cancelAnimationFrame(wrapSettleFrame);
      if (wrapReleaseFrame !== undefined) window.cancelAnimationFrame(wrapReleaseFrame);
      if (snapReadyTimer !== undefined) window.clearTimeout(snapReadyTimer);
      cancelSnap();
      if (lenisScroll) smooth?.off("scroll", lenisScroll);
      if (lenisTick) gsap.ticker.remove(lenisTick);
      smooth?.destroy();
      root.removeEventListener("mandegar:seek", seekExperience);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onNativeScroll);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("beforeunload", onBeforeUnload);
      copyStates.forEach(({ copy, lines }) => {
        copy.removeAttribute("style");
        lines.forEach((line) => line.removeAttribute("style"));
      });
      phaseRail?.removeAttribute("style");
      window.history.scrollRestoration = previousRestoration;
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
      style={{
        "--scene-progress": 0,
        "--experience-scroll-height-desktop": `${sceneTokens.scrollLengthVh.desktop}svh`,
        "--experience-scroll-height-mobile": `${sceneTokens.scrollLengthVh.mobile}svh`,
      } as CSSProperties}
    >
      {children}
    </div>
  );
}
