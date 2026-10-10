import Link from "next/link";
import Image from "next/image";
import { getText } from "@/lib/localized-text";
import { getContactChannels, getPageCopy, type SiteSettings } from "@/lib/content-source";
import { getUi, localizedPath, type Locale } from "@/lib/i18n";
import { getHomeSection } from "@/lib/home-navigation";
import styles from "./Footer.module.css";
import { HomeSectionLink } from "./HomeSectionLink";

export async function Footer({ locale, settings }: { locale: Locale; settings?: SiteSettings }) {
  const ui = getUi(locale);
  const copy = getPageCopy(locale);
  const channels = await getContactChannels();
  const contacts = channels.filter((channel) => !channel.isPlaceholder).flatMap((channel) => [
    ...(channel.email ? [{ label: channel.email, href: `mailto:${channel.email}` }] : []),
    ...(channel.phone ? [{ label: channel.phone, href: `tel:${channel.phone.replace(/[^+\d]/g, "")}` }] : []),
    ...(channel.whatsapp ? [{ label: copy.contactWhatsapp, href: channel.whatsapp.startsWith("https://") ? channel.whatsapp : `https://wa.me/${channel.whatsapp.replace(/\D/g, "")}` }] : []),
  ]).filter((item, index, items) => items.findIndex((candidate) => candidate.href === item.href) === index);
  const navigation = settings?.navigation.length ? settings.navigation.map((item) => ({ href: navigationPath(locale, item.path), label: getText(item.label, locale) })).filter((item) => item.label) : [
    { href: localizedPath(locale, "projects"), label: ui.navigation.projects },
    { href: localizedPath(locale, "services"), label: ui.navigation.services },
    { href: localizedPath(locale, "about"), label: ui.navigation.about },
    { href: localizedPath(locale, "partners"), label: ui.navigation.partners },
    { href: localizedPath(locale, "contact"), label: ui.navigation.contact },
  ];
  const brand = settings?.title || "MANDEGAR";
  return (
    <footer className={`footer ${styles.footer}`}>
      <div className={`pageWidth ${styles.inner}`}>
        <div className={`footerTop ${styles.top}`}>
          <div className={styles.brandColumn}>
            <Link prefetch={false} className={`footerBrand ${styles.brand}`} href={localizedPath(locale)}>{settings?.brandMark ? <Image src={settings.brandMark} alt="" width={32} height={32} className={styles.logoImage} /> : <span className={styles.brandMark} aria-hidden="true"><i /></span>}{brand}</Link>
            <p className={`footerLine ${styles.line}`}>{settings?.footerLine ? getText(settings.footerLine, locale) : ui.footer}</p>
            {settings?.globalLine ? <p className={styles.geography}>{getText(settings.globalLine, locale)}</p> : null}
            <Link prefetch={false} className={styles.projectLink} href={localizedPath(locale, "contact")}>{copy.startProject}<span aria-hidden="true">↗</span></Link>
          </div>
          <nav className={`footerLinks ${styles.links}`} aria-label={copy.footerNavigation}>
            <span className={styles.label}>{copy.footerNavigation}</span>
            {navigation.map((item) => <HomeSectionLink key={item.href} locale={locale} href={item.href}>{item.label}</HomeSectionLink>)}
          </nav>
          <div className={`footerMeta ${styles.contact}`}>
            <span className={styles.label}>{copy.footerContact}</span>
            {contacts.length ? contacts.map((item) => <a key={item.href} href={item.href} dir={item.href.startsWith("tel:") || item.href.startsWith("mailto:") ? "ltr" : undefined}>{item.label}</a>) : <p className={styles.placeholder}>{copy.footerPlaceholder}</p>}
            {settings?.address && getText(settings.address, locale) ? <address>{getText(settings.address, locale)}</address> : null}
            {settings?.socialLinks.length ? <div className={styles.social}>{settings.socialLinks.map((item) => <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer">{item.label}<span aria-hidden="true">↗</span></a>)}</div> : null}
          </div>
        </div>
        <div className={`footerBottom ${styles.bottom}`}>
          <span dir="ltr">© {new Date().getFullYear()} {settings?.copyrightHolder || "Mandegar"}</span>
          <Link prefetch={false} href={localizedPath(locale, "legal")}>{copy.privacy}</Link>
          <span>{copy.footerConceptNote}</span>
        </div>
      </div>
    </footer>
  );
}

function navigationPath(locale: Locale, path: string) {
  const cleanPath = path.replace(/^\/+/, "").replace(/^(fa|en|ar)(\/|$)/, "");
  const section = cleanPath.startsWith("#") ? getHomeSection(cleanPath) : null;
  if (section) return localizedPath(locale, section === "showcase" ? "projects" : section);
  return localizedPath(locale, cleanPath);
}
