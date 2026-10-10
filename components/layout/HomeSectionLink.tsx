"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { getNavigationHomeSection, navigateHomeSection } from "@/lib/home-navigation";
import { localizedPath, type Locale } from "@/lib/i18n";

export function HomeSectionLink({ href, locale, children }: { href: string; locale: Locale; children: ReactNode }) {
  const pathname = usePathname();
  const home = pathname.replace(/\/+$/, "") === localizedPath(locale).replace(/\/+$/, "");
  const section = getNavigationHomeSection(href);
  const target = home && section ? `#${section}` : href;

  return (
    <Link prefetch={false} href={target} onClick={(event) => {
      if (!home || !section || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      navigateHomeSection(section);
    }}>{children}</Link>
  );
}
