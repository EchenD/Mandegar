import type { Metadata } from "next";
import { locales, type Locale } from "@/lib/i18n";
import seoContent from "@/content/seo.json";
import siteContent from "@/content/site.json";

export const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3300");

const openGraphLocale: Record<Locale, string> = {
  fa: "fa_IR",
  en: "en_US",
  ar: "ar_AE",
};

export const pageSeo = seoContent as Record<Locale, Record<"home" | "projects" | "services" | "about" | "partners" | "contact" | "legal", [string, string]>>;

export function absoluteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const siteBasePath = siteUrl.pathname.replace(/\/$/, "");
  const relativePath = path.startsWith("/") ? path : `/${path}`;
  const fullPath = siteBasePath && (relativePath === siteBasePath || relativePath.startsWith(`${siteBasePath}/`))
    ? relativePath
    : `${siteBasePath}${relativePath}`;
  return new URL(fullPath, `${siteUrl.origin}/`).toString();
}

export function buildMetadata({ locale, title, description, path = "" }: { locale: Locale; title: string; description: string; path?: string }): Metadata {
  const localizedPath = path ? `/${locale}/${path}` : `/${locale}`;
  const languages = Object.fromEntries(locales.map((item) => [item, absoluteUrl(path ? `/${item}/${path}` : `/${item}`)]));
  const image = { url: absoluteUrl(siteContent.socialImage || "/images/mandegar-social.png"), width: 1200, height: 630, alt: siteContent.title };
  return {
    metadataBase: siteUrl,
    title,
    description,
    alternates: { canonical: absoluteUrl(localizedPath), languages: { ...languages, "x-default": absoluteUrl(path ? `/fa/${path}` : "/fa") } },
    openGraph: {
      type: "website",
      url: absoluteUrl(localizedPath),
      images: [image],
      siteName: siteContent.title,
      title,
      description,
      locale: openGraphLocale[locale],
      alternateLocale: locales.filter((item) => item !== locale).map((item) => openGraphLocale[item]),
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
