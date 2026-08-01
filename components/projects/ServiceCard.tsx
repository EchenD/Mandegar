import Link from "next/link";
import { getText, type Service } from "@/lib/content";
import { localizedPath, type Locale } from "@/lib/i18n";

export function ServiceCard({ service, locale }: { service: Service; locale: Locale }) {
  return (
    <Link href={localizedPath(locale, `services/${service.slug}`)} className="serviceCard">
      <div className="serviceNumber">{service.number}</div>
      <div className="serviceCardCopy">
        <h3>{getText(service.title, locale)}</h3>
        <p>{getText(service.summary, locale)}</p>
      </div>
      <span className="serviceArrow" aria-hidden="true">↗</span>
    </Link>
  );
}
