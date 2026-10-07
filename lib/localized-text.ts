import type { Locale } from "./i18n";
import type { Localized } from "./content-types";

export const getText = (value: Localized, locale: Locale) => value[locale];
