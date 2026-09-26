"use client";

import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import type { ScenePhaseId } from "../narrative-score";
import { DrawingInteraction } from "./DrawingInteraction";
import { GameInteraction } from "./GameInteraction";
import { getInteractionCopy } from "./interaction-copy";
import { InteractionChrome } from "./InteractionChrome";
import { InteractionHotspot, positionInteractionHotspot } from "./InteractionHotspot";
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
  const [settledPhase, setSettledPhase] = useState<ScenePhaseId | null>(null);
  const [showAnchorDebug, setShowAnchorDebug] = useState(false);
  const [reducedMotion] = useState(() => (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ));
  const previousFocus = useRef<HTMLElement | null>(null);
  const savedScroll = useRef(0);
  const panelRoot = useRef<HTMLDivElement>(null);
  const anchors = useRef(initialAnchors);
  const hotspotElement = useRef<HTMLButtonElement>(null);
  const debugAnchorElements = useRef<Partial<Record<InteractionStation, HTMLElement>>>({});
  const expectedStation = getStationForPhase(activePhase);

  const applyAnchorFrame = useCallback((frame: InteractionAnchorFrame) => {
    const hotspot = hotspotElement.current;
    const station = hotspot?.dataset.interactionHotspot as InteractionStation | undefined;
    if (hotspot && station) positionInteractionHotspot(hotspot, frame.stations[station]);
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
    const timer = window.setTimeout(
      () => setSettledPhase(activePhase),
      reducedMotion || runtime === "fallback" ? 0 : 650,
    );
    return () => window.clearTimeout(timer);
  }, [activePhase, reducedMotion, runtime]);

  useEffect(() => {
    const station = settledPhase === activePhase ? expectedStation : null;
    dispatch({ type: "AVAILABILITY", station });
    interactionRuntime.availableStation = station;
  }, [activePhase, expectedStation, settledPhase]);

  const exit = useCallback((cancelled: boolean) => {
    dispatch({ type: "EXIT", cancelled });
    interactionRuntime.activeStation = null;
  }, []);

  const enter = useCallback((station: InteractionStation, input: InteractionInput) => {
    if (interactionRuntime.availableStation !== station) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.querySelector<HTMLElement>("[data-experience-root]")
      ?.setAttribute("data-interaction-active", station);
    dispatch({ type: "ENTER", station, input });
    interactionRuntime.activeStation = station;
  }, []);

  const complete = useCallback((station: InteractionStation) => {
    dispatch({ type: "COMPLETING" });
    window.queueMicrotask(() => dispatch({ type: "COMPLETE", station }));
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
    if (!state.activeStation) return;
    savedScroll.current = window.scrollY;
    const body = document.body;
    const root = document.querySelector<HTMLElement>("[data-experience-root]");
    const previous = {
      overscrollBehavior: body.style.overscrollBehavior,
    };
    body.style.overscrollBehavior = "none";
    root?.setAttribute("data-interaction-active", state.activeStation);

    const preventScrollKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        exit(true);
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
        if (first && last && event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (first && last && !event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key)) {
        const target = event.target as HTMLElement | null;
        if (!target?.closest("[data-interaction-panel]")) event.preventDefault();
      }
    };
    const cancelForWebglLoss = () => exit(true);
    const preventWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) event.preventDefault();
    };
    const preventTouchScroll = (event: TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(`.${styles.experienceBody}`)) event.preventDefault();
    };
    window.addEventListener("keydown", preventScrollKeys);
    window.addEventListener("wheel", preventWheel, { passive: false });
    window.addEventListener("touchmove", preventTouchScroll, { passive: false });
    document.addEventListener("webglcontextlost", cancelForWebglLoss, true);
    window.requestAnimationFrame(() => panelRoot.current?.querySelector<HTMLElement>("button")?.focus());

    return () => {
      window.removeEventListener("keydown", preventScrollKeys);
      window.removeEventListener("wheel", preventWheel);
      window.removeEventListener("touchmove", preventTouchScroll);
      document.removeEventListener("webglcontextlost", cancelForWebglLoss, true);
      body.style.overscrollBehavior = previous.overscrollBehavior;
      root?.removeAttribute("data-interaction-active");
      window.scrollTo({ top: savedScroll.current, left: 0, behavior: "auto" });
      window.requestAnimationFrame(() => previousFocus.current?.focus());
    };
  }, [exit, state.activeStation]);

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
      {state.availableStation && !station && (
        <InteractionHotspot
          station={state.availableStation}
          label={copy.stations[state.availableStation].label}
          point={initialAnchors.stations[state.availableStation]}
          completed={state.completed[state.availableStation]}
          onEnter={(input) => enter(state.availableStation!, input)}
          elementRef={hotspotElement}
        />
      )}

      {station === "touch" && (
        <TouchComposerInteraction
          copy={copy}
          onClose={() => exit(true)}
          onComplete={() => complete("touch")}
          onContinue={() => exit(false)}
        />
      )}

      {station && station !== "touch" && (
        <div className={styles.activeLayer}>
          <InteractionChrome
            station={station}
            lifecycle={state.lifecycle}
            copy={copy}
            onClose={() => exit(true)}
            onContinue={() => exit(false)}
          >
            {station === "photo" && <PhotoBoothInteraction copy={copy} reducedMotion={reducedMotion} onComplete={() => complete("photo")} />}
            {station === "stage" && <StageBeamInteraction copy={copy} onComplete={() => complete("stage")} />}
            {station === "game" && <GameInteraction copy={copy} reducedMotion={reducedMotion} onComplete={() => complete("game")} />}
            {station === "draw" && <DrawingInteraction copy={copy} onComplete={() => complete("draw")} />}
          </InteractionChrome>
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
