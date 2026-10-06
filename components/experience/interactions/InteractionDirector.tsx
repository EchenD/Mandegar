"use client";

import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import type { ScenePhaseId } from "../narrative-score";
import { heroTimeline } from "../hero-timeline-config";
import { sampleHeroTimeline } from "../hero-timeline";
import { experienceState } from "../experience-state";
import { DrawingInteraction } from "./DrawingInteraction";
import { GameInteraction } from "./GameInteraction";
import { getInteractionCopy } from "./interaction-copy";
import { getStationForPhase, interactionRegistry } from "./interaction-registry";
import { interactionRuntime, resetInteractionRuntime } from "./interaction-runtime";
import { initialInteractionState, interactionReducer } from "./interaction-state";
import type { InteractionAnchorFrame, InteractionInput, InteractionStation } from "./interaction-types";
import { clearDrawing, clearDrawingDraft } from "./visitor-creation";
import { resetRace } from "./race-game";
import { ScrollScenes } from "./ScrollScenes";
import { TouchComposerInteraction } from "./TouchComposerInteraction";
import { resetInstallation, installationCopy } from "./installation-demo";
import styles from "./HeroInteractions.module.css";

const interactionStationNames: readonly InteractionStation[] = ["photo", "touch", "stage", "game", "draw"];
const pageScrollKeys = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);

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

