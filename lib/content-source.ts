import homepage from "@/content/homepage.json";
import site from "@/content/site.json";
import contacts from "@/content/contacts.json";
import legal from "@/content/legal.json";
import pages from "@/content/pages.json";
import people from "@/content/people.json";
import trust from "@/content/trust.json";
import { getProject as findProject, getService as findService, homeCopy, media, projects, services } from "./content";
import type { Localized, MediaAsset, Project, Service } from "./content";
import type { Locale } from "./i18n";
import { publicAssetPath } from "./public-asset-path";

export { getPageCopy } from "./page-copy";

export type ContentFetchOptions = { publishedOnly?: boolean };

// Async signatures are retained so existing page components can keep their API.
// Files are bundled into each build; serving a page never calls a content server.
export async function getProjects(_locale: Locale, _options?: ContentFetchOptions): Promise<Project[]> {
  return projects;
}

export async function getProject(_locale: Locale, slug: string): Promise<Project | undefined> {
  return findProject(slug);
}

export async function getServices(_locale: Locale, _options?: ContentFetchOptions): Promise<Service[]> {
  return services;
}

export async function getService(_locale: Locale, slug: string): Promise<Service | undefined> {
  return findService(slug);
}

type HomeConfiguration = {
  useContentOverrides: boolean;
  sectionSettings: Record<string, { order?: number; visible?: boolean }>;
  mediaOverrides: Record<string, keyof typeof media>;
  ctaOverrides: Record<string, { label?: Localized; href?: string }>;
  featuredProjectSlugs: string[];
};

export async function getHomeModel(locale: Locale) {
  const configuration = homepage as HomeConfiguration;
  const mediaOverrides: Record<string, MediaAsset> = {};
  const ctaOverrides: Record<string, { label?: string; href?: string }> = {};
  for (const [key, mediaKey] of Object.entries(configuration.mediaOverrides)) {
    mediaOverrides[key] = media[mediaKey];
  }
  for (const [key, cta] of Object.entries(configuration.ctaOverrides)) {
    ctaOverrides[key] = { label: cta.label?.[locale], href: cta.href };
  }
  return {
    copy: { ...homeCopy[locale] },
    sectionSettings: configuration.sectionSettings,
    mediaOverrides,
    ctaOverrides,
    featuredProjects: configuration.featuredProjectSlugs
      .map(findProject)
      .filter((project): project is Project => Boolean(project)),
    // This legacy flag enables the existing homepage's editorial overrides.
    // Keeping it false preserves the homepage's current text and arrangement.
    fromCms: configuration.useContentOverrides,
  };
}

export type ContactChannel = {
  purpose: "sales" | "general" | "international" | "whatsapp";
  label: Localized;
  description?: Localized;
  isPlaceholder?: boolean;
  department?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  country?: string;
  availability?: string;
  availabilityText?: Localized;
};

export async function getContactChannels(): Promise<ContactChannel[]> {
  return contacts as ContactChannel[];
}

export type LegalPageContent = {
  title: Localized;
  intro: Localized;
  status: "draft" | "approved";
  updatedAt?: string;
  sections: Array<{ heading: Localized; body: Localized }>;
};

export async function getLegalPage(_locale: Locale): Promise<LegalPageContent | null> {
  return legal as LegalPageContent;
}

export type SiteSettings = {
  title: string;
  copyrightHolder?: string;
  brandMark?: string;
  socialImage?: string;
  address?: Localized;
  navigation: Array<{ label: Localized; path: string; order: number }>;
  socialLinks: Array<{ label: string; url: string }>;
  footerLine?: Localized;
  globalLine?: Localized;
  featureFlags: { callbackForm: boolean; immersiveCanvas: boolean; lenis: boolean };
};

export async function getSiteSettings(): Promise<SiteSettings> {
  const settings = site as SiteSettings;
  return {
    ...settings,
    ...(settings.brandMark ? { brandMark: publicAssetPath(settings.brandMark) } : {}),
    navigation: [...settings.navigation].sort((a, b) => a.order - b.order),
  };
}

export type EditorialPageContent = {
  heroKicker: Localized;
  title: Localized;
  intro: Localized;
  sections: Array<{ key: string; kicker?: Localized; title?: Localized; body?: Localized; items: Localized[] }>;
  seo?: { title: Localized; description: Localized };
};

export async function getEditorialPage(_locale: Locale, pageKey: "projects" | "services" | "about" | "partners" | "contact"): Promise<EditorialPageContent | null> {
  return pages[pageKey] as EditorialPageContent;
}

export type TeamPartner = {
  name: string;
  role: Localized;
  biography: Localized;
  location?: string;
  partnerType?: string;
  isPlaceholder?: boolean;
  publicationState?: "draft" | "published" | "archived";
};

export async function getTeamPartners(): Promise<TeamPartner[]> {
  return (people as TeamPartner[]).filter((person) => person.publicationState === "published" && !person.isPlaceholder);
}

type ApprovedEvidence = {
  publicationState?: "draft" | "published" | "archived";
  isPlaceholder?: boolean;
  approvalNote?: string;
};

export type TrustContent = {
  clients: Array<ApprovedEvidence & { name: string; logo?: string; url?: string; sector?: string }>;
  metrics: Array<ApprovedEvidence & { label: Localized; value: string; unit?: string; context: Localized; sourceNote: string }>;
  testimonials: Array<ApprovedEvidence & { quote: Localized; person: Localized; role: Localized; organization: Localized }>;
};

export async function getTrustContent(_locale: Locale): Promise<TrustContent> {
  const content = trust as TrustContent;
  return {
    ...content,
    clients: content.clients.filter((client) => client.publicationState === "published" && !client.isPlaceholder).map((client) => ({
      ...client,
      ...(client.logo ? { logo: publicAssetPath(client.logo) } : {}),
    })),
    metrics: content.metrics.filter((metric) => metric.publicationState === "published" && !metric.isPlaceholder),
    testimonials: content.testimonials.filter((testimonial) => testimonial.publicationState === "published" && !testimonial.isPlaceholder),
  };
}
