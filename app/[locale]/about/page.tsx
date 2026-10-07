import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/editorial/Breadcrumbs";
import { PageCta } from "@/components/editorial/PageCta";
import { PageIntro } from "@/components/editorial/PageIntro";
import { MediaPlaceholder } from "@/components/media/MediaPlaceholder";
import styles from "@/components/editorial/CompanyPages.module.css";
import { getText, media } from "@/lib/content";
import { getEditorialPage, getPageCopy, getTeamPartners } from "@/lib/content-source";
import { localizedPath, type Locale } from "@/lib/i18n";
import { buildMetadata, pageSeo } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const editorial = await getEditorialPage(locale, "about");
  const [fallbackTitle, fallbackDescription] = pageSeo[locale].about;
  const title = editorial?.seo ? getText(editorial.seo.title, locale) || fallbackTitle : fallbackTitle;
  const description = editorial?.seo ? getText(editorial.seo.description, locale) || fallbackDescription : fallbackDescription;
  return buildMetadata({ locale, title, description, path: "about" });
}

export default async function AboutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const [editorial, people] = await Promise.all([getEditorialPage(locale, "about"), getTeamPartners()]);
  const copy = getPageCopy(locale);
  const [fallbackTitle, fallbackIntro] = pageSeo[locale].about;
  const approach = editorial?.sections.find((section) => section.key === "approach");
  const geography = editorial?.sections.find((section) => section.key === "geography");
  const principles = approach?.items.map((item) => getText(item, locale)).filter(Boolean) || [];
  const heroTitle = editorial ? getText(editorial.title, locale) : fallbackTitle;

  return (
    <div className={`aboutPage ${styles.page}`}>
      <PageIntro
        locale={locale}
        eyebrow={editorial ? getText(editorial.heroKicker, locale) : heroTitle}
        title={heroTitle}
        intro={editorial ? getText(editorial.intro, locale) : fallbackIntro}
        aside={(
          <div className={styles.identityPanel}>
            <div className={styles.identityDiagram} aria-hidden="true">
              <span className={styles.diagramOrbit} />
              <span className={styles.diagramOrbit} />
              <span className={styles.diagramOrbit} />
              <span className={styles.diagramCenter} />
              <span className={styles.diagramNode} />
              <span className={styles.diagramNode} />
              <span className={styles.diagramNode} />
              <span className={styles.diagramNode} />
            </div>
            <p>{approach?.title ? getText(approach.title, locale) : copy.aboutWorkflowTitle}</p>
            {principles.length > 0 ? <span>{principles[0]}</span> : null}
          </div>
        )}
      >
        <Breadcrumbs locale={locale} items={[{ label: editorial ? getText(editorial.heroKicker, locale) : heroTitle }]} />
        <div className={styles.heroLinks}>
          <Link prefetch={false} className={styles.primaryLink} href={localizedPath(locale, "services")}>{copy.viewServices}<span aria-hidden="true">↗</span></Link>
          <Link prefetch={false} className={styles.secondaryLink} href={localizedPath(locale, "projects")}>{copy.viewProjects}<span aria-hidden="true">↗</span></Link>
        </div>
      </PageIntro>

      {approach ? (
        <section className={`sectionPad ${styles.section}`} aria-labelledby="approach-title">
          <div className={`pageWidth aboutGrid ${styles.split}`}>
            <div className={styles.sectionHeader}>
              <div className="sectionKicker">02 / {approach.kicker ? getText(approach.kicker, locale) : null}</div>
              <h2 id="approach-title">{approach.title ? getText(approach.title, locale) : null}</h2>
            </div>
            <div>
              {approach.body ? <p className={styles.lead}>{getText(approach.body, locale)}</p> : null}
              <ol className={`principles ${styles.principles}`}>
                {principles.map((principle, index) => (
                  <li className={`principle ${styles.principle}`} key={principle}>
                    <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                    <h3>{principle}</h3>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      ) : null}

      <section className={`sectionPad ${styles.workflowSection}`} aria-labelledby="workflow-title">
        <div className="pageWidth">
          <div className={styles.wideHeader}>
            <div className={styles.sectionHeader}>
              <div className="sectionKicker">03 / {copy.aboutWorkflowKicker}</div>
              <h2 id="workflow-title">{copy.aboutWorkflowTitle}</h2>
            </div>
            <p className={styles.lead}>{copy.aboutWorkflowBody}</p>
          </div>
          <ol className={styles.workflow}>
            {copy.aboutWorkflowSteps.map((step, index) => (
              <li key={step.title}>
                <span className={styles.stepIndex} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {geography ? (
        <section className={`sectionPad ${styles.section}`} aria-labelledby="geography-title">
          <div className={`pageWidth ${styles.split}`}>
            <div className={styles.sectionHeader}>
              <div className="sectionKicker">04 / {geography.kicker ? getText(geography.kicker, locale) : null}</div>
              <h2 id="geography-title">{geography.title ? getText(geography.title, locale) : null}</h2>
            </div>
            <div className={styles.collaborationPanel}>
              {geography.body ? <p className={styles.lead}>{getText(geography.body, locale)}</p> : null}
              <div className={styles.collaborationLine} aria-hidden="true"><span /><span /><span /><span /></div>
            </div>
          </div>
        </section>
      ) : null}

      <section className={`sectionPad ${styles.teamSection}`} aria-labelledby="team-title">
        <div className="pageWidth">
          <div className={styles.wideHeader}>
            <div className={styles.sectionHeader}>
              <div className="sectionKicker">05 / {copy.aboutTeamKicker}</div>
              <h2 id="team-title">{copy.aboutTeamTitle}</h2>
            </div>
            <p className={styles.lead}>{copy.aboutTeamBody}</p>
          </div>
          {people.length > 0 ? (
            <div className={`teamGrid ${styles.teamGrid}`}>
              {people.map((person) => (
                <article className={`teamCard ${styles.teamCard}`} key={`${person.name}-${person.partnerType}`}>
                  <h3>{person.name}</h3>
                  <strong>{getText(person.role, locale)}</strong>
                  <p>{getText(person.biography, locale)}</p>
                  {person.location ? <small>{person.location}</small> : null}
                </article>
              ))}
            </div>
          ) : (
            <>
              <div className={styles.disciplineGrid}>
                {copy.aboutTeamRoles.map((role) => (
                  <article className={styles.disciplineCard} key={role.title}>
                    <MediaPlaceholder
                      media={media[role.media as keyof typeof media]}
                      locale={locale}
                      className={styles.disciplineMedia}
                      sizes="(max-width: 760px) 100vw, 33vw"
                    />
                    <div className={styles.disciplineCopy}>
                      <h3>{role.title}</h3>
                      <p>{role.body}</p>
                    </div>
                  </article>
                ))}
              </div>
              <p className={styles.disciplineNote}>{copy.aboutTeamPlaceholderNote}</p>
            </>
          )}
        </div>
      </section>

      <PageCta locale={locale} title={copy.aboutCtaTitle} body={copy.aboutCtaBody} secondaryLabel={copy.viewServices} secondaryHref={localizedPath(locale, "services")} />
    </div>
  );
}
