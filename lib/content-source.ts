import imageUrlBuilder from "@sanity/image-url";
import { getProject as getFallbackProject, getService as getFallbackService, homeCopy, media as fallbackMedia, projects as fallbackProjects, services as fallbackServices, type Localized, type MediaAsset, type Project, type Service } from "@/lib/content";
import { getText } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import { sanityFetch } from "@/lib/sanity/client";
import { contactChannelsQuery, editorialPageQuery, homepageQuery, legalPageQuery, projectQuery, projectsQuery, servicesQuery, siteSettingsQuery, teamPartnersQuery, trustContentQuery } from "@/lib/sanity/queries";

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
  if (!source) return fallback;
  const imageSrc = imageUrl(source.image?.asset);
  const kind: MediaAsset["kind"] = source.kind === "video" ? "video" : source.kind === "video-placeholder" ? "video-placeholder" : "image";
  const videoSrc = kind === "video" ? source.videoUrl : null;
  const hasManagedAsset = Boolean(kind === "video" ? videoSrc : imageSrc);
  return {
    src: videoSrc || imageSrc || fallback.src,
    mobileSrc: kind === "video" ? source.mobileVideoUrl : imageUrl(source.mobileCrop?.asset) || undefined,
    poster: kind === "video" ? imageSrc || fallback.poster || fallback.src : undefined,
    captionsSrc: source.captionsUrl || undefined,
    kind,
    isPlaceholder: source.isPlaceholder ?? !hasManagedAsset,
    alt: toLocalized(source.alt, getText(fallback.alt, "fa")),
    caption: source.caption ? toLocalized(source.caption) : fallback.caption,
  };
}

