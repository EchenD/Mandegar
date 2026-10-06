export const heroPhaseIds = [
  "arrival",
  "discovery",
  "activation",
  "engagement",
  "reveal",
  "experiences",
  "connection",
  "proof",
  "intelligence",
  "invitation",
  "loop",
] as const;

export type ScenePhaseId = (typeof heroPhaseIds)[number];

export const heroCueIds = [
  "photoTextReady",
  "photoCapture",
  "photoDelivered",
  "photoExit",
  "lightingBeam1",
  "lightingBeam2",
  "lightingBeam3",
  "lightingBeam4",
  "lightingBeam5",
  "heroHandoffStart",
  "heroHandoffEnd",
] as const;

export type HeroCueId = (typeof heroCueIds)[number];

const participationPhases: readonly ScenePhaseId[] = ["engagement", "experiences", "connection"];

export type CameraClipDetails = {
  cameraNode: string;
  clipName: string;
  durationSeconds: number;
};

export type HeroTimelinePhase = {
  id: ScenePhaseId;
  startFrame: number;
  viewFrame: number;
  endFrame: number;
  start: number;
  preview: number;
  end: number;
  transitionEnd: number;
};

export type HeroTimeline = {
  fps: number;
  firstFrame: number;
  lastFrame: number;
  clipDurationSeconds: number;
  phases: readonly HeroTimelinePhase[];
  cueFrames: Record<HeroCueId, number>;
  cues: Record<HeroCueId, number>;
};

export class HeroTimelineError extends Error {
  readonly issues: readonly string[];

