import type { Locale } from "./i18n";

export type Localized = Record<Locale, string>;
export type PublicationState = "draft" | "published" | "archived";

export type MediaAsset = {
  src: string;
  mobileSrc?: string;
  poster?: string;
  captionsSrc?: string;
  alt: Localized;
  caption?: Localized;
  kind: "image" | "video" | "video-placeholder";
  isPlaceholder?: boolean;
  rightsStatus?: "placeholder" | "pending" | "approved";
  sourceNote?: string;
};

export type RelatedProject = {
  slug: string;
  title: Localized;
  summary: Localized;
  category: Localized;
  year: string;
  location: Localized;
  media: MediaAsset;
};

export type Project = {
  slug: string;
  title: Localized;
  eyebrow: Localized;
  summary: Localized;
  category: Localized;
  categories?: Localized[];
  client?: Localized;
  year: string;
  location: Localized;
  media: MediaAsset;
  gallery: MediaAsset[];
  services: Localized[];
  serviceSlugs?: string[];
  challenge: Localized;
  approach: Localized;
  scope: Localized;
  outcome: Localized;
  credits?: Localized;
  relatedProjects?: RelatedProject[];
  relatedProjectSlugs?: string[];
  publicationState?: PublicationState;
  isPlaceholder: boolean;
};

export type Service = {
  slug: string;
  number: string;
  title: Localized;
  summary: Localized;
  detail: Localized;
  capabilities: Localized[];
  media: MediaAsset;
  status?: "current" | "emerging";
  publicationState?: PublicationState;
  isPlaceholder?: boolean;
  deliverables?: Localized[];
  process?: Array<{ title: Localized; body: Localized }>;
  faq?: Array<{ question: Localized; answer: Localized }>;
  relatedProjectSlugs?: string[];
};

export type ProjectDocument = Omit<Project, "media" | "gallery" | "relatedProjects"> & { media: string; gallery: string[] };
export type ServiceDocument = Omit<Service, "media"> & { media: string };

export type HomeCopy = {
  kicker: string;
  title: string;
  intro: string;
  conceptTitle: string;
  conceptBody: string;
  spaceTitle: string;
  spaceBody: string;
  interactiveTitle: string;
  interactiveBody: string;
  proofTitle: string;
  proofBody: string;
  systemTitle: string;
  systemBody: string;
  intelligenceTitle: string;
  intelligenceBody: string;
  trustTitle: string;
  trustBody: string;
  memoryTitle: string;
  memoryBody: string;
  ctaTitle: string;
  ctaBody: string;
};
