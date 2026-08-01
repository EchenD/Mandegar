export type ExperienceQuality = "full" | "lite";

/**
 * A tiny mutable bridge keeps the scroll timeline and the WebGL renderer in
 * sync without turning every animation frame into a React render.
 */
export const experienceState: {
  progress: number;
  quality: ExperienceQuality;
  pointerX: number;
  pointerY: number;
} = {
  progress: 0,
  quality: "full",
  pointerX: 0,
  pointerY: 0,
};
