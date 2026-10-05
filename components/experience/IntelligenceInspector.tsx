"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { Locale } from "@/lib/i18n";
import { getIntelligenceCopy, getIntelligenceExample } from "./intelligence-inspector-copy";
import {
  clearIntelligenceSelection,
  cycleIntelligencePerson,
  cycleIntelligenceStation,
  getEmptyIntelligenceSnapshot,
  getIntelligenceSnapshot,
  subscribeIntelligenceInspector,
  hoverIntelligenceStation,
  pinIntelligenceStation,
  updateIntelligencePeople,
} from "./intelligence-inspector-store";
import styles from "./IntelligenceInspector.module.css";
import { getIntelligencePersonProfile } from "./intelligence-person-profile";
import { getIntelligenceParticipation, getIntelligenceParticipationCopy } from "./intelligence-participation";

export function IntelligenceInspector({ locale, enabled }: { locale: Locale; enabled: boolean }) {
  const snapshot = useSyncExternalStore(subscribeIntelligenceInspector, getIntelligenceSnapshot, getEmptyIntelligenceSnapshot);
  const explore = useRef<HTMLButtonElement>(null);
  const exploreStations = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLElement>(null);
  const copy = getIntelligenceCopy(locale);
  const person = snapshot.pinned ?? snapshot.hovered;
  const example = person ? getIntelligenceExample(person, locale) : null;
  const profile = person ? getIntelligencePersonProfile(person, locale) : null;
  const station = snapshot.pinnedStation ?? snapshot.hoveredStation;
  const participation = station ? getIntelligenceParticipation(station, locale) : null;
  const stationCopy = getIntelligenceParticipationCopy(locale);
  const available = enabled && snapshot.available;
  const rtl = locale !== "en";

  const close = () => {
    const returnTo = snapshot.pinnedStation ? exploreStations : explore;
    clearIntelligenceSelection();
    window.requestAnimationFrame(() => returnTo.current?.focus({ preventScroll: true }));
  };

  useEffect(() => {
    const experience = root.current?.closest<HTMLElement>("[data-experience-root]");
    const shell = root.current?.closest<HTMLElement>("[data-mandegar-experience]");
    const clearUnavailable = () => {
      if (!enabled || document.hidden || experience?.dataset.storyStage !== "intelligence"
        || experience.hasAttribute("data-interaction-active") || experience.dataset.introActive === "true") {
        updateIntelligencePeople(null);
      }
    };
    const phase = new MutationObserver(clearUnavailable);
    if (experience) phase.observe(experience, { attributes: true, attributeFilter: ["data-story-stage", "data-interaction-active", "data-intro-active"] });
    const intersection = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) updateIntelligencePeople(null); });
    if (shell) intersection.observe(shell);
    document.addEventListener("visibilitychange", clearUnavailable);
    clearUnavailable();
    return () => {
      phase.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", clearUnavailable);
      updateIntelligencePeople(null);
    };
  }, [enabled]);

  useEffect(() => {
    const clear = () => clearIntelligenceSelection();
    const visibility = () => { if (document.hidden) clear(); };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !getIntelligenceSnapshot().available) return;
      const hadFocus = root.current?.contains(document.activeElement);
      const returnTo = getIntelligenceSnapshot().pinnedStation ? exploreStations : explore;
      clear();
      if (hadFocus) window.requestAnimationFrame(() => returnTo.current?.focus({ preventScroll: true }));
    };
    window.addEventListener("blur", clear);
    window.addEventListener("keydown", escape);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", clear);
      window.removeEventListener("keydown", escape);
      document.removeEventListener("visibilitychange", visibility);
      clear();
    };
  }, []);

  return (
    <aside
      ref={root}
      className={styles.root}
      hidden={!available}
      data-intelligence-inspector
      data-available={available ? "true" : "false"}
      data-person={person ?? "none"}
      data-station={station ?? "none"}
      data-pinned={snapshot.pinned || snapshot.pinnedStation ? "true" : "false"}
      data-visible-people={process.env.NODE_ENV !== "production" ? JSON.stringify(snapshot.people) : undefined}
      data-visible-stations={process.env.NODE_ENV !== "production" ? JSON.stringify(snapshot.stations) : undefined}
      aria-label={participation ? `${participation.title} · ${stationCopy.title}` : profile?.copy.title}
    >
      {example ? (
        <>
          <dl className={styles.visuallyHidden} data-intelligence-readout aria-live={snapshot.pinned ? "polite" : "off"}>
            {profile ? <>
              <div><dt>{profile.copy.age}</dt><dd data-person-age>{profile.age}</dd></div>
              <div><dt>{profile.copy.gender}</dt><dd data-person-gender>{profile.gender}</dd></div>
              <div><dt>{profile.copy.interest}</dt><dd data-person-interest>{profile.interest}</dd></div>
              <div><dt>{profile.copy.expression}</dt><dd data-person-expression>{profile.expression}</dd></div>
            </> : null}
            <div><dt>{copy.activities}</dt><dd data-example-activities>{example.activities}</dd></div>
            <div><dt>{copy.time}</dt><dd data-example-time>{example.time}</dd></div>
          </dl>
          {snapshot.pinned && (
            <div className={styles.controls}>
              <button type="button" onClick={() => cycleIntelligencePerson(-1)} aria-label={copy.previous} data-intelligence-previous>{rtl ? "→" : "←"}</button>
              <button type="button" onClick={() => cycleIntelligencePerson(1)} aria-label={copy.next} data-intelligence-next>{rtl ? "←" : "→"}</button>
              <button type="button" onClick={close} aria-label={copy.close} data-intelligence-close>×</button>
            </div>
          )}
        </>
      ) : null}
      {snapshot.stations.map((point) => (
        <button
          key={point.id}
          type="button"
          className={styles.stationTarget}
          style={{ left: point.x, top: point.y }}
          aria-label={`${getIntelligenceParticipation(point.id, locale).title} · ${stationCopy.title}`}
          aria-pressed={snapshot.pinnedStation === point.id}
          onPointerEnter={(event) => { if (event.pointerType !== "touch") hoverIntelligenceStation(point.id); }}
          onPointerLeave={() => hoverIntelligenceStation(null)}
          onClick={() => pinIntelligenceStation(point.id)}
          data-intelligence-station-target={point.id}
        >
          <span aria-hidden="true">+</span>
        </button>
      ))}
      {participation ? (
        <>
          <svg className={styles.stationLeader} aria-hidden="true"><line data-station-leader /></svg>
          <section className={styles.stationReadout} data-station-readout data-station-readout-id={station} dir={rtl ? "rtl" : "ltr"} aria-live={snapshot.pinnedStation ? "polite" : "off"}>
            <p>{stationCopy.title}</p>
            <h3>{participation.title}</h3>
            <dl>
              {participation.metrics.map((metric) => (
                <div key={metric.key}><dt>{metric.label}</dt><dd data-station-metric={metric.key}>{metric.value}</dd></div>
              ))}
            </dl>
          </section>
          {snapshot.pinnedStation ? (
            <div className={styles.controls}>
              <button type="button" onClick={() => cycleIntelligenceStation(-1)} aria-label={stationCopy.previous} data-station-previous>{rtl ? "→" : "←"}</button>
              <button type="button" onClick={() => cycleIntelligenceStation(1)} aria-label={stationCopy.next} data-station-next>{rtl ? "←" : "→"}</button>
              <button type="button" onClick={close} aria-label={stationCopy.close} data-station-close>×</button>
            </div>
          ) : null}
        </>
      ) : null}
      <div className={styles.exploreControls}>
        <button
          ref={explore}
          type="button"
          className={styles.explore}
          disabled={snapshot.people.length === 0}
          hidden={Boolean(snapshot.pinned || snapshot.pinnedStation)}
          onClick={(event) => {
            cycleIntelligencePerson(1);
            if (event.detail === 0) {
              window.requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>("[data-intelligence-next]")?.focus({ preventScroll: true }));
            }
          }}
          data-intelligence-explore
        >
          {copy.explore}<span aria-hidden="true">{rtl ? "↖" : "↗"}</span>
        </button>
        <button
          ref={exploreStations}
          type="button"
          className={styles.explore}
          disabled={snapshot.stations.length === 0}
          hidden={Boolean(snapshot.pinned || snapshot.pinnedStation)}
          onClick={(event) => {
            cycleIntelligenceStation(1);
            if (event.detail === 0) window.requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>("[data-station-next]")?.focus({ preventScroll: true }));
          }}
          data-intelligence-station-explore
        >
          {stationCopy.explore}<span aria-hidden="true">{rtl ? "↖" : "↗"}</span>
        </button>
      </div>
    </aside>
  );
}
