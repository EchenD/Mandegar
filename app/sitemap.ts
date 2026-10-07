import type { MetadataRoute } from "next";
import { getLegalPage, getProjects, getServices } from "@/lib/content-source";
import { locales } from "@/lib/i18n";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const content = await Promise.all(locales.map(async (locale) => ({ locale, projects: await getProjects(locale), services: await getServices(locale), legal: await getLegalPage(locale) })));
  return content.flatMap(({ locale, projects, services, legal }) => {
    const paths = [
      `/${locale}`,
      `/${locale}/projects`,
      `/${locale}/services`,
      `/${locale}/about`,
      `/${locale}/contact`,
      ...(legal?.status === "approved" ? [`/${locale}/legal`] : []),
      ...projects.map((project) => `/${locale}/projects/${project.slug}`),
      ...services.map((service) => `/${locale}/services/${service.slug}`),
    ];
    return paths.map((path) => ({ url: absoluteUrl(path) }));
  });
}
