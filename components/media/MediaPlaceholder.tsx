import Image from "next/image";
import type { MediaAsset } from "@/lib/content-types";
import type { Locale } from "@/lib/i18n";
import { getText } from "@/lib/localized-text";
import { getPageCopy } from "@/lib/page-copy";
import { AdaptiveVideo } from "./AdaptiveVideo";

export function MediaPlaceholder({ media, locale, priority = false, className = "", sizes = "(max-width: 760px) 100vw, 50vw" }: { media: MediaAsset; locale: Locale; priority?: boolean; className?: string; sizes?: string }) {
  const alt = getText(media.alt, locale);
  const caption = media.caption ? getText(media.caption, locale) : "";
  const copy = getPageCopy(locale);
  return (
    <figure className={`mediaFrame ${className}`}>
      {media.kind === "video" ? (
        <AdaptiveVideo media={media} locale={locale} label={alt} />
      ) : (
        <>
          <Image className={media.mobileSrc ? "mediaDesktop" : undefined} src={media.src} alt={alt} fill sizes={sizes} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} />
          {media.mobileSrc ? <Image className="mediaMobile" src={media.mobileSrc} alt={alt} fill sizes="100vw" loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} /> : null}
        </>
      )}
      {media.isPlaceholder ? <span className="mediaNotice">{copy.conceptMedia}</span> : null}
      {media.kind === "video-placeholder" ? <span className="videoMark">{copy.videoConcept}</span> : null}
      {caption ? <figcaption className="mediaCaption">{caption}</figcaption> : null}
    </figure>
  );
}
