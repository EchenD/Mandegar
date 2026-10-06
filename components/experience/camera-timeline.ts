/** The authored clip follows the actual scroll playhead without retiming. */
export function getCameraLoopSampleProgress(progress: number) {
  return Math.min(1, Math.max(0, progress));
}
