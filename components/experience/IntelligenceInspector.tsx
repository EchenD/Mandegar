"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { Locale } from "@/lib/i18n";
import { getIntelligenceCopy, getIntelligenceExample } from "./intelligence-inspector-copy";
import {
  clearIntelligenceSelection,
  cycleIntelligencePerson,
  getEmptyIntelligenceSnapshot,
  getIntelligenceSnapshot,
  subscribeIntelligenceInspector,
  updateIntelligencePeople,
} from "./intelligence-inspector-store";
import styles from "./IntelligenceInspector.module.css";

export function IntelligenceInspector({ locale, enabled }: { locale: Locale; enabled: boolean }) {
  const snapshot = useSyncExternalStore(subscribeIntelligenceInspector, getIntelligenceSnapshot, getEmptyIntelligenceSnapshot);
  const explore = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLElement>(null);
  const copy = getIntelligenceCopy(locale);
  const person = snapshot.pinned ?? snapshot.hovered;
  const example = person ? getIntelligenceExample(person, locale) : null;
  const available = enabled && snapshot.available;
  const rtl = locale !== "en";

  const close = () => {
    clearIntelligenceSelection();
    window.requestAnimationFrame(() => explore.current?.focus({ preventScroll: true }));
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
      clear();
      if (hadFocus) window.requestAnimationFrame(() => explore.current?.focus({ preventScroll: true }));
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
      data-pinned={snapshot.pinned ? "true" : "false"}
      data-visible-people={process.env.NODE_ENV !== "production" ? JSON.stringify(snapshot.people) : undefined}
      aria-label={copy.example}
    >
      {example ? (
        <>
          <p className={styles.visuallyHidden}>{copy.example}</p>
          <dl className={styles.visuallyHidden} data-intelligence-readout aria-live={snapshot.pinned ? "polite" : "off"}>
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
      <button
        ref={explore}
        type="button"
        className={styles.explore}
        disabled={snapshot.people.length === 0}
        hidden={Boolean(snapshot.pinned)}
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
    </aside>
  );
}
