import { expect, test, type Page } from "@playwright/test";
import * as THREE from "three";
import { createCrowdPeople, getCrowdPersonAtRay, getCrowdReadoutPoint, isCrowdPersonOccluded } from "../../components/experience/crowd-person-inspection";
import { createBakedSceneMaterial } from "../../components/experience/baked-scene-material";
import { restoreRuntimeMaterial } from "../../components/experience/baked-material-binding";
import { getCrowdSignalHead, getCrowdSignalLayout } from "../../components/experience/crowd-signal-geometry";

test.setTimeout(180_000);
test.use({ video: "off", trace: "off" });

type PersonPoint = { id: string; x: number; y: number };

async function openIntelligence(page: Page, locale = "en") {
  await page.goto(`/${locale}?intro=0&phase=intelligence`, { waitUntil: "domcontentloaded" });
  const inspector = page.locator("[data-intelligence-inspector]");
  await expect(inspector).toHaveAttribute("data-available", "true", { timeout: 60_000 });
  await expect.poll(async () => {
    const people = JSON.parse(await inspector.getAttribute("data-visible-people") ?? "[]") as PersonPoint[];
    return people.length;
  }, { timeout: 45_000 }).toBeGreaterThan(0);
  return inspector;
}

async function firstPerson(page: Page, id?: string) {
  const points = JSON.parse(await page.locator("[data-intelligence-inspector]").getAttribute("data-visible-people") ?? "[]") as PersonPoint[];
  expect(points.length).toBeGreaterThan(0);
  const point = id ? points.find((person) => person.id === id) : points[0];
  expect(point, `Projected point for ${id ?? "first visible person"}`).toBeDefined();
  return point!;
}

async function hoverPerson(page: Page, id: string) {
  // Pointer parallax moves the figure itself; retry only with fresh projected real-hit coordinates.
  await expect.poll(async () => {
    const points = JSON.parse(await page.locator("[data-intelligence-inspector]").getAttribute("data-visible-people") ?? "[]") as PersonPoint[];
    const point = points.find((person) => person.id === id);
    if (!point) return null;
    await page.mouse.move(point.x, point.y);
    return page.locator("[data-intelligence-inspector]").getAttribute("data-person");
  }, { timeout: 20_000 }).toBe(id);
}

async function expectWorldReadout(page: Page, id: string) {
  const inspector = page.locator("[data-intelligence-inspector]");
  await expect(inspector).toHaveAttribute("data-world-readout-person", id, { timeout: 20_000 });
  await expect(inspector).toHaveAttribute("data-world-readout-state", "ready", { timeout: 20_000 });
  const bounds = JSON.parse(await inspector.getAttribute("data-world-readout-rect") ?? "null") as { x: number; y: number; width: number; height: number } | null;
  expect(bounds).not.toBeNull();
  const viewport = page.viewportSize()!;
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
  expect(bounds!.width).toBeLessThanOrEqual(64);
  expect(bounds!.height).toBeLessThanOrEqual(105);
  const leader = JSON.parse(await inspector.getAttribute("data-world-readout-leader") ?? "null") as {
    start: { x: number; y: number }; end: { x: number; y: number }; points: number;
  };
  expect(leader.points).toBe(2);
  expect(Math.abs(leader.end.x - leader.start.x)).toBeLessThan(0.01);
  const length = leader.start.y - leader.end.y;
  expect(length).toBeGreaterThanOrEqual(63.99);
  expect(length).toBeLessThanOrEqual(82.01);
  await expect(inspector).toHaveAttribute("data-world-readout-kind", "vertical-signal");
  await expect(inspector).toHaveAttribute("data-world-readout-text", "none");
  await expect(inspector).toHaveAttribute("data-world-readout-font-size", "0");
  const glyphs = JSON.parse(await inspector.getAttribute("data-world-readout-glyphs") ?? "null") as {
    ring: { x: number; y: number }; bars: { x: number; y: number };
  };
  expect(glyphs.ring.x).toBe(glyphs.bars.x);
  expect(glyphs.bars.y - glyphs.ring.y).toBeGreaterThanOrEqual(36);
  const columnX = bounds!.x + glyphs.ring.x;
  const side = await inspector.getAttribute("data-world-readout-side");
  expect((columnX - leader.start.x) * (side === "left" ? -1 : 1)).toBeGreaterThan(20);
  await expect(page.locator("[data-scene-copy='intelligence']")).toBeVisible();
}

