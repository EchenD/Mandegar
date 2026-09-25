"use client";

import { useEffect, useRef, useState } from "react";
import type { InteractionCopy } from "./interaction-copy";
import {
  interactionRuntime,
  markInteractionCanvasDirty,
  registerInteractionCanvas,
  registerSceneInteraction,
} from "./interaction-runtime";
import styles from "./HeroInteractions.module.css";

const beamColors = ["#50c7ff", "#d95cff", "#ffb54a", "#75d8ff", "#ef86ff"];

export function StageBeamInteraction({ copy, onComplete }: { copy: InteractionCopy; onComplete: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const completionReported = useRef(false);
  const activeRef = useRef<boolean[]>([false, false, false, false, false]);
  const [active, setActive] = useState<boolean[]>([false, false, false, false, false]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    registerInteractionCanvas("videoWall", canvas);
    return () => {
      interactionRuntime.activeBeams = [false, false, false, false, false];
      registerInteractionCanvas("videoWall", null);
    };
  }, []);

  useEffect(() => {
    registerSceneInteraction("stage", (event) => {
      const beamIndex = Math.min(4, Math.max(0, Math.floor(event.x * 5)));
      if (event.phase === "move") {
        interactionRuntime.activeBeams = activeRef.current.map(
          (value, index) => index === beamIndex ? true : value,
        );
      } else if (event.phase === "activate") {
        setActive((current) => current.map(
          (value, index) => index === beamIndex ? !value : value,
        ));
      } else if (event.phase === "cancel" || event.phase === "up") {
        interactionRuntime.activeBeams = [...activeRef.current];
      }
    });
    return () => registerSceneInteraction("stage", null);
  }, []);

  useEffect(() => {
    interactionRuntime.activeBeams = [...active];
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#080b10");
    gradient.addColorStop(1, active.every(Boolean) ? "#225cff" : "#16191d");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    active.forEach((enabled, index) => {
      if (!enabled) return;
      context.fillStyle = beamColors[index];
      context.globalAlpha = 0.78;
      context.fillRect(index * (canvas.width / 5), 0, canvas.width / 5 - 4, canvas.height);
    });
    context.globalAlpha = 1;
    context.fillStyle = "white";
    context.font = "700 42px Arial, sans-serif";
    context.textAlign = "center";
    context.fillText(active.every(Boolean) ? copy.stage.finale : `${active.filter(Boolean).length} / 5`, canvas.width / 2, canvas.height / 2);
    markInteractionCanvasDirty("videoWall");
    if (active.every(Boolean) && !completionReported.current) {
      completionReported.current = true;
      onComplete();
    }
  }, [active, copy.stage.finale, onComplete]);

  return (
    <div className={styles.stageExperience}>
      <canvas ref={canvasRef} width={1050} height={450} className={styles.textureSource} aria-hidden="true" />
      <div className={styles.beamControls} role="group" aria-label={copy.stations.stage.title}>
        {active.map((enabled, index) => (
          <button
            key={beamColors[index]}
            type="button"
            aria-pressed={enabled}
            style={{ "--beam-color": beamColors[index] } as React.CSSProperties}
            onFocus={() => {
              interactionRuntime.activeBeams = active.map((value, beamIndex) => beamIndex === index ? true : value);
            }}
            onBlur={() => { interactionRuntime.activeBeams = [...active]; }}
            onPointerEnter={() => {
              interactionRuntime.activeBeams = active.map((value, beamIndex) => beamIndex === index ? true : value);
            }}
            onPointerLeave={() => { interactionRuntime.activeBeams = [...active]; }}
            onClick={() => setActive((current) => current.map((value, beamIndex) => beamIndex === index ? !value : value))}
          >
            {copy.stage.beam} {index + 1}
          </button>
        ))}
      </div>
      <div className={styles.actionRow}>
        <button type="button" onClick={() => setActive([false, false, false, false, false])}>{copy.reset}</button>
      </div>
    </div>
  );
}
