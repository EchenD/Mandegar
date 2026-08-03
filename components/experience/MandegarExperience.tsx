"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { Locale } from "@/lib/i18n";
import { ScrollMotion } from "./ScrollMotion";
import { experienceState } from "./experience-state";
import { scenePhases, type ScenePhaseId } from "./scene-config";
import styles from "./MandegarExperience.module.css";

const ExperienceCanvas = dynamic(
  () => import("./ExperienceCanvas").then((module) => module.ExperienceCanvas),
  { ssr: false },
);

type ExperienceCopy = {
  arrivalLabel: string;
  discoveryEyebrow: string;
  discoveryTitle: string;
  discoveryBody: string;
  activationEyebrow: string;
  activationTitle: string;
  activationBody: string;
  revealEyebrow: string;
  revealTitle: string;
  revealBody: string;
  invitationEyebrow: string;
  invitationTitle: string;
  invitationBody: string;
  startProject: string;
  scroll: string;
  replay: string;
  enableSound: string;
  muteSound: string;
  loading: string;
  phases: Record<ScenePhaseId, string>;
  navigation: {
    projects: string;
    services: string;
    about: string;
    contact: string;
  };
};

type ExperienceProps = {
  locale: Locale;
  copy: ExperienceCopy;
  ctaHref: string;
  enabledByCms?: boolean;
  lenisEnabled?: boolean;
};

type AudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

