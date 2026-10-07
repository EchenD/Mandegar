import Link from "next/link";
import type { Service } from "@/lib/content";
import { getText } from "@/lib/localized-text";
import { localizedPath, type Locale } from "@/lib/i18n";
import { MediaPlaceholder } from "@/components/media/MediaPlaceholder";
import styles from "./Portfolio.module.css";

export function ServiceCard({ service, locale, variant = "default", priority = false, viewLabel, emergingLabel }: {
  service: Service;
  locale: Locale;
  variant?: "default" | "archive";
  priority?: boolean;
  viewLabel?: string;
  emergingLabel?: string;
}) {
  const preview = service.media.kind === "video" ? { ...service.media, kind: "image" as const, src: service.media.poster || service.media.src, mobileSrc: undefined } : service.media;
  if (variant === "archive") {
    return (
      <article className={styles.serviceTile}>
        <Link prefetch={false} href={localizedPath(locale, `services/${service.slug}`)} className={`serviceCard ${styles.serviceLink}`} data-analytics="service_view" data-analytics-label={service.slug}>
          <div className={styles.serviceTileMedia}><MediaPlaceholder media={preview} locale={locale} priority={priority} /></div>
          <div className={`serviceCardCopy ${styles.serviceCopy}`}>
            <div className={styles.serviceTopline}><span className="serviceNumber">{service.number}</span>{service.status === "emerging" ? <span className={styles.statusBadge}>{emergingLabel}</span> : null}</div>
            <h2>{getText(service.title, locale)}</h2>
            <p>{getText(service.summary, locale)}</p>
            <span className={styles.cardAction}>{viewLabel}<span aria-hidden="true">↗</span></span>
          </div>
        </Link>
      </article>
    );
  }
  return (
    <Link prefetch={false} href={localizedPath(locale, `services/${service.slug}`)} className="serviceCard">
      <div className="serviceNumber">{service.number}</div>
      <div className="serviceCardCopy">
        <h3>{getText(service.title, locale)}</h3>
        <p>{getText(service.summary, locale)}</p>
      </div>
      <span className="serviceArrow" aria-hidden="true">↗</span>
    </Link>
  );
}
