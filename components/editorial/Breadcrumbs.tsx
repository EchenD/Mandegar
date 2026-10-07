import Link from "next/link";
import { getPageCopy } from "@/lib/content-source";
import { localizedPath, type Locale } from "@/lib/i18n";
import styles from "./PageLayout.module.css";

export function Breadcrumbs({ locale, items }: { locale: Locale; items: Array<{ label: string; href?: string }> }) {
  const copy = getPageCopy(locale);
  const crumbs = [{ label: copy.home, href: localizedPath(locale) }, ...items];
  return (
    <nav className={styles.breadcrumbs} aria-label={copy.breadcrumbs}>
      <ol>{crumbs.map((item, index) => <li key={`${item.label}-${index}`}>
        {index > 0 ? <span className={styles.separator} aria-hidden="true">/</span> : null}
        {item.href && index !== crumbs.length - 1 ? <Link prefetch={false} href={item.href}>{item.label}</Link> : <span aria-current={index === crumbs.length - 1 ? "page" : undefined}>{item.label}</span>}
      </li>)}</ol>
    </nav>
  );
}
