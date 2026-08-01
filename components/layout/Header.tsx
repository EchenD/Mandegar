"use client";

import Link from "next/link";
import { useState } from "react";
import { getUi, localizedPath, type Locale } from "@/lib/i18n";
import styles from "./Header.module.css";

type HeaderProps = { locale: Locale };

export function Header({ locale }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const copy = getUi(locale);

  const links = [
    { href: localizedPath(locale, "projects"), label: copy.navigation.projects },
    { href: localizedPath(locale, "services"), label: copy.navigation.services },
    { href: localizedPath(locale, "about"), label: copy.navigation.about },
    { href: localizedPath(locale, "contact"), label: copy.navigation.contact },
  ];

  return (
    <header className={styles.header}>
      <Link className={styles.logo} href={localizedPath(locale)} aria-label="Mandegar home" onClick={() => setOpen(false)}>
        <span className={styles.logoMark} aria-hidden="true"><span /></span>
        <span className={styles.logoText}>MANDEGAR</span>
      </Link>

      <nav id="primary-navigation" className={`${styles.nav} ${open ? styles.navOpen : ""}`} aria-label="Primary navigation">
        {links.map((link) => (
          <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</Link>
        ))}
        <div className={styles.mobileLanguage} aria-label="Language switcher">
          <LanguageLink locale={locale} target="fa" />
          <LanguageLink locale={locale} target="en" />
          <LanguageLink locale={locale} target="ar" />
        </div>
      </nav>

      <div className={styles.actions}>
        <div className={styles.desktopLanguage} aria-label="Language switcher">
          <LanguageLink locale={locale} target="fa" />
          <LanguageLink locale={locale} target="en" />
          <LanguageLink locale={locale} target="ar" />
        </div>
        <Link className="button buttonSmall" href={localizedPath(locale, "contact")} onClick={() => setOpen(false)}>{copy.start}</Link>
        <button className={styles.menuButton} type="button" aria-expanded={open} aria-controls="primary-navigation" onClick={() => setOpen(!open)}>
          <span className="srOnly">{open ? copy.close : copy.menu}</span>
          <i /><i />
        </button>
      </div>
    </header>
  );
}

function LanguageLink({ locale, target }: { locale: Locale; target: Locale }) {
  return (
    <Link className={locale === target ? styles.activeLanguage : ""} href={localizedPath(target)} aria-current={locale === target ? "page" : undefined}>
      {target === "fa" ? "فا" : target === "en" ? "EN" : "AR"}
    </Link>
  );
}
