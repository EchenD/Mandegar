import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/editorial/Breadcrumbs";
import { PageCta } from "@/components/editorial/PageCta";
import { PageIntro } from "@/components/editorial/PageIntro";
import styles from "@/components/editorial/CompanyPages.module.css";
import { getText } from "@/lib/content";
import { getLegalPage, getPageCopy } from "@/lib/content-source";
import { localizedPath, type Locale } from "@/lib/i18n";
import { buildMetadata, pageSeo } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const legal = await getLegalPage(locale);
  const [title, description] = pageSeo[locale].legal;
  return {
    ...buildMetadata({ locale, title, description, path: "legal" }),
    ...(legal?.status !== "approved" ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function LegalPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const legal = await getLegalPage(locale);
  const copy = getPageCopy(locale);
  const [fallbackTitle, fallbackIntro] = pageSeo[locale].legal;
  const title = legal ? getText(legal.title, locale) : fallbackTitle;
  const intro = legal ? getText(legal.intro, locale) : fallbackIntro;
  const sections = legal?.sections.map((section) => ({ heading: getText(section.heading, locale), body: getText(section.body, locale) })) || [];
  const isApproved = legal?.status === "approved";
  const updatedDate = legal?.updatedAt && !Number.isNaN(Date.parse(legal.updatedAt)) ? new Date(legal.updatedAt) : null;

  return (
    <div className={`legalPage ${styles.page}`}>
      <PageIntro
        locale={locale}
        eyebrow={copy.legalKicker}
        title={title}
        intro={intro}
        aside={(
          <div className={styles.legalSummary}>
            <span className={styles.legalStatus}><span className={styles.statusDot} aria-hidden="true" />{isApproved ? copy.legalApprovedLabel : copy.legalDraftLabel}</span>
            {updatedDate ? (
              <div className={styles.updatedDate}>
                <span>{copy.legalUpdated}</span>
                <time dateTime={legal?.updatedAt}>{new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : locale === "ar" ? "ar" : "en", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(updatedDate)}</time>
              </div>
            ) : null}
            {!isApproved ? <p className={`legalNotice ${styles.draftNotice}`}>{copy.legalDraftNotice}</p> : null}
          </div>
        )}
      >
        <Breadcrumbs locale={locale} items={[{ label: copy.legalKicker }]} />
      </PageIntro>

      <section className={`detailBody ${styles.legalBody}`}>
        <div className={`pageWidth ${styles.legalLayout}`}>
          <nav className={styles.contentsNav} aria-label={copy.legalContents}>
            <h2>{copy.legalContents}</h2>
            <ol>
              {sections.map((section, index) => (
                <li key={`${section.heading}-${index}`}><a href={`#legal-${index}`}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span>{section.heading}</span></a></li>
              ))}
            </ol>
          </nav>
          <div className={`legalContent ${styles.legalContent}`}>
            {sections.map((section, index) => (
              <section key={`${section.heading}-${index}`} aria-labelledby={`legal-${index}`}>
                <span className={styles.legalSectionIndex} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <h2 id={`legal-${index}`}>{section.heading}</h2>
                {section.body.split(/\n\s*\n/).map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
              </section>
            ))}
          </div>
        </div>
      </section>

      <PageCta locale={locale} title={copy.legalQuestionTitle} body={copy.legalQuestionBody} primaryLabel={copy.legalQuestionLink} primaryHref={localizedPath(locale, "contact")} />
    </div>
  );
}
