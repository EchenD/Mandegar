"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import journeyContent from "@/content/journey.json";
import { localizedPath, type Locale } from "@/lib/i18n";
import { publicAssetPath } from "@/lib/public-asset-path";
import { hasWebGLSupport } from "@/lib/webgl-support";
import styles from "./ConnectedJourney.module.css";
import {
  PartnerFinaleCanvas,
  type PartnerFinaleBridge,
  type PartnerFinaleMedia,
} from "./PartnerFinaleCanvas";
import { preloadServicesScene, ServicesSceneCanvas, type ServicesSceneBridge } from "./ServicesSceneCanvas";
import { ServicesShowcase } from "./ServicesShowcase";
import { serviceChapters } from "./services-copy";
import { getServicesColorReveal, getServicesMotionState, SERVICE_POSES, SERVICE_TURN_PADDING } from "./services-score";
import { heroEnding } from "./hero-ending";
import { experienceState } from "./experience-state";

export type JourneyProject = {
  slug: string;
  title: string;
  eyebrow: string;
  category?: string;
  summary: string;
  mediaSrc: string;
  mediaKind?: "image" | "video" | "video-placeholder";
  mediaPoster?: string;
  gallery?: Array<{
    src: string;
    kind?: "image" | "video" | "video-placeholder";
    poster?: string;
  }>;
  year?: string;
  location?: string;
  isPlaceholder?: boolean;
};
export type JourneyVoice = { quote: string; person: string; role: string; organization: string; isPlaceholder?: boolean };
export type JourneyClient = { name: string; logo?: string };
type JourneyCopy = { projectKicker: string; projectTitle: string; projectBody: string; viewProject: string; projectsEmpty: string };
type Props = { locale: Locale; projects: JourneyProject[]; voices?: JourneyVoice[]; clients?: JourneyClient[]; copy: JourneyCopy; aboutHref?: string; onWorkReady?: (jump: (() => void) | null) => void };
const emptyClients: JourneyClient[] = [];
const words = journeyContent.copy;
const aboutTyping = journeyContent.aboutTyping;

function MaskedWords({ text, marker }: { text: string; marker: string }) {
  return <>{text.split(/\s+/).map((word, index) => <span className={styles.wordMask} key={index} aria-hidden="true"><span data-motion-word={marker}>{word}</span></span>)}</>;
}

