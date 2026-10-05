import * as THREE from "three";

export const crowdSignalWidth = 190;
export const crowdSignalHeight = 116;

type SignalPoint = { x: number; y: number };
export type CrowdSignalLayout = {
  rect: { x: number; y: number; width: number; height: number };
  start: SignalPoint;
  end: SignalPoint;
  origin: SignalPoint;
  side: -1 | 1;
};

/** Match the authored network's origin, without changing the actor's geometry. */
export function getCrowdSignalHead(object: THREE.Object3D, target = new THREE.Vector3(), bounds = new THREE.Box3()) {
  object.updateWorldMatrix(true, true);
  bounds.setFromObject(object);
  if (bounds.isEmpty() || bounds.max.y - bounds.min.y < 0.3) return null;
  bounds.getCenter(target);
  target.y = bounds.max.y + 0.22;
  return target;
}

/** Keep the anchor at the real head; only the signal cluster adapts to the viewport. */
export function getCrowdSignalLayout(head: THREE.Vector3, viewportWidth: number, viewportHeight: number): CrowdSignalLayout | null {
  if (!Number.isFinite(head.x + head.y + head.z) || Math.abs(head.x) > 1 || Math.abs(head.y) > 1 || head.z < -1 || head.z > 1) return null;
  const margin = 12;
  if (!Number.isFinite(viewportWidth + viewportHeight) || viewportWidth < crowdSignalWidth + margin * 2 || viewportHeight < crowdSignalHeight + margin * 2) return null;
  const x = (head.x * 0.5 + 0.5) * viewportWidth;
  const y = (-head.y * 0.5 + 0.5) * viewportHeight;
  if (x < margin + 2 || x > viewportWidth - margin - 2 || y < margin || y > viewportHeight - margin) return null;
  const side = x <= viewportWidth / 2 ? 1 : -1;
  const left = THREE.MathUtils.clamp(side === 1 ? x + 24 : x - crowdSignalWidth - 24, margin, viewportWidth - crowdSignalWidth - margin);
  const top = THREE.MathUtils.clamp(y - 98, margin, viewportHeight - crowdSignalHeight - margin);
  return {
    rect: { x: left, y: top, width: crowdSignalWidth, height: crowdSignalHeight },
    start: { x, y },
    end: { x: side === 1 ? left : left + crowdSignalWidth, y: top + crowdSignalHeight - 20 },
    origin: { x: x - left, y: y - top },
    side,
  };
}
