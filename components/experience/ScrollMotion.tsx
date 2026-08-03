"use client";

import Lenis from "lenis";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type CSSProperties, useRef } from "react";
import { experienceState } from "./experience-state";

gsap.registerPlugin(ScrollTrigger);

const storyStages = ["spark", "idea", "space", "capability", "event", "proof", "interaction", "intelligence", "trust", "memory", "invitation"];

export function ScrollMotion({ children, lenisEnabled = false }: { children: React.ReactNode; lenisEnabled?: boolean }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const root = scope.current;
    if (!root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
    const supportsSmooth = window.matchMedia("(pointer: fine)").matches;
    let smooth: Lenis | undefined;
    let lenisTick: ((time: number) => void) | undefined;
    let lenisScroll: (() => void) | undefined;

    if (lenisEnabled && !reduced && !saveData && supportsSmooth) {
      smooth = new Lenis({ autoRaf: false, smoothWheel: true, syncTouch: false, lerp: 0.08 });
      lenisScroll = () => ScrollTrigger.update();
      smooth.on("scroll", lenisScroll);
      lenisTick = (time) => smooth?.raf(time * 1000);
      gsap.ticker.add(lenisTick);
    }

    const syncStoryStage = (progress: number) => {
      const stages: Array<[number, string]> = [[0, "spark"], [.11, "idea"], [.235, "space"], [.35, "capability"], [.45, "event"], [.56, "proof"], [.70, "interaction"], [.80, "intelligence"], [.875, "trust"], [.925, "memory"], [.975, "invitation"]];
      root.dataset.storyStage = stages.reduce((active, [start, stage]) => progress >= start ? stage : active, storyStages[0]);
    };

    const syncExperience = (progress: number) => {
      const safeProgress = Math.min(1, Math.max(0, progress));
      experienceState.progress = safeProgress;
      root.style.setProperty("--story-progress", safeProgress.toFixed(4));
      syncStoryStage(safeProgress);
    };

    const master = gsap.timeline({
      scrollTrigger: {
        trigger: root,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        invalidateOnRefresh: true,
      },
    });

    master.eventCallback("onUpdate", () => syncExperience(master.progress()));

    master
      .to(root, { "--scene-energy": 1, duration: 0.42, ease: "none" }, 0.08)
      .to(root, { "--scene-structure": 1, duration: 0.34, ease: "none" }, 0.2)
      .to(root, { "--scene-event": 1, duration: 0.32, ease: "none" }, 0.42)
      .to(root, { "--scene-impact": 1, duration: 0.24, ease: "none" }, 0.76);

    gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((element) => {
      gsap.fromTo(element, { opacity: 0, y: 30 }, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: element, start: "top 86%", once: true },
      });
    });

    if (!reduced) {
      const spark = root.querySelector<HTMLElement>("[data-scene-spark]");
      if (spark) {
        gsap.set(spark, { autoAlpha: 0, xPercent: -50, yPercent: -50, scale: .72 });
        master.fromTo(spark, { autoAlpha: 0, xPercent: -50, yPercent: -50, scale: .72 }, { autoAlpha: 1, xPercent: -50, yPercent: -50, scale: 1, duration: .035, ease: "sine.out" }, .09)
          .to(spark, { left: "39%", top: "44%", scale: .92, duration: .13, ease: "none" }, .22)
          .to(spark, { left: "47%", top: "46%", autoAlpha: .72, scale: .8, duration: .12, ease: "none" }, .35)
          .to(spark, { autoAlpha: .14, duration: .08, ease: "sine.inOut" }, .47)
          .to(spark, { autoAlpha: .1, duration: .31, ease: "none" }, .55)
          .to(spark, { left: "31%", top: "51%", autoAlpha: .92, scale: .78, duration: .1, ease: "sine.out" }, .87)
          .to(spark, { autoAlpha: .92, duration: .028, ease: "none" }, .97);
      }

      const guides = root.querySelector<SVGElement>("[data-scene-guides]");
      if (guides) {
        const paths = guides.querySelectorAll<SVGPathElement>("path");
        gsap.set(guides, { autoAlpha: 0 });
        gsap.set(paths, { strokeDasharray: 1, strokeDashoffset: 1 });
        master.to(guides, { autoAlpha: .9, duration: .018, ease: "none" }, .205)
          .to(paths, { strokeDashoffset: 0, duration: .14, stagger: .018, ease: "none" }, .215)
          .to(guides, { autoAlpha: .18, duration: .06, ease: "sine.inOut" }, .37)
          .to(guides, { autoAlpha: 0, duration: .055, ease: "sine.inOut" }, .44);
      }

      const media = (selector: string, timing: readonly [number, number, number, number], scale = 1) => {
        const element = root.querySelector<HTMLElement>(selector);
        if (!element) return;
        const [enterStart, enterEnd, exitStart, exitEnd] = timing;
        gsap.set(element, { x: 0, y: 0, xPercent: -50, yPercent: -50, scale: 1, rotate: 0 });
        master.fromTo(element, { autoAlpha: 0, x: 0, y: 0, xPercent: -50, yPercent: -50, scale: scale * .94, rotate: -1.6 }, { autoAlpha: .94, x: 0, y: 0, xPercent: -50, yPercent: -50, scale, rotate: 0, duration: enterEnd - enterStart, ease: "sine.out" }, enterStart)
          .to(element, { autoAlpha: .94, duration: Math.max(.001, exitStart - enterEnd) }, enterEnd)
          .to(element, { autoAlpha: 0, x: 0, y: 0, xPercent: -50, yPercent: -50, scale: scale * 1.008, rotate: .18, duration: exitEnd - exitStart, ease: "sine.inOut" }, exitStart);
      };
      // Each large screen has an explicit arrival, hold and departure. Their
      // low-opacity crossover is only a few pixels of scroll, so a panel is
      // never left ghosting behind the next cinematic beat.
      media('[data-scene-media="event"]', [.43, .454, .535, .555]);
      media('[data-scene-media="project-0"]', [.552, .582, .662, .684]);
      media('[data-scene-media="project-1"]', [.57, .594, .656, .676], .72);
      media('[data-scene-media="project-2"]', [.586, .606, .647, .667], .62);
      media('[data-scene-media="memory"]', [.9, .92, .93, .948], .84);

      const layer = (selector: string, start: number, end: number, scale = 1) => {
        const element = root.querySelector<HTMLElement>(selector);
        if (!element) return;
        const fade = Math.min(.026, Math.max(.014, (end - start) * .18));
        gsap.set(element, { autoAlpha: 0, scale: .97, filter: "blur(6px)" });
        master.fromTo(element, { autoAlpha: 0, scale: .97, filter: "blur(6px)" }, { autoAlpha: 1, scale, filter: "blur(0px)", duration: fade, ease: "sine.out" }, start)
          .to(element, { autoAlpha: 1, duration: Math.max(.01, end - start - fade * 2) }, start + fade)
          .to(element, { autoAlpha: 0, scale: scale * 1.01, filter: "blur(4px)", duration: fade, ease: "sine.inOut" }, end - fade);
      };
      layer('[data-scene-layer="construction"]', .34, .52);
      layer('[data-scene-layer="build"]', .35, .505);
      layer('[data-scene-layer="interaction"]', .682, .798);
      layer('[data-scene-layer="data"]', .798, .895);
      layer('[data-scene-layer="memory-particles"]', .882, 1);

      const memoryParticles = root.querySelectorAll<HTMLElement>(".sceneMemoryParticles i");
      if (memoryParticles.length) {
        gsap.set(memoryParticles, { autoAlpha: 0, scale: .2 });
        master.fromTo(memoryParticles, { autoAlpha: 0, scale: .2 }, { autoAlpha: 1, scale: 1, duration: .055, stagger: .0015, ease: "sine.out" }, .885)
          .to(memoryParticles, { autoAlpha: .55, scale: .72, duration: .032, ease: "sine.inOut" }, .962);
      }

      // The copy is a replacement, not a document scroll: each entry begins
      // just before the prior exit ends, keeping a continuous reading rhythm.
      const copyTimings: Record<string, readonly [number, number, number, number]> = {
        idea: [.105, .125, .22, .238],
        space: [.223, .243, .335, .353],
        build: [.338, .358, .437, .455],
        event: [.44, .46, .548, .566],
        proof: [.551, .571, .694, .712],
        interaction: [.697, .717, .792, .81],
        intelligence: [.795, .815, .866, .884],
        trust: [.869, .889, .916, .934],
        memory: [.919, .939, .941, .959],
        invitation: [.944, .964, 1, 1],
      };
      gsap.utils.toArray<HTMLElement>("[data-scene-copy]").forEach((copy) => {
        const timing = copyTimings[copy.dataset.sceneCopy || ""];
        if (!timing) return;
        const [enterStart, enterEnd, exitStart, exitEnd] = timing;
        const persistent = copy.dataset.sceneCopy === "invitation";
        gsap.set(copy, { autoAlpha: 0, x: 0, y: 0, yPercent: -50, scale: .985, filter: "blur(8px)", clipPath: "inset(0 0 100% 0)" });
        const copyTween = master.fromTo(copy, { autoAlpha: 0, x: 0, y: 0, yPercent: -50, scale: .985, filter: "blur(8px)", clipPath: "inset(0 0 100% 0)" }, { autoAlpha: 1, x: 0, y: 0, yPercent: -50, scale: 1, filter: "blur(0px)", clipPath: "inset(0 0 0% 0)", duration: enterEnd - enterStart, ease: "sine.out" }, enterStart)
          .to(copy, { autoAlpha: 1, duration: Math.max(.001, exitStart - enterEnd) }, enterEnd);
        if (!persistent) copyTween.to(copy, { autoAlpha: 0, x: 0, y: 0, yPercent: -50, scale: 1.008, filter: "blur(5px)", clipPath: "inset(100% 0 0% 0)", duration: exitEnd - exitStart, ease: "sine.inOut" }, exitStart);
      });
    }

    syncExperience(master.scrollTrigger?.progress ?? 0);
    ScrollTrigger.refresh();

    return () => {
      if (lenisScroll) smooth?.off("scroll", lenisScroll);
      if (lenisTick) gsap.ticker.remove(lenisTick);
      smooth?.destroy();
      experienceState.progress = 0;
      root.removeAttribute("data-story-stage");
    };
  }, { scope, dependencies: [lenisEnabled] });

  return <div ref={scope} className="immersiveRoot" data-experience-root style={{ "--story-progress": 0, "--scene-energy": 0, "--scene-structure": 0, "--scene-event": 0, "--scene-impact": 0 } as CSSProperties}>{children}</div>;
}
