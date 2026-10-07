import Link from "next/link";
import { getPageCopy } from "@/lib/content-source";
import { localizedPath, type Locale } from "@/lib/i18n";
import styles from "./PageLayout.module.css";

type Props = {
  locale: Locale;
  title: string;
  body: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
};

export function PageCta({ locale, title, body, primaryLabel, primaryHref, secondaryLabel, secondaryHref }: Props) {
  const copy = getPageCopy(locale);
  return (
    <section className={styles.cta} aria-label={title}>
      <div className={`pageWidth ${styles.ctaGrid}`}>
        <div><span className={styles.eyebrow}><span className={styles.dot} aria-hidden="true" />{copy.startProject}</span><h2>{title}</h2></div>
        <div className={styles.ctaContent}><p>{body}</p><div className={styles.actions}>
          <Link prefetch={false} className={styles.primary} href={primaryHref || localizedPath(locale, "contact")}>{primaryLabel || copy.startProject}<span aria-hidden="true">↗</span></Link>
          {secondaryLabel && secondaryHref ? <Link prefetch={false} className={styles.secondary} href={secondaryHref}>{secondaryLabel}<span aria-hidden="true">↗</span></Link> : null}
        </div></div>
      </div>
    </section>
  );
}