export function MandegarExperience({ locale, copy, ctaHref, enabledByCms = true, lenisEnabled = false }: ExperienceProps) {
  const [activePhase, setActivePhase] = useState<ScenePhaseId>("arrival");
  const [runtime, setRuntime] = useState<"pending" | "fallback" | "adaptive" | "full">("pending");
  const [loadProgress, setLoadProgress] = useState(12);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioContext = useRef<AudioContext | undefined>(undefined);
  const audioNodes = useRef<AudioNode[]>([]);

  useEffect(() => {
    const hydrationFrame = window.requestAnimationFrame(() => setLoadProgress(38));
    return () => {
      window.cancelAnimationFrame(hydrationFrame);
      audioNodes.current.forEach((node) => {
        if ("stop" in node) (node as OscillatorNode).stop();
        node.disconnect();
      });
      audioContext.current?.close();
    };
  }, []);

  const handleRuntimeReady = useCallback((nextRuntime: "pending" | "fallback" | "adaptive" | "full") => {
    setRuntime(nextRuntime);
    setLoadProgress(72);
  }, []);

  const handleFirstFrame = useCallback(() => setLoadProgress(100), []);
  const handlePhaseChange = useCallback((phase: ScenePhaseId) => setActivePhase(phase), []);

  const scrollToProgress = useCallback((progress: number) => {
    const root = document.querySelector<HTMLElement>("[data-experience-root]");
    if (!root) return;
    const distance = Math.max(0, root.offsetHeight - window.innerHeight);
    window.scrollTo({ top: root.offsetTop + distance * progress, behavior: "smooth" });
  }, []);

  const scrollToPhase = useCallback((phase: ScenePhaseId) => {
    const checkpoint = scenePhases.find((item) => item.id === phase);
    if (checkpoint) scrollToProgress(checkpoint.preview);
  }, [scrollToProgress]);

  const toggleSound = useCallback(async () => {
    if (soundEnabled) {
      audioNodes.current.forEach((node) => {
        if ("stop" in node) (node as OscillatorNode).stop();
        node.disconnect();
      });
      audioNodes.current = [];
      await audioContext.current?.close();
      audioContext.current = undefined;
      setSoundEnabled(false);
      return;
    }
    const Context = window.AudioContext || (window as AudioWindow).webkitAudioContext;
    if (!Context) return;
    const context = new Context();
    const master = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 210;
    master.gain.setValueAtTime(0, context.currentTime);
    master.gain.linearRampToValueAtTime(0.018, context.currentTime + 1.4);
    filter.connect(master);
    master.connect(context.destination);
    const first = context.createOscillator();
    const second = context.createOscillator();
    const secondGain = context.createGain();
    first.type = "sine";
    first.frequency.value = 54;
    second.type = "sine";
    second.frequency.value = 81;
    second.detune.value = 4;
    secondGain.gain.value = 0.22;
    first.connect(filter);
    second.connect(secondGain);
    secondGain.connect(filter);
    first.start();
    second.start();
    audioContext.current = context;
    audioNodes.current = [first, second, secondGain, filter, master];
    setSoundEnabled(true);
  }, [soundEnabled]);

  const navItems = [
    { label: copy.navigation.projects, href: `/${locale}/projects` },
    { label: copy.navigation.services, href: `/${locale}/services` },
    { label: copy.navigation.about, href: `/${locale}/about` },
    { label: copy.navigation.contact, href: `/${locale}/contact` },
  ];

  return (
    <ScrollMotion className={styles.root} lenisEnabled={lenisEnabled} onPhaseChange={handlePhaseChange}>
      <div
        className={styles.loader}
        data-complete={loadProgress === 100 ? "true" : "false"}
        aria-live="polite"
        aria-label={`${copy.loading} ${loadProgress}%`}
      >
        <div className={styles.loaderMark} style={{ "--load-progress": `${loadProgress * 3.6}deg` } as CSSProperties}>
          <span />
        </div>
        <div className={styles.loaderMeta}>
          <span>MANDEGAR / EXHIBITION WORLD</span>
          <b>{String(loadProgress).padStart(3, "0")}</b>
        </div>
      </div>

      <div className={styles.sticky}>
        <div className={styles.sceneShell} data-runtime={runtime} data-mandegar-experience>
          <h1 className={styles.visuallyHidden}>{copy.revealTitle}</h1>
          <ExperienceCanvas
            className={styles.canvas}
            enabledByCms={enabledByCms}
            onRuntimeReady={handleRuntimeReady}
            onFirstFrame={handleFirstFrame}
          />
          <div className={styles.fallbackScene} aria-hidden="true">
            <span className={styles.fallbackHall} />
            <span className={styles.fallbackStage} />
            <span className={styles.fallbackScreen} />
            <span className={styles.fallbackHalo} />
            <span className={styles.fallbackTrail} />
          </div>
          <div className={styles.atmosphere} aria-hidden="true"><i /><i /><i /></div>
          <div className={styles.spatialBrand} aria-hidden="true">MANDEGAR <small>CREATING TOMORROW</small></div>
          <div className={styles.capabilityLabels} aria-hidden="true">
            <span>PHOTO / 01</span><span>GAME / 02</span><span>TOUCH / 03</span>
          </div>

          <div className={styles.copyLayer}>
            <div className={styles.arrivalSignal}>
              <span>01</span>
              <p>{copy.arrivalLabel}</p>
            </div>
            <section className={`${styles.sceneCopy} ${styles.discoveryCopy}`} data-scene-copy="discovery" data-cinematic-beat>
              <span>{copy.discoveryEyebrow}</span>
              <h1>{copy.discoveryTitle}</h1>
              <p>{copy.discoveryBody}</p>
            </section>
            <section className={`${styles.sceneCopy} ${styles.activationCopy}`} data-scene-copy="activation" data-cinematic-beat>
              <span>{copy.activationEyebrow}</span>
              <h2>{copy.activationTitle}</h2>
              <p>{copy.activationBody}</p>
            </section>
            <section className={`${styles.sceneCopy} ${styles.revealCopy}`} data-scene-copy="reveal" data-cinematic-beat>
              <span>{copy.revealEyebrow}</span>
              <h2>{copy.revealTitle}</h2>
              <p>{copy.revealBody}</p>
            </section>
            <section className={`${styles.sceneCopy} ${styles.invitationCopy}`} data-scene-copy="loop" data-cinematic-beat>
              <span>{copy.invitationEyebrow}</span>
              <h2>{copy.invitationTitle}</h2>
              <p>{copy.invitationBody}</p>
              <div className={styles.ctaRow}>
                <Link href={ctaHref} className={styles.primaryCta} data-analytics="cta_start_project">{copy.startProject}<i aria-hidden="true">↗</i></Link>
                <button type="button" className={styles.replayButton} onClick={() => scrollToPhase("arrival")}>{copy.replay}<i aria-hidden="true">↺</i></button>
              </div>
            </section>
          </div>

          <aside className={styles.sideDock} aria-label={locale === "en" ? "Direct navigation" : locale === "ar" ? "التنقل المباشر" : "دسترسی مستقیم"}>
            <span className={styles.sideDockLine} />
            {navItems.map((item, index) => <Link key={item.href} href={item.href}><small>0{index + 1}</small>{item.label}</Link>)}
          </aside>

          <button className={styles.soundControl} type="button" aria-pressed={soundEnabled} onClick={toggleSound}>
            <span aria-hidden="true">{soundEnabled ? "◖" : "○"}</span>
            {soundEnabled ? copy.muteSound : copy.enableSound}
          </button>

          <div className={styles.phaseRail} aria-label={locale === "en" ? "Experience phases" : locale === "ar" ? "مراحل التجربة" : "مراحل تجربه"}>
            <span className={styles.phaseTrack}><i style={{ transform: `scaleX(${Math.max(0.03, scenePhases.findIndex((phase) => phase.id === activePhase) / 4)})` }} /></span>
            <div className={styles.phaseButtons}>
              {scenePhases.map((phase, index) => (
                <button key={phase.id} type="button" data-active={activePhase === phase.id ? "true" : "false"} onClick={() => scrollToPhase(phase.id)}>
                  <small>0{index + 1}</small><span>{copy.phases[phase.id]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.scrollCue} data-hidden={activePhase === "loop" ? "true" : "false"}>
            <span>{copy.scroll}</span><i />
          </div>
          {process.env.NODE_ENV !== "production" ? <DevTuner scrollToProgress={scrollToProgress} /> : null}
        </div>
      </div>

      <div className={styles.semanticFallback} data-semantic-fallback data-cinematic-beat>
        {["discovery", "activation", "reveal", "loop"].map((phase) => {
          const content = phase === "discovery"
            ? [copy.discoveryEyebrow, copy.discoveryTitle, copy.discoveryBody]
            : phase === "activation"
              ? [copy.activationEyebrow, copy.activationTitle, copy.activationBody]
              : phase === "reveal"
                ? [copy.revealEyebrow, copy.revealTitle, copy.revealBody]
                : [copy.invitationEyebrow, copy.invitationTitle, copy.invitationBody];
          return <section key={phase}><span>{content[0]}</span><h2>{content[1]}</h2><p>{content[2]}</p>{phase === "loop" ? <Link href={ctaHref}>{copy.startProject}</Link> : null}</section>;
        })}
      </div>
    </ScrollMotion>
  );
}

function DevTuner({ scrollToProgress }: { scrollToProgress: (progress: number) => void }) {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lightScale, setLightScale] = useState(1);
  return (
    <div className={styles.devTuner} data-open={open ? "true" : "false"} data-dev-tuner>
      <button type="button" onClick={() => setOpen(!open)}>TUNE</button>
      {open ? <div>
        <label>Scene <input type="range" min="0" max="1" step="0.001" value={progress} onChange={(event) => { const value = Number(event.target.value); setProgress(value); scrollToProgress(value); }} /></label>
        <label>Light <input type="range" min="0.5" max="1.5" step="0.05" value={lightScale} onChange={(event) => { const value = Number(event.target.value); setLightScale(value); experienceState.lightScale = value; }} /></label>
        <span>{progress.toFixed(3)} / {lightScale.toFixed(2)}</span>
      </div> : null}
    </div>
  );
}

export type { ExperienceCopy };
