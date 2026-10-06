"use client";

import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { narrativeScore, type ScenePhaseId } from "../narrative-score";
import { DrawingInteraction } from "./DrawingInteraction";
import { GameInteraction } from "./GameInteraction";
import { getInteractionCopy } from "./interaction-copy";
import { getStationForPhase } from "./interaction-registry";
import {
  interactionRuntime,
  resetInteractionRuntime,
} from "./interaction-runtime";
import { initialInteractionState, interactionReducer } from "./interaction-state";
import type {
  InteractionAnchorFrame,
  InteractionInput,
  InteractionStation,
} from "./interaction-types";
import { clearDrawing, clearDrawingDraft } from "./visitor-creation";
import { resetRace } from "./race-game";
import { ScrollScenes } from "./ScrollScenes";
import { photoScrollTiming, scrollHoldTiming } from "./scroll-scenes";
import { TouchComposerInteraction } from "./TouchComposerInteraction";
import { resetInstallation, installationCopy } from "./installation-demo";
import styles from "./HeroInteractions.module.css";

const interactionStationNames: readonly InteractionStation[] = [
  "photo",
  "touch",
  "stage",
  "game",
  "draw",
];

function fallbackFrame(): InteractionAnchorFrame {
  const width = typeof window === "undefined" ? 1200 : window.innerWidth;
  const height = typeof window === "undefined" ? 800 : window.innerHeight;
  const point = (x: number, y: number) => ({ x: width * x, y: height * y, visible: true, fallback: true });
  return {
    stations: {
      photo: point(0.28, 0.46),
      touch: point(0.31, 0.42),
      stage: point(0.5, 0.42),
      game: point(0.7, 0.43),
      draw: point(0.73, 0.47),
    },
    photoFlash: point(0.3, 0.34),
    photoPhone: point(0.39, 0.49),
    beams: Array.from({ length: 5 }, (_, index) => ({
      origin: point(0.36 + index * 0.07, 0.18),
      target: point(0.4 + index * 0.05, 0.62),
    })),
  };
}

