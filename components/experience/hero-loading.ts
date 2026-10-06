import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const listeners = new Set<(progress: number) => void>();
const readyListeners = new Set<() => void>();
let progress = 0;
let loading = false;
export const heroLoadingManager = new THREE.LoadingManager();
export const heroModelLoader = new GLTFLoader(heroLoadingManager);
export const heroTextureLoader = new THREE.TextureLoader(heroLoadingManager);

function report(loaded: number, total: number) {
  progress = Math.max(progress, Math.floor(loaded / Math.max(1, total) * 95));
  listeners.forEach((listener) => listener(progress));
}
heroLoadingManager.onStart = (_url, loaded, total) => { loading = true; report(loaded, total); };
heroLoadingManager.onProgress = (_url, loaded, total) => report(loaded, total);
heroLoadingManager.onLoad = () => {
  loading = false;
  readyListeners.forEach((listener) => listener());
  readyListeners.clear();
};

export function subscribeHeroLoading(listener: (progress: number) => void) {
  listeners.add(listener);
  listener(progress);
  return () => { listeners.delete(listener); };
}

export function whenHeroAssetsReady(listener: () => void) {
  if (loading) readyListeners.add(listener);
  else listener();
  return () => { readyListeners.delete(listener); };
}
