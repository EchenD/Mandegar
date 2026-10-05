"use client";

import Image from "next/image";
import type { Locale } from "@/lib/i18n";
import { serviceChapters, servicesCopy } from "./services-copy";
import styles from "./ServicesShowcase.module.css";

type Props = {
  locale: Locale;
  reduced: boolean;
  mobile: boolean;
  activeIndex: number;
  spatialEnabled?: boolean;
  sceneReady?: boolean;
};

export function ServicesShowcase({
  locale,
  reduced,
  mobile,
  activeIndex,
  spatialEnabled = true,
  sceneReady = false,
}: Props) {
  const ui = servicesCopy[locale];
  const selected = Math.min(serviceChapters.length - 1, Math.max(0, activeIndex));
  const activeService = serviceChapters[selected];

  if (reduced) {
    return (
      <div className={styles.staticRoot} data-services-showcase data-services-mode="reduced" data-active-service={activeService.id}>
        <header className={styles.staticHeading}>
          <h2 className={styles.kicker}>02 / {ui.kicker}</h2>
        </header>
        <div className={styles.staticGrid}>
          {serviceChapters.map((service, index) => (
            <article className={styles.staticCard} key={service.id} data-service-copy={service.id} data-service-index={index}>
              <Image className={styles.staticImage} src={service.image} alt="" width={960} height={720} unoptimized data-service-poster />
              <div className={styles.staticCardCopy}>
                <span className={styles.number} data-service-number dir="ltr" aria-hidden="true">{String(index + 1).padStart(2, "0")} / 05</span>
                <h3>{service.title[locale]}</h3>
                <p>{service.description[locale]}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  const showPoster = !spatialEnabled || !sceneReady;
  return (
    <div className={styles.root} data-services-showcase data-services-mode={spatialEnabled ? "spatial" : "poster"} data-active-service={activeService.id} data-mobile={mobile}>
      <div className={styles.poster} data-visible={showPoster} aria-hidden="true">
        {serviceChapters.map((service, index) => (
          <Image
            className={styles.posterImage}
            key={service.id}
            src={service.image}
            alt=""
            width={960}
            height={720}
            unoptimized
            data-service-poster
            data-active={index === selected}
          />
        ))}
      </div>
      <div className={styles.copyShell} data-services-copy-shell>
        <header className={styles.heading}>
          <h2 className={styles.kicker}>02 / {ui.kicker}</h2>
        </header>
        <div className={styles.panels}>
          {serviceChapters.map((service, index) => (
            <article
              className={styles.panel}
              key={service.id}
              data-service-copy={service.id}
              data-service-index={index}
              data-active={index === selected}
              aria-hidden={index !== selected}
              inert={index !== selected}
            >
              <span className={styles.number} data-service-number dir="ltr" aria-hidden="true">{String(index + 1).padStart(2, "0")} / 05</span>
              <h3 aria-label={service.title[locale]}>
                <span data-service-title-text aria-hidden="true">{service.title[locale]}</span>
                <span className={styles.titleCaret} aria-hidden="true" />
              </h3>
              <p>
                <span className={styles.screenReaderText} data-service-description-accessible>{service.description[locale]}</span>
                <span data-service-description-text aria-hidden="true">{service.description[locale]}</span>
                <span className={styles.descriptionCaret} aria-hidden="true" />
              </p>
            </article>
          ))}
        </div>
        <p className={styles.scrollHint} data-services-scroll-hint>{ui.scroll}<span aria-hidden="true">↓</span></p>
      </div>
    </div>
  );
}