export const InteractionDirector = memo(function InteractionDirector({
  locale,
  activePhase,
  runtime,
}: {
  locale: Locale;
  activePhase: ScenePhaseId;
  runtime: "pending" | "fallback" | "adaptive" | "full";
}) {
  const copy = useMemo(() => getInteractionCopy(locale), [locale]);
  const initialAnchors = useMemo(() => fallbackFrame(), []);
  const [state, dispatch] = useReducer(interactionReducer, initialInteractionState);
  const [showAnchorDebug, setShowAnchorDebug] = useState(false);
  const [reducedMotion] = useState(() => (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ));
  const [scrollSkipProgress, setScrollSkipProgress] = useState(0);
  const [interactionRun, setInteractionRun] = useState(0);
  const [departing, setDeparting] = useState(false);
  const scrollSkipAmount = useRef(0);
  const completionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const continuingTouch = useRef<number | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const autoStarted = useRef<Partial<Record<InteractionStation, boolean>>>({});
  const previousExpectedStation = useRef<InteractionStation | null>(null);
  const savedScroll = useRef(0);
  const enteredAt = useRef(0);
  const entryProgress = useRef(0);
  const resultAt = useRef<number | null>(null);
  const departureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelIntent = useRef({ at: -Infinity, gap: Infinity, deltaY: 0 });
  const touching = useRef(false);
  const touchEndedAt = useRef(-Infinity);
  const nativeScrolledAt = useRef(-Infinity);
  const panelRoot = useRef<HTMLDivElement>(null);
  const anchors = useRef(initialAnchors);
  const debugAnchorElements = useRef<Partial<Record<InteractionStation, HTMLElement>>>({});
  const expectedStation = getStationForPhase(activePhase);

  const applyAnchorFrame = useCallback((frame: InteractionAnchorFrame) => {
    interactionStationNames.forEach((name) => {
      const element = debugAnchorElements.current[name];
      if (!element) return;
      const point = frame.stations[name];
      element.style.left = `${point.x}px`;
      element.style.top = `${point.y}px`;
      element.dataset.fallback = point.fallback ? "true" : "false";
    });
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setShowAnchorDebug(
        process.env.NODE_ENV === "development"
        && new URLSearchParams(window.location.search).get("anchors") === "1",
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (previousExpectedStation.current !== expectedStation) {
      const previous = previousExpectedStation.current;
      if (previous) autoStarted.current[previous] = false;
      previousExpectedStation.current = expectedStation;
    }
    dispatch({ type: "AVAILABILITY", station: expectedStation });
    interactionRuntime.availableStation = expectedStation;
  }, [expectedStation]);

  const finishExit = useCallback((cancelled: boolean) => {
    if (completionTimer.current !== null) clearTimeout(completionTimer.current);
    completionTimer.current = null;
    const root = document.querySelector<HTMLElement>("[data-experience-root]");
    root?.removeAttribute("data-interaction-active");
    root?.removeAttribute("data-lenis-prevent");
    root?.removeAttribute("data-interaction-result");
    root?.removeAttribute("data-interaction-departing");
    const copyLayer = root?.querySelector<HTMLElement>("[data-copy-layer]");
    if (copyLayer) { copyLayer.inert = false; copyLayer.removeAttribute("aria-hidden"); }
    if (panelRoot.current?.contains(document.activeElement) || document.activeElement === document.body) {
      if (previousFocus.current?.isConnected) previousFocus.current.focus({ preventScroll: true });
    }
    root?.dispatchEvent(new Event("mandegar:interaction-release"));
    dispatch({ type: "EXIT", cancelled });
    interactionRuntime.activeStation = null;
    resultAt.current = null;
    setDeparting(false);
  }, []);

  const exit = useCallback((cancelled: boolean, delta = 0, immediate = false) => {
    if (departureTimer.current !== null) return;
    const station = interactionRuntime.activeStation;
    if (!station) { finishExit(cancelled); return; }
    // Reverse input can turn forward again within the departure fade, before
    // the idle arrival sampler runs. Rearm at the reverse departure itself.
    if (delta < 0 || window.scrollY < savedScroll.current - 2) autoStarted.current[station] = false;
    const root = document.querySelector<HTMLElement>("[data-experience-root]");
    root?.setAttribute("data-interaction-departing", station);
    setDeparting(true);
    window.dispatchEvent(new CustomEvent("mandegar:interaction-departure", { detail: { station } }));
    root?.removeAttribute("data-interaction-active");
    root?.dispatchEvent(new Event("mandegar:interaction-release"));
    if (delta) root?.dispatchEvent(new CustomEvent("mandegar:continue-scroll", { detail: { delta, immediate } }));
    departureTimer.current = setTimeout(() => {
      departureTimer.current = null;
      finishExit(cancelled);
    }, reducedMotion ? 0 : 400);
  }, [finishExit, reducedMotion]);

  const enter = useCallback((station: InteractionStation, input: InteractionInput) => {
    if (
      (runtime !== "adaptive" && runtime !== "full")
      || interactionRuntime.availableStation !== station
      || state.availableStation !== station
      || state.activeStation
    ) return;
    autoStarted.current[station] = true;
    resultAt.current = null;
    setDeparting(false);
    // A new forward visit always offers a fresh interaction. Saved creations
    // remain elsewhere in the journey until this station is visited again.
    if (station === "touch") resetInstallation();
    if (station === "game") resetRace();
    if (station === "draw") { clearDrawing(); clearDrawingDraft(); }
    dispatch({ type: "RESTART", station });
    setInteractionRun((previous) => previous + 1);
    scrollSkipAmount.current = 0;
    setScrollSkipProgress(0);
    if (station === "photo" || station === "stage") {
      interactionRuntime.scrollSceneVisit += 1;
      if (station === "photo") interactionRuntime.photoHoldProgress = photoScrollTiming.countdownStart;
      else interactionRuntime.stageHoldProgress = 0.2;
    }
    const root = document.querySelector<HTMLElement>("[data-experience-root]");
    savedScroll.current = window.scrollY;
    entryProgress.current = Number(root?.dataset.nativeProgress ?? 0);
    enteredAt.current = performance.now();
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Acquire before React commits: otherwise the arrival's remaining Lenis
    // movement can immediately look like a new scroll-to-leave gesture.
    interactionRuntime.activeStation = station;
    root?.setAttribute("data-interaction-active", station);
    dispatch({ type: "ENTER", station, input });
  }, [runtime, state.activeStation, state.availableStation]);

  useEffect(() => {
    if (
      !expectedStation
      || (runtime !== "adaptive" && runtime !== "full")
      || state.availableStation !== expectedStation
      || state.activeStation
    ) return;
    const root = document.querySelector<HTMLElement>("[data-experience-root]");
    const beat = narrativeScore.find((item) => item.id === activePhase);
    if (!root || !beat) return;
    // The authored Touch camera still frames the booth at its midpoint.
    // Each automatic experience starts only at its usable composition.
    const arrival = beat.start + (beat.end - beat.start) * (expectedStation === "touch" ? 0.7 : 0.5);
    let frame: number;
    let lastProgress = Number(root.dataset.nativeProgress);
    let lastFrameAt = performance.now();
    let lastMotionAt = lastFrameAt;
    let sampled = false;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const checkArrival = () => {
      const now = performance.now();
      const nativeProgress = Number(root.dataset.nativeProgress);
      // A reverse visit rearms the next forward arrival, without reopening a
      // station immediately after Skip or completion at the same position.
      if (root.dataset.scrollDirection === "backward"
        || nativeProgress < arrival - 0.004) autoStarted.current[expectedStation] = false;
      const movement = Math.abs(nativeProgress - lastProgress) * Math.max(1, root.offsetHeight - window.innerHeight);
      const speed = movement / Math.max(16, now - lastFrameAt);
      lastProgress = nativeProgress;
      lastFrameAt = now;
      if (movement > 1) lastMotionAt = now;
      const fastWheel = now - wheelIntent.current.at < 250 && Math.abs(wheelIntent.current.deltaY) > window.innerHeight * 1.5;
      const touchSettled = !touching.current && now - touchEndedAt.current > 160
        && (!coarsePointer || (now - lastMotionAt >= 100 && now - nativeScrolledAt.current >= 160));
      if (sampled && root.dataset.storyStage === beat.id
        && !interactionRuntime.activeStation
        && interactionRuntime.availableStation === expectedStation
        && !autoStarted.current[expectedStation]
        && nativeProgress >= arrival - 0.0001 && nativeProgress <= beat.end - 0.006
        && root.dataset.scrollDirection === "forward"
        && speed <= 2.4 && !fastWheel && touchSettled) {
        enter(expectedStation, "automatic");
        return;
      }
      sampled = true;
      frame = window.requestAnimationFrame(checkArrival);
    };
    frame = window.requestAnimationFrame(checkArrival);
    return () => window.cancelAnimationFrame(frame);
  }, [activePhase, enter, expectedStation, runtime, state.activeStation, state.availableStation]);

  const complete = useCallback((station: InteractionStation) => {
    // Report each run once, then keep its result until the visitor continues.
    if (resultAt.current !== null || departureTimer.current !== null) return;
    // Guard duplicate completion and input until the result has been painted.
    resultAt.current = Infinity;
    dispatch({ type: "COMPLETE", station });
    scrollSkipAmount.current = 0;
    setScrollSkipProgress(0);
    const root = document.querySelector<HTMLElement>("[data-experience-root]");
    root?.setAttribute("data-interaction-result", station);
  }, []);

  useEffect(() => {
    if (state.lifecycle !== "complete" || !state.activeStation) return;
    const root = document.querySelector<HTMLElement>("[data-experience-root]");
    // Start readability after React commits the result and it can be painted.
    // Slow rendering must not consume the visitor's protected reading period.
    const frame = requestAnimationFrame(() => {
      if (departureTimer.current !== null) return;
      resultAt.current = performance.now();
      completionTimer.current = setTimeout(() => {
        completionTimer.current = null;
        root?.removeAttribute("data-interaction-active");
        root?.removeAttribute("data-lenis-prevent");
        root?.dispatchEvent(new Event("mandegar:interaction-release"));
        savedScroll.current = window.scrollY;
      }, 900);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (completionTimer.current !== null) clearTimeout(completionTimer.current);
      completionTimer.current = null;
    };
  }, [state.activeStation, state.lifecycle]);

  const restart = useCallback((station: InteractionStation) => {
    resultAt.current = null;
    setDeparting(false);
    if (departureTimer.current !== null) clearTimeout(departureTimer.current);
    departureTimer.current = null;
    if (completionTimer.current !== null) clearTimeout(completionTimer.current);
    completionTimer.current = null;
    scrollSkipAmount.current = 0;
    setScrollSkipProgress(0);
    savedScroll.current = window.scrollY;
    enteredAt.current = performance.now();
    const root = document.querySelector<HTMLElement>("[data-experience-root]");
    root?.removeAttribute("data-interaction-result");
    root?.removeAttribute("data-interaction-departing");
    entryProgress.current = Number(root?.dataset.nativeProgress ?? 0);
    root?.setAttribute("data-interaction-active", station);
    const copyLayer = root?.querySelector<HTMLElement>("[data-copy-layer]");
    if (copyLayer) { copyLayer.inert = true; copyLayer.setAttribute("aria-hidden", "true"); }
    dispatch({ type: "RESTART", station });
  }, []);

  useEffect(() => {
    const handleRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ station: InteractionStation; input: InteractionInput }>).detail;
      if (detail) enter(detail.station, detail.input);
    };
    const handleAnchors = (event: Event) => {
      const detail = (event as CustomEvent<InteractionAnchorFrame>).detail;
      if (!detail) return;
      anchors.current = detail;
      applyAnchorFrame(detail);
    };
    const handleParticipation = (event: Event) => {
      const station = (event as CustomEvent<{ station: InteractionStation }>).detail?.station;
      if (!station || interactionRuntime.activeStation !== station) return;
      scrollSkipAmount.current = 0;
      setScrollSkipProgress(0);
    };
    const handlePassiveComplete = (event: Event) => {
      const station = (event as CustomEvent<{ station: InteractionStation }>).detail?.station;
      if (station && interactionRuntime.activeStation === station) complete(station);
    };
    window.addEventListener("mandegar:interaction-request", handleRequest);
    window.addEventListener("mandegar:interaction-anchors", handleAnchors);
    window.addEventListener("mandegar:interaction-participation", handleParticipation);
    window.addEventListener("mandegar:passive-complete", handlePassiveComplete);
    return () => {
      window.removeEventListener("mandegar:interaction-request", handleRequest);
      window.removeEventListener("mandegar:interaction-anchors", handleAnchors);
      window.removeEventListener("mandegar:interaction-participation", handleParticipation);
      window.removeEventListener("mandegar:passive-complete", handlePassiveComplete);
    };
  }, [applyAnchorFrame, complete, enter]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const root = panelRoot.current;
    if (!root) return;
    root.dataset.reactRenderCount = String(Number(root.dataset.reactRenderCount ?? 0) + 1);
  });

  useEffect(() => {
    applyAnchorFrame(anchors.current);
  }, [applyAnchorFrame, showAnchorDebug, state.availableStation]);

  useEffect(() => {
    if (!state.activeStation) return;
    if (state.activeStation !== expectedStation || (runtime !== "adaptive" && runtime !== "full")) exit(true);
  }, [expectedStation, exit, runtime, state.activeStation]);

  useEffect(() => {
    // A swipe begun on the held scene keeps moving after React releases the
    // station. Its touch-action was chosen at touchstart, so forward the rest
    // of that same gesture rather than requiring a second swipe.
    const move = (event: TouchEvent) => {
      const previousY = continuingTouch.current;
      const y = event.touches[0]?.clientY;
      if (previousY === null || y === undefined) return;
      continuingTouch.current = y;
      document.querySelector<HTMLElement>("[data-experience-root]")?.dispatchEvent(new CustomEvent("mandegar:continue-scroll", {
        detail: { delta: previousY - y, immediate: true },
      }));
      if (event.cancelable) event.preventDefault();
    };
    const wheel = (event: WheelEvent) => {
      const now = performance.now();
      wheelIntent.current = { at: now, gap: now - wheelIntent.current.at, deltaY: event.deltaY };
    };
    const start = () => { touching.current = true; };
    const scroll = () => { nativeScrolledAt.current = performance.now(); };
    const end = (event: TouchEvent) => {
      touching.current = event.touches.length > 0;
      if (!touching.current) {
        continuingTouch.current = null;
        touchEndedAt.current = performance.now();
      }
    };
    window.addEventListener("wheel", wheel, { capture: true, passive: true });
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("touchstart", start, { capture: true, passive: true });
    window.addEventListener("touchmove", move, { capture: true, passive: false });
    window.addEventListener("touchend", end, true);
    window.addEventListener("touchcancel", end, true);
    return () => {
      window.removeEventListener("touchmove", move, true);
      window.removeEventListener("wheel", wheel, true);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("touchstart", start, true);
      window.removeEventListener("touchend", end, true);
      window.removeEventListener("touchcancel", end, true);
      touching.current = false;
      continuingTouch.current = null;
    };
  }, []);

  useEffect(() => {
    if (!state.activeStation || state.activeStation !== expectedStation) return;
    const root = document.querySelector<HTMLElement>("[data-experience-root]");
    const canvas = document.querySelector<HTMLCanvasElement>("[data-experience-canvas='true']");
    const oldTouch = canvas?.style.touchAction ?? "";
    const restoreFocus = previousFocus.current;
    const focusScope = panelRoot.current;
    interactionRuntime.activeStation = state.activeStation;
    root?.setAttribute("data-interaction-active", state.activeStation);
    const copyLayer = root?.querySelector<HTMLElement>("[data-copy-layer]");
    if (copyLayer) { copyLayer.inert = true; copyLayer.setAttribute("aria-hidden", "true"); }
    // Canvas gestures are classified below: controls keep their drag; a swipe
    // on the rest of the scene leaves and continues the page in one gesture.
    if (canvas) canvas.style.touchAction = "none";
    let released = false;
    let touchY: number | null = null;
    let touchOwnsControl = false;
    const passive = state.activeStation === "photo" || state.activeStation === "stage";
    let arrivalWheel = performance.now() - wheelIntent.current.at < 160;
    const leave = (delta = 0, immediate = false) => { if (!released) { released = true; exit(resultAt.current === null, delta, immediate); } };
    const stepStage = (amount: number, stepSize: number) => {
      scrollSkipAmount.current = Math.max(0, Math.min(1, scrollSkipAmount.current + amount / (stepSize * 5)));
      const lamps = Math.floor(scrollSkipAmount.current * 5 + 0.000001);
      interactionRuntime.stageHoldProgress = 0.2 + lamps * 0.12;
      setScrollSkipProgress(lamps / 5);
    };
    const fillSkip = (amount: number, threshold: number, immediate = false) => {
      if (departureTimer.current !== null) return true;
      if (resultAt.current !== null) {
        // The unlock timer owns the end of reading protection. A residual
        // wheel RAF must not depart before that timer releases the real hold.
        if (performance.now() - resultAt.current >= 900 && root && !root.hasAttribute("data-interaction-active")) leave(amount, immediate);
        return false;
      }
      scrollSkipAmount.current = Math.min(1, scrollSkipAmount.current + amount / threshold);
      setScrollSkipProgress(scrollSkipAmount.current);
      const beat = narrativeScore.find((item) => item.id === activePhase)!;
      const travel = Math.max(0, Math.min(0.012, beat.end - entryProgress.current - 0.012));
      root?.dispatchEvent(new CustomEvent("mandegar:interaction-scrub", {
        detail: { progress: entryProgress.current + travel * scrollSkipAmount.current },
      }));
      if (scrollSkipAmount.current >= 1 - 0.000001) {
        // Passive sequences reach their result first. Further scroll then
        // continues; no old scroll packet can eject a freshly captured photo.
        if (!passive) leave(amount, immediate);
      }
      return false;
    };
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || event.deltaY === 0) return;
      if (departureTimer.current !== null) return;
      if (event.deltaY < 0 && !(state.activeStation === "stage" && resultAt.current === null && scrollSkipAmount.current > 0)) { leave(event.deltaY); if (event.cancelable) event.preventDefault(); return; }
      if (arrivalWheel && performance.now() - enteredAt.current < 160 && wheelIntent.current.gap < 160) {
        if (event.cancelable) event.preventDefault();
        return;
      }
      arrivalWheel = false;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      if (state.activeStation === "stage" && resultAt.current === null) {
        stepStage(Math.max(-120, Math.min(120, event.deltaY * unit)), scrollHoldTiming.stageWheelStep);
        if (event.cancelable) event.preventDefault();
        return;
      }
      // A large mouse notch gets the same grace as a normal notch. Small
      // trackpad packets accumulate continuously instead of counting events.
      const threshold = passive ? scrollHoldTiming.wheelThreshold : scrollHoldTiming.interactionWheelThreshold;
      if (!fillSkip(Math.min(120, event.deltaY * unit), threshold) && event.cancelable) event.preventDefault();
    };
    const touchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? null;
      const target = event.target as HTMLElement | null;
      touchOwnsControl = Boolean(target?.closest("[data-installation-controls], [data-mobile-game-dock], [data-mobile-drawing-dock], button"));
    };
    const touchMove = (event: TouchEvent) => {
      if (continuingTouch.current !== null) return;
      const y = event.touches[0]?.clientY;
      if (y === undefined || touchY === null) return;
      if (touchOwnsControl || interactionRuntime.gestureStation) {
        if (event.cancelable) event.preventDefault();
        return;
      }
      const delta = touchY - y;
      touchY = y;
      if (delta === 0) return;
      if (state.activeStation === "stage" && resultAt.current === null && (delta > 0 || scrollSkipAmount.current > 0)) {
        stepStage(delta, scrollHoldTiming.stageTouchStep);
        if (event.cancelable) event.preventDefault();
        return;
      }
      const threshold = passive ? scrollHoldTiming.touchThreshold : scrollHoldTiming.interactionTouchThreshold;
      if (delta > 0) {
        fillSkip(delta, threshold, true);
        // The packet that releases the hold is already forwarded by leave().
        // Keep ownership of the same swipe so later packets continue moving.
        if (released) continuingTouch.current = y;
        if (event.cancelable) event.preventDefault();
        return;
      }
      leave(delta, true);
      continuingTouch.current = y;
      touchY = y;
      if (event.cancelable) event.preventDefault();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); leave(); return; }
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (state.activeStation === "stage" && resultAt.current === null && ["ArrowDown", "ArrowUp", "PageDown", "PageUp", " "].includes(event.key)
        && !target?.closest("input, textarea") && !(event.key === " " && target?.closest("button"))) {
        event.preventDefault();
        stepStage(["ArrowUp", "PageUp"].includes(event.key) ? -120 : 120, scrollHoldTiming.stageWheelStep);
        return;
      }
      const ownsInput = target?.closest("[data-installation-controls], [data-game-spatial-controls], [data-mobile-game-dock], [data-drawing-spatial-controls], input, textarea, button");
      if (!ownsInput && ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) leave();
      else if (["PageUp", "PageDown"].includes(event.key)) leave();
    };
    const nativeScroll = () => {
      if (performance.now() - enteredAt.current < 80) return;
      if (Math.abs(window.scrollY - savedScroll.current) > 2) leave();
    };
    const loss = () => leave();
    window.addEventListener("wheel", wheel, { capture: true, passive: false });
    window.addEventListener("touchstart", touchStart, { capture: true, passive: true });
    window.addEventListener("touchmove", touchMove, { capture: true, passive: false });
    window.addEventListener("keydown", key);
    window.addEventListener("scroll", nativeScroll, { passive: true });
    document.addEventListener("webglcontextlost", loss, true);
    const frame = requestAnimationFrame(() => panelRoot.current?.querySelector<HTMLElement>("[data-interaction-escape]")?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("wheel", wheel, true);
      window.removeEventListener("touchstart", touchStart, true);
      window.removeEventListener("touchmove", touchMove, true);
      window.removeEventListener("keydown", key);
      window.removeEventListener("scroll", nativeScroll);
      document.removeEventListener("webglcontextlost", loss, true);
      if (canvas) canvas.style.touchAction = oldTouch;
      root?.removeAttribute("data-interaction-active");
      root?.removeAttribute("data-lenis-prevent");
      if (copyLayer) { copyLayer.inert = false; copyLayer.removeAttribute("aria-hidden"); }
      interactionRuntime.gestureStation = null;
      if (focusScope?.contains(document.activeElement) && restoreFocus?.isConnected) restoreFocus.focus({ preventScroll: true });
    };
  }, [activePhase, exit, expectedStation, state.activeStation]);
  useEffect(() => {
    if (state.lifecycle !== "cancelled") return;
    const frame = requestAnimationFrame(() => dispatch({ type: "AVAILABILITY", station: expectedStation }));
    return () => cancelAnimationFrame(frame);
  }, [expectedStation, state.lifecycle]);

  useEffect(() => () => {
    if (completionTimer.current !== null) clearTimeout(completionTimer.current);
    if (departureTimer.current !== null) clearTimeout(departureTimer.current);
    resetInteractionRuntime();
  }, []);

  const station = state.activeStation;
  const isResult = state.lifecycle === "complete";
  return (
    <div
      ref={panelRoot}
      className={styles.root}
      data-interaction-director
      data-available-station={state.availableStation ?? "none"}
      data-active-station={station ?? "none"}
      data-lifecycle={state.lifecycle}
      data-presentation={departing ? "departing" : isResult ? "result" : station ? "active" : "arrival"}
      data-completed-touch={String(state.completed.touch)}
      data-scroll-locked={station && state.lifecycle !== "complete" ? "true" : "false"}
      data-runtime={runtime}
    >
      {station === "touch" && (
        <TouchComposerInteraction
          key={interactionRun}
          locale={locale}
        />
      )}

      {station === "game" && (
        <GameInteraction
          key={interactionRun}
          copy={copy}
          reducedMotion={reducedMotion}
          onClose={() => exit(true)}
          onComplete={() => complete("game")}
          onReset={() => restart("game")}
          onContinue={() => exit(false)}
        />
      )}

      {station === "draw" && (
        <DrawingInteraction
          key={interactionRun}
          copy={copy}
          onClose={() => exit(true)}
          onComplete={() => complete("draw")}
          onContinue={() => exit(false)}
        />
      )}

      <ScrollScenes locale={locale} enabled={runtime === "adaptive" || runtime === "full"} />
      {station && (
        <div className={styles.journeyControl} data-journey-control data-phase={activePhase}>
          <p className={styles.journeyMessage} data-interaction-result={isResult ? station : undefined} role={isResult ? "status" : undefined} tabIndex={isResult ? -1 : undefined}>
            {isResult ? station === "touch" ? copy.touch.complete : station === "photo" ? copy.photo.delivery : station === "stage" ? copy.stage.finale : station === "game" ? copy.game.crashed : copy.draw.complete : station === "touch" ? installationCopy[locale].instruction : copy.stations[station].instruction}
          </p>
          {!isResult &&
          <button type="button" className={styles.journeyButton} data-interaction-escape data-mobile-interaction-skip
            data-scroll-skip-progress={scrollSkipProgress.toFixed(3)}
            aria-describedby="interaction-scroll-hint"
            onClick={() => exit(true)}>
            {copy.skip}
            <i className={styles.skipTrack} data-scroll-skip-fill aria-hidden="true">
              <i style={{ transform: `scaleX(${scrollSkipProgress})` }} />
            </i>
          </button>
          }
          <span id="interaction-scroll-hint">{isResult ? copy.scrollNext : copy.scrollContinue}</span>
        </div>
      )}

      {showAnchorDebug && (
        <div className={styles.anchorDebug} data-anchor-debug aria-hidden="true">
          {interactionStationNames.map((name) => {
            const point = initialAnchors.stations[name];
            return (
              <i
                key={name}
                ref={(element) => {
                  if (element) debugAnchorElements.current[name] = element;
                  else delete debugAnchorElements.current[name];
                }}
                style={{ left: point.x, top: point.y }}
                data-fallback={point.fallback ? "true" : "false"}
                data-anchor-debug-point={name}
              >
                {name}
              </i>
            );
          })}
        </div>
      )}
    </div>
  );
});