function PrototypeLogo({ index }: { index: number }) {
  const variant = index % 5;
  return <span className={styles.prototypeLogo} aria-hidden="true">
    <svg viewBox="0 0 120 72" role="presentation">
      {variant === 0 && <><circle cx="46" cy="36" r="21" /><circle cx="75" cy="36" r="21" /></>}
      {variant === 1 && <><path d="M27 51 60 13l33 38H75L60 34 45 51Z" /><circle cx="60" cy="52" r="7" /></>}
      {variant === 2 && <><path d="M25 17h28v38H25zM67 17h28v38H67z" /><path d="m45 36 15-15 15 15-15 15Z" /></>}
      {variant === 3 && <><circle cx="60" cy="36" r="25" fill="none" stroke="currentColor" strokeWidth="9" /><path d="M60 8v28h28" /></>}
      {variant === 4 && <><path d="M23 48c17-34 29-34 38 0 9-34 21-34 36 0" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" /></>}
    </svg>
  </span>;
}

function spatialMediaSource(src: string, mobile: boolean) {
  if (!src.includes("cdn.sanity.io/images/")) return src;
  const url = new URL(src);
  url.searchParams.set("w", mobile ? "640" : "960");
  url.searchParams.set("q", mobile ? "68" : "74");
  url.searchParams.set("auto", "format");
  return url.toString();
}

function isHeroPhotoResult(src: string) {
  return src.split(/[?#]/, 1)[0].endsWith("/media/placeholders/photo-experience.webp");
}

function serviceWritingProgress(progress: number, index: number) {
  const pose = SERVICE_POSES[index];
  const previousPose = SERVICE_POSES[index - 1];
  const turnStart = index ? previousPose + SERVICE_TURN_PADDING : 0;
  const turnEnd = index ? pose - SERVICE_TURN_PADDING : .1;
  const titleStart = index ? turnStart + (turnEnd - turnStart) * .65 : .032;
  const titleEnd = pose - .022;
  const descriptionStart = pose - .055;
  const descriptionEnd = pose;
  const titleEraseStart = index === SERVICE_POSES.length - 1 ? .92 : pose + .0625;
  const titleEraseEnd = index === SERVICE_POSES.length - 1 ? .974 : (pose + SERVICE_POSES[index + 1]) / 2;
  const descriptionEraseStart = index === SERVICE_POSES.length - 1 ? .9 : pose + .035;
  const descriptionEraseEnd = index === SERVICE_POSES.length - 1 ? .942 : pose + .06;
  const portion = (start: number, end: number) => THREE.MathUtils.clamp((progress - start) / (end - start), 0, 1);
  return {
    title: portion(titleStart, titleEnd) * (1 - portion(titleEraseStart, titleEraseEnd)),
    description: portion(descriptionStart, descriptionEnd) * (1 - portion(descriptionEraseStart, descriptionEraseEnd)),
  };
}

export function ConnectedJourney({ locale, projects, copy, clients = emptyClients, aboutHref, onWorkReady }: Props) {
  const root = useRef<HTMLElement>(null);
  const [reduced, setReduced] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [spatialEnabled, setSpatialEnabled] = useState(true);
  const [partnerCanvasMounted, setPartnerCanvasMounted] = useState(false);
  const [partnerMediaSeed, setPartnerMediaSeed] = useState<number | null>(null);
  const [servicesCanvasMounted, setServicesCanvasMounted] = useState(false);
  const [serviceSceneReady, setServiceSceneReady] = useState(false);
  const [serviceSpatialFailed, setServiceSpatialFailed] = useState(false);
  const [activeServiceIndex, setActiveServiceIndex] = useState(0);
  const partnerCanvasMountedRef = useRef(false);
  const servicesCanvasMountedRef = useRef(false);
  const partnerFinaleBridge = useRef<PartnerFinaleBridge>({ progress: 0, ready: false });
  const servicesBridge = useRef<ServicesSceneBridge>({ progress: 0, ready: false });
  const selected = useMemo(() => projects.filter(project => project.mediaSrc).slice(0, 8), [projects]);
  const sphereProjects = useMemo(() => selected.length
    ? Array.from({ length: 8 }, (_, index) => selected[index % selected.length])
    : [], [selected]);
  const configuredCopy = words[locale];
  const ui = { ...configuredCopy, partnersLabel: clients.length ? configuredCopy.partnersLabel : configuredCopy.genericPartnersLabel };
  const partnerItems = useMemo<JourneyClient[]>(() => clients.length
    ? clients
    : ui.disciplines.map((name) => ({ name })), [clients, ui.disciplines]);
  const partnerFinaleMedia = useMemo<PartnerFinaleMedia[]>(() => {
    const seen = new Set<string>();
    const media = selected.flatMap((project) => [
      {
        src: project.mediaSrc,
        label: project.title,
        kind: project.mediaKind,
        poster: project.mediaPoster,
      },
      ...(project.gallery || []).map((item) => ({
        src: item.src,
        label: project.title,
        kind: item.kind,
        poster: item.poster,
      })),
    ]).filter((item) => !isHeroPhotoResult(item.src)).flatMap((item) => {
      const video = item.kind === "video" || /\.(mp4|webm|mov)(?:$|\?)/i.test(item.src);
      if (mobile && video) {
        return item.poster
          ? [{ ...item, src: spatialMediaSource(item.poster, true), kind: "image" as const }]
          : [];
      }
      return [{ ...item, src: spatialMediaSource(item.src, mobile) }];
    }).filter((item) => {
      if (!item.src || seen.has(item.src)) return false;
      seen.add(item.src);
      return true;
    });
    if (media.length) return media;
    return [{
      src: publicAssetPath("/media/placeholders/exhibition-space.webp"),
      label: "Mandegar",
      kind: "image",
    }];
  }, [mobile, selected]);
  const logo = publicAssetPath("/images/mandegar-finale-logo.webp");
  const typing = aboutTyping[locale];
  const firstPartnerImage = partnerFinaleMedia.find((item) => item.kind !== "video"
    && !/\.(mp4|webm|mov)(?:$|\?)/i.test(item.src));
  const staticJourney = reduced || !selected.length;
  const servicesSpatialEnabled = spatialEnabled && !serviceSpatialFailed;

  useEffect(() => {
    const bridge = servicesBridge.current;
    const ready = (value: boolean) => setServiceSceneReady(value);
    const failed = () => setServiceSpatialFailed(true);
    bridge.onReady = ready;
    bridge.onError = failed;
    if (bridge.ready) ready(true);
    return () => {
      if (bridge.onReady === ready) bridge.onReady = undefined;
      if (bridge.onError === failed) bridge.onError = undefined;
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const value = new Uint32Array(1);
      window.crypto.getRandomValues(value);
      setPartnerMediaSeed(value[0] || 1);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
    if (saveData || !firstPartnerImage) return;
    const preload = new window.Image();
    preload.decoding = "async";
    preload.fetchPriority = "high";
    preload.crossOrigin = "anonymous";
    preload.src = firstPartnerImage.src;
    void preload.decode().catch(() => undefined);
  }, [firstPartnerImage]);

  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const size = matchMedia("(max-width: 760px)");
    const sync = () => {
      const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
      const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 8;
      const supportsWebGL = hasWebGLSupport();
      const nextSpatialEnabled = !motion.matches && !saveData && supportsWebGL && deviceMemory > 2;
      setReduced(motion.matches);
      setMobile(size.matches);
      setSpatialEnabled(nextSpatialEnabled);
      if (nextSpatialEnabled && selected.length && !servicesCanvasMountedRef.current) {
        // Fetch and warm the inactive services scene during the opening experience.
        // A fast native scroll through Projects must not start its first load.
        preloadServicesScene();
        servicesCanvasMountedRef.current = true;
        setServicesCanvasMounted(true);
      }
      if (nextSpatialEnabled && !partnerCanvasMountedRef.current) {
        partnerCanvasMountedRef.current = true;
        setPartnerCanvasMounted(true);
      }
    };
    sync();
    motion.addEventListener("change", sync);
    size.addEventListener("change", sync);
    return () => { motion.removeEventListener("change", sync); size.removeEventListener("change", sync); };
  }, [selected.length]);

  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    const hero = document.querySelector<HTMLElement>("[data-experience-root]");
    const publishHandoff = (progress: number) => {
      experienceState.handoffProgress = progress;
      hero?.style.setProperty("--hero-handoff", String(progress));
      if (hero) hero.dataset.handoffProgress = String(progress);
    };
    publishHandoff(0);
    const focusWork = () => {
      const link = node.querySelector<HTMLElement>("[data-project-copy='0'] a");
      (link ?? node).focus({ preventScroll: true });
    };
    if (staticJourney) {
      const seekStatic = (label: string) => {
        const index = /^Service([1-5])$/.exec(label)?.[1];
        const target = index
          ? node.querySelector<HTMLElement>(`[data-service-index="${Number(index) - 1}"]`)
          : label === "Services" ? node.querySelector<HTMLElement>("[data-services]")
          : label.startsWith("About") ? node.querySelector<HTMLElement>("[data-about]")
          : label === "Finale" || label === "Contact" ? node.querySelector<HTMLElement>("[data-final-cta]") : node;
        target?.scrollIntoView({ behavior: "instant", block: "start" });
        (target?.querySelector<HTMLElement>("a, button") ?? target)?.focus({ preventScroll: true });
      };
      const handleSeek = (event: Event) => {
        const label = (event as CustomEvent<{ label?: string }>).detail?.label;
        if (label) seekStatic(label);
      };
      node.addEventListener("mandegar:journey-seek", handleSeek);
      onWorkReady?.(() => {
        node.scrollIntoView({ behavior: "instant", block: "start" });
        focusWork();
      });
      return () => {
        onWorkReady?.(null);
        node.removeEventListener("mandegar:journey-seek", handleSeek);
      };
    }
    let jumpToWork: (() => void) | undefined;
    let seekToLabel: ((label: string) => void) | undefined;
    const handleJourneySeek = (event: Event) => {
      const detail = (event as CustomEvent<{ label?: string; focus?: boolean }>).detail;
      if (!detail?.label) return;
      seekToLabel?.(detail.label);
      if (detail.focus) {
        const target = detail.label === "Services" ? node.querySelector<HTMLElement>("[data-services]")
          : detail.label.startsWith("About") ? node.querySelector<HTMLElement>("[data-about]")
          : detail.label === "Finale" || detail.label === "Contact" ? node.querySelector<HTMLElement>("[data-final-cta]")
          : node.querySelector<HTMLElement>("[data-project-copy='0']");
        requestAnimationFrame(() => (target?.querySelector<HTMLElement>("a, button") ?? target ?? node).focus({ preventScroll: true }));
      }
    };
    node.addEventListener("mandegar:journey-seek", handleJourneySeek);
    const partnerBridge = partnerFinaleBridge.current;
    const serviceBridge = servicesBridge.current;
    const servicesLayer = node.querySelector<HTMLElement>("[data-services]")!;
    const servicePanels = Array.from(node.querySelectorAll<HTMLElement>("[data-service-copy]"));
    const serviceText = serviceChapters.map((service, index) => ({
      panel: servicePanels[index],
      title: servicePanels[index].querySelector<HTMLElement>("[data-service-title-text]")!,
      description: servicePanels[index].querySelector<HTMLElement>("[data-service-description-text]")!,
      titleCharacters: Array.from(service.title[locale]),
      descriptionCharacters: Array.from(service.description[locale]),
    }));
    gsap.registerPlugin(ScrollTrigger);
    const rtl = locale !== "en";
    const chapter = (i: number) => `[data-project-copy="${i}"]`;
    const cards = Array.from(node.querySelectorAll<HTMLElement>("[data-orbit-card]"));
    const typingLine = node.querySelector<HTMLElement>("[data-typing-line]")!;
    const typingBase = node.querySelector<HTMLElement>("[data-typing-base]")!;
    const typingWord = node.querySelector<HTMLElement>("[data-typing-word]")!;
    const typingCursor = node.querySelector<HTMLElement>("[data-typing-cursor]")!;
    const aboutKickerText = node.querySelector<HTMLElement>("[data-about-kicker-text]")!;
    const aboutLinkText = node.querySelector<HTMLElement>("[data-about-link-text]")!;
    const partnerKickerText = node.querySelector<HTMLElement>("[data-partners-kicker-text]")!;
    const partnerCenterText = node.querySelector<HTMLElement>("[data-partner-center-text]")!;
    const finaleKickerText = node.querySelector<HTMLElement>("[data-finale-kicker-text]")!;
    const finaleTitleText = node.querySelector<HTMLElement>("[data-finale-title-text]")!;
    const finaleCtaText = node.querySelector<HTMLElement>("[data-finale-cta-text]")!;
    const logoFallback = node.querySelector<HTMLElement>("[data-logo-fallback]");
    const partnerScene = node.querySelector<HTMLElement>("[data-partner-scene]")!;
    const partnerFallback = node.querySelector<HTMLElement>("[data-partner-fallback]");
    const partnerCards = Array.from(node.querySelectorAll<HTMLElement>("[data-partner-card]"));
    const partnerCardSizes = partnerCards.map((card) => ({
      width: Math.max(1, card.offsetWidth),
      height: Math.max(1, card.offsetHeight),
    }));
    const partnerWheel = {
      entry: 0,
      spread: 0,
      ring: 0,
      rotation: 0,
      fold: 0,
      handoff: 0,
      retreat: 0,
    };
    const hidePartnerFallback = () => {
      if (!partnerFallback) return;
      partnerFallback.style.opacity = "0";
      partnerFallback.style.visibility = "hidden";
    };
    partnerBridge.onReady = hidePartnerFallback;
    if (partnerBridge.ready) hidePartnerFallback();
    const orbit = { position: 0, spin: 0, spinBlur: 0, collapse: 0 };
    const orbitDirection = rtl ? -1 : 1;
    const front = new THREE.Vector3(0, 0, 1);
    const ringRadius = .8595;
    const ringHeight = .5111;
    const spherePoints = [
      new THREE.Vector3(0, ringHeight, ringRadius),
      new THREE.Vector3(ringRadius, ringHeight, 0),
      new THREE.Vector3(0, ringHeight, -ringRadius),
      new THREE.Vector3(-ringRadius, ringHeight, 0),
      new THREE.Vector3(ringRadius / Math.SQRT2, -ringHeight, ringRadius / Math.SQRT2),
      new THREE.Vector3(ringRadius / Math.SQRT2, -ringHeight, -ringRadius / Math.SQRT2),
      new THREE.Vector3(-ringRadius / Math.SQRT2, -ringHeight, -ringRadius / Math.SQRT2),
      new THREE.Vector3(-ringRadius / Math.SQRT2, -ringHeight, ringRadius / Math.SQRT2),
    ].map((point) => point.normalize());
    const focusOrder = [0, 3, 6, 1, 5, 4, 2, 7];
    const anchors = cards.map((_, index) => spherePoints[focusOrder[index % focusOrder.length]]);
    const rotations = anchors.map((anchor) => new THREE.Quaternion().setFromUnitVectors(anchor, front));
    const sphereRotation = new THREE.Quaternion();
    const transitionRotation = new THREE.Quaternion();
    const transitionEuler = new THREE.Euler();
    const spherePosition = new THREE.Vector3();
    const cameraMotion = { targetX: 0, targetY: 0, x: 0, y: 0, elapsed: 0 };
    const renderOrbit = () => {
      const count = Math.max(1, cards.length);
      const safePosition = Math.max(0, Math.min(count - 1, orbit.position));
      const previousIndex = Math.floor(safePosition);
      const nextIndex = Math.min(count - 1, previousIndex + 1);
      const mix = safePosition - previousIndex;
      const easedMix = mix * mix * (3 - 2 * mix);
      sphereRotation.copy(rotations[previousIndex]).slerp(rotations[nextIndex], easedMix);
      transitionEuler.set(
        orbit.spin * Math.PI * 1.6,
        orbit.spin * Math.PI * 3.5 * orbitDirection,
        orbit.spin * Math.PI * 1.1 * orbitDirection,
      );
      transitionRotation.setFromEuler(transitionEuler);
      sphereRotation.premultiply(transitionRotation);
      cards.forEach((card, index) => {
        spherePosition.copy(anchors[index]).applyQuaternion(sphereRotation);
        const depth = (spherePosition.z + 1) / 2;
        const spread = 1 - orbit.collapse;
        const cameraDepth = .38 + depth * .62;
        const breathX = Math.sin(cameraMotion.elapsed * .54) * .7;
        const breathY = Math.cos(cameraMotion.elapsed * .43 + .8) * .55;
        const x = spherePosition.x * (mobile ? 59 : 78) * orbitDirection * spread
          + (cameraMotion.x * 2.8 + breathX) * cameraDepth * spread;
        const y = -spherePosition.y * (mobile ? 47 : 64) * spread
          + (cameraMotion.y * 2 + breathY) * cameraDepth * spread;
        const z = (spherePosition.z - 1) * (mobile ? 620 : 950) * spread;
        const sphereScale = (mobile ? .82 : 1) * (.28 + depth * .72);
        const breathingScale = 1 + Math.sin(cameraMotion.elapsed * .48 + depth * .7) * .007 * spread;
        const scale = (sphereScale + ((mobile ? .04 : .022) - sphereScale) * orbit.collapse) * breathingScale;
        const depthBlur = depth > .82 ? 0 : depth > .6 ? (mobile ? 2.5 : 3.5) : depth > .34 ? (mobile ? 6 : 9) : mobile ? 10 : 15;
        const blur = (depthBlur + orbit.spinBlur * (mobile ? 13 : 19)) * (1 - orbit.collapse);
        card.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(2)}vw, ${y.toFixed(2)}svh, ${z.toFixed(2)}px) scale(${scale.toFixed(4)})`;
        card.style.filter = `blur(${blur.toFixed(2)}px) grayscale(${orbit.collapse.toFixed(3)}) saturate(${(1 - orbit.spinBlur * .38).toFixed(2)}) brightness(${(1 - orbit.collapse * .985).toFixed(3)})`;
        card.style.opacity = String(.14 + depth * .86);
        card.style.zIndex = String(Math.round(depth * 100));
      });
    };
    const renderPartnerWheel = () => {
      const count = Math.max(1, partnerCards.length);
      const fold = THREE.MathUtils.clamp(partnerWheel.fold, 0, 1);
      const handoff = THREE.MathUtils.clamp(partnerWheel.handoff, 0, 1);
      const fanCenterOffset = (mobile ? -2 : -3.5)
        * partnerWheel.spread
        * (1 - partnerWheel.ring)
        * (1 - fold);
      const retreat = partnerWheel.retreat;
      const smooth = (value: number) => value * value * (3 - 2 * value);
      const openingLeg = THREE.MathUtils.clamp(retreat / .12, 0, 1);
      const mosaicLeg = THREE.MathUtils.clamp((retreat - .12) / .62, 0, 1);
      const gateLeg = THREE.MathUtils.clamp((retreat - .74) / .23, 0, 1);
      const cameraStart = mobile ? 8.5 : 8;
      const cameraTravel = retreat <= .12
        ? smooth(openingLeg) * 5
        : retreat <= .74
          ? 5 + smooth(mosaicLeg) * 67
          : 72 + smooth(gateLeg) * 40;
      const retreatScale = cameraStart / (cameraStart + cameraTravel);
      partnerScene.style.transform = `translate3d(${fanCenterOffset.toFixed(2)}vw, 0, 0) scale(${retreatScale.toFixed(5)})`;
      if (partnerFallback) {
        const fallbackReveal = smooth(THREE.MathUtils.clamp((retreat - .035) / .045, 0, 1));
        const fallbackExit = 1 - smooth(THREE.MathUtils.clamp((retreat - .8) / .08, 0, 1));
        const fallbackOpacity = partnerBridge.ready ? 0 : fallbackReveal * fallbackExit;
        partnerFallback.style.opacity = String(fallbackOpacity);
        partnerFallback.style.visibility = fallbackOpacity > .001 ? "visible" : "hidden";
      }
      partnerBridge.progress = partnerWheel.retreat;
      partnerBridge.invalidate?.();
      partnerCards.forEach((card, index) => {
        const stagger = index === 0 ? 0 : index / Math.max(1, count - 1) * .28;
        const localSpread = THREE.MathUtils.clamp((partnerWheel.spread - stagger) / Math.max(.01, 1 - stagger), 0, 1);
        const foldDelay = index / Math.max(1, count - 1) * .2;
        const localFold = smooth(THREE.MathUtils.clamp(
          (fold - foldDelay) / Math.max(.01, 1 - foldDelay),
          0,
          1,
        ));
        const fanAngle = THREE.MathUtils.degToRad(-20 - index / Math.max(1, count - 1) * 140);
        const ringAngle = -Math.PI / 2 - index / count * Math.PI * 2 + partnerWheel.rotation * orbitDirection;
        const angle = THREE.MathUtils.lerp(fanAngle, ringAngle, partnerWheel.ring);
        const fanDepth = 1 - index / count;
        const ringDepth = (Math.sin(angle) + 1) / 2;
        const frontalRingDepth = THREE.MathUtils.lerp(.5, ringDepth, .35);
        const depth = THREE.MathUtils.lerp(fanDepth, frontalRingDepth, partnerWheel.ring);
        const radiusX = THREE.MathUtils.lerp(mobile ? 22 : 21, mobile ? 32 : 30, partnerWheel.ring);
        const radiusY = THREE.MathUtils.lerp(mobile ? 20 : 18, mobile ? 27 : 25, partnerWheel.ring);
        const ringX = Math.cos(angle) * radiusX * localSpread;
        const ringY = Math.sin(angle) * radiusY * localSpread;
        const ringZ = (-110 + depth * 220) * localSpread;
        const x = THREE.MathUtils.lerp(ringX, 0, localFold);
        const y = THREE.MathUtils.lerp(ringY, 0, localFold);
        const z = THREE.MathUtils.lerp(ringZ, index === 0 ? 18 : -index * 2.2, localFold);
        const ringScale = index === 0 && localSpread < .01
          ? .82 + partnerWheel.entry * .18
          : .88 + depth * .12;
        const scale = THREE.MathUtils.lerp(ringScale, index === 0 ? 1.025 : 1, localFold);
        const morph = index === 0
          ? partnerWheel.entry * partnerWheel.entry * (3 - 2 * partnerWheel.entry)
          : 1;
        const dotScaleX = 12 / partnerCardSizes[index].width;
        const dotScaleY = 12 / partnerCardSizes[index].height;
        const scaleX = index === 0 ? THREE.MathUtils.lerp(dotScaleX, scale, morph) : scale;
        const scaleY = index === 0 ? THREE.MathUtils.lerp(dotScaleY, scale, morph) : scale;
        const ringOpacity = index === 0
          ? partnerWheel.entry
          : localSpread * (.72 + depth * .28);
        const foldedAway = smooth(THREE.MathUtils.clamp((localFold - .7) / .3, 0, 1));
        const opacity = index === 0
          ? ringOpacity * (1 - smooth(handoff))
          : ringOpacity * (1 - foldedAway);
        const foldArc = Math.sin(localFold * Math.PI);
        const rotateX = Math.sin(angle) * foldArc * -9;
        const rotateY = Math.cos(angle) * foldArc * 18;
        const rotateZ = Math.sin(angle * 1.7) * foldArc * 3;
        card.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(2)}vw, ${y.toFixed(2)}svh, ${z.toFixed(1)}px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) rotateZ(${rotateZ.toFixed(2)}deg) scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)})`;
        card.style.opacity = String(opacity);
        card.style.zIndex = String(index === 0 && fold > .5 ? 200 : Math.round(depth * 100) - index);
        const cardBlur = (1 - depth) * 1.1 * localSpread * (1 - localFold);
        card.style.filter = cardBlur < .01 ? "none" : `blur(${cardBlur.toFixed(2)}px)`;
        if (index === 0) {
          const surfaceMorph = THREE.MathUtils.clamp((morph - .22) / .58, 0, 1);
          const outlineRelease = THREE.MathUtils.clamp((morph - .7) / .3, 0, 1);
          const surface = Math.round(17 + (249 - 17) * surfaceMorph);
          card.style.clipPath = "none";
          card.style.backgroundColor = `rgb(${surface}, ${surface}, ${Math.max(17, surface - 5)})`;
          card.style.borderColor = `rgba(22, 25, 29, ${(1 - outlineRelease * .92).toFixed(3)})`;
          card.style.borderWidth = `${THREE.MathUtils.lerp(3, 1, morph).toFixed(2)}px`;
          card.style.borderRadius = `${THREE.MathUtils.lerp(999, mobile ? 18 : 28, morph).toFixed(1)}px`;
          card.style.setProperty("--card-content-opacity", String(THREE.MathUtils.clamp((morph - .7) / .3, 0, 1)));
        }
      });
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      cameraMotion.targetX = THREE.MathUtils.clamp((event.clientX / window.innerWidth) * 2 - 1, -1, 1);
      cameraMotion.targetY = THREE.MathUtils.clamp((event.clientY / window.innerHeight) * 2 - 1, -1, 1);
      serviceBridge.pointerX = cameraMotion.targetX;
      serviceBridge.pointerY = cameraMotion.targetY;
      if (serviceBridge.active) serviceBridge.invalidate?.();
    };
    const resetPointer = () => {
      cameraMotion.targetX = 0;
      cameraMotion.targetY = 0;
      serviceBridge.pointerX = 0;
      serviceBridge.pointerY = 0;
      if (serviceBridge.active) serviceBridge.invalidate?.();
    };
    let motionFrame = 0;
    let previousFrame = performance.now();
    const animateCamera = (time: number) => {
      const delta = Math.min((time - previousFrame) / 1000, .05);
      previousFrame = time;
      cameraMotion.elapsed += delta;
      const damping = 1 - Math.exp(-delta * 4.5);
      cameraMotion.x += (cameraMotion.targetX - cameraMotion.x) * damping;
      cameraMotion.y += (cameraMotion.targetY - cameraMotion.y) * damping;
      renderOrbit();
      motionFrame = requestAnimationFrame(animateCamera);
    };
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("blur", resetPointer);
    motionFrame = requestAnimationFrame(animateCamera);
    const handoffDuration = mobile ? heroEnding.mobile.duration : heroEnding.desktop.duration;
    const handoffEase = (value: number) => value * value * (3 - 2 * value);
    const ctx = gsap.context(() => {
      gsap.set("[data-layer], [data-project-copy]", { autoAlpha: 0 });
      gsap.set("[data-journey-surface]", {
        yPercent: 100,
        clipPath: "polygon(0% 10%, 12.5% 6%, 25% 3%, 37.5% 1%, 50% 0%, 62.5% 1%, 75% 3%, 87.5% 6%, 100% 10%, 100% 100%, 0% 100%)",
      });
      gsap.set("[data-world]", { autoAlpha: 1 });
      gsap.set("[data-projects-world]", { autoAlpha: 1 });
      gsap.set("[data-about]", { autoAlpha: 1 });
      gsap.set("[data-about-backdrop], [data-about-kicker], [data-about-link]", { autoAlpha: 0 });
      gsap.set("[data-services-copy-shell]", { autoAlpha: 0 });
      gsap.set("[data-partners]", { autoAlpha: 0 });
      gsap.set("[data-partners-kicker], [data-partner-center]", { autoAlpha: 0 });
      gsap.set("[data-partner-scene]", { autoAlpha: 1 });
      gsap.set("[data-finale-kicker], [data-final-title], [data-final-cta]", { autoAlpha: 0 });
      if (logoFallback) gsap.set(logoFallback, { opacity: 0 });
      typingBase.textContent = "";
      typingWord.textContent = "";
      const projectTitles = Array.from(node.querySelectorAll<HTMLElement>("[data-project-title]"));
      projectTitles.forEach((title) => { title.textContent = ""; });
      serviceText.forEach(({ title, description }) => {
        title.textContent = "";
        description.textContent = "";
      });
      [aboutKickerText, aboutLinkText, partnerKickerText, partnerCenterText, finaleKickerText, finaleTitleText, finaleCtaText].forEach((element) => {
        element.textContent = "";
      });
      gsap.set(typingCursor, { autoAlpha: 0, width: 12, height: 12, x: 0, borderRadius: "50%" });
      gsap.set("[data-seam]", { scaleX: 0, autoAlpha: 0 });
      renderOrbit();
      renderPartnerWheel();
      let partnerWarmupAt = Number.POSITIVE_INFINITY;
      let activeService = -1;
      const renderServices = () => {
        const motion = getServicesMotionState(serviceBridge.progress);
        const index = motion.index;
        servicesLayer.style.setProperty("--services-scale", String(motion.scale));
        servicesLayer.style.setProperty("--services-presence", String(motion.entry * (1 - motion.exit)));
        servicesLayer.style.setProperty("--services-color-reveal", String(getServicesColorReveal(motion)));
        node.dataset.serviceProgress = serviceBridge.progress.toFixed(4);
        serviceText.forEach(({ panel, title, description, titleCharacters, descriptionCharacters }, serviceIndex) => {
          const writing = serviceWritingProgress(serviceBridge.progress, serviceIndex);
          const titleCount = Math.round(writing.title * titleCharacters.length);
          const descriptionCount = Math.round(writing.description * descriptionCharacters.length);
          const nextTitle = titleCharacters.slice(0, titleCount).join("");
          const nextDescription = descriptionCharacters.slice(0, descriptionCount).join("");
          if (title.textContent !== nextTitle) title.textContent = nextTitle;
          if (description.textContent !== nextDescription) description.textContent = nextDescription;
          panel.dataset.titleWriting = String(titleCount > 0 && titleCount < titleCharacters.length);
          panel.dataset.descriptionWriting = String(descriptionCount > 0 && descriptionCount < descriptionCharacters.length);
        });
        if (index !== activeService) {
          activeService = index;
          setActiveServiceIndex(index);
        }
        serviceBridge.invalidate?.();
      };
      const tl = gsap.timeline({ defaults: { ease: "power3.inOut" }, onUpdate() {
        const time = this.time();
        publishHandoff(handoffEase(Math.min(1, time / handoffDuration)));
        node.dataset.journeyProgress = this.progress().toFixed(4);
        node.dataset.journeyPhase = time >= this.labels.Finale ? "finale"
          : time >= this.labels.Partners ? "partners"
            : time >= this.labels.About ? "about"
              : time >= this.labels.ServicesEntry ? "services" : "projects";
        const active = time >= this.labels.ServicesEntry && time < this.labels.About;
        if (active !== serviceBridge.active) {
          serviceBridge.active = active;
          serviceBridge.invalidate?.();
        }
        if (time >= partnerWarmupAt && !partnerCanvasMountedRef.current) {
          partnerCanvasMountedRef.current = true;
          setPartnerCanvasMounted(true);
        }
        if (time > .6) document.documentElement.dataset.mandegarTone = "light";
        else delete document.documentElement.dataset.mandegarTone;
      }, scrollTrigger: {
        trigger: node, start: "top top", end: "bottom bottom", scrub: heroEnding.scrub,
        onUpdate: self => {
          node.style.setProperty("--journey-progress", String(self.progress));
        },
        onLeaveBack: () => { delete document.documentElement.dataset.mandegarTone; },
      } });
      const typeText = (target: HTMLElement, text: string, at: number, speed = .045, maximum = 1.15) => {
        const characters = Array.from(text);
        const state = { count: 0 };
        const duration = Math.min(maximum, Math.max(.32, characters.length * speed));
        tl.set(target, { autoAlpha: 1 }, at)
          .to(state, {
            count: characters.length,
            duration,
            ease: `steps(${Math.max(1, characters.length)})`,
            onUpdate: () => {
              target.textContent = characters.slice(0, Math.round(state.count)).join("");
            },
          }, at);
        return duration;
      };
      const eraseText = (target: HTMLElement, text: string, at: number, speed = .032, maximum = .82) => {
        const characters = Array.from(text);
        const state = { count: characters.length };
        const duration = Math.min(maximum, Math.max(.26, characters.length * speed));
        tl.to(state, {
          count: 0,
          duration,
          ease: `steps(${Math.max(1, characters.length)})`,
          onUpdate: () => {
            target.textContent = characters.slice(0, Math.round(state.count)).join("");
          },
        }, at);
        return duration;
      };
      const revealProject = (index: number, at: number) => {
        const project = chapter(index);
        const projectTitle = projectTitles[index];
        tl.set(project, { autoAlpha: 1 }, at)
          .set(projectTitle, { autoAlpha: 1 }, at);
        return at + .02 + typeText(projectTitle, selected[index].title, at + .02, .038, .92);
      };
      const dismissProject = (index: number, at: number) => {
        const project = chapter(index);
        const projectTitle = projectTitles[index];
        const duration = eraseText(projectTitle, selected[index].title, at, .027, .58);
        tl.set(project, { autoAlpha: 0 }, at + duration + .02);
      };
      // Preserve the original entrance and reading time after the camera ends.
      tl.addLabel("Entry", 0)
        .to("[data-journey-surface]", {
          yPercent: 0,
          clipPath: "polygon(0% 0%, 12.5% 0%, 25% 0%, 37.5% 0%, 50% 0%, 62.5% 0%, 75% 0%, 87.5% 0%, 100% 0%, 100% 100%, 0% 100%)",
          duration: handoffDuration,
          ease: handoffEase,
        }, 0);

      let cursor = handoffDuration - .38;
      selected.forEach((_, index) => {
        if (index > 0) {
          dismissProject(index - 1, cursor - .54);
          tl.to(orbit, { position: index, duration: 1.15, ease: "power3.inOut", onUpdate: renderOrbit }, cursor - .42);
          cursor += 1.08;
        }
        tl.addLabel(`Project${index + 1}`, cursor);
        const revealedAt = revealProject(index, cursor - .08);
        if (index === 0) tl.addLabel("Work", Math.max(handoffDuration, revealedAt) + .02);
        cursor += mobile ? 1.45 : 1.65;
      });
      tl.addLabel("Projects", tl.labels.Project1);
      const last = selected.length - 1;
      tl.addLabel("LastProjectRead", tl.labels[`Project${selected.length}`] + .98);
      dismissProject(last, cursor - .2);
      tl.fromTo(typingCursor, {
          autoAlpha: 0,
          scale: .15,
        }, {
          autoAlpha: 1,
          scale: 1,
          duration: .52,
          ease: "power2.in",
        }, cursor + 1.72)
        .to(orbit, {
          spin: .08,
          duration: .6,
          ease: "power1.in",
          onUpdate: renderOrbit,
        }, cursor - .12)
        .to(orbit, {
          spin: 1,
          spinBlur: 1,
          duration: 1.62,
          ease: "expo.in",
          onUpdate: renderOrbit,
        }, cursor + .48)
        .to(orbit, {
          collapse: 1,
          duration: 1.52,
          ease: "power3.in",
          onUpdate: renderOrbit,
        }, cursor + .58)
        .set("[data-about-backdrop]", { autoAlpha: 1 }, cursor + 2.12)
        .set("[data-projects-world]", { autoAlpha: 0 }, cursor + 2.12);

      const servicesStart = cursor + 2.12;
      const servicesDuration = mobile ? 8 : 9;
      const servicesEnd = servicesStart + servicesDuration;
      tl.addLabel("ProjectsServicesStart", cursor + .58)
        .addLabel("ProjectsServicesMid", cursor + 1.35)
        .addLabel("ProjectsServicesEnd", servicesStart + servicesDuration * .12)
        .addLabel("ServicesEntry", servicesStart)
        .addLabel("Services", servicesStart + servicesDuration * SERVICE_POSES[0])
        .set("[data-services]", { autoAlpha: 1 }, servicesStart)
        .to(serviceBridge, {
          progress: 1,
          duration: servicesDuration,
          ease: "none",
          onUpdate: renderServices,
        }, servicesStart)
        .to(typingCursor, { autoAlpha: 0, duration: .58, ease: "power2.inOut" }, servicesStart + .22)
        .to("[data-services-copy-shell]", { autoAlpha: 1, duration: .48, ease: "power2.out" }, servicesStart + servicesDuration * .05)
        .addLabel("ServicesExit", servicesStart + servicesDuration * .9)
        .addLabel("ServicesAboutStart", servicesStart + servicesDuration * .9)
        .addLabel("ServicesAboutMid", servicesEnd - .16)
        .to("[data-services-copy-shell]", { autoAlpha: 0, duration: .48, ease: "power2.in" }, servicesStart + servicesDuration * .9)
        .to(typingCursor, { autoAlpha: 1, scale: 1, duration: .35, ease: "power2.out" }, servicesStart + servicesDuration * .945)
        .set("[data-services]", { autoAlpha: 0 }, servicesEnd);
      SERVICE_POSES.forEach((progress, index) => {
        tl.addLabel(`Service${index + 1}`, servicesStart + servicesDuration * progress);
      });

      // Resume the original dot-to-cursor transition after the services platform closes.
      cursor = servicesEnd - 2.12;
      tl
        .addLabel("About", cursor + 2.12)
        .to(typingCursor, { autoAlpha: .18, duration: .12, ease: "none" }, cursor + 2.2)
        .to(typingCursor, { autoAlpha: 1, duration: .12, ease: "none" }, cursor + 2.32)
        .to(typingCursor, { autoAlpha: .18, duration: .12, ease: "none" }, cursor + 2.5)
        .to(typingCursor, { autoAlpha: 1, duration: .12, ease: "none" }, cursor + 2.62)
        .to(typingCursor, {
          width: 3,
          height: mobile ? 36 : 64,
          borderRadius: 2,
          duration: .28,
          ease: "power2.inOut",
        }, cursor + 2.76);

      let typingCursorTime = cursor + 3.12;
      const baseCharacters = Array.from(typing.base);
      const baseState = { count: 0 };
      tl.to(baseState, {
        count: baseCharacters.length,
        duration: Math.max(.8, baseCharacters.length * .095),
        ease: `steps(${Math.max(1, baseCharacters.length)})`,
        onUpdate: () => {
          typingBase.textContent = baseCharacters.slice(0, Math.round(baseState.count)).join("");
        },
      }, typingCursorTime);
      typingCursorTime += Math.max(.8, baseCharacters.length * .095) + .18;

      const wordLooks = [
        { color: "#225cff", fontFamily: "var(--font-sans)", fontWeight: 780, fontStyle: "normal" },
        { color: "#d24f35", fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 650, fontStyle: "italic" },
        { color: "#14856f", fontFamily: "'Courier New', monospace", fontWeight: 700, fontStyle: "normal" },
        { color: "#7145c9", fontFamily: "var(--font-sans)", fontWeight: 850, fontStyle: "normal" },
      ];
      typing.words.forEach((word, wordIndex) => {
        const characters = Array.from(word);
        const writeState = { count: 0 };
        tl.set(typingWord, wordLooks[wordIndex % wordLooks.length], typingCursorTime)
          .to(writeState, {
          count: characters.length,
          duration: Math.max(.48, characters.length * .105),
          ease: `steps(${Math.max(1, characters.length)})`,
          onUpdate: () => {
            typingWord.textContent = characters.slice(0, Math.round(writeState.count)).join("");
          },
        }, typingCursorTime);
        typingCursorTime += Math.max(.48, characters.length * .105);
        tl.addLabel(`About${wordIndex + 1}`, typingCursorTime);
        if (wordIndex === 0) {
          tl.addLabel("AboutRead", typingCursorTime)
            .addLabel("ServicesAboutEnd", typingCursorTime);
          tl.set("[data-about-kicker], [data-about-link]", { autoAlpha: 1 }, typingCursorTime - .28);
          typeText(aboutKickerText, `03 / ${ui.aboutLabel}`, typingCursorTime - .28, .035, .92);
          typeText(aboutLinkText, ui.more, typingCursorTime - .18, .04, .88);
        }
        typingCursorTime += mobile ? .66 : .82;
        if (wordIndex < typing.words.length - 1) {
          const eraseState = { count: characters.length };
          tl.to(eraseState, {
            count: 0,
            duration: Math.max(.38, characters.length * .075),
            ease: `steps(${Math.max(1, characters.length)})`,
            onUpdate: () => {
              typingWord.textContent = characters.slice(0, Math.round(eraseState.count)).join("");
            },
          }, typingCursorTime);
          typingCursorTime += Math.max(.38, characters.length * .075) + .16;
        }
      });
      const finalWord = typing.words[typing.words.length - 1];
      const finalCharacters = Array.from(finalWord);
      const eraseFinalState = { count: finalCharacters.length };
      tl.to(eraseFinalState, {
        count: 0,
        duration: Math.max(.38, finalCharacters.length * .075),
        ease: `steps(${Math.max(1, finalCharacters.length)})`,
        onUpdate: () => {
          typingWord.textContent = finalCharacters.slice(0, Math.round(eraseFinalState.count)).join("");
        },
      }, typingCursorTime);
      eraseText(aboutKickerText, `03 / ${ui.aboutLabel}`, typingCursorTime + .05, .025, .7);
      eraseText(aboutLinkText, ui.more, typingCursorTime + .08, .03, .68);
      tl.set("[data-about-kicker], [data-about-link]", { autoAlpha: 0 }, typingCursorTime + .82);
      typingCursorTime += Math.max(.38, finalCharacters.length * .075) + .12;

      const eraseBaseState = { count: baseCharacters.length };
      tl.to(eraseBaseState, {
        count: 0,
        duration: Math.max(.72, baseCharacters.length * .07),
        ease: `steps(${Math.max(1, baseCharacters.length)})`,
        onUpdate: () => {
          typingBase.textContent = baseCharacters.slice(0, Math.round(eraseBaseState.count)).join("");
        },
      }, typingCursorTime)
        .to(typingCursor, {
          width: 12,
          height: 12,
          borderRadius: "50%",
          duration: .32,
          ease: "power2.inOut",
        }, typingCursorTime + Math.max(.72, baseCharacters.length * .07) - .08);

      const partnerStart = typingCursorTime + Math.max(.72, baseCharacters.length * .07) + .38;
      const foldStart = partnerStart + 7.9;
      const mosaicStart = foldStart + 1.9;
      partnerWarmupAt = Math.max(0, partnerStart - 4.8);
      tl.set("[data-partners]", { autoAlpha: 1 }, partnerStart)
        .set("[data-about]", { autoAlpha: 0 }, partnerStart + .12)
        .to(typingCursor, { autoAlpha: 0, scale: .35, duration: .24 }, partnerStart)
        .to(partnerWheel, {
          entry: 1,
          duration: 1.25,
          ease: "power3.out",
          onUpdate: renderPartnerWheel,
        }, partnerStart)
        .addLabel("Partners", partnerStart + .75)
        .to(partnerWheel, {
          spread: 1,
          duration: 1.85,
          ease: "power3.inOut",
          onUpdate: renderPartnerWheel,
        }, partnerStart + 1.05)
        .to(partnerWheel, {
          ring: 1,
          duration: 1.7,
          ease: "power3.inOut",
          onUpdate: renderPartnerWheel,
        }, partnerStart + 2.72)
        .set("[data-partner-center]", { autoAlpha: 1 }, partnerStart + 3.48)
        .set("[data-partners-kicker]", { autoAlpha: 1 }, partnerStart + 3.62);
      typeText(partnerCenterText, ui.partnersLabel, partnerStart + 3.48, .07, 1.05);
      typeText(partnerKickerText, `04 / ${ui.partnersLabel}`, partnerStart + 3.62, .035, .9);
      tl.to(partnerWheel, {
        rotation: Math.PI / 2,
        duration: 3.25,
        ease: "none",
        onUpdate: renderPartnerWheel,
      }, partnerStart + 4.5);
      eraseText(partnerCenterText, ui.partnersLabel, foldStart, .045, .72);
      eraseText(partnerKickerText, `04 / ${ui.partnersLabel}`, foldStart + .06, .028, .72);

      tl.to("[data-partner-center], [data-partners-kicker]", { autoAlpha: 0, duration: .28 }, foldStart + .38)
        .to(partnerWheel, {
          fold: 1,
          duration: 1.55,
          ease: "power3.inOut",
          onUpdate: renderPartnerWheel,
        }, foldStart)
        .to(partnerWheel, {
          retreat: 1,
          duration: 9.4,
          ease: "none",
          onUpdate: renderPartnerWheel,
        }, mosaicStart)
        .to(partnerWheel, {
          handoff: 1,
          duration: .55,
          ease: "power2.inOut",
          onUpdate: renderPartnerWheel,
        }, mosaicStart + .42)
        .set("[data-partner-scene]", { autoAlpha: 0 }, mosaicStart + 1.06)
        .addLabel("LogoPass", mosaicStart + 7.55);
      if (logoFallback) tl.fromTo(logoFallback, {
          opacity: 0,
          scale: 1.02,
        }, {
          opacity: 1,
          scale: 1,
          duration: 1.05,
          ease: "power2.out",
        }, mosaicStart + 8.88);
      tl.addLabel("Finale", mosaicStart + 8.88);
      tl.set("[data-finale-kicker]", { autoAlpha: 1 }, mosaicStart + 9.28)
        .set("[data-final-title]", { autoAlpha: 1 }, mosaicStart + 9.75)
        .set("[data-final-cta]", { autoAlpha: 1 }, mosaicStart + 10.2);
      typeText(finaleKickerText, "05 / MANDEGAR", mosaicStart + 9.28, .045, .8);
      typeText(finaleTitleText, ui.finale, mosaicStart + 9.75, .052, 1.25);
      typeText(finaleCtaText, ui.contact, mosaicStart + 10.2, .045, .92);
      tl.addLabel("Contact", mosaicStart + 11.12);
      tl.to({}, { duration: 1.5 });
      node.style.setProperty("--journey-height", `${Math.ceil(tl.duration() * heroEnding.scrollVhPerUnit + 100)}svh`);
      node.dataset.handoffDuration = String(handoffDuration);
      node.dataset.journeyDuration = String(tl.duration());
      node.dataset.journeyLabels = JSON.stringify(Object.fromEntries(
        Object.entries(tl.labels).map(([label, time]) => [label, time / tl.duration()]),
      ));
      seekToLabel = (label: string) => {
        const trigger = tl.scrollTrigger;
        if (!trigger || tl.labels[label] === undefined) return;
        const currentTop = node.getBoundingClientRect().top + window.scrollY;
        const currentTravel = node.clientHeight - window.innerHeight;
        if (Math.abs(trigger.start - currentTop) > 1 || Math.abs(trigger.end - trigger.start - currentTravel) > 1) {
          ScrollTrigger.refresh();
        }
        const top = trigger.labelToScroll(label);
        const previousBehavior = document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = "auto";
        document.querySelector<HTMLElement>("[data-experience-root]")?.dispatchEvent(
          new CustomEvent("mandegar:seek", { detail: { top } }),
        );
        window.scrollTo({ top, left: 0, behavior: "auto" });
        ScrollTrigger.update();
        trigger.getTween()?.progress(1);
        tl.time(tl.labels[label], false);
        document.documentElement.style.scrollBehavior = previousBehavior;
      };
      jumpToWork = () => {
        seekToLabel?.("Work");
        focusWork();
      };
    }, node);
    const refresh = requestAnimationFrame(() => {
      ScrollTrigger.refresh();
      if (jumpToWork) onWorkReady?.(jumpToWork);
    });
    return () => {
      onWorkReady?.(null);
      node.removeEventListener("mandegar:journey-seek", handleJourneySeek);
      cancelAnimationFrame(refresh);
      cancelAnimationFrame(motionFrame);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("blur", resetPointer);
      ctx.revert();
      publishHandoff(0);
      partnerScene.style.removeProperty("transform");
      partnerScene.style.removeProperty("z-index");
      partnerFallback?.style.removeProperty("opacity");
      partnerFallback?.style.removeProperty("visibility");
      partnerBridge.progress = 0;
      if (partnerBridge.onReady === hidePartnerFallback) {
        partnerBridge.onReady = undefined;
      }
      partnerBridge.invalidate?.();
      serviceBridge.progress = 0;
      serviceBridge.active = false;
      serviceBridge.pointerX = 0;
      serviceBridge.pointerY = 0;
      serviceBridge.invalidate?.();
      serviceText.forEach(({ panel, title, description, titleCharacters, descriptionCharacters }) => {
        title.textContent = titleCharacters.join("");
        description.textContent = descriptionCharacters.join("");
        delete panel.dataset.titleWriting;
        delete panel.dataset.descriptionWriting;
      });
      servicesLayer.style.removeProperty("--services-scale");
      servicesLayer.style.removeProperty("--services-presence");
      servicesLayer.style.removeProperty("--services-color-reveal");
      delete node.dataset.journeyLabels;
      delete node.dataset.handoffDuration;
      delete node.dataset.journeyDuration;
      delete node.dataset.journeyProgress;
      delete node.dataset.journeyPhase;
      delete node.dataset.serviceProgress;
      partnerCards.forEach((card) => {
        card.style.removeProperty("transform");
        card.style.removeProperty("opacity");
        card.style.removeProperty("z-index");
        card.style.removeProperty("filter");
        card.style.removeProperty("clip-path");
        card.style.removeProperty("background-color");
        card.style.removeProperty("border-color");
        card.style.removeProperty("border-width");
        card.style.removeProperty("border-radius");
        card.style.removeProperty("--card-content-opacity");
      });
      Array.from(node.querySelectorAll<HTMLElement>("[data-project-title]")).forEach((title, index) => {
        title.textContent = selected[index]?.title || "";
      });
      aboutKickerText.textContent = `03 / ${ui.aboutLabel}`;
      aboutLinkText.textContent = ui.more;
      typingBase.textContent = typing.base;
      typingWord.textContent = typing.words[0];
      partnerKickerText.textContent = `04 / ${ui.partnersLabel}`;
      partnerCenterText.textContent = ui.partnersLabel;
      finaleKickerText.textContent = "05 / MANDEGAR";
      finaleTitleText.textContent = ui.finale;
      finaleCtaText.textContent = ui.contact;
      delete document.documentElement.dataset.mandegarTone;
    };
  }, [
    locale,
    logo,
    mobile,
    onWorkReady,
    partnerItems,
    reduced,
    selected,
    spatialEnabled,
    staticJourney,
    typing.base,
    typing.words,
    ui.aboutLabel,
    ui.contact,
    ui.finale,
    ui.more,
    ui.partnersLabel,
  ]);

  return <section ref={root} tabIndex={-1} className={styles.root}
    style={{ "--hero-ending-overlap-desktop": `${heroEnding.desktop.overlapVh}svh`, "--hero-ending-overlap-mobile": `${heroEnding.mobile.overlapVh}svh` } as CSSProperties}
    data-connected-journey data-post-experience data-motion={staticJourney ? "reduced" : "full"} data-active-service={activeServiceIndex} aria-label={ui.work}>
    <div className={styles.stage} data-journey-surface>
      <div className={styles.world} data-world data-layer aria-hidden="true"><span className={styles.orbit} /><span className={styles.worldRule} /></div>
      <div className={styles.projectsWorld} data-projects-world data-layer>
        <div className={styles.orbitTrack} data-project-orbit aria-hidden="true">
          {sphereProjects.map((project, index) => <div key={`${project.slug}-${index}`} className={styles.orbitCard} data-orbit-card={index}>
            <Image src={project.mediaSrc} alt="" fill priority={index === 0} sizes="(max-width: 760px) 76vw, 50vw" />
            <span className={styles.photoShade} />
          </div>)}
        </div>
      </div>
      {!selected.length ? <div className={styles.empty}><h2>{copy.projectTitle}</h2><p>{copy.projectsEmpty}</p></div> : null}
      {selected.map((project, index) => <article className={styles.projectCopy} key={project.slug} data-project-copy={index} data-layer>
        <div className={styles.titlePosition}>
          <Link href={localizedPath(locale, `projects/${project.slug}`)} aria-label={project.title}>
            <h2><span data-project-title>{project.title}</span><i className={styles.inlineCursor} aria-hidden="true" /></h2>
            <span className={styles.projectAction} data-project-action>{copy.viewProject}<span aria-hidden="true">{locale === "en" ? "↗" : "↖"}</span></span>
          </Link>
        </div>
        <Image className={styles.staticPhoto} src={project.mediaSrc} alt="" width={1200} height={800} />
      </article>)}

      <section className={styles.servicesLayer} tabIndex={-1} data-services data-layer aria-label={locale === "fa" ? "خدمات ما" : locale === "ar" ? "خدماتنا" : "Our services"}>
        {servicesCanvasMounted && servicesSpatialEnabled && !staticJourney ? <div className={styles.servicesScene} aria-hidden="true">
          <ServicesSceneCanvas bridge={servicesBridge} locale={locale} mobile={mobile} />
        </div> : null}
        <ServicesShowcase
          locale={locale}
          reduced={staticJourney}
          mobile={mobile}
          activeIndex={activeServiceIndex}
          spatialEnabled={servicesSpatialEnabled}
          sceneReady={serviceSceneReady}
        />
      </section>

      <section className={styles.about} tabIndex={-1} data-about data-layer aria-label={ui.aboutLabel}>
        <span className={styles.aboutBackdrop} data-about-backdrop aria-hidden="true" />
        <small className={styles.kicker} data-about-kicker><span data-about-kicker-text>03 / {ui.aboutLabel}</span><i className={styles.inlineCursor} aria-hidden="true" /></small>
        <div className={styles.aboutTyping}>
          <h2 className={styles.typingLine} data-typing-line aria-label={`${typing.base} ${typing.words.join(", ")}`}>
            <span className={styles.typingCopy} aria-hidden="true">
              <span className={styles.typingBase} data-typing-base>{typing.base}</span>
              <span className={styles.typingWord} data-typing-word>{typing.words[0]}</span>
            </span>
            <i className={styles.typingCursor} data-typing-cursor aria-hidden="true" />
          </h2>
        </div>
        <Link className={styles.aboutLink} data-about-link href={aboutHref || localizedPath(locale, "about")}><span data-about-link-text>{ui.more}</span><i className={styles.inlineCursor} aria-hidden="true" /><span aria-hidden="true">↗</span></Link>
      </section>
      <section className={styles.partners} data-partners data-layer aria-label={ui.partnersLabel}>
        <small className={styles.kicker} data-partners-kicker><span data-partners-kicker-text>04 / {ui.partnersLabel}</span><i className={styles.inlineCursor} aria-hidden="true" /></small>
        {firstPartnerImage ? <div className={styles.partnerFallback} data-partner-fallback aria-hidden="true">
          <Image
            src={firstPartnerImage.src}
            alt=""
            fill
            priority
            unoptimized
            crossOrigin="anonymous"
            sizes="100vw"
          />
        </div> : null}
        {partnerCanvasMounted && partnerMediaSeed !== null && spatialEnabled && !staticJourney ? <PartnerFinaleCanvas
          className={styles.partnerFinaleCanvas}
          bridge={partnerFinaleBridge}
          media={partnerFinaleMedia}
          mediaSeed={partnerMediaSeed}
          logoSrc={logo}
          mobile={mobile}
        /> : null}
        <div className={styles.partnerScene} data-partner-scene>
          <div className={styles.partnerWheel} data-partner-wheel>
            {partnerItems.map((client, index) => <article className={styles.partnerCard} data-partner-card={index} key={`${client.name}-${index}`}>
              <div className={styles.partnerLogo}>
                {client.logo
                  ? <Image src={client.logo} alt={client.name} width={360} height={160} sizes="(max-width: 760px) 54vw, 24vw" />
                  : <PrototypeLogo index={index} />}
              </div>
              <small>{client.name}</small>
            </article>)}
          </div>
          <h2 className={styles.partnerCenter} data-partner-center><span data-partner-center-text>{ui.partnersLabel}</span><i className={styles.inlineCursor} aria-hidden="true" />{clients.length === 0 ? <span className={styles.partnerConceptNote}>{ui.genericPartnersNote}</span> : null}</h2>
        </div>
        <small className={`${styles.kicker} ${styles.finaleKicker}`} data-finale-kicker><span data-finale-kicker-text>05 / MANDEGAR</span><i className={styles.inlineCursor} aria-hidden="true" /></small>
        {(!spatialEnabled || staticJourney) ? <div className={styles.logo} data-logo-fallback role="img" aria-label="Mandegar">
          <span style={{ WebkitMaskImage: `url("${logo}")`, maskImage: `url("${logo}")` } as CSSProperties} />
        </div> : null}
        <div className={styles.finaleDetail}><h2 data-final-title aria-label={ui.finale}><span data-finale-title-text>{ui.finale}</span><i className={styles.inlineCursor} aria-hidden="true" /></h2><Link data-final-cta href={localizedPath(locale, "contact")}><span data-finale-cta-text>{ui.contact}</span><i className={styles.inlineCursor} aria-hidden="true" /><span aria-hidden="true">↗</span></Link></div>
        {/* The previous paged logo grid stays out of this motion prototype.
        <div className={styles.partnerViewport}>{partnerPages.map((page, pageIndex) => <div className={styles.partnerPage} data-partner-page={pageIndex} data-layer key={pageIndex}>
          <div className={styles.partnerGrid}>{page.map((client: JourneyClient, index) => <div className={styles.partnerCell} data-partner-cell key={`${client.name}-${index}`}>
            {client.logo ? <Image src={client.logo} alt={client.name} width={240} height={100} sizes="(max-width: 760px) 38vw, 20vw" /> : <><span>{String(pageIndex * pageSize + index + 1).padStart(2, "0")}</span><small>{clients.length ? client.name : ui.placeholder}</small></>}
          </div>)}</div>
          <span className={styles.partnerRange}>{String(pageIndex * pageSize + 1).padStart(2, "0")}—{String(Math.min((pageIndex + 1) * pageSize, partnerItems.length)).padStart(2, "0")} / {String(partnerItems.length).padStart(2, "0")}</span>
        </div>)}</div>
        {partnerPages.length > 1 && <nav className={styles.partnerNav} aria-label={ui.partnersLabel}>{partnerPages.map((_, index) => <button key={index} type="button" onClick={() => jump(`Partners${index + 1}`)}>{String(index + 1).padStart(2, "0")}</button>)}</nav>}
        */}
      </section>
      <span className={styles.seam} data-seam aria-hidden="true" />
      <div className={styles.entry} data-entry data-layer aria-hidden="true"><small>MANDEGAR / 01</small><p><MaskedWords text={ui.entry} marker="entry" /></p></div>
    </div>
  </section>;
}