function mapProject(source: any, fallback: Project): Project {
  const categories = source?.categories?.map((item: any) => toLocalized(item?.label, "")).filter((item: Localized) => Object.values(item).some(Boolean)) || [];
  const projectMedia = mapMedia(source?.heroMedia, fallback.media);
  return {
    ...fallback,
    slug: source?.slug || fallback.slug,
    title: toLocalized(source?.title, getText(fallback.title, "fa")),
    eyebrow: toLocalized(source?.sector, getText(fallback.eyebrow, "fa")),
    summary: toLocalized(source?.summary, getText(fallback.summary, "fa")),
    category: categories[0] || toLocalized(source?.sector, getText(fallback.category, "fa")),
    categories: categories.length ? categories : fallback.categories || [fallback.category],
    client: source?.client ? toLocalized(source.client) : fallback.client,
    year: source?.year || fallback.year,
    location: toLocalized(source?.location, getText(fallback.location, "fa")),
    media: projectMedia,
    gallery: (source?.mediaGallery?.length ? source.mediaGallery : fallback.gallery).map((item: any, index: number) => mapMedia(item, fallback.gallery[index % fallback.gallery.length])),
    services: source?.services?.length ? source.services.map((item: any) => toLocalized(item?.title, "")) : fallback.services,
    challenge: toLocalized(source?.challenge, getText(fallback.challenge, "fa")),
    approach: toLocalized(source?.concept, getText(fallback.approach, "fa")),
    scope: toLocalized(source?.scope, getText(fallback.scope, "fa")),
    outcome: toLocalized(source?.outcomes, getText(fallback.outcome, "fa")),
    credits: source?.credits ? toLocalized(source.credits) : fallback.credits,
    relatedProjects: (source?.relatedProjects || []).map((item: any, index: number) => {
      const relatedFallback = getFallbackProject(item.slug) || fallbackProjects[index % fallbackProjects.length];
      const relatedCategories = item.categories?.map((category: any) => toLocalized(category?.label, "")) || [];
      return {
        slug: item.slug,
        title: toLocalized(item.title, getText(relatedFallback.title, "fa")),
        summary: toLocalized(item.summary, getText(relatedFallback.summary, "fa")),
        category: relatedCategories[0] || relatedFallback.category,
        year: item.year || relatedFallback.year,
        location: toLocalized(item.location, getText(relatedFallback.location, "fa")),
        media: mapMedia(item.heroMedia, relatedFallback.media),
      };
    }),
    isPlaceholder: source?.isPlaceholder ?? projectMedia.isPlaceholder ?? false,
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
  return result.map((item, index) => mapProject(item, getFallbackProject(item.slug) || fallbackProjects[index % fallbackProjects.length]));
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
  const services = result.map((item, index) => mapService(item, getFallbackService(item.slug) || fallbackServices[index % fallbackServices.length]));
  return [...services, ...fallbackServices.filter((fallback) => !services.some((service) => service.slug === fallback.slug))];
}

export async function getService(locale: Locale, slug: string): Promise<Service | undefined> {
  const fallback = getFallbackService(slug);
  const services = await getServices(locale);
  return services.find((service) => service.slug === slug) || fallback;
}

export async function getHomeModel(locale: Locale) {
  const fallback = homeCopy[locale];
  const result = await sanityFetch<any>(homepageQuery, { locale });
  const copy = { ...fallback };
  const sectionSettings: Record<string, { order?: number; visible?: boolean }> = {};
  const mediaOverrides: Record<string, MediaAsset> = {};
  const ctaOverrides: Record<string, { label?: string; href?: string }> = {};
  const featuredProjects: Project[] = [];
  if (!result) return { copy, sectionSettings, mediaOverrides, featuredProjects, ctaOverrides, fromCms: false };

  const scalar = (value: LocalizedInput, fallbackValue: string) => typeof value === "string" ? value : value?.[locale] || value?.en || value?.fa || fallbackValue;
  copy.title = scalar(result.title, copy.title);
  copy.kicker = scalar(result.kicker, copy.kicker);
  copy.intro = scalar(result.intro, copy.intro);
  if (result.heroCta) ctaOverrides.hero = { label: scalar(result.heroCta.label, ""), href: result.heroCta.href };
  const sectionCopy: Record<string, [keyof typeof copy, keyof typeof copy]> = {
    idea: ["conceptTitle", "conceptBody"],
    space: ["spaceTitle", "spaceBody"],
    experience: ["interactiveTitle", "interactiveBody"],
    proof: ["proofTitle", "proofBody"],
    capability: ["systemTitle", "systemBody"],
    intelligence: ["intelligenceTitle", "intelligenceBody"],
    trust: ["trustTitle", "trustBody"],
    memory: ["memoryTitle", "memoryBody"],
    conversion: ["ctaTitle", "ctaBody"],
  };
  const fallbackSectionMedia: Record<string, MediaAsset> = { idea: fallbackMedia.spark, space: fallbackMedia.exhibition, experience: fallbackMedia.interactive, intelligence: fallbackMedia.intelligence, memory: fallbackMedia.photo };
  for (const section of result.sections || []) {
    sectionSettings[section.key] = { order: section.order, visible: section.visible };
    if (section.media && fallbackSectionMedia[section.key]) mediaOverrides[section.key] = mapMedia(section.media, fallbackSectionMedia[section.key]);
    if (section.cta) ctaOverrides[section.key] = { label: scalar(section.cta.label, ""), href: section.cta.href };
    if (section.key === "proof" && section.projects?.length) {
      section.projects.forEach((project: any, index: number) => featuredProjects.push(mapProject(project, getFallbackProject(project.slug) || fallbackProjects[index % fallbackProjects.length])));
    }
    const keys = sectionCopy[section.key];
    if (keys) {
      copy[keys[0]] = scalar(section.title, copy[keys[0]]);
      copy[keys[1]] = scalar(section.body, copy[keys[1]]);
    }
  }
  return { copy, sectionSettings, mediaOverrides, featuredProjects, ctaOverrides, fromCms: true };
}

export type ContactChannel = {
  purpose: "sales" | "general" | "international" | "whatsapp";
  label: Localized;
  department?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  country?: string;
  availability?: string;
};

export async function getContactChannels(): Promise<ContactChannel[]> {
  const result = await sanityFetch<any[]>(contactChannelsQuery);
  if (!result?.length) return [];
  return result.map((channel) => ({
    purpose: channel.purpose || "general",
    label: toLocalized(channel.label, "Contact"),
    department: channel.department,
    phone: channel.phone,
    whatsapp: channel.whatsapp,
    email: channel.email,
    country: channel.country,
    availability: channel.availability,
  }));
}

export type LegalPageContent = {
  title: Localized;
  intro: Localized;
  status: "draft" | "approved";
  updatedAt?: string;
  sections: Array<{ heading: Localized; body: Localized }>;
};

export async function getLegalPage(locale: Locale): Promise<LegalPageContent | null> {
  const result = await sanityFetch<any>(legalPageQuery, { locale });
  if (!result) return null;
  return {
    title: toLocalized(result.title),
    intro: toLocalized(result.intro),
    status: result.status === "approved" ? "approved" : "draft",
    updatedAt: result.updatedAt,
    sections: (result.sections || []).map((section: any) => ({ heading: toLocalized(section.heading), body: toLocalized(section.body) })),
  };
}

export type SiteSettings = {
  title: string;
  navigation: Array<{ label: Localized; path: string; order: number }>;
  socialLinks: Array<{ label: string; url: string }>;
  footerLine?: Localized;
  globalLine?: Localized;
  featureFlags: { callbackForm: boolean; immersiveCanvas: boolean; lenis: boolean };
};

export async function getSiteSettings(): Promise<SiteSettings> {
  const result = await sanityFetch<any>(siteSettingsQuery);
  return {
    title: result?.title || "MANDEGAR",
    navigation: (result?.navigation || []).map((item: any) => ({ label: toLocalized(item.label), path: item.path || "", order: item.order || 0 })).sort((a: SiteSettings["navigation"][number], b: SiteSettings["navigation"][number]) => a.order - b.order),
    socialLinks: (result?.socialLinks || []).filter((item: any) => item?.url).map((item: any) => ({ label: item.label || item.url, url: item.url })),
    footerLine: result?.footerLine ? toLocalized(result.footerLine) : undefined,
    globalLine: result?.globalLine ? toLocalized(result.globalLine) : undefined,
    featureFlags: {
      callbackForm: Boolean(result?.featureFlags?.callbackForm),
      immersiveCanvas: result?.featureFlags?.immersiveCanvas !== false,
      // Smooth scrolling is an enhancement and can be disabled editorially.
      // It defaults on for the immersive homepage when no CMS setting exists.
      lenis: result?.featureFlags?.lenis !== false,
    },
  };
}

export type EditorialPageContent = {
  heroKicker: Localized;
  title: Localized;
  intro: Localized;
  sections: Array<{ key: string; kicker?: Localized; title?: Localized; body?: Localized; items: Localized[] }>;
  seo?: { title: Localized; description: Localized };
};

export async function getEditorialPage(locale: Locale, pageKey: "projects" | "services" | "about" | "contact"): Promise<EditorialPageContent | null> {
  const result = await sanityFetch<any>(editorialPageQuery, { locale, pageKey });
  if (!result) return null;
  return {
    heroKicker: toLocalized(result.heroKicker),
    title: toLocalized(result.title),
    intro: toLocalized(result.intro),
    sections: (result.sections || []).map((section: any) => ({
      key: section.key || "section",
      kicker: section.kicker ? toLocalized(section.kicker) : undefined,
      title: section.title ? toLocalized(section.title) : undefined,
      body: section.body ? toLocalized(section.body) : undefined,
      items: (section.items || []).map((item: any) => toLocalized(item)),
    })),
    seo: result.seo ? { title: toLocalized(result.seo.title), description: toLocalized(result.seo.description) } : undefined,
  };
}

export type TeamPartner = { name: string; role: Localized; biography: Localized; location?: string; partnerType?: string };

export async function getTeamPartners(): Promise<TeamPartner[]> {
  const result = await sanityFetch<any[]>(teamPartnersQuery);
  return (result || []).map((item) => ({
    name: item.name,
    role: toLocalized(item.role),
    biography: toLocalized(item.biography),
    location: item.location,
    partnerType: item.partnerType,
  }));
}

export type TrustContent = {
  clients: Array<{ name: string; logo?: string; url?: string; sector?: string }>;
  metrics: Array<{ label: Localized; value: string; unit?: string; context: Localized; sourceNote: string }>;
  testimonials: Array<{ quote: Localized; person: Localized; role: Localized; organization: Localized }>;
};

export async function getTrustContent(locale: Locale): Promise<TrustContent> {
  const result = await sanityFetch<any>(trustContentQuery, { locale });
  return {
    clients: (result?.clients || []).map((client: any) => ({ name: client.name, logo: imageUrl(client.logo?.asset) || undefined, url: client.url, sector: client.sector })),
    metrics: (result?.metrics || []).map((metric: any) => ({ label: toLocalized(metric.label), value: metric.value, unit: metric.unit, context: toLocalized(metric.context), sourceNote: metric.sourceNote })),
    testimonials: (result?.testimonials || []).map((testimonial: any) => ({ quote: toLocalized(testimonial.quote), person: toLocalized(testimonial.person), role: toLocalized(testimonial.role), organization: toLocalized(testimonial.organization) })),
  };
}
