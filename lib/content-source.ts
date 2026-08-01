import imageUrlBuilder from "@sanity/image-url";
import { getProject as getFallbackProject, getService as getFallbackService, homeCopy, projects as fallbackProjects, services as fallbackServices, type Localized, type MediaAsset, type Project, type Service } from "@/lib/content";
import { getText } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import { sanityFetch } from "@/lib/sanity/client";
import { projectQuery, projectsQuery, servicesQuery } from "@/lib/sanity/queries";

type LocalizedInput = string | Partial<Localized> | null | undefined;

function toLocalized(value: LocalizedInput, fallback = ""): Localized {
  if (typeof value === "string") return { fa: value, en: value, ar: value };
  return { fa: value?.fa || fallback, en: value?.en || fallback, ar: value?.ar || fallback };
}

function imageUrl(source: unknown) {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
  if (!projectId || !source) return null;
  return imageUrlBuilder({ projectId, dataset }).image(source).width(1800).auto("format").url();
}

function mapMedia(source: any, fallback: MediaAsset): MediaAsset {
  const src = imageUrl(source?.image?.asset) || source?.videoUrl || fallback.src;
  return {
    src,
    kind: source?.kind === "video" ? "video-placeholder" : source?.kind || fallback.kind,
    isPlaceholder: Boolean(source?.isPlaceholder) || !imageUrl(source?.image?.asset),
    alt: toLocalized(source?.alt, getText(fallback.alt, "fa")),
  };
}

function mapProject(source: any, fallback: Project): Project {
  return {
    ...fallback,
    slug: source?.slug || fallback.slug,
    title: toLocalized(source?.title, getText(fallback.title, "fa")),
    eyebrow: toLocalized(source?.sector, getText(fallback.eyebrow, "fa")),
    summary: toLocalized(source?.summary, getText(fallback.summary, "fa")),
    category: toLocalized(source?.category?.label || source?.sector, getText(fallback.category, "fa")),
    year: source?.year || fallback.year,
    location: toLocalized(source?.location, getText(fallback.location, "fa")),
    media: mapMedia(source?.heroMedia, fallback.media),
    gallery: (source?.mediaGallery?.length ? source.mediaGallery : fallback.gallery).map((item: any, index: number) => mapMedia(item, fallback.gallery[index % fallback.gallery.length])),
    services: source?.services?.length ? source.services.map((item: any) => toLocalized(item?.title, "")) : fallback.services,
    challenge: toLocalized(source?.challenge, getText(fallback.challenge, "fa")),
    approach: toLocalized(source?.concept, getText(fallback.approach, "fa")),
    scope: toLocalized(source?.scope, getText(fallback.scope, "fa")),
    outcome: toLocalized(source?.outcomes, getText(fallback.outcome, "fa")),
    isPlaceholder: false,
  };
}

function mapService(source: any, fallback: Service): Service {
  return {
    ...fallback,
    slug: source?.slug || fallback.slug,
    title: toLocalized(source?.title, getText(fallback.title, "fa")),
    summary: toLocalized(source?.summary, getText(fallback.summary, "fa")),
    detail: toLocalized(source?.detail, getText(fallback.detail, "fa")),
    capabilities: source?.capabilities?.length ? source.capabilities.map((item: any) => toLocalized(item, "")) : fallback.capabilities,
    media: mapMedia(source?.media, fallback.media),
    status: source?.status === "emerging" ? "emerging" : source?.status === "archived" ? "emerging" : "current",
  };
}

export async function getProjects(locale: Locale): Promise<Project[]> {
  const result = await sanityFetch<any[]>(projectsQuery, { locale });
  if (!result?.length) return fallbackProjects;
  return result.map((item, index) => mapProject(item, fallbackProjects[index % fallbackProjects.length]));
}

export async function getProject(locale: Locale, slug: string): Promise<Project | undefined> {
  const fallback = getFallbackProject(slug);
  const result = await sanityFetch<any>(projectQuery, { locale, slug });
  if (result) return mapProject(result, fallback || fallbackProjects[0]);
  return fallback;
}

export async function getServices(locale: Locale): Promise<Service[]> {
  const result = await sanityFetch<any[]>(servicesQuery, { locale });
  if (!result?.length) return fallbackServices;
  return result.map((item, index) => mapService(item, fallbackServices[index % fallbackServices.length]));
}

export async function getService(locale: Locale, slug: string): Promise<Service | undefined> {
  const fallback = getFallbackService(slug);
  const services = await getServices(locale);
  return services.find((service) => service.slug === slug) || fallback;
}

export function getHomeCopy(locale: Locale) {
  return homeCopy[locale];
}
