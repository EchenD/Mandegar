import { experienceState } from "./experience-state";
import { getIntroFrame } from "./intro-score";
import { directNarrative } from "./narrative-director";

export function directIntro(progress: number) {
  const frame = getIntroFrame(progress);
  experienceState.sequence = "intro";
  experienceState.intro = frame;
  directNarrative(0);
  return frame;
}

export function completeIntro() {
  const frame = getIntroFrame(1);
  experienceState.intro = frame;
  directNarrative(0);
  experienceState.sequence = "loop";
  return frame;
}

export function resetIntro() {
  experienceState.sequence = "loading";
  experienceState.intro = getIntroFrame(0);
  directNarrative(0);
}
