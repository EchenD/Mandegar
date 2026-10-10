export const homeSectionLabels = {
  showcase: "Work",
  services: "Services",
  about: "AboutRead",
  partners: "PartnersRead",
  contact: "Contact",
} as const;

export type HomeSection = keyof typeof homeSectionLabels;

export function getHomeSection(hash: string): HomeSection | null {
  const section = hash.replace(/^#/, "");
  return Object.hasOwn(homeSectionLabels, section) ? section as HomeSection : null;
}

export function getNavigationHomeSection(path: string): HomeSection | null {
  const [pathname, hash] = path.split("#");
  if (hash) return getHomeSection(hash);
  const segments = pathname.split("?")[0].split("/").filter(Boolean);
  if (["fa", "en", "ar"].includes(segments[0])) segments.shift();
  if (segments.length !== 1) return null;
  return getHomeSection(segments[0] === "projects" ? "showcase" : segments[0]);
}

export type HomeScrollCheckpoint = { progress: number } | { top: number };

export function getHomeScrollCheckpoint(): HomeScrollCheckpoint | null {
  const checkpoint = window.history.state?.mandegarHomeScroll;
  if (typeof checkpoint?.progress === "number" && Number.isFinite(checkpoint.progress)) {
    return { progress: Math.max(0, Math.min(1, checkpoint.progress)) };
  }
  if (typeof checkpoint?.top === "number" && Number.isFinite(checkpoint.top)) {
    return { top: Math.max(0, checkpoint.top) };
  }
  return null;
}

export function navigateHomeSection(section: HomeSection) {
  const root = document.querySelector<HTMLElement>("[data-experience-root]");
  const distance = Number(root?.dataset.cameraScrollDistance);
  const relativeTop = window.scrollY - (root?.offsetTop ?? 0);
  const checkpoint: HomeScrollCheckpoint = root?.dataset.reducedMotion !== "true"
    && distance > 0 && relativeTop >= 0 && relativeTop <= distance
    ? { progress: relativeTop / distance }
    : { top: window.scrollY };
  const state = window.history.state && typeof window.history.state === "object" ? window.history.state : {};
  window.history.replaceState({ ...state, mandegarHomeScroll: checkpoint }, "");
  const nextState = { ...state };
  delete nextState.mandegarHomeScroll;
  window.history.pushState(nextState, "", `#${section}`);
  window.dispatchEvent(new CustomEvent("mandegar:home-section", { detail: { section } }));
}
