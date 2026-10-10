import { qualityProfiles, type SceneQuality } from "./scene-config";

export function getHeroRenderDpr(
  quality: SceneQuality,
  width: number,
  height: number,
  devicePixelRatio: number,
  constrained = false,
) {
  const profile = qualityProfiles[quality];
  const deviceRatio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  if (quality === "full") return Math.min(deviceRatio, profile.dpr[1]);
  const maximum = constrained ? Math.min(profile.dpr[1], 1.5) : profile.dpr[1];
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return Math.min(deviceRatio, maximum);
  }
  const pixelBudget = constrained ? 750_000 : 1_250_000;
  // Large screens on constrained hardware may need less than one pixel per
  // CSS pixel. A DPR floor would silently exceed their rendering budget.
  const pixelRatio = Math.sqrt(pixelBudget / width / height);
  return Math.min(deviceRatio, maximum, pixelRatio);
}