test("hovering and clicking a real scene person previews and pins a compact head signal", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  const inspector = await openIntelligence(page);
  const chapterCopy = await page.locator("[data-scene-copy='intelligence']").textContent();
  await page.mouse.move(20, 80);
  const baselinePath = testInfo.outputPath("intelligence-desktop-before-hover.png");
  await page.screenshot({ path: baselinePath });
  await testInfo.attach("intelligence-desktop-before-hover", { path: baselinePath, contentType: "image/png" });
  const point = await firstPerson(page);
  await inspector.locator("[data-intelligence-explore]").focus();
  await hoverPerson(page, point.id);
  await expect(inspector).toHaveAttribute("data-person", point.id);
  await expect(inspector).toHaveAttribute("data-pinned", "false");
  await expect(inspector).toContainText("Example data · simulated");
  await expectWorldReadout(page, point.id);
  await expect(page.locator("[data-scene-copy='intelligence']")).toHaveText(chapterCopy!);
  await expect(inspector.locator("[data-intelligence-explore]")).toBeFocused();
  await expect(inspector.locator("[data-intelligence-explore]")).toBeVisible();
  const otherPoint = (JSON.parse(await inspector.getAttribute("data-visible-people") ?? "[]") as PersonPoint[]).find((person) => person.id !== point.id);
  if (otherPoint) {
    await hoverPerson(page, otherPoint.id);
    // Return before waiting for the intermediate annotation to finish its entrance.
    await hoverPerson(page, point.id);
    await expectWorldReadout(page, point.id);
  }
  const activities = await inspector.locator("[data-example-activities]").textContent();
  const time = await inspector.locator("[data-example-time]").textContent();
  const firstPaint = Number(await inspector.getAttribute("data-world-readout-paint-count"));
  await expect.poll(async () => Number(await inspector.getAttribute("data-world-readout-paint-count")), { timeout: 10_000 }).toBeGreaterThan(firstPaint);
  const semanticBounds = await inspector.locator("[data-intelligence-readout]").boundingBox();
  expect(semanticBounds!.width).toBeLessThanOrEqual(1);
  expect(semanticBounds!.height).toBeLessThanOrEqual(1);
  const pinPoint = await firstPerson(page, point.id);
  await page.mouse.click(pinPoint.x, pinPoint.y);
  await expect(inspector).toHaveAttribute("data-pinned", "true");
  await page.mouse.move(20, 80);
  await expect(inspector).toHaveAttribute("data-person", point.id);
  await expect(inspector.locator("[data-example-activities]")).toHaveText(activities!);
  await expect(inspector.locator("[data-example-time]")).toHaveText(time!);
  const screenshotPath = testInfo.outputPath("intelligence-person-example.png");
  await page.screenshot({ path: screenshotPath });
  await testInfo.attach("intelligence-person-example", { path: screenshotPath, contentType: "image/png" });
  await inspector.locator("[data-intelligence-close]").click();
  await expect(inspector).toHaveAttribute("data-person", "none");
  await expect(inspector).toHaveAttribute("data-world-readout-state", "hidden", { timeout: 10_000 });
  await expect(inspector.locator("[data-intelligence-explore]")).toBeFocused();

  const nextPoint = await firstPerson(page);
  await page.mouse.click(nextPoint.x, nextPoint.y);
  await expect(inspector).toHaveAttribute("data-pinned", "true");
  await page.mouse.move(20, 80);
  await page.mouse.wheel(0, -2_400);
  await expect.poll(() => page.locator("[data-experience-root]").getAttribute("data-story-stage"), { timeout: 20_000 }).not.toBe("intelligence");
  await expect(inspector).toHaveAttribute("data-available", "false");
  await expect(inspector).toHaveAttribute("data-person", "none");
  await expect(inspector).toHaveAttribute("data-world-readout-state", "hidden");
  await expect(inspector).toBeHidden();
  await expect(page.locator("[data-experience-root]")).not.toHaveAttribute("data-intelligence-selected", "true");
  expect(errors).toEqual([]);
});

