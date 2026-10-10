import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const args = process.argv.slice(2);
const labelArgument = args.find((argument) => !argument.startsWith("--"));
if (args.includes("--sheet-only") && !labelArgument) throw new Error("Supply an existing capture label with --sheet-only.");
const label = labelArgument || `review-${new Date().toISOString().replace(/[:.]/g, "-")}`;
if (!/^[a-z0-9][a-z0-9_-]*$/i.test(label)) throw new Error("Use a capture label containing only letters, numbers, hyphens, or underscores.");
const baseUrl = process.env.HERO_REVIEW_URL || "http://localhost:3300";
const output = path.resolve("Docs/hero-flow-review/mobile-camera", label);
const handoff = JSON.parse(await readFile("Docs/CreativeProduction/camera-timing-handoff.template.json", "utf8"));
async function createOverview() {
  const phases = Object.keys(handoff.phaseStartFrames);
  const cells = await Promise.all(phases.map(async (phase, index) => ({
    input: await sharp(path.join(output, `${phase}.png`)).resize(234, 506).png().toBuffer(),
    left: index % 4 * 234,
    top: Math.floor(index / 4) * 534 + 28,
  })));
  const labels = phases.map((phase, index) => `<text x="${index % 4 * 234 + 10}" y="${Math.floor(index / 4) * 534 + 20}" font-family="sans-serif" font-size="14" fill="#16191d">${phase}</text>`).join("");
  const height = Math.ceil(phases.length / 4) * 534;
  await sharp({ create: { width: 936, height, channels: 4, background: "#f5f4ef" } })
    .composite([...cells, { input: Buffer.from(`<svg width="936" height="${height}">${labels}</svg>`), top: 0, left: 0 }])
    .png().toFile(path.join(output, "overview.png"));
}
if (args.includes("--sheet-only")) {
  await createOverview();
  process.exit(0);
}
await mkdir(path.dirname(output), { recursive: true });
// Preserve earlier comparisons; each capture gets its own directory.
await mkdir(output);
const browser = await chromium.launch();
const records = [];
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/fa?intro=0&phase=discovery`, { waitUntil: "domcontentloaded", timeout: 600_000 });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.locator("[data-loading-progress='100']").waitFor({ state: "attached", timeout: 120_000 });
  await page.locator("[data-experience-canvas='true'] canvas").waitFor({ timeout: 120_000 });
  if (!await page.locator("[data-experience-root]").getAttribute("data-camera-frame")) {
    throw new Error("Camera frame diagnostics are unavailable. Capture from a development server.");
  }
  for (const [phase, start] of Object.entries(handoff.phaseStartFrames)) {
    // Frame the middle of each authored viewing window, including the terminal loop.
    const frame = (start + handoff.phaseEndFrames[phase]) / 2;
    await page.locator("[data-experience-root]").evaluate((root, progress) => {
      root.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
    }, (frame - handoff.firstFrame) / (handoff.lastFrame - handoff.firstFrame));
    await page.waitForFunction((target) => {
      const root = document.querySelector("[data-experience-root]");
      return Math.abs(Number(root?.dataset.cameraFrame) - target) < 0.1;
    }, frame, { timeout: 30_000 });
    await page.waitForTimeout(1200);
    const record = await page.evaluate(() => {
      const root = document.querySelector("[data-experience-root]");
      const canvas = document.querySelector("[data-experience-canvas='true'] canvas");
      const bounds = canvas.getBoundingClientRect();
      const gl = canvas.getContext("webgl2");
      return {
        phase: root.dataset.storyStage,
        frame: Number(root.dataset.cameraFrame),
        projection: JSON.parse(root.dataset.cameraProjection || "null"),
        renderSize: [canvas.width, canvas.height],
        displaySize: [bounds.width, bounds.height],
        devicePixelRatio,
        antialias: gl?.getContextAttributes()?.antialias,
      };
    });
    await page.screenshot({ path: path.join(output, `${phase}.png`) });
    records.push(record);
    console.log(JSON.stringify(record));
  }
  await writeFile(path.join(output, "measurements.json"), JSON.stringify(records, null, 2) + "\n");
  await createOverview();
} finally {
  await browser.close();
}