export const InteractionDirector = memo(function InteractionDirector({ locale, activePhase, runtime }: {
  locale: Locale;
  activePhase: ScenePhaseId;
  runtime: "pending" | "fallback" | "adaptive" | "full";
}) {
  const copy = useMemo(() => getInteractionCopy(locale), [locale]);
  const initialAnchors = useMemo(() => fallbackFrame(), []);
  const [state, dispatch] = useReducer(interactionReducer, initialInteractionState);
  const [expectedStation, setExpectedStation] = useState<InteractionStation | null>(null);
  const [showAnchorDebug, setShowAnchorDebug] = useState(false);
  const [reducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [scrollSkipProgress, setScrollSkipProgress] = useState(0);
  const [interactionRun, setInteractionRun] = useState(0);
  const [departing, setDeparting] = useState(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  const departureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionFrame = useRef<number | null>(null);
  const completionReported = useRef(false);
  const completionInputVersion = useRef(0);
  const autoStarted = useRef<Partial<Record<InteractionStation, boolean>>>({});
  const previousExpectedStation = useRef<InteractionStation | null>(null);
  const panelRoot = useRef<HTMLDivElement>(null);
  const anchors = useRef(initialAnchors);
  const debugAnchorElements = useRef<Partial<Record<InteractionStation, HTMLElement>>>({});
  const arrivalInput = useRef({
    touching: false,
    touchEndedAt: -Infinity,
    nativeScrolledAt: -Infinity,
    wheelAt: -Infinity,
    wheelDelta: 0,
    keyboard: false,
    version: 0,
  });

  const applyAnchorFrame = useCallback((frame: InteractionAnchorFrame) => {
    interactionStationNames.forEach((name) => {
      const element = debugAnchorElements.current[name];
      if (!element) return;
      const point = frame.stations[name];
      element.style.left = `${point.x}px`;
      element.style.top = `${point.y}px`;
      element.dataset.fallback = String(point.fallback);
    });
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShowAnchorDebug(process.env.NODE_ENV === "development"
      && new URLSearchParams(window.location.search).get("anchors") === "1"));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const input = arrivalInput.current;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || event.deltaY === 0) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
      input.wheelAt = performance.now();
      input.wheelDelta = event.deltaY * unit;
      input.keyboard = false;
      input.version += 1;
    };
    const start = () => { input.touching = true; input.keyboard = false; input.version += 1; };
    const end = (event: TouchEvent) => {
      input.touching = event.touches.length > 0;
      if (!input.touching) input.touchEndedAt = performance.now();
    };
    const scroll = () => { input.nativeScrolledAt = performance.now(); };
    const pointer = () => { input.keyboard = false; };
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")
        || (event.key === " " && target?.closest("button"))) return;
      if (event.key === "Tab" || pageScrollKeys.has(event.key)) input.keyboard = true;
      if (event.key === "Escape" || pageScrollKeys.has(event.key)) input.version += 1;
    };
    const seek = () => { input.version += 1; };
    const root = document.querySelector<HTMLElement>("[data-experience-root]");
    window.addEventListener("wheel", wheel, { capture: true, passive: true });
    window.addEventListener("touchstart", start, { capture: true, passive: true });
    window.addEventListener("touchend", end, true);
    window.addEventListener("touchcancel", end, true);
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("pointerdown", pointer, true);
    window.addEventListener("keydown", key);
    root?.addEventListener("mandegar:seek", seek);
    return () => {
      window.removeEventListener("wheel", wheel, true);
      window.removeEventListener("touchstart", start, true);
      window.removeEventListener("touchend", end, true);
      window.removeEventListener("touchcancel", end, true);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("pointerdown", pointer, true);
      window.removeEventListener("keydown", key);
      root?.removeEventListener("mandegar:seek", seek);
      input.touching = false;
    };
  }, []);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-experience-root]");
    if (!root) return;
    const update = () => {
      const sample = sampleHeroTimeline(heroTimeline, Number(root.dataset.nativeProgress ?? experienceState.progress));
      const candidate = getStationForPhase(sample.phase.id);
      const station = sample.inViewingWindow && sample.progress < sample.phase.end
        && candidate !== "photo" && candidate !== "stage"
        && root.dataset.reducedMotion !== "true"
        && (runtime === "adaptive" || runtime === "full") ? candidate : null;
      interactionRuntime.availableStation = station;
      setExpectedStation(station);
      setScrollSkipProgress(sample.windowProgress);
    };
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["data-native-progress", "data-reduced-motion"] });
    update();
    return () => observer.disconnect();
  }, [activePhase, runtime]);

  useEffect(() => {
    if (previousExpectedStation.current !== expectedStation) {
      if (previousExpectedStation.current) autoStarted.current[previousExpectedStation.current] = false;
      previousExpectedStation.current = expectedStation;
    }
    dispatch({ type: "AVAILABILITY", station: expectedStation });
  }, [expectedStation, state.activeStation]);

  const cancelResultAdvance = useCallback(() => {
    if (completionTimer.current !== null) clearTimeout(completionTimer.current);
    if (completionFrame.current !== null) cancelAnimationFrame(completionFrame.current);
    completionTimer.current = null;
    completionFrame.current = null;
  }, []);

  const cancelPhaseAdvance = useCallback(() => {
    cancelResultAdvance();
    document.querySelector<HTMLElement>("[data-experience-root]")?.dispatchEvent(new Event("mandegar:cancel-finish-phase"));
  }, [cancelResultAdvance]);

  const finishExit = useCallback((cancelled: boolean) => {
    cancelPhaseAdvance();
    const root = document.querySelector<HTMLElement>("[data-experience-root]");
    root?.removeAttribute("data-interaction-active");
    root?.removeAttribute("data-interaction-result");
    root?.removeAttribute("data-interaction-departing");
    const copyLayer = root?.querySelector<HTMLElement>("[data-copy-layer]");
    if (copyLayer) { copyLayer.inert = false; copyLayer.removeAttribute("aria-hidden"); }
    if ((panelRoot.current?.contains(document.activeElement) || document.activeElement === document.body)
      && previousFocus.current?.isConnected) previousFocus.current.focus({ preventScroll: true });
    interactionRuntime.activeStation = null;
    interactionRuntime.gestureStation = null;
    dispatch({ type: "EXIT", cancelled });
    setDeparting(false);
  }, [cancelPhaseAdvance]);

  const exit = useCallback((cancelled: boolean) => {
    if (departureTimer.current !== null) return;
    cancelPhaseAdvance();
    const station = interactionRuntime.activeStation;
    if (!station) { finishExit(cancelled); return; }
    document.querySelector<HTMLElement>("[data-experience-root]")?.setAttribute("data-interaction-departing", station);
    setDeparting(true);
    window.dispatchEvent(new CustomEvent("mandegar:interaction-departure", { detail: { station } }));
    departureTimer.current = setTimeout(() => {
      departureTimer.current = null;
      finishExit(cancelled);
    }, reducedMotion ? 0 : 400);
  }, [cancelPhaseAdvance, finishExit, reducedMotion]);

  const enter = useCallback((station: InteractionStation, input: InteractionInput) => {
    if (interactionRuntime.availableStation !== station || state.availableStation !== station
      || state.activeStation || interactionRuntime.activeStation) return;
    const sample = sampleHeroTimeline(heroTimeline, experienceState.progress);
    if (sample.phase.id !== interactionRegistry[station].phase
      || !sample.inViewingWindow || sample.progress >= sample.phase.end) return;
    cancelPhaseAdvance();
    completionReported.current = false;
    autoStarted.current[station] = true;
    if (station === "touch") resetInstallation();
    if (station === "game") resetRace();
    if (station === "draw") { clearDrawing(); clearDrawingDraft(); }
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    interactionRuntime.activeStation = station;
    document.querySelector<HTMLElement>("[data-experience-root]")?.setAttribute("data-interaction-active", station);
    setInteractionRun((run) => run + 1);
    dispatch({ type: "RESTART", station });
    dispatch({ type: "ENTER", station, input });
  }, [cancelPhaseAdvance, state.activeStation, state.availableStation]);

  useEffect(() => {
    if (!expectedStation || state.activeStation || state.availableStation !== expectedStation) return;
    const root = document.querySelector<HTMLElement>("[data-experience-root]");
    const phase = heroTimeline.phases.find((item) => item.id === interactionRegistry[expectedStation].phase);
    if (!root || !phase) return;
    let frame: number;
    let previousProgress = Number(root.dataset.nativeProgress ?? 0);
    let previousTime = performance.now();
    let lastMotionAt = previousTime;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    let sampled = false;
    const checkArrival = () => {
      const now = performance.now();
      const progress = Number(root.dataset.nativeProgress ?? 0);
      if (root.dataset.scrollDirection === "backward" || progress < phase.start) autoStarted.current[expectedStation] = false;
      const pixels = Math.abs(progress - previousProgress) * Math.max(1, Number(root.dataset.cameraScrollDistance) || root.offsetHeight - innerHeight);
      const speed = pixels / Math.max(16, now - previousTime);
      if (pixels > 1) lastMotionAt = now;
      const input = arrivalInput.current;
      const fastWheel = now - input.wheelAt < 250 && Math.abs(input.wheelDelta) > innerHeight * 1.5;
      const touchSettled = !input.touching && now - input.touchEndedAt >= 160
        && (!coarsePointer || (now - lastMotionAt >= 100 && now - input.nativeScrolledAt >= 160));
      previousProgress = progress;
      previousTime = now;
      if (sampled && root.dataset.scrollDirection === "forward"
        && root.dataset.storyStage === phase.id && root.dataset.reducedMotion !== "true"
        && !autoStarted.current[expectedStation] && !interactionRuntime.activeStation
        && progress >= phase.preview - .0001 && progress < phase.end
        && speed <= 2.4 && touchSettled && !fastWheel && now - input.wheelAt >= 160) {
        enter(expectedStation, input.keyboard ? "keyboard" : "automatic");
        return;
      }
      sampled = true;
      frame = requestAnimationFrame(checkArrival);
    };
    frame = requestAnimationFrame(checkArrival);
    return () => cancelAnimationFrame(frame);
  }, [enter, expectedStation, state.activeStation, state.availableStation]);

  const continuePhase = useCallback((station: InteractionStation) => {
    cancelResultAdvance();
    const root = document.querySelector<HTMLElement>("[data-experience-root]");
    root?.dispatchEvent(new CustomEvent("mandegar:finish-phase", { detail: { phase: interactionRegistry[station].phase } }));
  }, [cancelResultAdvance]);

  const complete = useCallback((station: InteractionStation) => {
    if (interactionRuntime.activeStation !== station || departureTimer.current !== null || completionReported.current) return;
    completionReported.current = true;
    completionInputVersion.current = arrivalInput.current.version;
    dispatch({ type: "COMPLETE", station });
    document.querySelector<HTMLElement>("[data-experience-root]")?.setAttribute("data-interaction-result", station);
  }, []);

  useEffect(() => {
    const station = state.activeStation;
    if (!station || state.lifecycle !== "complete") return;
    // New input can arrive between completion and React committing the result.
    // The permanent input tracker covers that gap before these listeners exist.
    if (arrivalInput.current.version !== completionInputVersion.current) return;
    // Start reading protection after React commits the result and the browser
    // has had a frame to paint it. The page remains scrollable throughout.
    completionFrame.current = requestAnimationFrame(() => {
      completionFrame.current = requestAnimationFrame(() => {
        completionFrame.current = null;
        completionTimer.current = setTimeout(() => {
          completionTimer.current = null;
          if (interactionRuntime.activeStation === station && departureTimer.current === null) continuePhase(station);
        }, 900);
      });
    });
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")
        || (event.key === " " && target?.closest("button"))) return;
      if (event.key === "Escape" || pageScrollKeys.has(event.key)) cancelResultAdvance();
    };
    const root = document.querySelector<HTMLElement>("[data-experience-root]");
    // Cancel on new scroll intent, not native scroll events: those also fire
    // while an earlier wheel gesture is still easing toward its target.
    window.addEventListener("wheel", cancelResultAdvance, { passive: true });
    window.addEventListener("touchstart", cancelResultAdvance, { passive: true });
    window.addEventListener("keydown", key);
    root?.addEventListener("mandegar:seek", cancelResultAdvance);
    return () => {
      cancelResultAdvance();
      window.removeEventListener("wheel", cancelResultAdvance);
      window.removeEventListener("touchstart", cancelResultAdvance);
      window.removeEventListener("keydown", key);
      root?.removeEventListener("mandegar:seek", cancelResultAdvance);
    };
  }, [cancelResultAdvance, continuePhase, state.activeStation, state.lifecycle]);

  const restart = useCallback((station: InteractionStation) => {
    if (interactionRuntime.activeStation !== station || interactionRuntime.availableStation !== station) return;
    cancelPhaseAdvance();
    if (departureTimer.current !== null) clearTimeout(departureTimer.current);
    departureTimer.current = null;
    completionReported.current = false;
    setDeparting(false);
    const root = document.querySelector<HTMLElement>("[data-experience-root]");
    root?.removeAttribute("data-interaction-result");
    root?.removeAttribute("data-interaction-departing");
    if (station === "touch") resetInstallation();
    if (station === "game") resetRace();
    if (station === "draw") { clearDrawing(); clearDrawingDraft(); }
    setInteractionRun((run) => run + 1);
    dispatch({ type: "RESTART", station });
  }, [cancelPhaseAdvance]);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-experience-root]");
    const leaveForSection = () => {
      if (departureTimer.current !== null) clearTimeout(departureTimer.current);
      departureTimer.current = null;
      if (interactionRuntime.activeStation) finishExit(true);
    };
    const finished = () => exit(false);
    window.addEventListener("mandegar:home-section", leaveForSection);
    root?.addEventListener("mandegar:phase-finished", finished);
    return () => {
      window.removeEventListener("mandegar:home-section", leaveForSection);
      root?.removeEventListener("mandegar:phase-finished", finished);
    };
  }, [exit, finishExit]);

  useEffect(() => {
    const handleRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ station: InteractionStation; input: InteractionInput }>).detail;
      if (detail) enter(detail.station, detail.input);
    };
    const handleAnchors = (event: Event) => {
      const frame = (event as CustomEvent<InteractionAnchorFrame>).detail;
      if (!frame) return;
      anchors.current = frame;
      applyAnchorFrame(frame);
    };
    window.addEventListener("mandegar:interaction-request", handleRequest);
    window.addEventListener("mandegar:interaction-anchors", handleAnchors);
    return () => {
      window.removeEventListener("mandegar:interaction-request", handleRequest);
      window.removeEventListener("mandegar:interaction-anchors", handleAnchors);
    };
  }, [applyAnchorFrame, enter]);

  useEffect(() => { applyAnchorFrame(anchors.current); }, [applyAnchorFrame, expectedStation, showAnchorDebug, state.activeStation]);

  useEffect(() => {
    if (!state.activeStation || state.input !== "keyboard") return;
    const frame = requestAnimationFrame(() => {
      panelRoot.current?.querySelector<HTMLElement>("[data-interaction-escape]")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [state.activeStation, state.input]);

  useEffect(() => {
    if (state.activeStation && state.activeStation !== expectedStation) exit(state.lifecycle !== "complete");
  }, [exit, expectedStation, state.activeStation, state.lifecycle]);

  useEffect(() => {
    if (!state.activeStation) return;
    const root = document.querySelector<HTMLElement>("[data-experience-root]");
    const copyLayer = root?.querySelector<HTMLElement>("[data-copy-layer]");
    if (copyLayer) { copyLayer.inert = true; copyLayer.setAttribute("aria-hidden", "true"); }
    // Game and drawing own their control gestures. Wheel and page keys still
    // move native scroll; a swipe outside a control remains a normal swipe.
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") exit(true); };
    const move = (event: TouchEvent) => {
      if (interactionRuntime.gestureStation && event.cancelable) event.preventDefault();
    };
    const loss = () => exit(true);
    window.addEventListener("keydown", key);
    window.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("webglcontextlost", loss, true);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("touchmove", move);
      document.removeEventListener("webglcontextlost", loss, true);
      if (copyLayer) { copyLayer.inert = false; copyLayer.removeAttribute("aria-hidden"); }
    };
  }, [exit, state.activeStation]);

  useEffect(() => () => {
    cancelPhaseAdvance();
    if (departureTimer.current !== null) clearTimeout(departureTimer.current);
    resetInteractionRuntime();
  }, [cancelPhaseAdvance]);

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
      data-scroll-locked="false"
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
          onContinue={() => station && continuePhase(station)}
        />
      )}

      {station === "draw" && (
        <DrawingInteraction
          key={interactionRun}
          copy={copy}
          onClose={() => exit(true)}
          onComplete={() => complete("draw")}
          onContinue={() => station && continuePhase(station)}
        />
      )}

      <ScrollScenes locale={locale} enabled={runtime === "adaptive" || runtime === "full"} />
      {station && (
        <div className={styles.journeyControl} data-journey-control data-phase={activePhase}>
          <p className={styles.journeyMessage} data-interaction-result={isResult ? station : undefined} role={isResult ? "status" : undefined} tabIndex={isResult ? -1 : undefined}>
            {isResult ? station === "touch" ? copy.touch.complete : station === "photo" ? copy.photo.delivery : station === "stage" ? copy.stage.finale : station === "game" ? copy.game.crashed : copy.draw.complete : station === "touch" ? installationCopy[locale].instruction : copy.stations[station].instruction}
          </p>
          {station === "touch" && !isResult && <button type="button" className={styles.journeyButton} data-interaction-finish
            onClick={() => complete("touch")}>{copy.finish}</button>}
          {!isResult &&
          <button type="button" className={styles.journeyButton} data-interaction-escape data-mobile-interaction-skip
            data-scroll-skip-progress={scrollSkipProgress.toFixed(3)}
            aria-describedby="interaction-scroll-hint"
            onClick={() => continuePhase(station)}>
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
