import type { CSSProperties } from "react";
import type { InteractionAnchorPoint, InteractionInput, InteractionStation } from "./interaction-types";
import styles from "./HeroInteractions.module.css";

export function InteractionHotspot({
  station,
  label,
  point,
  completed,
  onEnter,
}: {
  station: InteractionStation;
  label: string;
  point: InteractionAnchorPoint;
  completed: boolean;
  onEnter: (input: InteractionInput) => void;
}) {
  const position = point.visible ? point : { x: 50, y: 50, visible: true, fallback: true };
  return (
    <button
      type="button"
      className={styles.hotspot}
      data-interaction-hotspot={station}
      data-anchor-fallback={position.fallback ? "true" : "false"}
      data-completed={completed ? "true" : "false"}
      style={{ "--hotspot-x": `${position.x}px`, "--hotspot-y": `${position.y}px` } as CSSProperties}
      onClick={(event) => onEnter(
        "pointerType" in event.nativeEvent && event.nativeEvent.pointerType === "touch"
          ? "touch"
          : "pointer",
      )}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onEnter("keyboard");
      }}
      aria-label={label}
    >
      <span aria-hidden="true" />
      <strong>{completed ? "✓" : "+"}</strong>
      <small>{label}</small>
    </button>
  );
}
