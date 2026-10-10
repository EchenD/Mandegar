const fallbackFontFamily = "\"Vazirmatn Variable\", Tahoma, sans-serif";

type FontFamilyCache = {
  body: HTMLElement;
  key: string;
  family: string;
};

const fontFamilies = new WeakMap<Document, FontFamilyCache>();

/** Canvas text follows the locale's CSS font without a style read each frame. */
export function getCanvasFontFamily(): string {
  if (typeof document === "undefined" || !document.body) return fallbackFontFamily;

  const body = document.body;
  const root = document.documentElement;
  const key = `${root.lang}:${root.className}:${body.className}`;
  const cached = fontFamilies.get(document);
  if (cached?.body === body && cached.key === key) return cached.family;

  const family = getComputedStyle(body).fontFamily || fallbackFontFamily;
  fontFamilies.set(document, { body, key, family });
  return family;
}
