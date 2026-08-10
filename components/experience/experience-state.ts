import type { SceneQuality } from "./scene-config";
import { getIntroFrame, type IntroFrame } from "./intro-score";
import { getNarrativeFrame, type NarrativeFrame } from "./narrative-score";

/**
 * A tiny mutable bridge keeps the scroll timeline and the WebGL renderer in
 * sync without turning every animation frame into a React render.
 */
export const experienceState: {
  sequence: "loading" | "intro" | "loop";
  intro: IntroFrame;
  progress: number;
  narrative: NarrativeFrame;
  quality: SceneQuality;
  pointerX: number;
  pointerY: number;
  pointerPulse: number;
  assemblyProgress: number;
  focusDistance: number;
  lightScale: number;
  focusZone: "photo" | "game" | "touch" | null;
  focusProject: number | null;
} = {
  sequence: "loading",
  intro: getIntroFrame(0),
  progress: 0,
  narrative: getNarrativeFrame(0),
  quality: "full",
  pointerX: 0,
  pointerY: 0,
  pointerPulse: 0,
  assemblyProgress: 0,
  focusDistance: 18,
  lightScale: 1,
  focusZone: null,
  focusProject: null,
};
