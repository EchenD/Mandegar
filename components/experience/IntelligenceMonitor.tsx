"use client";

import { useEffect, useRef } from "react";
import type { Locale } from "@/lib/i18n";
import { experienceState } from "./experience-state";
import { getIntelligenceCopy } from "./intelligence-inspector-copy";
import { getFocusedIntelligencePerson, getIntelligenceSnapshot, subscribeIntelligenceInspector } from "./intelligence-inspector-store";
import {
  advanceIntelligenceMonitorBlend,
  createIntelligenceMonitorPainter,
  createIntelligenceSignalState,
  getIntelligenceMonitorVisibility,
  intelligenceMonitorFrameInterval,
  intelligenceMonitorSize,
  retargetIntelligenceSignal,
  stepIntelligenceSignal,
} from "./intelligence-monitor-graphics";
import { interactionRuntime, markInteractionCanvasDirty, registerInteractionCanvas } from "./interactions/interaction-runtime";
import styles from "./IntelligenceMonitor.module.css";

/** An illustrative signal canvas owns the wide monitor only during Intelligence. */
export function IntelligenceMonitor({ locale, enabled }: { locale: Locale; enabled: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const copy = getIntelligenceCopy(locale);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !enabled) return;
    const state = createIntelligenceSignalState();
    const paint = createIntelligenceMonitorPainter(context, copy.signal, copy.example, locale !== "en");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const root = canvas.closest("[data-mandegar-experience]");
    let mounted = true;
    let fontsReady = document.fonts.status === "loaded";
    let onScreen = true;
    let frame = 0;
    let lastTime = performance.now();
    let lastPaint = -Infinity;
    let dirty = true;
    let blend = 0;
    let pendingRelease = false;
    let publishedBlend = -1;
    let paintCount = 0;
    let publishedState = "hidden";
    let publishedPerson: string | null | undefined;

    const publishState = (value: string) => {
      if (publishedState === value) return;
      publishedState = value;
      canvas.dataset.monitorState = value;
      canvas.setAttribute("aria-hidden", value === "hidden" || value === "paused" ? "true" : "false");
    };
    const publishBlend = (value: number) => {
      const rounded = Math.round(value * 1000);
      if (publishedBlend === rounded) return;
      publishedBlend = rounded;
      canvas.dataset.monitorBlend = (rounded / 1000).toFixed(3);
    };
    const ownsSurface = () => interactionRuntime.monitorEntries.videoWall?.canvas === canvas;
    const releaseSurface = () => {
      if (ownsSurface()) {
        interactionRuntime.monitorEntries.videoWall!.blend = 0;
        registerInteractionCanvas("videoWall", null);
      }
      blend = 0;
      pendingRelease = false;
      dirty = true;
      publishBlend(0);
    };

    const tick = (time: number) => {
      frame = 0;
      if (!mounted || document.hidden || !onScreen) return;
      const delta = Math.max(0, Math.min(1, (time - lastTime) / 1000));
      lastTime = time;
      const visibility = getIntelligenceMonitorVisibility(experienceState.progress, experienceState.sequence);
      // A foreground station always wins, even before its first canvas paint.
      if (interactionRuntime.activeStation !== null || !fontsReady) {
        releaseSurface();
        publishState("hidden");
      } else if (visibility <= 0) {
        if (!ownsSurface() || pendingRelease) {
          // A successor's registration is never reclaimed during our fade.
          releaseSurface();
          publishState("hidden");
        } else {
          blend = advanceIntelligenceMonitorBlend(blend, 0, delta);
          interactionRuntime.monitorEntries.videoWall!.blend = blend;
          publishBlend(blend);
          publishState("fading");
          // Give the controller one actual frame at alpha zero before release.
          pendingRelease = blend === 0;
        }
      } else {
        pendingRelease = false;
        const owner = ownsSurface();
        if (!owner) dirty = true;
        const person = getIntelligenceSnapshot().available ? getFocusedIntelligencePerson() : null;
        if (retargetIntelligenceSignal(state, person)) dirty = true;
        const due = time - lastPaint >= intelligenceMonitorFrameInterval;
        if (due && (dirty || !motion.matches)) {
          stepIntelligenceSignal(state, Math.max(0, Math.min(0.125, (time - lastPaint) / 1000)), motion.matches);
          paint(state);
          lastPaint = time;
          dirty = false;
          if (owner) markInteractionCanvasDirty("videoWall");
          else registerInteractionCanvas("videoWall", canvas, 0);
          if (publishedPerson !== person) {
            publishedPerson = person;
            canvas.dataset.monitorPerson = person ?? "none";
            canvas.dataset.monitorSeed = state.seed.toFixed(6);
          }
          if (process.env.NODE_ENV !== "production") canvas.dataset.monitorPaintCount = String(++paintCount);
        }
        if (ownsSurface()) {
          blend = advanceIntelligenceMonitorBlend(blend, visibility, delta);
          interactionRuntime.monitorEntries.videoWall!.blend = blend;
          publishBlend(blend);
          publishState(blend < 0.999 ? "fading" : motion.matches ? "still" : "playing");
        }
      }
      frame = window.requestAnimationFrame(tick);
    };

    const resume = () => {
      lastTime = performance.now();
      lastPaint = lastTime;
      dirty = true;
      if (mounted && !document.hidden && onScreen && frame === 0) frame = window.requestAnimationFrame(tick);
    };
    const pause = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      publishState("paused");
    };
    const visibilityChanged = () => { if (document.hidden) pause(); else resume(); };
    const motionChanged = () => { dirty = true; resume(); };
    const observer = new IntersectionObserver((entries) => {
      onScreen = entries[0]?.isIntersecting ?? false;
      if (onScreen) resume();
      else pause();
    });
    if (root) observer.observe(root);
    const unsubscribe = subscribeIntelligenceInspector(() => {
      const person = getIntelligenceSnapshot().available ? getFocusedIntelligencePerson() : null;
      if (retargetIntelligenceSignal(state, person)) dirty = true;
    });
    document.addEventListener("visibilitychange", visibilityChanged);
    motion.addEventListener("change", motionChanged);
    void document.fonts.ready.then(() => { if (mounted) { fontsReady = true; dirty = true; resume(); } });
    resume();
    return () => {
      mounted = false;
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      unsubscribe();
      document.removeEventListener("visibilitychange", visibilityChanged);
      motion.removeEventListener("change", motionChanged);
      releaseSurface();
      publishState("hidden");
    };
  }, [copy, enabled, locale]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.source}
      width={intelligenceMonitorSize.width}
      height={intelligenceMonitorSize.height}
      role="img"
      aria-hidden="true"
      aria-label={`${copy.signal}. ${copy.example}.`}
      data-intelligence-monitor-canvas
      data-monitor-state="hidden"
      data-monitor-blend="0.000"
      data-monitor-person="none"
    />
  );
}
