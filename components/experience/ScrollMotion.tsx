"use client";

import Lenis from "lenis";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type CSSProperties, useRef } from "react";
import { experienceState } from "./experience-state";
import { directNarrative, resetNarrative } from "./narrative-director";
import {
  getNarrativeBeat,
  getNarrativePreview,
  narrativeScore,
  type ScenePhaseId,
} from "./narrative-score";

gsap.registerPlugin(ScrollTrigger);

type CopyState = {
  copy: HTMLElement;
  lines: HTMLElement[];
  phase: Exclude<ScenePhaseId, "arrival">;
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
  const span = phase.end - phase.start;
  const enterStart = phase.start + span * 0.04;
  const enterEnd = phase.start + span * 0.38;
  const exitStart = phase.end - span * 0.36;
  const exitEnd = phase.end;
  let highestOpacity = 0;

  state.lines.forEach((line, index) => {
    const sequence = state.lines.length > 1 ? index / (state.lines.length - 1) : 0;
    const enterOffset = sequence * span * 0.075;
    const exitOffset = sequence * span * 0.055;
    const entered = ease(rangeProgress(progress, enterStart + enterOffset, enterEnd));
    const exited = ease(rangeProgress(progress, exitStart + exitOffset, exitEnd));
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
    const previousRestoration = window.history.scrollRestoration;
    const previousBehavior = document.documentElement.style.scrollBehavior;
    const preview = getNarrativePreview(new URLSearchParams(window.location.search).get("phase"));
    const arrivalSignal = root.querySelector<HTMLElement>("[data-arrival-signal]");
    const phaseRail = root.querySelector<HTMLElement>("[data-phase-rail]");
    const copyStates: CopyState[] = Array.from(root.querySelectorAll<HTMLElement>("[data-scene-copy]")).map((copy) => ({
      copy,
      lines: Array.from(copy.querySelectorAll<HTMLElement>("[data-copy-line]")),
      phase: copy.dataset.sceneCopy as Exclude<ScenePhaseId, "arrival">,
    }));
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

    window.history.scrollRestoration = "manual";
    document.documentElement.style.scrollBehavior = "auto";
    if (preview === undefined) window.scrollTo({ top: root.offsetTop, left: 0, behavior: "auto" });

    const syncExperience = (progress: number) => {
      const safeProgress = clamp01(progress);
      const narrative = directNarrative(safeProgress);
      const phase = narrative.phase;
      root.style.setProperty("--scene-progress", safeProgress.toFixed(4));
      root.dataset.storyStage = phase;
      copyStates.forEach((state) => renderCopyState(state, safeProgress));
      const arrivalVisibility = safeProgress <= 0.12
        ? 1 - ease(rangeProgress(safeProgress, 0.055, 0.12))
        : ease(rangeProgress(safeProgress, 0.985, 1));
      if (arrivalSignal) arrivalSignal.style.opacity = arrivalVisibility.toFixed(4);
      if (phaseRail) phaseRail.style.opacity = "1";
      if (phase !== activePhase) {
        activePhase = phase;
        onPhaseChange?.(phase);
      }
    };

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

    const seekExperience = (event: Event) => {
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
      return getNarrativeBeat(effectiveProgress).id === "loop" && projectedProgress >= 1 ? projectedProgress : null;
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
      }
    };
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      touchStartY = event.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const currentY = event.touches[0]?.clientY ?? touchStartY;
      const delta = touchStartY - currentY;
      if (Math.abs(delta) >= 4) {
        lastIntentDirection = Math.sign(delta);
        lastIntentAt = performance.now();
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
        lastIntentDirection = isForwardKey ? 1 : -1;
        lastIntentAt = performance.now();
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
      if (wrapping || direction === 0) return;
      const followsRecentIntent = direction === lastIntentDirection && performance.now() - lastIntentAt < 2000;
      if (!followsRecentIntent) return;
      if (direction > 0 && currentProgress >= 0.9999 && getNarrativeBeat(currentProgress).id === "loop") {
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
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", onNativeScroll, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("beforeunload", onBeforeUnload);

    syncExperience(0);
    ScrollTrigger.refresh();
    const initialFrame = window.requestAnimationFrame(() => goToProgress(preview ?? 0, true));
    const restoreBehaviorFrame = window.requestAnimationFrame(() => {
      document.documentElement.style.scrollBehavior = previousBehavior;
    });

    return () => {
      window.cancelAnimationFrame(initialFrame);
      window.cancelAnimationFrame(restoreBehaviorFrame);
      if (wrapSettleFrame !== undefined) window.cancelAnimationFrame(wrapSettleFrame);
      if (wrapReleaseFrame !== undefined) window.cancelAnimationFrame(wrapReleaseFrame);
      if (lenisScroll) smooth?.off("scroll", lenisScroll);
      if (lenisTick) gsap.ticker.remove(lenisTick);
      smooth?.destroy();
      root.removeEventListener("mandegar:seek", seekExperience);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onNativeScroll);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("beforeunload", onBeforeUnload);
      copyStates.forEach(({ copy, lines }) => {
        copy.removeAttribute("style");
        lines.forEach((line) => line.removeAttribute("style"));
      });
      arrivalSignal?.removeAttribute("style");
      phaseRail?.removeAttribute("style");
      window.history.scrollRestoration = previousRestoration;
      document.documentElement.style.scrollBehavior = previousBehavior;
      resetNarrative();
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
