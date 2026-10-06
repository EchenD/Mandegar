export const homeSectionLabels = {
  showcase: "Work",
  services: "Services",
  about: "AboutRead",
  contact: "Contact",
} as const;

export type HomeSection = keyof typeof homeSectionLabels;

export function getHomeSection(hash: string): HomeSection | null {
  const section = hash.replace(/^#/, "");
  return Object.hasOwn(homeSectionLabels, section) ? section as HomeSection : null;
}

export function navigateHomeSection(section: HomeSection) {
  window.history.pushState(null, "", `#${section}`);
  window.dispatchEvent(new CustomEvent("mandegar:home-section", { detail: { section } }));
}
