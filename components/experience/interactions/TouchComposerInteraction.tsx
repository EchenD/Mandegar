"use client";

import gsap from "gsap";
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { Locale } from "@/lib/i18n";
import { interactionSurfaceSizes } from "../scene-config";
import { interactionRuntime, markInteractionCanvasDirty, registerInteractionCanvas } from "./interaction-runtime";
import { getInstallationState, installationCopy, installationViews, selectInstallationView, subscribeInstallation } from "./installation-demo";
import { getTouchStoryDescription, paintTouchStory, paintTouchStoryMorph, type StoryExit, type StoryMotion } from "./touch-motion-story";
import styles from "./HeroInteractions.module.css";

const ease = (amount: number) => amount * amount * (3 - 2 * amount);

export function TouchComposerInteraction({ locale }: { locale: Locale }) {
  const state = useSyncExternalStore(subscribeInstallation, getInstallationState, getInstallationState);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const copy = installationCopy[locale];

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const snapshot = document.createElement("canvas");
    const incoming = document.createElement("canvas");
    const outgoing = document.createElement("canvas");
    snapshot.width = incoming.width = outgoing.width = canvas.width;
    snapshot.height = incoming.height = outgoing.height = canvas.height;
    const snapshotContext = snapshot.getContext("2d")!;
    const incomingContext = incoming.getContext("2d")!;
    const outgoingContext = outgoing.getContext("2d")!;
    const motion: StoryMotion = { title: 0, scene: 0, detail: 0, footer: 0 };
    const elementExit: StoryExit = { title: 0, scene: 0, detail: 0, footer: 0 };
    const timeline = gsap.timeline({ paused: true })
      .to(elementExit, { title: 1, duration: 0.65, ease: "power2.inOut" }, 0)
      .to(elementExit, { detail: 1, duration: 0.4, ease: "power2.in" }, 0.04)
      .to(elementExit, { scene: 1, duration: 0.9, ease: "power2.inOut" }, 0)
      .to(elementExit, { footer: 1, duration: 0.35, ease: "power2.in" }, 0.1)
      .to(motion, { scene: 1, duration: 1.7, ease: "power3.out" }, 0.04)
      .to(motion, { title: 1, duration: 0.95, ease: "power3.out" }, 0.04)
      .to(motion, { detail: 1, duration: 0.8, ease: "power2.out" }, 0.18)
      .to(motion, { footer: 1, duration: 0.7, ease: "power2.out" }, 0.28);
    let registered = false;
    let frame: number;
    let previous: number | null = null;
    let elapsed = 0;
    let chapterStarted = 0;
    let revision = -1;
    let hasSnapshot = false;
    let departureTime: number | null = null;
    let lastPaint = -Infinity;
    let outgoingView = getInstallationState().view;
    let outgoingMotion: StoryMotion = { ...motion };
    let outgoingTime = 0;
    let lastView = getInstallationState().view;
    let interrupted = false;
    // The canvas shares the site's local Persian/Arabic font.
    void document.fonts.load('600 57px "Vazirmatn Variable"').catch(() => undefined);
    const departure = (event: Event) => {
      if ((event as CustomEvent<{ station?: string }>).detail?.station !== "touch") return;
      departureTime = elapsed;
      canvas.dataset.departing = "true";
    };
    const visibility = () => { previous = null; };
    window.addEventListener("mandegar:interaction-departure", departure);
    document.addEventListener("visibilitychange", visibility);
    const paint = (now: number) => {
      frame = requestAnimationFrame(paint);
      if (document.hidden) { previous = null; return; }
      const delta = previous === null ? 0 : Math.max(0, now - previous);
      previous = now;
      elapsed += delta;
      const selected = getInstallationState();
      const changed = selected.revision !== revision;
      if (changed) {
        hasSnapshot = registered;
        if (hasSnapshot) {
          snapshotContext.drawImage(canvas, 0, 0);
          interrupted = elapsed - chapterStarted < timeline.duration() * 1000;
          outgoingView = lastView;
          outgoingMotion = { ...motion };
          outgoingTime = (elapsed - chapterStarted) / 1000;
        }
        revision = selected.revision;
        chapterStarted = elapsed;
        timeline.seek(0);
        if (interrupted) {
          paintTouchStory(outgoingContext, selected.view, locale, { title: 0, scene: 0, detail: 0, footer: 0 }, 0,
            undefined, { scene: false });
        }
      }
      // Paint at 30fps; the 3D scene can retain the most recent texture in between.
      if (!changed && elapsed - lastPaint < 1000 / 30) return;
      lastPaint = elapsed;
      const chapterTime = (elapsed - chapterStarted) / 1000;
      timeline.seek(motionPreference.matches ? timeline.duration() : Math.min(chapterTime, timeline.duration()));
      const blend = !hasSnapshot || motionPreference.matches ? 1 : Math.min(1, chapterTime / timeline.duration());
      paintTouchStory(incomingContext, selected.view, locale, motion, motionPreference.matches ? 0 : chapterTime,
        undefined, hasSnapshot && blend < 1 ? { transparent: true } : undefined);
      context.globalAlpha = 1;
      if (hasSnapshot && blend < 1) {
        if (chapterTime === 0 || interrupted) {
          if (interrupted) context.drawImage(outgoing, 0, 0);
          context.save();
          context.globalAlpha = interrupted ? 1 - ease(Math.min(1, chapterTime / 0.65)) : 1;
          context.drawImage(snapshot, 0, 0);
          context.restore();
        } else {
          paintTouchStory(outgoingContext, outgoingView, locale, outgoingMotion, outgoingTime + chapterTime, elementExit);
          context.drawImage(outgoing, 0, 0);
        }
        context.save();
        // Entering graphics build after outgoing type and UI begin their own exits.
        context.globalAlpha = interrupted ? ease(Math.min(1, chapterTime / 0.65)) : 1;
        context.drawImage(incoming, 0, 0);
        context.restore();
        if (!interrupted) paintTouchStoryMorph(context, outgoingView, selected.view, Math.min(1, chapterTime / 0.9), chapterTime);
      } else context.drawImage(incoming, 0, 0);
      lastView = selected.view;
      const entrance = motionPreference.matches ? 1 : ease(Math.min(1, elapsed / 800));
      const departureAmount = departureTime === null ? 0
        : motionPreference.matches ? 1 : ease(Math.min(1, (elapsed - departureTime) / 400));
      interactionRuntime.touchVisibility = entrance * (1 - departureAmount);
      canvas.dataset.installationView = selected.view;
      canvas.dataset.artworkStatus = "generated";
      canvas.dataset.storyChapter = String(installationViews.indexOf(selected.view) + 1);
      canvas.dataset.storyTime = chapterTime.toFixed(3);
      canvas.dataset.storyRevision = String(revision);
      canvas.dataset.transitionProgress = entrance.toFixed(3);
      canvas.dataset.viewTransitionProgress = blend.toFixed(3);
      canvas.dataset.elementExitProgress = Math.max(elementExit.title, elementExit.scene, elementExit.detail, elementExit.footer).toFixed(3);
      canvas.dataset.signalMorphProgress = (hasSnapshot ? Math.min(1, chapterTime / 0.9) : 1).toFixed(3);
      canvas.dataset.explosionProgress = motion.scene.toFixed(3);
      if (!registered) {
        // Register only after the first complete background paint.
        registerInteractionCanvas("interactive", canvas);
        registered = true;
      } else markInteractionCanvasDirty("interactive");
    };
    frame = requestAnimationFrame(paint);
    return () => {
      cancelAnimationFrame(frame);
      timeline.kill();
      window.removeEventListener("mandegar:interaction-departure", departure);
      document.removeEventListener("visibilitychange", visibility);
      interactionRuntime.touchVisibility = 0;
      if (interactionRuntime.monitorEntries.interactive?.canvas === canvas) registerInteractionCanvas("interactive", null);
    };
  }, [locale]);

  return <div className={styles.installationControls} data-touch-spatial-controls data-installation-controls data-installation-view={state.view}>
    <canvas ref={canvasRef} {...interactionSurfaceSizes.interactive.canvas} className={styles.textureSource} data-composer-canvas />
    <div role="group" aria-label={copy.instruction} className={styles.installationButtons}>
      {installationViews.map((view) => <button key={view} type="button" aria-disabled="true" data-installation-button={view}
        className={styles.installationPhysicalControl} aria-label={copy.views[view]} aria-pressed={state.view === view}
        onClick={(event) => { if (event.currentTarget.dataset.physicalEnabled === "true") selectInstallationView(view); }} />)}
    </div>
    <span className={styles.puzzleScreenReader} role="status" aria-live="polite">
      {getTouchStoryDescription(state.view, locale)}
    </span>
  </div>;
}
