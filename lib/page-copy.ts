import pageCopy from "@/content/page-copy.json";
import type { Locale } from "./i18n";

export type PageCopy = typeof pageCopy.en;

// Safe to use in small client components: only interface text is imported here.
export function getPageCopy(locale: Locale): PageCopy {
  return pageCopy[locale];
}
