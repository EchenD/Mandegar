import mediaDocuments from "@/content/media.json";
import projectDocuments from "@/content/projects.json";
import serviceDocuments from "@/content/services.json";
import homepage from "@/content/homepage.json";
import type { Locale } from "./i18n";
import { publicAssetPath } from "./public-asset-path";
import type { HomeCopy, MediaAsset, Project, ProjectDocument, Service, ServiceDocument } from "./content-types";

export type { Localized, MediaAsset, Project, RelatedProject, Service } from "./content-types";
export { getText } from "./localized-text";

// Store root-relative paths in content files so one collection works on every host.
function resolveMedia(asset: MediaAsset): MediaAsset {
  return {
    ...asset,
    src: publicAssetPath(asset.src),
    ...(asset.mobileSrc ? { mobileSrc: publicAssetPath(asset.mobileSrc) } : {}),
    ...(asset.poster ? { poster: publicAssetPath(asset.poster) } : {}),
    ...(asset.captionsSrc ? { captionsSrc: publicAssetPath(asset.captionsSrc) } : {}),
  };
}

export const media = Object.fromEntries(
  Object.entries(mediaDocuments).map(([key, asset]) => [key, resolveMedia(asset as MediaAsset)]),
) as Record<keyof typeof mediaDocuments, MediaAsset>;

function getMedia(key: string): MediaAsset {
  const asset = media[key as keyof typeof media];
  if (!asset) throw new Error(`Unknown content media reference: ${key}. Run npm run content:check.`);
  return asset;
}

// Draft and archived records never become public links, including on the homepage.
export const services: Service[] = (serviceDocuments as ServiceDocument[])
  .filter((service) => service.publicationState === "published")
  .map((service, index) => ({ ...service, number: String(index + 1).padStart(2, "0"), media: getMedia(service.media) }));

const publishedProjects: Project[] = (projectDocuments as ProjectDocument[])
  .filter((project) => project.publicationState === "published")
  .map((project) => ({
    ...project,
    media: getMedia(project.media),
    gallery: project.gallery.map(getMedia),
    serviceSlugs: project.serviceSlugs?.filter((slug) => services.some((service) => service.slug === slug)),
  }));

export const projects: Project[] = publishedProjects.map((project) => ({
  ...project,
  relatedProjects: (project.relatedProjectSlugs || [])
    .map((slug) => publishedProjects.find((related) => related.slug === slug))
    .filter((related): related is Project => Boolean(related && related.slug !== project.slug))
    .map(({ slug, title, summary, category, year, location, media: projectMedia }) => ({
      slug, title, summary, category, year, location, media: projectMedia,
    })),
}));

export const homeCopy: Record<Locale, HomeCopy> = homepage.copy;

export function getProject(slug: string) {
  return projects.find((project) => project.slug === slug);
}

export function getService(slug: string) {
  return services.find((service) => service.slug === slug);
}
