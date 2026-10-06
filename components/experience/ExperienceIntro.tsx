"use client";

import { useEffect, useRef, useState } from "react";
import { completeIntro, directIntro } from "./intro-director";
import { introCameraHandoffProgress } from "./intro-score";
import styles from "./ExperienceIntro.module.css";

const INTRO_DURATION_MS = 4_900;

export function ExperienceIntro({
  ready,
  enabled,
  skipLabel,
  onInteractive,
  onComplete,
}: {
  ready: boolean;
  enabled: boolean;
  skipLabel: string;
  onInteractive: () => void;
  onComplete: () => void;
}) {
  const [active, setActive] = useState(false);
  const finishRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!ready) {
      return;
    }

    const parameters = new URLSearchParams(window.location.search);
    const introPreference = parameters.get("intro");
    const skipIntro = introPreference === "0" || parameters.has("phase") || Boolean(window.location.hash);
    const requestedDurationParameter = parameters.get("introDuration");
    const requestedDuration = requestedDurationParameter === null ? null : Number(requestedDurationParameter);
    const duration = process.env.NODE_ENV !== "production" && requestedDuration !== null && Number.isFinite(requestedDuration)
      ? Math.min(30_000, Math.max(1_000, requestedDuration))
      : INTRO_DURATION_MS;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
    const shouldPlay = enabled && !skipIntro && !reduced && !saveData;
    let animationFrame: number | undefined;
    let startedAt: number | undefined;
    let finished = false;
    let interactionReleased = false;

    const releaseInteraction = () => {
      if (interactionReleased) return;
      interactionReleased = true;
      setActive(false);
      onInteractive();
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);
      releaseInteraction();
      completeIntro();
      onComplete();
    };
    finishRef.current = finish;
    window.addEventListener("mandegar:skip-intro", finish);

    if (!shouldPlay) {
      finish();
      return () => window.removeEventListener("mandegar:skip-intro", finish);
    }

    directIntro(0);
    const tick = (time: number) => {
      startedAt ??= time;
      const progress = Math.min(1, (time - startedAt) / duration);
      if (progress >= introCameraHandoffProgress) releaseInteraction();
      directIntro(progress, !interactionReleased);
      if (progress >= 1) {
        finish();
        return;
      }
      animationFrame = window.requestAnimationFrame(tick);
    };
    animationFrame = window.requestAnimationFrame((time) => {
      setActive(true);
      tick(time);
    });

    return () => {
      window.removeEventListener("mandegar:skip-intro", finish);
      finished = true;
      if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);
      finishRef.current = () => undefined;
    };
  }, [enabled, onComplete, onInteractive, ready]);

  if (!active) return null;
  return (
    <div className={styles.root} data-experience-intro="active">
      <button className={styles.skip} type="button" onClick={() => finishRef.current()}>
        {skipLabel}
      </button>
    </div>
  );
}
