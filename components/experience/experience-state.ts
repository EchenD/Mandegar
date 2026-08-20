import type { SceneQuality } from "./scene-config";
import { getIntroFrame, type IntroFrame } from "./intro-score";
import { getNarrativeFrame, type NarrativeFrame } from "./narrative-score";
import { getStageFrame, type StageFrame } from "./stage-presets";

/**
 * A tiny mutable bridge keeps the scroll timeline and the WebGL renderer in
 * sync without turning every animation frame into a React render.
 */
export const experienceState: {
  sequence: "loading" | "intro" | "loop";
  intro: IntroFrame;
  progress: number;
  narrative: NarrativeFrame;
  stage: StageFrame;
  quality: SceneQuality;
  pointerX: number;
  pointerY: number;
  pointerPresent: boolean;
  pointerPulse: number;
  assemblyProgress: number;
  focusDistance: number;
  lightScale: number;
  focusZone: "photo" | "game" | "touch" | null;
  focusProject: number | null;
  focusScreen: "videoWall" | "interactive" | "game" | "main" | null;
} = {
  sequence: "loading",
  intro: getIntroFrame(0),
  progress: 0,
  narrative: getNarrativeFrame(0),
  stage: getStageFrame(0),
  quality: "full",
  pointerX: 0,
  pointerY: 0,
  pointerPresent: false,
  pointerPulse: 0,
  assemblyProgress: 0,
  focusDistance: 18,
  lightScale: 1,
  focusZone: null,
  focusProject: null,
  focusScreen: null,
};
