let cachedWebGLSupport: boolean | undefined;

export function hasWebGLSupport() {
  if (cachedWebGLSupport !== undefined) return cachedWebGLSupport;
  if (typeof document === "undefined") return false;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
  cachedWebGLSupport = Boolean(context);

  // Capability checks create a real WebGL context. Release it immediately so
  // repeated mounts and development refreshes do not exhaust the browser pool.
  context?.getExtension("WEBGL_lose_context")?.loseContext();
  return cachedWebGLSupport;
}
