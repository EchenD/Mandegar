"use client";

import { useEffect } from "react";
import { localeConfig, type Locale } from "@/lib/i18n";

export function LocaleDocument({ locale }: { locale: Locale }) {
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = localeConfig[locale].dir;
  }, [locale]);
  return null;
}
