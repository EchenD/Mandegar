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
import { PhotoBoothInteraction } from "./PhotoBoothInteraction";
import { StageBeamInteraction } from "./StageBeamInteraction";
import { TouchComposerInteraction } from "./TouchComposerInteraction";
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
  const previousFocus = useRef<HTMLElement | null>(null);
  const autoStarted = useRef<Partial<Record<InteractionStation, boolean>>>({});
  const savedScroll = useRef(0);
  const savedScrollProgress = useRef<{
    distance: number;
    progress: number;
    rootTop: number;
  } | null>(null);
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
    dispatch({ type: "AVAILABILITY", station: expectedStation });
    interactionRuntime.availableStation = expectedStation;
  }, [expectedStation]);

  const exit = useCallback((cancelled: boolean) => {
    dispatch({ type: "EXIT", cancelled });
    interactionRuntime.activeStation = null;
  }, []);

  const enter = useCallback((station: InteractionStation, input: InteractionInput) => {
    if (
      interactionRuntime.availableStation !== station
      || state.availableStation !== station
      || state.activeStation
    ) return;
    autoStarted.current[station] = true;
    const root = document.querySelector<HTMLElement>("[data-experience-root]");
    const rootTop = root ? root.getBoundingClientRect().top + window.scrollY : 0;
    const distance = root ? Math.max(1, root.offsetHeight - window.innerHeight) : 1;
    const nativeProgress = Number(root?.dataset.nativeProgress);
    const progress = Number.isFinite(nativeProgress)
      ? Math.max(0, Math.min(1, nativeProgress))
      : Math.max(0, Math.min(1, (window.scrollY - rootTop) / distance));
    const canonicalScroll = root
      ? Math.max(0, Math.min(
        document.documentElement.scrollHeight - window.innerHeight,
        rootTop + distance * progress,
      ))
      : window.scrollY;
    savedScroll.current = Math.abs(window.scrollY - canonicalScroll) <= 2
      ? window.scrollY
      : canonicalScroll;
    savedScrollProgress.current = root
      ? {
        distance,
        progress,
        rootTop,
      }
      : null;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dispatch({ type: "ENTER", station, input });
  }, [state.activeStation, state.availableStation]);

  useEffect(() => {
    if (
      !expectedStation
      || (runtime !== "adaptive" && runtime !== "full")
      || state.availableStation !== expectedStation
      || state.activeStation
      || autoStarted.current[expectedStation]
    ) return;
    const root = document.querySelector<HTMLElement>("[data-experience-root]");
    const beat = narrativeScore.find((item) => item.id === activePhase);
    if (!root || !beat) return;
    let frame: number | undefined;
    const triggerProgress = Number(beat.preview.toFixed(4));
    const checkArrival = () => {
      if (
        root.dataset.storyStage !== beat.id
        || interactionRuntime.activeStation
        || interactionRuntime.availableStation !== expectedStation
        || autoStarted.current[expectedStation]
      ) {
        frame = window.requestAnimationFrame(checkArrival);
        return;
      }
      const narrativeProgress = Number(root.dataset.narrativeProgress);
      if (
        !Number.isFinite(narrativeProgress)
        || narrativeProgress < triggerProgress
        || narrativeProgress >= beat.end
        || root.dataset.scrollDirection !== "forward"
      ) {
        frame = window.requestAnimationFrame(checkArrival);
        return;
      }
      root.dispatchEvent(new CustomEvent("mandegar:seek", {
        detail: { progress: beat.preview, sync: true },
      }));
      enter(expectedStation, "automatic");
    };
    frame = window.requestAnimationFrame(checkArrival);
    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, [activePhase, enter, expectedStation, runtime, state.activeStation, state.availableStation]);

  const complete = useCallback((station: InteractionStation) => {
    dispatch({ type: "COMPLETING" });
    window.queueMicrotask(() => dispatch({ type: "COMPLETE", station }));
  }, []);

  const restart = useCallback((station: InteractionStation) => {
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
    window.addEventListener("mandegar:interaction-request", handleRequest);
    window.addEventListener("mandegar:interaction-anchors", handleAnchors);
    return () => {
      window.removeEventListener("mandegar:interaction-request", handleRequest);
      window.removeEventListener("mandegar:interaction-anchors", handleAnchors);
    };
  }, [applyAnchorFrame, enter]);

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
    if (state.activeStation !== expectedStation) exit(true);
  }, [expectedStation, exit, state.activeStation]);

  useEffect(() => {
    if (!state.activeStation || state.activeStation !== expectedStation) return;
    const html = document.documentElement;
    const body = document.body;
    const root = document.querySelector<HTMLElement>("[data-experience-root]");
    const canvas = document.querySelector<HTMLCanvasElement>("[data-experience-canvas='true']");
    const focusScope = panelRoot.current;
    const focusToRestore = previousFocus.current;
    const snapshot = savedScrollProgress.current;
    interactionRuntime.activeStation = state.activeStation;
    if (root && snapshot) {
      const canonicalScroll = snapshot.rootTop + snapshot.distance * snapshot.progress;
      if (Math.abs(window.scrollY - canonicalScroll) <= 2) savedScroll.current = window.scrollY;
    }
    const previous = {
      bodyOverscrollBehavior: body.style.overscrollBehavior,
      canvasTouchAction: canvas?.style.touchAction ?? "",
      htmlOverscrollBehavior: html.style.overscrollBehavior,
      rootOverflowAnchor: root?.style.overflowAnchor ?? "",
      rootLenisPrevent: root?.getAttribute("data-lenis-prevent") ?? null,
    };
    html.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";
    if (canvas) canvas.style.touchAction = "none";
    if (root) {
      root.style.overflowAnchor = "none";
      root.setAttribute("data-lenis-prevent", "");
    }
    root?.setAttribute("data-interaction-active", state.activeStation);

    const getRestoredScrollPosition = () => {
      const snapshot = savedScrollProgress.current;
      if (!root || !snapshot) return savedScroll.current;
      const rootTop = root.getBoundingClientRect().top + window.scrollY;
      const distance = Math.max(1, root.offsetHeight - window.innerHeight);
      const layoutChanged = Math.abs(distance - snapshot.distance) > 1
        || Math.abs(rootTop - snapshot.rootTop) > 1;
      return layoutChanged
        ? rootTop + distance * snapshot.progress
        : savedScroll.current;
    };
    const holdScrollPosition = () => {
      if (Math.abs(window.scrollY - savedScroll.current) < 0.5) return;
      window.scrollTo({ top: savedScroll.current, left: 0, behavior: "auto" });
    };

    const preventScrollKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        panelRoot.current?.querySelector<HTMLButtonElement>("[data-interaction-dismiss]")?.click();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Tab") {
        const focusable = Array.from(
          panelRoot.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex='-1'])",
          ) ?? [],
        ).filter((element) => element.offsetParent !== null);
        const first = focusable[0];
        const last = focusable.at(-1);
        const focusIsInside = focusable.some((element) => element === document.activeElement);
        if (first && last && !focusIsInside) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus({ preventScroll: true });
        } else if (first && last && event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus({ preventScroll: true });
        } else if (first && last && !event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus({ preventScroll: true });
        }
        return;
      }
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) {
        const target = event.target as HTMLElement | null;
        const editable = target?.closest(
          "input, select, textarea, [contenteditable='true']",
        );
        if (editable) return;
        if (event.key === " " && target?.closest("button")) return;
        event.preventDefault();
        const scroller = target?.closest<HTMLElement>(`.${styles.experienceBody}`);
        if (!scroller) return;
        const pageStep = Math.max(48, scroller.clientHeight * .8);
        const delta = event.key === "ArrowUp" ? -40
          : event.key === "ArrowDown" ? 40
            : event.key === "PageUp" ? -pageStep
              : event.key === "PageDown" || event.key === " " ? pageStep
                : 0;
        if (event.key === "Home") scroller.scrollTo({ top: 0, behavior: "auto" });
        else if (event.key === "End") scroller.scrollTo({ top: scroller.scrollHeight, behavior: "auto" });
        else scroller.scrollBy({ top: delta, behavior: "auto" });
      }
    };
    const cancelForWebglLoss = () => exit(true);
    const preventWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      const target = event.target as HTMLElement | null;
      const scroller = target?.closest<HTMLElement>(`.${styles.experienceBody}`);
      if (scroller && scroller.scrollHeight > scroller.clientHeight) {
        scroller.scrollBy({ top: event.deltaY, left: event.deltaX, behavior: "auto" });
      }
    };
    let previousTouchY: number | null = null;
    const rememberTouchPosition = (event: TouchEvent) => {
      previousTouchY = event.touches[0]?.clientY ?? null;
    };
    const preventTouchScroll = (event: TouchEvent) => {
      const target = event.target as HTMLElement | null;
      const scroller = target?.closest<HTMLElement>(`.${styles.experienceBody}`);
      const currentTouchY = event.touches[0]?.clientY;
      const deltaY = currentTouchY !== undefined && previousTouchY !== null
        ? previousTouchY - currentTouchY
        : 0;
      previousTouchY = currentTouchY ?? null;
      const maxScroll = scroller ? scroller.scrollHeight - scroller.clientHeight : 0;
      const canScrollInside = Boolean(scroller)
        && maxScroll > 1
        && ((deltaY > 0 && scroller!.scrollTop < maxScroll - 1)
          || (deltaY < 0 && scroller!.scrollTop > 1));
      if (!canScrollInside && event.cancelable) event.preventDefault();
    };
    const forgetTouchPosition = () => { previousTouchY = null; };
    window.addEventListener("keydown", preventScrollKeys);
    window.addEventListener("wheel", preventWheel, { capture: true, passive: false });
    window.addEventListener("touchstart", rememberTouchPosition, { capture: true, passive: true });
    window.addEventListener("touchmove", preventTouchScroll, { capture: true, passive: false });
    window.addEventListener("touchend", forgetTouchPosition, true);
    window.addEventListener("touchcancel", forgetTouchPosition, true);
    window.addEventListener("scroll", holdScrollPosition, { passive: true });
    document.addEventListener("webglcontextlost", cancelForWebglLoss, true);
    holdScrollPosition();
    const focusFrame = window.requestAnimationFrame(() => {
      panelRoot.current?.querySelector<HTMLElement>("[data-interaction-escape]")?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", preventScrollKeys);
      window.removeEventListener("wheel", preventWheel, true);
      window.removeEventListener("touchstart", rememberTouchPosition, true);
      window.removeEventListener("touchmove", preventTouchScroll, true);
      window.removeEventListener("touchend", forgetTouchPosition, true);
      window.removeEventListener("touchcancel", forgetTouchPosition, true);
      window.removeEventListener("scroll", holdScrollPosition);
      document.removeEventListener("webglcontextlost", cancelForWebglLoss, true);
      html.style.overscrollBehavior = previous.htmlOverscrollBehavior;
      body.style.overscrollBehavior = previous.bodyOverscrollBehavior;
      if (canvas) canvas.style.touchAction = previous.canvasTouchAction;
      if (root) {
        root.style.overflowAnchor = previous.rootOverflowAnchor;
        if (previous.rootLenisPrevent === null) root.removeAttribute("data-lenis-prevent");
        else root.setAttribute("data-lenis-prevent", previous.rootLenisPrevent);
      }
      const restoredScroll = getRestoredScrollPosition();
      if (Math.abs(window.scrollY - restoredScroll) >= 0.5) {
        window.scrollTo({ top: restoredScroll, left: 0, behavior: "auto" });
      }
      root?.removeAttribute("data-interaction-active");
      savedScrollProgress.current = null;
      if (document.activeElement === body || focusScope?.contains(document.activeElement)) {
        window.requestAnimationFrame(() => {
          if (focusToRestore?.isConnected) focusToRestore.focus({ preventScroll: true });
        });
      }
    };
  }, [exit, expectedStation, state.activeStation, state.input]);

  useEffect(() => {
    if (state.lifecycle !== "cancelled") return;
    const frame = requestAnimationFrame(() => dispatch({ type: "AVAILABILITY", station: expectedStation }));
    return () => cancelAnimationFrame(frame);
  }, [expectedStation, state.lifecycle]);

  useEffect(() => () => resetInteractionRuntime(), []);

  const station = state.activeStation;
  return (
    <div
      ref={panelRoot}
      className={styles.root}
      data-interaction-director
      data-available-station={state.availableStation ?? "none"}
      data-active-station={station ?? "none"}
      data-lifecycle={state.lifecycle}
      data-scroll-locked={station ? "true" : "false"}
      data-runtime={runtime}
    >
      {station === "touch" && (
        <TouchComposerInteraction
          copy={copy}
          onClose={() => exit(true)}
          onComplete={() => complete("touch")}
          onReset={() => restart("touch")}
          onContinue={() => exit(false)}
        />
      )}

      {station === "stage" && (
        <StageBeamInteraction
          copy={copy}
          onClose={() => exit(true)}
          onComplete={() => complete("stage")}
          onReset={() => restart("stage")}
          onContinue={() => exit(false)}
        />
      )}

      {station === "game" && (
        <GameInteraction
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
          copy={copy}
          onClose={() => exit(true)}
          onComplete={() => complete("draw")}
          onContinue={() => exit(false)}
        />
      )}

      {station === "photo" && (
        <PhotoBoothInteraction
          copy={copy}
          reducedMotion={reducedMotion}
          onClose={() => exit(true)}
          onComplete={() => complete("photo")}
          onReset={() => restart("photo")}
          onContinue={() => exit(false)}
        />
      )}

      {station && state.lifecycle !== "complete" && (
        <p className={styles.interactionHint} data-interaction-hint role="status">
          {copy.stations[station].instruction}
        </p>
      )}

      {station && (
        <button
          type="button"
          className={styles.mobileSkipButton}
          data-interaction-escape
          data-mobile-interaction-skip
          data-complete={state.lifecycle === "complete" ? "true" : "false"}
          onClick={() => {
            const continueControl = panelRoot.current?.querySelector<HTMLButtonElement>("[data-interaction-continue]");
            const exitControl = state.lifecycle === "complete" && continueControl && !continueControl.disabled
              ? continueControl
              : panelRoot.current?.querySelector<HTMLButtonElement>("[data-interaction-dismiss]");
            exitControl?.click();
          }}
        >
          {state.lifecycle === "complete" ? copy.continue : copy.skip}
        </button>
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