  constructor(issues: string[]) {
    super(`Camera timing handoff is incomplete or invalid:\n${issues.join("\n")}`);
    this.name = "HeroTimelineError";
    this.issues = issues;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validates source frame data before it can replace the live hero timeline. */
export function compileHeroTimeline(input: unknown, clip: CameraClipDetails): HeroTimeline {
  if (!isRecord(input)) throw new HeroTimelineError(["The handoff must be a JSON object."]);
  const issues: string[] = [];
  const number = (value: unknown, path: string) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    issues.push(`${path} needs a finite frame number or numeric value; null is still pending.`);
    return Number.NaN;
  };
  const record = (value: unknown, path: string) => {
    if (isRecord(value)) return value;
    issues.push(`${path} must be an object.`);
    return {} as Record<string, unknown>;
  };
  const reject = () => { if (issues.length) throw new HeroTimelineError(issues); };

  if (input.schemaVersion !== 1) issues.push("schemaVersion must be 1.");
  if (input.scope !== "full-hero") issues.push("scope must be full-hero.");
  if (input.status !== "draft" && input.status !== "ready") issues.push("status must be draft or ready.");
  if (input.asset !== "mandegar_environment.glb") issues.push("asset must be mandegar_environment.glb.");
  if (input.cameraNode !== "camera_mandegar_master" || input.cameraNode !== clip.cameraNode) issues.push("cameraNode does not match the required exported camera_mandegar_master.");
  if (input.clipName !== "camera_master_loop" || input.clipName !== clip.clipName) issues.push("clipName does not match the required exported camera_master_loop animation.");
  const fps = number(input.fps, "fps");
  const firstFrame = number(input.firstFrame, "firstFrame");
  const lastFrame = number(input.lastFrame, "lastFrame");
  if (fps <= 0) issues.push("fps must be greater than zero.");
  if (lastFrame <= firstFrame) issues.push("lastFrame must be greater than firstFrame.");
  if (!Number.isFinite(clip.durationSeconds) || clip.durationSeconds <= 0) issues.push("The exported clip needs a positive finite duration.");
  reject();

  const frameSpan = lastFrame - firstFrame;
  const sourceDuration = frameSpan / fps;
  // Exported float32 key times may differ slightly from the DCC frame clock.
  if (!Number.isFinite(sourceDuration) || Math.abs(sourceDuration - clip.durationSeconds) > Math.max(0.001, 0.5 / fps)) {
    issues.push(`The source frame range is ${sourceDuration.toFixed(4)}s, but the exported clip is ${clip.durationSeconds.toFixed(4)}s. Check FPS and export range.`);
  }
  const startFrames = record(input.phaseStartFrames, "phaseStartFrames");
  const endFrames = input.phaseEndFrames === undefined ? {} : record(input.phaseEndFrames, "phaseEndFrames");
  const viewFrames = record(input.phaseRestFrames, "phaseRestFrames");
  const cueInput = record(input.cues, "cues");
  for (const [path, map] of [["phaseStartFrames", startFrames], ["phaseEndFrames", endFrames], ["phaseRestFrames", viewFrames]] as const) {
    for (const id of Object.keys(map)) {
      if (!heroPhaseIds.includes(id as ScenePhaseId)) issues.push(`${path}.${id} is not a hero chapter.`);
    }
  }
  const starts = heroPhaseIds.map((id) => number(startFrames[id], `phaseStartFrames.${id}`));
  const cueFrames = Object.fromEntries(heroCueIds.map((id) => [id, number(cueInput[id], `cues.${id}`)])) as Record<HeroCueId, number>;
  const within = (frame: number, start: number, end: number, path: string) => {
    if (Number.isFinite(frame) && (frame < start || frame > end)) issues.push(`${path} must be within frames ${start}–${end}.`);
  };
  const normalize = (frame: number) => (frame - firstFrame) / frameSpan;
  if (Number.isFinite(starts[0]) && starts[0] !== firstFrame) issues.push("Arrival must start at firstFrame.");
  const phases = heroPhaseIds.map((id, index): HeroTimelinePhase => {
    const startFrame = starts[index];
    const boundary = starts[index + 1] ?? lastFrame;
    const endFrame = endFrames[id] == null ? boundary : number(endFrames[id], `phaseEndFrames.${id}`);
    const terminalLoop = id === "loop" && startFrame === lastFrame && endFrame === lastFrame;
    const viewFrame = viewFrames[id] == null
      ? participationPhases.includes(id) ? startFrame : (startFrame + endFrame) / 2
      : number(viewFrames[id], `phaseRestFrames.${id}`);
    within(startFrame, firstFrame, lastFrame, `phaseStartFrames.${id}`);
    within(endFrame, firstFrame, lastFrame, `phaseEndFrames.${id}`);
    if (!terminalLoop && (endFrame <= startFrame || boundary <= startFrame)) issues.push(`${id} must end after it starts.`);
    if (Number.isFinite(endFrame) && Number.isFinite(boundary) && endFrame > boundary) {
      issues.push(`phaseEndFrames.${id} cannot extend beyond the next chapter's start. Viewing windows cannot overlap.`);
    }
    if (Number.isFinite(viewFrame) && (viewFrame < startFrame || viewFrame > endFrame
      || participationPhases.includes(id) && viewFrame === endFrame)) {
      issues.push(`phaseRestFrames.${id} must be within its viewing window; a participation view needs room before the window ends.`);
    }
    return { id, startFrame, viewFrame, endFrame, start: normalize(startFrame), preview: normalize(viewFrame), end: normalize(endFrame), transitionEnd: normalize(boundary) };
  });
  for (const id of heroCueIds) within(cueFrames[id], firstFrame, lastFrame, `cues.${id}`);
  const inChapter = (ids: readonly HeroCueId[], phaseId: ScenePhaseId) => {
    const phase = phases.find((item) => item.id === phaseId)!;
    ids.forEach((id, index) => {
      within(cueFrames[id], phase.startFrame, phase.endFrame, `cues.${id}`);
      if (index > 0 && cueFrames[id] <= cueFrames[ids[index - 1]]) issues.push(`cues.${id} must follow cues.${ids[index - 1]}.`);
    });
  };
  inChapter(heroCueIds.slice(0, 4), "activation");
  inChapter(heroCueIds.slice(4, 9), "reveal");
  if (cueFrames.heroHandoffEnd <= cueFrames.heroHandoffStart) issues.push("heroHandoffEnd must follow heroHandoffStart.");
  reject();
  return {
    fps,
    firstFrame,
    lastFrame,
    clipDurationSeconds: clip.durationSeconds,
    phases,
    cueFrames,
    cues: Object.fromEntries(heroCueIds.map((id) => [id, normalize(cueFrames[id])])) as Record<HeroCueId, number>,
  };
}

/** A single direct playhead for authored camera time, chapter state and cues. */
export function sampleHeroTimeline(timeline: HeroTimeline, progress: number) {
  if (!Number.isFinite(progress)) throw new Error("Hero progress must be finite.");
  const safeProgress = Math.min(1, Math.max(0, progress));
  const frame = timeline.firstFrame + (timeline.lastFrame - timeline.firstFrame) * safeProgress;
  const phase = timeline.phases.reduce((current, item) => safeProgress >= item.start ? item : current, timeline.phases[0]);
  const inViewingWindow = safeProgress >= phase.start && safeProgress <= phase.end;
  const windowProgress = phase.end === phase.start ? 1 : Math.min(1, Math.max(0, (safeProgress - phase.start) / (phase.end - phase.start)));
  return {
    progress: safeProgress,
    frame,
    clipSeconds: safeProgress * timeline.clipDurationSeconds,
    phase,
    inViewingWindow,
    windowProgress,
  };
}

/** Finish targets the viewing window's end; scroll uses its current real progress. */
export function getInteractionDepartureTarget(
  timeline: HeroTimeline,
  phaseId: ScenePhaseId,
  progress: number,
  direction: "forward" | "backward" = "forward",
) {
  if (!participationPhases.includes(phaseId)) return null;
  const sample = sampleHeroTimeline(timeline, progress);
  // Ignore late completion callbacks after the visitor has already left.
  if (sample.phase.id !== phaseId || !sample.inViewingWindow) return null;
  const target = direction === "forward" ? sample.phase.end : sample.phase.start;
  return target === sample.progress ? null : target;
}
