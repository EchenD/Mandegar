import type { Metadata } from "next";
import Image from "next/image";
import { Breadcrumbs } from "@/components/editorial/Breadcrumbs";
import { PageCta } from "@/components/editorial/PageCta";
import { PageIntro } from "@/components/editorial/PageIntro";
import { PartnerMark } from "@/components/editorial/PartnerMark";
import styles from "@/components/editorial/PartnersPage.module.css";
import journeyContent from "@/content/journey.json";
import { getText } from "@/lib/content";
import { getEditorialPage, getPageCopy, getTrustContent } from "@/lib/content-source";
import { localizedPath, type Locale } from "@/lib/i18n";
import { buildMetadata, pageSeo } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const editorial = await getEditorialPage(locale, "partners");
  const [fallbackTitle, fallbackDescription] = pageSeo[locale].partners;
  const title = editorial?.seo ? getText(editorial.seo.title, locale) || fallbackTitle : fallbackTitle;
  const description = editorial?.seo ? getText(editorial.seo.description, locale) || fallbackDescription : fallbackDescription;
  return buildMetadata({ locale, title, description, path: "partners" });
}

export default async function PartnersPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const [editorial, trust] = await Promise.all([getEditorialPage(locale, "partners"), getTrustContent(locale)]);
  const copy = getPageCopy(locale);
  const journey = journeyContent.copy[locale];
  const [fallbackTitle, fallbackIntro] = pageSeo[locale].partners;
  const title = editorial ? getText(editorial.title, locale) : fallbackTitle;
  const network = editorial?.sections.find((section) => section.key === "network");
  const hasPartners = trust.clients.length > 0;
  const partners: Array<{ name: string; logo?: string; url?: string }> = hasPartners
    ? trust.clients
    : journey.disciplines.map((name) => ({ name }));

  return (
    <div className={styles.page} data-partners-page>
      <PageIntro
        locale={locale}
        number="04"
        eyebrow={editorial ? getText(editorial.heroKicker, locale) : journey.partnersLabel}
        title={title}
        intro={editorial ? getText(editorial.intro, locale) : fallbackIntro}
        aside={(
          <div className={styles.network}>
            <svg viewBox="0 0 120 120" fill="none" aria-hidden="true" focusable="false">
              <circle cx="60" cy="60" r="43" stroke="currentColor" strokeOpacity=".3" />
              <path d="m30 30 60 60M90 30 30 90" stroke="currentColor" strokeOpacity=".3" />
              <circle cx="30" cy="30" r="7" fill="var(--paper)" stroke="currentColor" />
              <circle cx="90" cy="30" r="7" fill="var(--paper)" stroke="currentColor" />
              <circle cx="30" cy="90" r="7" fill="var(--paper)" stroke="currentColor" />
              <circle cx="90" cy="90" r="7" fill="var(--paper)" stroke="currentColor" />
              <circle cx="60" cy="60" r="9" fill="currentColor" />
            </svg>
            <p>{network?.kicker ? getText(network.kicker, locale) : journey.partners}</p>
          </div>
        )}
      >
        <Breadcrumbs locale={locale} items={[{ label: journey.partnersLabel }]} />
      </PageIntro>

      <section className={styles.archive} aria-labelledby="partners-list-title">
        <div className="pageWidth">
          <div className={styles.sectionHeader}>
            <h2 id="partners-list-title">{network?.title ? getText(network.title, locale) : journey.partnersLabel}</h2>
            {!hasPartners ? <p className={styles.notice} data-partners-placeholder>{copy.partnersPlaceholderNote}</p> : network?.body ? <p className={styles.notice}>{getText(network.body, locale)}</p> : null}
          </div>
          <div className={styles.grid} data-partners-list>
            {partners.map((partner, index) => {
              const { logo, url } = partner;
              return (
                <article className={styles.card} key={`${partner.name}-${index}`} data-partner-profile>
                  <div className={styles.mark}>
                    {logo ? (
                      <Image src={logo} alt="" width={360} height={160} sizes="(max-width: 340px) 90vw, (max-width: 760px) 45vw, (max-width: 1000px) 30vw, 23vw" />
                    ) : hasPartners ? (
                      <span className={styles.monogram} aria-hidden="true">{Array.from(partner.name).slice(0, 2).join("")}</span>
                    ) : <PartnerMark index={index} />}
                  </div>
                  <div className={styles.cardCopy}>
                    <h3>{partner.name}</h3>
                    {!hasPartners ? <p>{journey.placeholder}</p> : null}
                    {url ? <a className={styles.website} href={url} aria-label={`${copy.partnersWebsiteLabel}: ${partner.name}`}>{copy.partnersWebsiteLabel}<span aria-hidden="true">{locale === "en" ? "↗" : "↖"}</span></a> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <PageCta
        locale={locale}
        title={copy.partnersCtaTitle}
        body={copy.partnersCtaBody}
        secondaryLabel={copy.viewProjects}
        secondaryHref={localizedPath(locale, "projects")}
      />
    </div>
  );
}