test("keyboard exploration keeps focus and stable example records, then clears on blur", async ({ page }) => {
  const inspector = await openIntelligence(page);
  const explore = inspector.locator("[data-intelligence-explore]");
  await explore.focus();
  await page.keyboard.press("Enter");
  await expect(inspector).toHaveAttribute("data-pinned", "true");
  await expect(inspector.locator("[data-intelligence-next]")).toBeFocused();
  const firstId = await inspector.getAttribute("data-person");
  await expectWorldReadout(page, firstId!);
  const firstTime = await inspector.locator("[data-example-time]").textContent();
  await page.keyboard.press("Enter");
  await expect(inspector).not.toHaveAttribute("data-person", firstId!);
  await inspector.locator("[data-intelligence-previous]").focus();
  await page.keyboard.press("Enter");
  await expect(inspector).toHaveAttribute("data-person", firstId!);
  await expect(inspector.locator("[data-example-time]")).toHaveText(firstTime!);
  await page.keyboard.press("Escape");
  await expect(inspector).toHaveAttribute("data-person", "none");
  await expect(explore).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(inspector).toHaveAttribute("data-pinned", "true");
  // Chromium headless tab switching does not reliably dispatch window blur.
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(inspector).toHaveAttribute("data-person", "none");
  await expect(inspector).toHaveAttribute("data-world-readout-state", "hidden", { timeout: 10_000 });
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-scroll-locked", "false");
});

test.describe("mobile head signal", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("a Persian scene tap pins a compact signal with semantic records and reachable controls", async ({ page }, testInfo) => {
    const inspector = await openIntelligence(page, "fa");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const point = await firstPerson(page);
    await page.touchscreen.tap(point.x, point.y);
    await expect(inspector).toHaveAttribute("data-person", point.id);
    await expect(inspector).toHaveAttribute("data-pinned", "true");
    await expect(inspector).toContainText("داده نمونه · شبیه‌سازی‌شده");
    await expect(page.locator("[data-experience-root]")).not.toHaveAttribute("data-intelligence-selected", "true");
    await expectWorldReadout(page, point.id);
    await expect(inspector).toHaveAttribute("data-world-readout-font-size", "0");
    const semanticReadout = await inspector.locator("[data-intelligence-readout]").boundingBox();
    expect(semanticReadout?.width).toBeLessThanOrEqual(1);
    expect(semanticReadout?.height).toBeLessThanOrEqual(1);
    for (const button of await inspector.locator("button:visible").all()) {
      const bounds = await button.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.width).toBeGreaterThanOrEqual(44);
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const screenshotPath = testInfo.outputPath("intelligence-persian-tap.png");
    await page.screenshot({ path: screenshotPath });
    await testInfo.attach("intelligence-persian-tap", { path: screenshotPath, contentType: "image/png" });
    await inspector.locator("[data-intelligence-close]").click();
    await expect(inspector).toHaveAttribute("data-person", "none");
    await expect(page.locator("[data-experience-root]")).not.toHaveAttribute("data-intelligence-selected", "true");
  });
});

