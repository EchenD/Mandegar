import interfaceContent from "@/content/ui.json";

export const locales = ["fa", "en", "ar"] as const;
export type Locale = (typeof locales)[number];

export const localeConfig: Record<Locale, { dir: "rtl" | "ltr"; label: string; nativeLabel: string }> = {
  fa: { dir: "rtl", label: "Persian", nativeLabel: "فارسی" },
  en: { dir: "ltr", label: "English", nativeLabel: "English" },
  ar: { dir: "rtl", label: "Arabic", nativeLabel: "العربية" },
};

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function ensureLocale(value: string): Locale {
  return isLocale(value) ? value : "fa";
}

export function localizedPath(locale: Locale, path = "") {
  return `/${locale}${path ? `/${path.replace(/^\//, "")}` : ""}`;
}

export const ui = interfaceContent;

export function getUi(locale: Locale) {
  return ui[locale];
}
