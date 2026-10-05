import { publicAssetPath } from "@/lib/public-asset-path";

export type RaceArtwork = {
  cars: HTMLImageElement | null;
  road: HTMLImageElement | null;
};

export const raceCarSprites = {
  blue: [65, 104, 341, 674],
  ivory: [498, 104, 338, 675],
  bronze: [933, 107, 349, 672],
  silver: [1375, 107, 345, 668],
} as const;

const artwork: RaceArtwork = { cars: null, road: null };
const subscribers = new Set<() => void>();
let started = false;

export function getRaceArtwork() {
  return artwork;
}

export function loadRaceArtwork(onReady: () => void) {
  subscribers.add(onReady);
  if (!started) {
    started = true;
    for (const [key, filename] of [["cars", "race-cars.webp"], ["road", "race-road.webp"]] as const) {
      const image = new Image();
      image.decoding = "async";
      image.fetchPriority = "low";
      image.onload = () => {
        artwork[key] = image;
        for (const callback of subscribers) callback();
      };
      image.src = publicAssetPath(`/media/hero/${filename}`);
    }
  }
  if (artwork.cars || artwork.road) onReady();
  return () => { subscribers.delete(onReady); };
}
