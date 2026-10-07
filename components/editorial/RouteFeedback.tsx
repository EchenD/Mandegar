"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ensureLocale, isLocale, localeConfig, localizedPath } from "@/lib/i18n";
import { getPageCopy } from "@/lib/page-copy";
import styles from "./RouteFeedback.module.css";

export function RouteFeedback({ reset }: { reset?: () => void }) {
  const locale = useRecoveryLocale();
  const copy = getPageCopy(locale);
  return (
    <section className={styles.feedback} lang={locale} dir={localeConfig[locale].dir}>
      <span className={styles.marker} aria-hidden="true">{reset ? "!" : "404"}</span>
      <h1>{reset ? copy.errorTitle : copy.notFoundTitle}</h1>
      <p>{reset ? copy.errorBody : copy.notFoundBody}</p>
      <div className={styles.actions}>
        {reset ? <button className="button" type="button" onClick={reset}>{copy.retry}</button> : null}
        <Link prefetch={false} className="button" href={localizedPath(locale)}>{copy.backHome}</Link>
        {!reset ? <Link prefetch={false} className={styles.secondary} href={localizedPath(locale, "projects")}>{copy.viewProjects}<span aria-hidden="true">↗</span></Link> : null}
      </div>
    </section>
  );
}

function useRecoveryLocale() {
  // Static 404 HTML is shared by all URLs. Keep its first client render equal
  // to the primary-language server render, then read the requested locale.
  const browserPath = useSyncExternalStore(subscribeToLocation, () => window.location.pathname, () => "");
  return ensureLocale(browserPath.split("/").find(isLocale) || "fa");
}

function subscribeToLocation(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}
