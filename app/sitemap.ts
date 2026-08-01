import type { MetadataRoute } from "next";
import { projects, services } from "@/lib/content";
import { locales } from "@/lib/i18n";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const routes = locales.flatMap((locale) => [
    `${base}/${locale}`,
    `${base}/${locale}/projects`,
    `${base}/${locale}/services`,
    `${base}/${locale}/about`,
    `${base}/${locale}/contact`,
    ...projects.map((project) => `${base}/${locale}/projects/${project.slug}`),
    ...services.map((service) => `${base}/${locale}/services/${service.slug}`),
  ]);
  return routes.map((url) => ({ url, lastModified: new Date() }));
}
