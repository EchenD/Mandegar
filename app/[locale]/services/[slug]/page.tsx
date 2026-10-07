import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/editorial/Breadcrumbs";
import { PageCta } from "@/components/editorial/PageCta";
import { MediaPlaceholder } from "@/components/media/MediaPlaceholder";
import { ProjectCard } from "@/components/projects/ProjectCard";
import styles from "@/components/projects/Portfolio.module.css";
import { JsonLd } from "@/components/seo/JsonLd";
import { getText } from "@/lib/content";
import { getPageCopy, getProjects, getService, getServices } from "@/lib/content-source";
import { getUi, locales, localizedPath, type Locale } from "@/lib/i18n";
import { absoluteUrl, buildMetadata } from "@/lib/seo";

export async function generateStaticParams() {
  const params = await Promise.all(locales.map(async (locale) => {
    const services = await getServices(locale, { publishedOnly: true });
    return services.map((service) => ({ locale, slug: service.slug }));
  }));
  return params.flat();
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const service = await getService(locale, slug);
  if (!service) return {};
  return buildMetadata({ locale, title: getText(service.title, locale), description: getText(service.summary, locale), path: `services/${slug}` });
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params;
  const [service, projects, services] = await Promise.all([getService(locale, slug), getProjects(locale), getServices(locale)]);
  if (!service) notFound();
  const ui = getUi(locale);
  const copy = getPageCopy(locale);
  const title = getText(service.title, locale);
  const summary = getText(service.summary, locale);
  const deliverables = service.deliverables || [];
  const process = service.process || [];
  const faq = service.faq || [];
  const specifiedSlugs = service.relatedProjectSlugs || [];
  const specified = specifiedSlugs.flatMap((relatedSlug) => projects.find((project) => project.slug === relatedSlug) || []);
  const matching = projects.filter((project) => project.serviceSlugs?.includes(service.slug) && !specifiedSlugs.includes(project.slug));
  const related = [...specified, ...matching].slice(0, 2);
  const relatedServices = services.filter((entry) => entry.slug !== slug).slice(0, 2);
  const sections = [
    { id: "overview", title: copy.serviceOverview },
    ...(service.capabilities.length ? [{ id: "capabilities", title: copy.capabilities }] : []),
    ...(deliverables.length ? [{ id: "deliverables", title: copy.deliverables }] : []),
    ...(process.length ? [{ id: "process", title: copy.process }] : []),
    ...(faq.length ? [{ id: "faq", title: copy.faq }] : []),
  ];

  return (
    <div className={`serviceDetail ${styles.portfolioPage}`}>
      <JsonLd data={[
        {
          "@context": "https://schema.org",
          "@type": "Service",
          name: title,
          description: summary,
          url: absoluteUrl(`/${locale}/services/${slug}`),
          provider: { "@type": "Organization", name: "Mandegar", url: absoluteUrl(`/${locale}`) },
          inLanguage: locale,
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: copy.home, item: absoluteUrl(`/${locale}`) },
            { "@type": "ListItem", position: 2, name: ui.navigation.services, item: absoluteUrl(`/${locale}/services`) },
            { "@type": "ListItem", position: 3, name: title, item: absoluteUrl(`/${locale}/services/${slug}`) },
          ],
        },
      ]} />
      <section className={`detailHero ${styles.detailHero}`}>
        <div className="pageWidth">
          <Breadcrumbs locale={locale} items={[{ label: ui.navigation.services, href: localizedPath(locale, "services") }, { label: title }]} />
          <div className={styles.detailHeading}>
            <div>
              <div className={`sectionKicker ${styles.kicker}`}>{service.number} / {ui.navigation.services}</div>
              {service.status === "emerging" ? <span className={`emergingNotice ${styles.statusBadge}`}>{copy.emergingLabel}</span> : null}
              <h1>{title}</h1>
              <p className={styles.detailSummary}>{summary}</p>
            </div>
            <div className={styles.serviceBrief}>
              <span className={styles.asideMark} aria-hidden="true" />
              <h2>{copy.serviceWorkingTogether}</h2>
              <p>{copy.serviceWorkingTogetherBody}</p>
              <Link prefetch={false} className={styles.inlineLink} href={localizedPath(locale, "contact")}>{copy.startProject}<span aria-hidden="true">↗</span></Link>
            </div>
          </div>
          {service.status === "emerging" ? <p className={styles.conceptNotice}>{copy.emergingNotice}</p> : null}
          <div className={`detailHeroMedia ${styles.heroMedia}`}><MediaPlaceholder media={service.media} locale={locale} sizes="(max-width: 760px) 100vw, calc(100vw - 2.5rem)" priority /></div>
        </div>
      </section>
      <section className={`detailBody ${styles.detailBody}`} aria-label={title}>
        <div className={`pageWidth detailBodyGrid ${styles.detailGrid}`}>
          <aside className={styles.detailAside}>
            <nav className={styles.contentsNav} aria-label={copy.serviceContents}>
              <h2>{copy.serviceContents}</h2>
              <ol>{sections.map((section, sectionIndex) => <li key={section.id}><a href={`#${section.id}`}><span aria-hidden="true">{new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 }).format(sectionIndex + 1)}</span>{section.title}</a></li>)}</ol>
            </nav>
            <Link prefetch={false} href={localizedPath(locale, "services")} className={styles.inlineLink}>{copy.backToServices}<span aria-hidden="true">↗</span></Link>
          </aside>
          <div className={styles.caseContent}>
            <section id="overview" className={styles.caseSection}><h2>{copy.serviceOverview}</h2><p>{getText(service.detail, locale)}</p></section>
            {service.capabilities.length ? <section id="capabilities" className={styles.caseSection}><h2>{copy.capabilities}</h2><ul className={`serviceDetailCapabilities ${styles.capabilityGrid}`}>{service.capabilities.map((capability, capabilityIndex) => <li className={`capabilityCard ${styles.capability}`} key={`${service.slug}-capability-${capabilityIndex}`}><span aria-hidden="true">{new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 }).format(capabilityIndex + 1)}</span>{getText(capability, locale)}</li>)}</ul></section> : null}
            {deliverables.length ? <section id="deliverables" className={styles.caseSection}><h2>{copy.deliverables}</h2><ul className={styles.deliverableList}>{deliverables.map((deliverable, deliverableIndex) => <li key={`${service.slug}-deliverable-${deliverableIndex}`}><span aria-hidden="true">↗</span>{getText(deliverable, locale)}</li>)}</ul></section> : null}
            {process.length ? <section id="process" className={styles.caseSection}><h2>{copy.process}</h2><ol className={styles.processList}>{process.map((step, stepIndex) => <li key={`${service.slug}-step-${stepIndex}`}><span className={styles.processNumber} aria-hidden="true">{new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 }).format(stepIndex + 1)}</span><div><h3>{getText(step.title, locale)}</h3><p>{getText(step.body, locale)}</p></div></li>)}</ol></section> : null}
            {faq.length ? <section id="faq" className={styles.caseSection}><h2>{copy.faq}</h2><div className={styles.faqList}>{faq.map((entry, faqIndex) => <details key={`${service.slug}-faq-${faqIndex}`}><summary>{getText(entry.question, locale)}<span aria-hidden="true">+</span></summary><p>{getText(entry.answer, locale)}</p></details>)}</div></section> : null}
          </div>
        </div>
      </section>
      {related.length ? <section className={`relatedSection ${styles.relatedSection}`} aria-labelledby="related-title"><div className="pageWidth"><div className={styles.sectionHeading}><h2 id="related-title">{copy.relatedProjects}</h2><p>{copy.serviceRelatedProjectsBody}</p></div><div className={styles.relatedGrid}>{related.map((project) => <ProjectCard key={project.slug} project={project} locale={locale} variant="archive" labels={copy} />)}</div></div></section> : null}
      {relatedServices.length ? <section className={styles.otherServices} aria-labelledby="other-services-title"><div className="pageWidth"><h2 id="other-services-title">{copy.relatedServices}</h2><div>{relatedServices.map((entry) => <Link prefetch={false} key={entry.slug} href={localizedPath(locale, `services/${entry.slug}`)}><span>{entry.number}</span><strong>{getText(entry.title, locale)}</strong><span aria-hidden="true">↗</span></Link>)}</div></div></section> : null}
      <PageCta locale={locale} title={copy.serviceCtaTitle} body={copy.serviceCtaBody} primaryLabel={copy.startProject} secondaryLabel={copy.viewProjects} secondaryHref={localizedPath(locale, "projects")} />
    </div>
  );
}
