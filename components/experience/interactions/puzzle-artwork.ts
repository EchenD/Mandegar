import { publicAssetPath } from "@/lib/public-asset-path";

export const puzzleArtworkUrl = publicAssetPath("/media/hero/connected-experience.webp");
export const puzzleArtworkFallbackUrl = publicAssetPath("/media/mandegar/screens/mandegar-puzzle.webp");

/** Keep the pieces usable while their story artwork loads or is unavailable. */
export function loadPuzzleArtwork(
  onReady: (image: HTMLImageElement | null) => void,
  { immediate = false }: { immediate?: boolean } = {},
) {
  const image = new Image();
  const fallback = new Image();
  let disposed = false;
  let fallbackStarted = false;
  const notify = (next: HTMLImageElement | null) => { if (!disposed) onReady(next); };
  const loadFallback = () => {
    if (disposed || image.naturalWidth > 0 || fallbackStarted) return;
    fallbackStarted = true;
    fallback.onload = () => { if (!image.naturalWidth) notify(fallback); };
    fallback.onerror = () => { if (!image.naturalWidth) notify(null); };
    fallback.src = puzzleArtworkFallbackUrl;
  };
  const timeout = window.setTimeout(loadFallback, 1200);
  image.onload = () => { window.clearTimeout(timeout); notify(image); };
  image.onerror = () => { window.clearTimeout(timeout); loadFallback(); };
  image.src = puzzleArtworkUrl;
  if (image.complete && image.naturalWidth > 0) {
    window.clearTimeout(timeout);
    notify(image);
  } else if (immediate) notify(null);
  return () => {
    disposed = true;
    window.clearTimeout(timeout);
    image.onload = image.onerror = null;
    fallback.onload = fallback.onerror = null;
  };
}