test("Arabic examples use localized labels and retain keyboard access", async ({ page }) => {
  const inspector = await openIntelligence(page, "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await inspector.locator("[data-intelligence-explore]").focus();
  await page.keyboard.press("Enter");
  await expect(inspector).toContainText("بيانات نموذجية · محاكاة");
  await expectWorldReadout(page, (await inspector.getAttribute("data-person"))!);
  await expect(inspector.locator("[data-intelligence-next]")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(inspector.locator("[data-intelligence-explore]")).toBeFocused();
});

test("head signal uses the crowd particle origin after the actor transform", () => {
  const geometry = new THREE.BoxGeometry(1, 2, 0.3);
  const material = new THREE.MeshBasicMaterial();
  const actor = new THREE.Mesh(geometry, material);
  actor.position.set(2, 3, -4);
  actor.scale.setScalar(2);
  const head = getCrowdSignalHead(actor)!;
  expect(head.x).toBeCloseTo(2);
  expect(head.y).toBeCloseTo(5.22);
  expect(head.z).toBeCloseTo(-4);
  geometry.dispose();
  material.dispose();
});

test("head signal keeps a short vertical leader rising from the actual projected head", () => {
  const layout = getCrowdSignalLayout(new THREE.Vector3(-0.3, 0.2, 0.4), 1440, 900)!;
  expect(layout.start.x).toBeCloseTo(504);
  expect(layout.start.y).toBeCloseTo(360);
  expect(layout.end.x).toBe(layout.start.x);
  expect(layout.start.y - layout.end.y).toBeCloseTo(76);
  expect(layout.rect.y).toBeLessThan(layout.end.y);
  expect(layout.rect.width).toBe(64);
  expect(layout.rect.height).toBe(98);
});

test("head signal fits a small mobile viewport without moving the head anchor", () => {
  for (const x of [-0.9, 0, 0.9]) {
    const layout = getCrowdSignalLayout(new THREE.Vector3(x, 0, 0.4), 320, 640)!;
    expect(layout).not.toBeNull();
    expect(layout.start.x).toBeCloseTo((x * 0.5 + 0.5) * 320);
    expect(layout.start.y).toBe(320);
    expect(layout.rect.x).toBeGreaterThanOrEqual(12);
    expect(layout.rect.x + layout.rect.width).toBeLessThanOrEqual(308);
    expect(layout.start.y - layout.end.y).toBeGreaterThanOrEqual(63.99);
    expect(layout.start.y - layout.end.y).toBeLessThanOrEqual(82.01);
    expect(layout.end.x).toBe(layout.start.x);
    expect(layout.side).toBe(x > 0 ? -1 : 1);
    const columnX = layout.origin.x + layout.side * 28;
    expect(columnX - 8.5).toBeGreaterThanOrEqual(0);
    expect(columnX + 8.5).toBeLessThanOrEqual(layout.rect.width);
  }
});

test("head signal clamps its glyphs at viewport edges while its leader stays vertical", () => {
  for (const y of [0.78, -0.96]) {
    const layout = getCrowdSignalLayout(new THREE.Vector3(0.1, y, 0.4), 390, 844)!;
    expect(layout).not.toBeNull();
    expect(layout.rect.y).toBeGreaterThanOrEqual(12);
    expect(layout.rect.y + layout.rect.height).toBeLessThanOrEqual(832);
    expect(layout.start.y).toBeCloseTo((-y * 0.5 + 0.5) * 844);
    expect(layout.end.x).toBe(layout.start.x);
    expect(layout.start.y - layout.end.y).toBeCloseTo(76);
    const ringX = layout.origin.x + layout.side * 28;
    const ringY = layout.origin.y - 64;
    expect(ringX - 7.5).toBeGreaterThanOrEqual(0);
    expect(ringY - 7.5).toBeGreaterThanOrEqual(0);
    expect(ringX + 8.5).toBeLessThanOrEqual(layout.rect.width);
  }
});

test("head signal hides an offscreen or behind-camera origin instead of detaching it", () => {
  for (const head of [new THREE.Vector3(1.01, 0, 0), new THREE.Vector3(0, -1.01, 0), new THREE.Vector3(0, 0, 1.01), new THREE.Vector3(Number.NaN, 0, 0)]) {
    expect(getCrowdSignalLayout(head, 390, 844)).toBeNull();
  }
  // A line must have room to rise, and both tiny glyphs must stay beside its actual origin.
  expect(getCrowdSignalLayout(new THREE.Vector3(0, 0.9, 0), 390, 844)).toBeNull();
  expect(getCrowdSignalLayout(new THREE.Vector3(-0.98, 0, 0), 390, 844)).toBeNull();
});

test("a noninteractive opaque wall blocks selecting the person behind it", () => {
  const world = new THREE.Scene();
  const geometry = new THREE.BoxGeometry(1, 2, 0.3);
  const material = new THREE.MeshBasicMaterial();
  const person = new THREE.Mesh(geometry, material);
  person.name = "Human_00";
  const wall = new THREE.Mesh(geometry, material);
  wall.position.z = 1;
  world.add(person, wall);
  world.updateMatrixWorld(true);
  const ray = new THREE.Ray(new THREE.Vector3(0, 0, 3), new THREE.Vector3(0, 0, -1));
  const raycaster = new THREE.Raycaster();
  expect(getCrowdPersonAtRay(world, ray, raycaster)).toBeNull();
  wall.visible = false;
  expect(getCrowdPersonAtRay(world, ray, raycaster)).toBe("Human_00");
  geometry.dispose();
  material.dispose();
});

function createOcclusionScene() {
  const world = new THREE.Scene();
  const person = new THREE.Group();
  person.name = "Human_00";
  const material = new THREE.MeshBasicMaterial();
  const bodyGeometry = new THREE.BoxGeometry(1, 2, 0.3);
  person.add(new THREE.Mesh(bodyGeometry, material));
  world.add(person);
  const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 10);
  camera.position.z = 5;
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const raycaster = new THREE.Raycaster();
  const dispose = () => {
    world.traverse((object) => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
    material.dispose();
  };
  return { world, person, material, camera, raycaster, dispose };
}

test("a fully occluded person is ineligible for the world readout", () => {
  const scene = createOcclusionScene();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 0.2), scene.material);
  wall.position.z = 1;
  scene.world.add(wall);
  scene.world.updateMatrixWorld(true);
  expect(isCrowdPersonOccluded(scene.person, scene.world, scene.camera, scene.raycaster)).toBe(true);
  wall.visible = false;
  expect(isCrowdPersonOccluded(scene.person, scene.world, scene.camera, scene.raycaster)).toBe(false);
  scene.dispose();
});

