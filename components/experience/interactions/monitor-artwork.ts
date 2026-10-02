const artworkStartupTimeout = 1200;

export function loadMonitorArtwork(
  source: string,
  onReady: (image: HTMLImageElement | null) => void,
  { immediate = false }: { immediate?: boolean } = {},
) {
  const image = new Image();
  let disposed = false;
  const notify = () => {
    if (disposed) return;
    window.clearTimeout(timeout);
    onReady(image.naturalWidth > 0 ? image : null);
  };
  const timeout = window.setTimeout(notify, artworkStartupTimeout);
  image.onload = notify;
  image.onerror = notify;
  image.src = source;
  // An outgoing canvas already supplies the entrance background. A stalled
  // idle artwork request must never prevent the foreground controls starting.
  if (immediate || image.complete) notify();

  return () => {
    disposed = true;
    window.clearTimeout(timeout);
    image.onload = null;
    image.onerror = null;
  };
}
