import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { heroTimeline } from "../../components/experience/hero-timeline-config";

test.setTimeout(300_000);
test.use({ video: "off", trace: "off" });

async function open(page: Page, locale: string) {
  await page.goto(`/${locale}?intro=0&phase=discovery`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-loading-progress]")).toHaveAttribute("data-loading-progress", "100", { timeout: 90_000 });
  await expect(page.locator("[data-experience-root]")).not.toHaveAttribute("data-intro-active", "true");
}

async function seek(page: Page, frame: number) {
  const root = page.locator("[data-experience-root]");
  await root.evaluate((element, progress) => element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } })), frame / 2500);
  await expect.poll(async () => Number(await root.getAttribute("data-hero-frame"))).toBeCloseTo(frame, 1);
  await expect.poll(async () => Number(await root.getAttribute("data-camera-frame"))).toBeCloseTo(frame, 1);
}

async function expectedCamera() {
  const buffer = readFileSync("public/models/mandegar/mandegar_environment.glb");
  const data = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const gltf = await new GLTFLoader().parseAsync(data, "");
  const camera = gltf.scene.getObjectByName("camera_mandegar_master")!;
  const clip = THREE.AnimationClip.findByName(gltf.animations, "camera_master_loop")!;
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  return (frame: number) => {
    action.paused = false;
    mixer.setTime(frame / 2500 * clip.duration);
    gltf.scene.updateMatrixWorld(true);
    return [...camera.getWorldPosition(new THREE.Vector3()).toArray(), ...camera.getWorldQuaternion(new THREE.Quaternion()).toArray()];
  };
}

for (const variant of [
  { locale: "fa", viewport: { width: 1440, height: 900 }, mobile: false },
  { locale: "ar", viewport: { width: 390, height: 844 }, mobile: true },
]) {
  test(`${variant.locale} phases, photo and lamps follow authored frames in both directions`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ viewport: variant.viewport, hasTouch: variant.mobile, isMobile: variant.mobile });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await open(page, variant.locale);
      const root = page.locator("[data-experience-root]");
      const director = page.locator("[data-interaction-director]");
      const cameraAt = await expectedCamera();
      const poses = new Map<number, number[]>();
      const frames = heroTimeline.phases.map((phase) => (phase.startFrame + phase.endFrame) / 2);
      const records = await root.evaluate(async (element: HTMLElement, order) => {
        const results = [];
        for (const frame of order) {
          element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress: frame / 2500, sync: true } }));
          for (let count = 0; count < 3; count += 1) await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          results.push({ frame, renderedFrame: Number(element.dataset.cameraFrame), pose: JSON.parse(element.dataset.cameraBasePose ?? "[]") as number[], phase: element.dataset.storyStage });
        }
        return results;
      }, [...frames, ...[...frames].reverse()]);
      for (const record of records) {
        const frame = record.frame;
        const expectedPhase = heroTimeline.phases.find((phase) => frame >= phase.startFrame && frame <= phase.endFrame)!;
        expect(record.renderedFrame).toBeCloseTo(frame, 1);
        expect(record.phase).toBe(expectedPhase.id);
        const actual = record.pose;
        const expected = cameraAt(record.renderedFrame);
        expect(actual).toHaveLength(expected.length);
        actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index], 5));
        if (poses.has(frame)) actual.forEach((value, index) => expect(value).toBeCloseTo(poses.get(frame)![index], 5));
        poses.set(frame, actual);
      }
      const photo = page.locator("[data-photo-scroll]");
      for (const [frame, state] of [[519, "idle"], [540, "countdown"], [581, "captured"], [611, "captured"], [701, "idle"], [611, "captured"], [540, "countdown"], [519, "idle"]] as const) {
        await seek(page, frame);
        await expect(photo).toHaveAttribute("data-photo-state", state);
      }
      const lights = page.locator("[data-stage-scroll]");
      for (const [frame, count] of [[1140, 0], [1160, 1], [1190, 2], [1220, 3], [1250, 4], [1280, 5], [1250, 4], [1220, 3], [1190, 2], [1160, 1], [1140, 0]]) {
        await seek(page, frame);
        await expect(lights).toHaveAttribute("data-lit-lamps", String(count));
      }
      await seek(page, 1280);
      await page.screenshot({ path: testInfo.outputPath(`${variant.locale}-authored-lighting.png`) });
      const gapFrames = heroTimeline.phases.slice(0, -1).flatMap((phase, index) => {
        const next = heroTimeline.phases[index + 1];
        return next.startFrame > phase.endFrame ? [(phase.endFrame + next.startFrame) / 2] : [];
      });
      for (const frame of gapFrames) {
        await seek(page, frame);
        await expect(root).toHaveAttribute("data-in-viewing-window", "false");
        await expect(director).toHaveAttribute("data-available-station", "none");
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });
}

test("participation keeps native scroll, Skip follows the window, and Finish smoothly reaches its end", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "en");
  const root = page.locator("[data-experience-root]");
  const director = page.locator("[data-interaction-director]");
  await seek(page, 825);
  await expect(director).toHaveAttribute("data-active-station", "touch");
  const pose = await root.getAttribute("data-camera-base-pose");
  await page.locator("[data-installation-button='parts']").click();
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-installation-view", "parts");
  await expect(root).toHaveAttribute("data-camera-base-pose", pose!);
  await seek(page, 875);
  await expect(page.locator("[data-interaction-escape]")).toHaveAttribute("data-scroll-skip-progress", "0.500");
  const before = await page.evaluate(() => scrollY);
  await page.mouse.move(20, 450);
  await page.mouse.wheel(0, 150);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before + 50);
  await expect(director).toHaveAttribute("data-active-station", "touch");
  await seek(page, 825);
  const samples = page.evaluate(() => new Promise<{ frame: number; y: number; distance: number }[]>((resolve) => {
    const root = document.querySelector<HTMLElement>("[data-experience-root]")!;
    const values: { frame: number; y: number; distance: number }[] = [];
    const record = () => {
      values.push({ frame: Number(root.dataset.heroFrame), y: scrollY - root.offsetTop, distance: Number(root.dataset.cameraScrollDistance) });
      if (Number(root.dataset.heroFrame) >= 949.99) resolve(values);
      else requestAnimationFrame(record);
    };
    requestAnimationFrame(record);
  }));
  await page.locator("[data-interaction-finish]").click();
  const values = await samples;
  expect(values.length).toBeGreaterThan(5);
  expect(values.some((value) => value.frame > 835 && value.frame < 940)).toBe(true);
  for (let index = 1; index < values.length; index += 1) {
    expect(values[index].frame).toBeGreaterThanOrEqual(values[index - 1].frame - 0.1);
    expect(Math.abs(values[index].y / values[index].distance * 2500 - values[index].frame)).toBeLessThan(0.2);
  }
  await expect.poll(async () => Number(await root.getAttribute("data-hero-frame"))).toBeCloseTo(950, 1);
  await expect(director).toHaveAttribute("data-active-station", "none");
  await page.screenshot({ path: testInfo.outputPath("finish-authored-window.png") });
  await seek(page, 790);
  await seek(page, 825);
  await expect(director).toHaveAttribute("data-active-station", "touch");
  await page.locator("[data-interaction-finish]").evaluate((button: HTMLButtonElement) => {
    button.click();
    setTimeout(() => window.dispatchEvent(new WheelEvent("wheel", { deltaY: -150, bubbles: true, cancelable: true })), 150);
  });
  await expect(root).not.toHaveAttribute("data-finish-scrolling");
  await expect.poll(async () => Number(await root.getAttribute("data-hero-frame"))).toBeLessThan(930);
});
