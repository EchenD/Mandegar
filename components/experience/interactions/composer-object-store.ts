export const composerObjectDefinitions = [
  { id: "space", x: 0.2, y: 0.67, color: "#225cff" },
  { id: "story", x: 0.5, y: 0.71, color: "#f7f7f4" },
  { id: "people", x: 0.8, y: 0.67, color: "#75d8ff" },
] as const;

export type ComposerObjectPose = { x: number; y: number };
type ComposerObjectState = {
  poses: readonly ComposerObjectPose[];
  interactive: boolean;
  dragging: { index: number; pointerId: number } | null;
};

const initialPoses = () => composerObjectDefinitions.map(() => ({ x: 0, y: 0 }));
let state: ComposerObjectState = { poses: initialPoses(), interactive: false, dragging: null };
let settledPoses = state.poses;
let activation: ((index: number) => void) | null = null;
const listeners = new Set<() => void>();

function publish(next: ComposerObjectState) {
  state = next;
  listeners.forEach((listener) => listener());
}

export function getComposerObjectState(): Readonly<ComposerObjectState> { return state; }
export function subscribeComposerObjects(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function registerComposerObjectActions(handler: ((index: number) => void) | null) {
  activation = handler;
}

export function setComposerObjectsInteractive(interactive: boolean) {
  if (interactive === state.interactive) return;
  if (!interactive) cancelComposerObjectDrag();
  publish({ ...state, interactive });
}

export function updateComposerObjectPose(index: number, pose: ComposerObjectPose, settle = false) {
  if (!state.poses[index] || !Number.isFinite(pose.x) || !Number.isFinite(pose.y)) return;
  const next = { x: Math.max(-1, Math.min(1, pose.x)), y: Math.max(0, Math.min(1, pose.y)) };
  const current = state.poses[index];
  if (current.x === next.x && current.y === next.y) {
    if (settle) settledPoses = state.poses;
    return;
  }
  const poses = state.poses.map((value, item) => item === index ? next : value);
  if (settle) settledPoses = poses;
  publish({ ...state, poses });
}

export function beginComposerObjectDrag(index: number, pointerId: number) {
  if (!state.interactive || !state.poses[index] || state.dragging) return false;
  settledPoses = state.poses;
  publish({ ...state, dragging: { index, pointerId } });
  return true;
}

export function finishComposerObjectDrag(pointerId: number) {
  if (state.dragging?.pointerId !== pointerId) return;
  const index = state.dragging.index;
  settledPoses = state.poses;
  publish({ ...state, dragging: null });
  activation?.(index);
}

export function cancelComposerObjectDrag() {
  if (!state.dragging) return;
  publish({ ...state, poses: settledPoses, dragging: null });
}

export function settleComposerObject(index: number) {
  const pose = state.poses[index];
  if (pose && pose.y === 0) updateComposerObjectPose(index, { ...pose, y: 0.35 }, true);
}

export function resetComposerObjects() {
  const poses = initialPoses();
  settledPoses = poses;
  publish({ ...state, poses, dragging: null });
}

export function getComposerMonitorPoint(index: number, pose = state.poses[index]) {
  const definition = composerObjectDefinitions[index];
  return { x: definition.x + pose.x * 0.08, y: definition.y - pose.y * 0.085 };
}
