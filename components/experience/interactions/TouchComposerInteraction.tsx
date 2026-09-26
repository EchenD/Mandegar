"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InteractionCopy } from "./interaction-copy";
import {
  interactionRuntime,
  markInteractionCanvasDirty,
  registerInteractionCanvas,
  registerSceneInteraction,
} from "./interaction-runtime";
import type { SceneInteractionEvent } from "./interaction-types";
import styles from "./HeroInteractions.module.css";

const canvasWidth = 960;
const canvasHeight = 540;
const center = { x: 0.5, y: 0.47 };
const elementDefinitions = [
  { id: "space", x: 0.2, y: 0.68, color: "#50c7ff" },
  { id: "story", x: 0.5, y: 0.73, color: "#d95cff" },
  { id: "people", x: 0.8, y: 0.68, color: "#ffb54a" },
] as const;

type ComposerPointer = {
  pointerId: number;
  elementIndex: number | null;
  control: "close" | "reset" | "continue" | null;
  startX: number;
  startY: number;
  x: number;
  y: number;
};

function distance(firstX: number, firstY: number, secondX: number, secondY: number) {
  return Math.hypot(firstX - secondX, firstY - secondY);
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function hitRect(x: number, y: number, left: number, top: number, width: number, height: number) {
  return x >= left && x <= left + width && y >= top && y <= top + height;
}

function scenePoint(event: SceneInteractionEvent) {
  return {
    x: event.x,
    y: event.y,
  };
}

export function TouchComposerInteraction({
  copy,
  onClose,
  onComplete,
  onContinue,
}: {
  copy: InteractionCopy;
  onClose: () => void;
  onComplete: () => void;
  onContinue: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderFrame = useRef<number | null>(null);
  const completionTimer = useRef<number | null>(null);
  const sceneInputCount = useRef(0);
  const activePointer = useRef<ComposerPointer | null>(null);
  const selectedRef = useRef([false, false, false]);
  const completeRef = useRef(false);
  const hoverElement = useRef<number | null>(null);
  const keyboardFocus = useRef<number | null>(null);
  const [selected, setSelected] = useState([false, false, false]);
  const [complete, setComplete] = useState(false);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const width = canvas.width;
    const height = canvas.height;
    const direction = document.documentElement.dir === "rtl" ? "rtl" : "ltr";
    const selectedElements = selectedRef.current;
    const pointer = activePointer.current;
    const selectedCount = selectedElements.filter(Boolean).length;
    const isComplete = selectedCount === elementDefinitions.length;

    context.clearRect(0, 0, width, height);
    const background = context.createRadialGradient(
      width * center.x,
      height * center.y,
      12,
      width * center.x,
      height * center.y,
      width * 0.72,
    );
    background.addColorStop(0, "#102453");
    background.addColorStop(0.5, "#081225");
    background.addColorStop(1, "#03070d");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    context.strokeStyle = "rgba(117,216,255,.07)";
    context.lineWidth = 1;
    for (let x = 0; x <= width; x += 48) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (let y = 0; y <= height; y += 48) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }

    context.save();
    context.direction = direction;
    context.textAlign = "center";
    context.fillStyle = "rgba(247,247,244,.52)";
    context.font = '600 15px "Vazirmatn Variable", Tahoma, sans-serif';
    context.letterSpacing = "3px";
    context.fillText("MANDEGAR / EXPERIENCE COMPOSER", width / 2, 36);
    context.letterSpacing = "0px";
    context.fillStyle = "#f7f7f4";
    context.font = '650 29px "Vazirmatn Variable", Tahoma, sans-serif';
    context.fillText(isComplete ? copy.touch.complete : copy.touch.instruction, width / 2, 78);
    context.restore();

    const centerX = center.x * width;
    const centerY = center.y * height;
    elementDefinitions.forEach((definition, index) => {
      if (!selectedElements[index]) return;
      const sourceX = definition.x * width;
      const sourceY = definition.y * height;
      const gradient = context.createLinearGradient(sourceX, sourceY, centerX, centerY);
      gradient.addColorStop(0, `${definition.color}28`);
      gradient.addColorStop(0.55, definition.color);
      gradient.addColorStop(1, "#f7f7f4");
      context.strokeStyle = gradient;
      context.lineWidth = 4;
      context.shadowColor = definition.color;
      context.shadowBlur = 16;
      context.beginPath();
      context.moveTo(sourceX, sourceY);
      context.quadraticCurveTo(
        (sourceX + centerX) / 2,
        Math.min(sourceY, centerY) - 54,
        centerX,
        centerY,
      );
      context.stroke();
      context.shadowBlur = 0;
    });

    const ringGradient = context.createRadialGradient(centerX, centerY, 8, centerX, centerY, 92);
    ringGradient.addColorStop(0, isComplete ? "rgba(247,247,244,.32)" : "rgba(34,92,255,.18)");
    ringGradient.addColorStop(1, "rgba(34,92,255,0)");
    context.fillStyle = ringGradient;
    context.beginPath();
    context.arc(centerX, centerY, 94, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = isComplete ? "#f7f7f4" : "rgba(117,216,255,.7)";
    context.lineWidth = isComplete ? 4 : 2;
    context.shadowColor = isComplete ? "#75d8ff" : "#225cff";
    context.shadowBlur = isComplete ? 28 : 14;
    context.beginPath();
    context.arc(centerX, centerY, 62, 0, Math.PI * 2);
    context.stroke();
    context.shadowBlur = 0;
    context.fillStyle = "#f7f7f4";
    context.font = '700 23px "Vazirmatn Variable", Tahoma, sans-serif';
    context.textAlign = "center";
    context.fillText(`${selectedCount} / 3`, centerX, centerY + 8);

    elementDefinitions.forEach((definition, index) => {
      const dragging = pointer?.elementIndex === index;
      const x = (dragging ? pointer.x : definition.x) * width;
      const y = (dragging ? pointer.y : definition.y) * height;
      const active = selectedElements[index];
      const focused = hoverElement.current === index || keyboardFocus.current === index;
      context.fillStyle = active ? `${definition.color}38` : "rgba(5,10,19,.9)";
      context.strokeStyle = definition.color;
      context.lineWidth = focused || dragging ? 5 : active ? 3 : 2;
      context.shadowColor = definition.color;
      context.shadowBlur = active || focused || dragging ? 24 : 10;
      context.beginPath();
      context.arc(x, y, 54, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.shadowBlur = 0;
      if (active) {
        context.fillStyle = definition.color;
        context.beginPath();
        context.arc(x + 37, y - 37, 12, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#03070d";
        context.font = '800 15px "Vazirmatn Variable", Tahoma, sans-serif';
        context.fillText("✓", x + 37, y - 32);
      }
      context.direction = direction;
      context.fillStyle = "#f7f7f4";
      context.font = '700 22px "Vazirmatn Variable", Tahoma, sans-serif';
      context.textAlign = "center";
      context.fillText(copy.touch.elements[index], x, y + 7);
    });

    const closeX = width * 0.94;
    const closeY = height * 0.09;
    context.strokeStyle = keyboardFocus.current === 5 ? "#f7f7f4" : "rgba(247,247,244,.55)";
    context.lineWidth = keyboardFocus.current === 5 ? 4 : 2;
    context.beginPath();
    context.arc(closeX, closeY, 22, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = "#f7f7f4";
    context.font = "400 28px sans-serif";
    context.fillText("×", closeX, closeY + 9);

    const drawButton = (
      left: number,
      label: string,
      enabled: boolean,
      focused: boolean,
      primary = false,
    ) => {
      const top = height * 0.86;
      const buttonWidth = width * 0.2;
      const buttonHeight = height * 0.085;
      roundedRect(context, left, top, buttonWidth, buttonHeight, buttonHeight / 2);
      context.fillStyle = primary && enabled ? "#225cff" : "rgba(8,17,34,.9)";
      context.fill();
      context.strokeStyle = focused
        ? "#f7f7f4"
        : enabled
          ? "rgba(117,216,255,.85)"
          : "rgba(117,216,255,.2)";
      context.lineWidth = focused ? 4 : 2;
      context.stroke();
      context.fillStyle = enabled ? "#f7f7f4" : "rgba(247,247,244,.32)";
      context.direction = direction;
      context.font = '700 18px "Vazirmatn Variable", Tahoma, sans-serif';
      context.textAlign = "center";
      context.fillText(label, left + buttonWidth / 2, top + buttonHeight * 0.64);
    };
    drawButton(width * 0.06, copy.reset, selectedCount > 0, keyboardFocus.current === 3);
    drawButton(width * 0.74, copy.continue, isComplete, keyboardFocus.current === 4, true);

    markInteractionCanvasDirty("interactive");
  }, [copy]);

  const schedulePaint = useCallback(() => {
    if (renderFrame.current !== null) return;
    renderFrame.current = window.requestAnimationFrame(() => {
      renderFrame.current = null;
      paint();
    });
  }, [paint]);

  const reset = useCallback(() => {
    if (completionTimer.current !== null) window.clearTimeout(completionTimer.current);
    completionTimer.current = null;
    selectedRef.current = [false, false, false];
    interactionRuntime.touchElements = [false, false, false];
    completeRef.current = false;
    activePointer.current = null;
    setSelected([false, false, false]);
    setComplete(false);
    schedulePaint();
  }, [schedulePaint]);

  const activateElement = useCallback((index: number) => {
    if (selectedRef.current[index]) return;
    const next = [...selectedRef.current];
    next[index] = true;
    selectedRef.current = next;
    interactionRuntime.touchElements = [...next];
    setSelected(next);
    const finished = next.every(Boolean);
    if (finished && !completeRef.current) {
      completeRef.current = true;
      setComplete(true);
      completionTimer.current = window.setTimeout(() => {
        completionTimer.current = null;
        onComplete();
      }, 320);
    }
    schedulePaint();
  }, [onComplete, schedulePaint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    registerInteractionCanvas("interactive", canvas);
    paint();
    let active = true;
    void document.fonts?.ready.then(() => {
      if (active) schedulePaint();
    });
    return () => {
      active = false;
      registerInteractionCanvas("interactive", null);
    };
  }, [paint, schedulePaint]);

  useEffect(() => {
    const handleSceneInput = (event: SceneInteractionEvent) => {
      sceneInputCount.current += 1;
      if (canvasRef.current) {
        canvasRef.current.dataset.sceneInputCount = String(sceneInputCount.current);
      }
      const point = scenePoint(event);
      if (event.phase === "move") {
        const pointer = activePointer.current;
        if (pointer?.pointerId === event.pointerId && pointer.elementIndex !== null) {
          pointer.x = point.x;
          pointer.y = point.y;
          schedulePaint();
          return;
        }
        hoverElement.current = elementDefinitions.findIndex((definition, index) => (
          !selectedRef.current[index]
          && distance(point.x, point.y, definition.x, definition.y) <= 0.09
        ));
        if (hoverElement.current < 0) hoverElement.current = null;
        schedulePaint();
        return;
      }

      if (event.phase === "down") {
        let control: ComposerPointer["control"] = null;
        if (distance(point.x, point.y, 0.94, 0.09) <= 0.055) control = "close";
        else if (hitRect(point.x, point.y, 0.06, 0.86, 0.2, 0.085)) control = "reset";
        else if (hitRect(point.x, point.y, 0.74, 0.86, 0.2, 0.085)) control = "continue";
        const elementIndex = control === null
          ? elementDefinitions.findIndex((definition, index) => (
            !selectedRef.current[index]
            && distance(point.x, point.y, definition.x, definition.y) <= 0.1
          ))
          : -1;
        activePointer.current = {
          pointerId: event.pointerId,
          elementIndex: elementIndex >= 0 ? elementIndex : null,
          control,
          startX: point.x,
          startY: point.y,
          x: point.x,
          y: point.y,
        };
        schedulePaint();
        return;
      }

      if (event.phase === "cancel") {
        activePointer.current = null;
        hoverElement.current = null;
        schedulePaint();
        return;
      }

      if (event.phase !== "up") return;
      const pointer = activePointer.current;
      activePointer.current = null;
      if (!pointer || pointer.pointerId !== event.pointerId) {
        schedulePaint();
        return;
      }
      if (pointer.control === "close" && distance(point.x, point.y, 0.94, 0.09) <= 0.065) {
        onClose();
      } else if (pointer.control === "reset" && hitRect(point.x, point.y, 0.04, 0.83, 0.24, 0.14)) {
        reset();
      } else if (
        pointer.control === "continue"
        && completeRef.current
        && hitRect(point.x, point.y, 0.72, 0.83, 0.24, 0.14)
      ) {
        onContinue();
      } else if (pointer.elementIndex !== null) {
        const travelled = distance(point.x, point.y, pointer.startX, pointer.startY);
        const reachedCenter = distance(point.x, point.y, center.x, center.y) <= 0.18;
        if (travelled <= 0.045 || reachedCenter) activateElement(pointer.elementIndex);
      }
      schedulePaint();
    };
    registerSceneInteraction("touch", handleSceneInput);
    return () => registerSceneInteraction("touch", null);
  }, [activateElement, onClose, onContinue, reset, schedulePaint]);

  useEffect(() => () => {
    if (renderFrame.current !== null) window.cancelAnimationFrame(renderFrame.current);
    if (completionTimer.current !== null) window.clearTimeout(completionTimer.current);
    interactionRuntime.touchElements = [false, false, false];
  }, []);

  const focusControl = (index: number | null) => {
    keyboardFocus.current = index;
    schedulePaint();
  };

  return (
    <div
      className={styles.spatialInteractionSemantics}
      data-touch-spatial-controls
      data-touch-selected-count={selected.filter(Boolean).length}
      data-touch-complete={complete ? "true" : "false"}
      role="region"
      aria-label={copy.stations.touch.title}
    >
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className={styles.textureSource}
        data-composer-canvas
        aria-hidden="true"
      />
      <p>{copy.touch.instruction}</p>
      {copy.touch.elements.map((label, index) => (
        <button
          key={elementDefinitions[index].id}
          type="button"
          data-touch-element={elementDefinitions[index].id}
          aria-pressed={selected[index]}
          onFocus={() => focusControl(index)}
          onBlur={() => focusControl(null)}
          onClick={() => activateElement(index)}
        >
          {label}
        </button>
      ))}
      <button
        type="button"
        disabled={!selected.some(Boolean)}
        onFocus={() => focusControl(3)}
        onBlur={() => focusControl(null)}
        onClick={reset}
      >
        {copy.reset}
      </button>
      <button
        type="button"
        disabled={!complete}
        onFocus={() => focusControl(4)}
        onBlur={() => focusControl(null)}
        onClick={onContinue}
      >
        {copy.continue}
      </button>
      <button
        type="button"
        onFocus={() => focusControl(5)}
        onBlur={() => focusControl(null)}
        onClick={onClose}
      >
        {copy.close}
      </button>
      <span role="status" aria-live="polite">
        {complete ? copy.touch.complete : `${selected.filter(Boolean).length} / 3`}
      </span>
    </div>
  );
}
