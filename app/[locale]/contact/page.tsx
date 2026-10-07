import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/editorial/Breadcrumbs";
import { CopyBrief } from "@/components/editorial/CopyBrief";
import { PageIntro } from "@/components/editorial/PageIntro";
import styles from "@/components/editorial/CompanyPages.module.css";
import { getText } from "@/lib/content";
import { getContactChannels, getEditorialPage, getPageCopy, type ContactChannel } from "@/lib/content-source";
import { localizedPath, type Locale } from "@/lib/i18n";
import { buildMetadata, pageSeo } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const editorial = await getEditorialPage(locale, "contact");
  const [fallbackTitle, fallbackDescription] = pageSeo[locale].contact;
  const title = editorial?.seo ? getText(editorial.seo.title, locale) || fallbackTitle : fallbackTitle;
  const description = editorial?.seo ? getText(editorial.seo.description, locale) || fallbackDescription : fallbackDescription;
  return buildMetadata({ locale, title, description, path: "contact" });
}

export default async function ContactPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const [channels, editorial] = await Promise.all([getContactChannels(), getEditorialPage(locale, "contact")]);
  const copy = getPageCopy(locale);
  const [fallbackTitle, fallbackIntro] = pageSeo[locale].contact;
  const purposes: Array<{ purpose: ContactChannel["purpose"]; title: string; body: string }> = [
    { purpose: "sales", title: copy.contactSalesTitle, body: copy.contactSalesBody },
    { purpose: "general", title: copy.contactGeneralTitle, body: copy.contactGeneralBody },
    { purpose: "international", title: copy.contactInternationalTitle, body: copy.contactInternationalBody },
    { purpose: "whatsapp", title: copy.contactWhatsappTitle, body: copy.contactWhatsappBody },
  ];
  const heroTitle = editorial ? getText(editorial.title, locale) : fallbackTitle;
  const briefTemplate = `${copy.briefTitle}\n\n${copy.briefFields.map((field) => `${field}: `).join("\n\n")}`;

  return (
    <div className={`contactPage ${styles.page}`}>
      <PageIntro
        locale={locale}
        eyebrow={editorial ? getText(editorial.heroKicker, locale) : heroTitle}
        title={heroTitle}
        intro={editorial ? getText(editorial.intro, locale) : fallbackIntro}
        aside={(
          <a className={styles.briefPreview} href="#project-brief">
            <span className={styles.previewIndex} aria-hidden="true">{String(copy.briefFields.length).padStart(2, "0")}</span>
            <h2>{copy.briefTitle}</h2>
            <p>{copy.briefBody}</p>
            <span className={styles.previewArrow} aria-hidden="true">↙</span>
          </a>
        )}
      >
        <Breadcrumbs locale={locale} items={[{ label: editorial ? getText(editorial.heroKicker, locale) : heroTitle }]} />
      </PageIntro>

      <section className={`sectionPad ${styles.section}`} aria-labelledby="channels-title">
        <div className="pageWidth">
          <div className={styles.wideHeader}>
            <div className={styles.sectionHeader}>
              <div className="sectionKicker">02 / {copy.contactChannelsKicker}</div>
              <h2 id="channels-title">{copy.contactChannelsTitle}</h2>
            </div>
            <p className={styles.lead}>{copy.contactChannelsBody}</p>
          </div>
          <div className={`contactGrid ${styles.contactGrid}`}>
            {purposes.map((item, index) => {
              const matches = channels.filter((channel) => channel.purpose === item.purpose);
              return (
                <ContactCard
                  key={item.purpose}
                  locale={locale}
                  index={index + 1}
                  title={item.title}
                  body={item.body}
                  channels={matches}
                  copy={copy}
                />
              );
            })}
          </div>
        </div>
      </section>

      <section id="project-brief" className={`sectionPad ${styles.briefSection}`} aria-labelledby="brief-title">
        <div className={`pageWidth ${styles.split}`}>
          <div className={styles.sectionHeader}>
            <div className="sectionKicker">03 / {copy.briefKicker}</div>
            <h2 id="brief-title">{copy.briefTitle}</h2>
            <p className={styles.lead}>{copy.briefBody}</p>
            <CopyBrief
              template={briefTemplate}
              labels={{ copy: copy.copyBrief, copied: copy.copiedBrief, fallback: copy.copyBriefFallback, failed: copy.copyBriefFailed }}
            />
            <p className={styles.privacyNote}>{copy.briefPrivacyNote}</p>
          </div>
          <ol className={styles.briefFields}>
            {copy.briefFields.map((field, index) => <li key={field}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><h3>{field}</h3></li>)}
          </ol>
        </div>
      </section>

      <div className={`pageWidth ${styles.contactExplore}`}>
        <Link prefetch={false} className={styles.secondaryLink} href={localizedPath(locale, "services")}>{copy.viewServices}<span aria-hidden="true">↗</span></Link>
        <Link prefetch={false} className={styles.secondaryLink} href={localizedPath(locale, "projects")}>{copy.viewProjects}<span aria-hidden="true">↗</span></Link>
      </div>
    </div>
  );
}

