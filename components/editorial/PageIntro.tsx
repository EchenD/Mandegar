import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import styles from "./PageLayout.module.css";

type Props = {
  locale: Locale;
  eyebrow: string;
  title: string;
  intro: string;
  number?: string;
  aside?: ReactNode;
  children?: ReactNode;
};

export function PageIntro({ locale, eyebrow, title, intro, number = "01", aside, children }: Props) {
  return (
    <section className={`pageHero ${styles.intro}`} data-editorial-intro lang={locale}>
      <div className={`pageWidth ${styles.introInner}`}>
        <div className={styles.eyebrow}><span className={styles.dot} aria-hidden="true" />{eyebrow}<span className={styles.index} dir="ltr" aria-hidden="true">/{number}</span></div>
        <div className={styles.introGrid}>
          <div className={styles.titleColumn}><h1>{title}</h1>{children}</div>
          <div className={styles.summaryColumn}><p className={styles.introText}>{intro}</p>{aside ? <div className={styles.aside}>{aside}</div> : null}</div>
        </div>
        <div className={styles.rule} aria-hidden="true"><span /><i /></div>
      </div>
    </section>
  );
}