test("an exposed shoulder keeps the person eligible when the central body is occluded", () => {
  const scene = createOcclusionScene();
  const narrowWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3, 0.2), scene.material);
  narrowWall.position.z = 1;
  scene.world.add(narrowWall);
  scene.world.updateMatrixWorld(true);
  const centralRay = new THREE.Ray(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1));
  expect(getCrowdPersonAtRay(scene.world, centralRay, scene.raycaster)).toBeNull();
  expect(isCrowdPersonOccluded(scene.person, scene.world, scene.camera, scene.raycaster)).toBe(false);
  scene.dispose();
});

test("samples missing the actual silhouette cannot establish full occlusion", () => {
  const scene = createOcclusionScene();
  const body = scene.person.children[0] as THREE.Mesh;
  scene.person.remove(body);
  body.geometry.dispose();
  for (const x of [-0.5, 0.5]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2, 0.3), scene.material);
    side.position.x = x;
    scene.person.add(side);
  }
  const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 0.2), scene.material);
  wall.position.z = 1;
  scene.world.add(wall);
  scene.world.updateMatrixWorld(true);
  expect(isCrowdPersonOccluded(scene.person, scene.world, scene.camera, scene.raycaster)).toBe(false);
  scene.dispose();
});

test("a validated exposed edge hit survives occlusion between the standard body samples", () => {
  const scene = createOcclusionScene();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(0.95, 3, 0.2), scene.material);
  wall.position.z = 1;
  scene.world.add(wall);
  scene.world.updateMatrixWorld(true);
  expect(isCrowdPersonOccluded(scene.person, scene.world, scene.camera, scene.raycaster)).toBe(true);
  const exposedPoint = new THREE.Vector3(0.49, 0, 0.15);
  const pointerRay = new THREE.Ray(new THREE.Vector3(0.49, 0, 5), new THREE.Vector3(0, 0, -1));
  expect(getCrowdPersonAtRay(scene.world, pointerRay, scene.raycaster)).toBe("Human_00");
  expect(isCrowdPersonOccluded(scene.person, scene.world, scene.camera, scene.raycaster, exposedPoint)).toBe(false);
  scene.dispose();
});