function ContactCard({ locale, index, title, body, channels, copy }: {
  locale: Locale;
  index: number;
  title: string;
  body: string;
  channels: ContactChannel[];
  copy: ReturnType<typeof getPageCopy>;
}) {
  const details = channels.filter((channel) => !channel.isPlaceholder).flatMap((channel, channelIndex) => {
    const email = channel.email && isEmail(channel.email) ? channel.email : null;
    const phone = channel.phone && isPhone(channel.phone) ? channel.phone : null;
    const whatsapp = channel.whatsapp ? whatsappUrl(channel.whatsapp) : null;
    const availability = channel.availabilityText ? getText(channel.availabilityText, locale) : channel.availability;
    if (!email && !phone && !whatsapp) return [];
    return [
      <div className={styles.channelGroup} key={`${channel.purpose}-${channelIndex}`}>
        {channels.length > 1 ? <strong>{getText(channel.label, locale)}</strong> : null}
        {availability ? <p>{availability}</p> : null}
        <div className={`contactDetails ${styles.contactDetails}`}>
          {email ? <a href={`mailto:${email}`} data-analytics="email_click" data-analytics-label={channel.purpose}><span>{copy.contactEmail}</span><bdi>{email}</bdi><span aria-hidden="true">↗</span></a> : null}
          {phone ? <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} data-analytics="phone_click" data-analytics-label={channel.purpose}><span>{copy.contactPhone}</span><bdi>{phone}</bdi><span aria-hidden="true">↗</span></a> : null}
          {whatsapp ? <a href={whatsapp} target="_blank" rel="noopener noreferrer" data-analytics="whatsapp_click" data-analytics-label={channel.purpose}><span>{copy.contactWhatsapp}</span><span aria-hidden="true">↗</span></a> : null}
        </div>
      </div>,
    ];
  });
  const channelDescription = channels.find((channel) => channel.description)?.description;

  return (
    <article className={`contactCard ${styles.contactCard}`}>
      <span className={styles.cardIndex} aria-hidden="true">{String(index).padStart(2, "0")}</span>
      <h3>{title}</h3>
      <p>{channelDescription ? getText(channelDescription, locale) : body}</p>
      {details.length > 0 ? details : (
        <div className={`contactPlaceholder ${styles.contactPlaceholder}`}>
          <span className={styles.statusDot} aria-hidden="true" />
          <div><strong>{copy.contactPlaceholderTitle}</strong><p>{copy.contactPlaceholderBody}</p></div>
        </div>
      )}
    </article>
  );
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    && !/@(?:[^@]*\.)?(?:example|invalid|test|localhost)(?:\.[a-z]+)?$/i.test(value)
    && !/placeholder/i.test(value);
}

function isPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return /^\+?[\d\s().-]+$/.test(value) && digits.length >= 7 && digits.length <= 15 && !/^(\d)\1+$/.test(digits);
}

function whatsappUrl(value: string) {
  if (/^https:\/\/(?:wa\.me|(?:api\.|www\.)?whatsapp\.com)\//i.test(value)) return value;
  return isPhone(value) ? `https://wa.me/${value.replace(/\D/g, "")}` : null;
}
