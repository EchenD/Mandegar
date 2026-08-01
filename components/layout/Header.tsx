"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getText } from "@/lib/content";
import type { SiteSettings } from "@/lib/content-source";
import { getUi, locales, localizedPath, type Locale } from "@/lib/i18n";
import styles from "./Header.module.css";

type HeaderProps = { locale: Locale; settings?: SiteSettings };

export function Header({ locale, settings }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const navigation = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const copy = getUi(locale);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    navigation.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      menuButton.current?.focus();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const defaultLinks = [
    { href: localizedPath(locale, "projects"), label: copy.navigation.projects },
    { href: localizedPath(locale, "services"), label: copy.navigation.services },
    { href: localizedPath(locale, "about"), label: copy.navigation.about },
    { href: localizedPath(locale, "contact"), label: copy.navigation.contact },
  ];
  const links = settings?.navigation.length ? settings.navigation.map((item) => ({ href: cmsPath(locale, item.path), label: getText(item.label, locale) })).filter((item) => item.label) : defaultLinks;

  return (
    <header className={styles.header}>
      <Link className={styles.logo} href={localizedPath(locale)} aria-label={locale === "fa" ? "خانه مندگار" : locale === "ar" ? "الصفحة الرئيسية لمندگار" : "Mandegar home"} onClick={() => setOpen(false)}>
        <span className={styles.logoMark} aria-hidden="true"><span /></span>
        <span className={styles.logoText}>{settings?.title || "MANDEGAR"}</span>
      </Link>

      <nav ref={navigation} id="primary-navigation" className={`${styles.nav} ${open ? styles.navOpen : ""}`} aria-label={locale === "fa" ? "پیمایش اصلی" : locale === "ar" ? "التنقل الرئيسي" : "Primary navigation"}>
        {links.map((link) => (
          <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</Link>
        ))}
        <div className={styles.mobileLanguage} aria-label="Language switcher">
          <LanguageLink locale={locale} target="fa" pathname={pathname} />
          <LanguageLink locale={locale} target="en" pathname={pathname} />
          <LanguageLink locale={locale} target="ar" pathname={pathname} />
        </div>
      </nav>

      <div className={styles.actions}>
        <div className={styles.desktopLanguage} aria-label="Language switcher">
          <LanguageLink locale={locale} target="fa" pathname={pathname} />
          <LanguageLink locale={locale} target="en" pathname={pathname} />
          <LanguageLink locale={locale} target="ar" pathname={pathname} />
        </div>
        <Link className="button buttonSmall" href={localizedPath(locale, "contact")} data-analytics="cta_start_project" onClick={() => setOpen(false)}>{copy.start}</Link>
        <button ref={menuButton} className={styles.menuButton} type="button" aria-expanded={open} aria-controls="primary-navigation" onClick={() => setOpen(!open)}>
          <span className="srOnly">{open ? copy.close : copy.menu}</span>
          <i /><i />
        </button>
      </div>
    </header>
  );
}

function cmsPath(locale: Locale, path: string) {
  const cleanPath = path.replace(/^\/+/, "").replace(/^(fa|en|ar)(\/|$)/, "");
  return localizedPath(locale, cleanPath);
}

function LanguageLink({ locale, target, pathname }: { locale: Locale; target: Locale; pathname: string }) {
  const segments = pathname.split("/");
  const href = locales.includes(segments[1] as Locale) ? ["", target, ...segments.slice(2)].join("/") : localizedPath(target);
  return (
    <Link className={locale === target ? styles.activeLanguage : ""} href={href} hrefLang={target} lang={target} data-analytics="language_select" data-analytics-label={target} aria-current={locale === target ? "page" : undefined}>
      {target === "fa" ? "فا" : target === "en" ? "EN" : "AR"}
    </Link>
  );
}