test("a torso inside the frustum remains the preferred readout anchor", () => {
  const scene = createOcclusionScene();
  const torso = new THREE.Vector3(0, 0, 0);
  const outsideHit = new THREE.Vector3(3, 0, 0);
  expect(getCrowdReadoutPoint(torso, scene.camera, outsideHit)).toBe(torso);
  scene.dispose();
});

test("an exposed edge inside the frustum anchors a person whose torso is outside", () => {
  const scene = createOcclusionScene();
  const torso = new THREE.Vector3(2.1, 0, 0);
  const visibleHit = new THREE.Vector3(1.9, 0, 0.15);
  const projected = new THREE.Vector3();
  expect(getCrowdReadoutPoint(torso, scene.camera, visibleHit, projected)).toBe(visibleHit);
  expect(Math.abs(projected.x)).toBeLessThanOrEqual(1);
  scene.dispose();
});

test("a person with both anchor points outside the frustum has no readout", () => {
  const scene = createOcclusionScene();
  const torso = new THREE.Vector3(3, 0, 0);
  expect(getCrowdReadoutPoint(torso, scene.camera, new THREE.Vector3(0, 3, 0))).toBeNull();
  expect(getCrowdReadoutPoint(torso, scene.camera, new THREE.Vector3(0, 0, 6))).toBeNull();
  expect(getCrowdReadoutPoint(torso, scene.camera)).toBeNull();
  scene.dispose();
});

test("readout anchors follow a changed camera transform before the next render", () => {
  const scene = createOcclusionScene();
  const torso = new THREE.Vector3(0, 0, 0);
  const edge = new THREE.Vector3(1.5, 0, 0);
  expect(getCrowdReadoutPoint(torso, scene.camera, edge)).toBe(torso);
  scene.camera.position.x = 3;
  expect(getCrowdReadoutPoint(torso, scene.camera, edge)).toBe(edge);
  scene.dispose();
});

test("highlighting one person preserves authored maps and geometry and the other person's focus", () => {
  const quietMap = new THREE.Texture();
  const peakMap = new THREE.Texture();
  const originalMaterial = new THREE.MeshBasicMaterial();
  const geometry = new THREE.BoxGeometry(1, 2, 0.3);
  const originalUvs = Array.from(geometry.attributes.uv.array);
  const root = new THREE.Group();
  for (const [index, x] of [0, 2].entries()) {
    const person = new THREE.Mesh(geometry, originalMaterial);
    person.name = `Human_0${index}`;
    person.position.x = x;
    root.add(person);
  }
  root.updateMatrixWorld(true);
  const baked = createBakedSceneMaterial({ name: "test_crowd", quietMap, peakMap, edgeColor: "#225cff", crowdFalloff: true });
  const people = createCrowdPeople(root, baked.material, baked.uniforms);
  people[0].focus.value = 1;
  baked.uniforms.uPeakMix.value = 0.7;
  for (const person of people) {
    expect(person.material.uniforms.uQuietMap.value).toBe(quietMap);
    expect(person.material.uniforms.uPeakMap.value).toBe(peakMap);
    expect(person.material.uniforms.uPeakMix).toBe(baked.uniforms.uPeakMix);
    expect((person.object as THREE.Mesh).geometry).toBe(geometry);
  }
  expect(people[0].material.uniforms.uPersonFocus.value).toBe(1);
  expect(people[1].material.uniforms.uPersonFocus.value).toBe(0);
  expect(baked.uniforms.uPersonFocus.value).toBe(0);
  expect(Array.from(geometry.attributes.uv.array)).toEqual(originalUvs);
  people.forEach((person) => {
    restoreRuntimeMaterial(person.bindings, person.material);
    expect((person.object as THREE.Mesh).material).toBe(originalMaterial);
    person.material.dispose();
  });
  baked.material.dispose();
  originalMaterial.dispose();
  geometry.dispose();
  quietMap.dispose();
  peakMap.dispose();
});
