import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const keyframeDirectory = join(
  repositoryRoot,
  "Docs",
  "CreativeProduction",
  "keyframes",
);
const outputDirectory = join(
  repositoryRoot,
  "Docs",
  "CreativeProduction",
  "animatic",
);
const outputPath = join(outputDirectory, "Mandegar_K1-K7_Animatic_v1.mp4");

const frames = [
  { file: "K7c-loop-return-v1.png", seconds: 2.8 },
  { file: "K2-discovery-v1.png", seconds: 2.5 },
  { file: "K3a-led-screens-v1.png", seconds: 1.5 },
  { file: "K3b-media-wall-v1.png", seconds: 1.6 },
  { file: "K3c-interactive-booths-v1.png", seconds: 1.6 },
  { file: "K3d-brand-audience-v1.png", seconds: 1.8 },
  { file: "K4a-reveal-ignition-v1.png", seconds: 1.3 },
  { file: "K4b-peak-reveal-v1.png", seconds: 2.1 },
  { file: "K4c-reveal-settled-v1.png", seconds: 2.5 },
  { file: "K7a-invitation-hold-v1.png", seconds: 3.2 },
  { file: "K7b-loop-condense-v1.png", seconds: 2.0 },
  { file: "K7c-loop-return-v1.png", seconds: 2.8 },
];

const fps = 30;
const transitionSeconds = 0.55;
const inputs = frames.flatMap(({ file }) => [
  "-i",
  join(keyframeDirectory, file),
]);

const frameFilters = frames.map(({ seconds }, index) => {
  const frameCount = Math.round(seconds * fps);
  const drift = index % 2 === 0 ? "0.00010" : "0.00014";

  const filters = [
    `[${index}:v]scale=1920:1080:force_original_aspect_ratio=increase`,
    "crop=1920:1080",
    "setsar=1",
    `zoompan=z='min(zoom+${drift},1.022)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frameCount}:s=1920x1080:fps=${fps}`,
    "format=yuv420p",
    "setpts=PTS-STARTPTS",
  ].join(",");

  return `${filters}[v${index}]`;
});

let elapsedSeconds = frames[0].seconds;
let previousLabel = "v0";
const transitionFilters = [];

for (let index = 1; index < frames.length; index += 1) {
  const outputLabel = `x${index}`;
  const offset = elapsedSeconds - transitionSeconds * index;

  transitionFilters.push(
    `[${previousLabel}][v${index}]xfade=transition=fade:duration=${transitionSeconds}:offset=${offset.toFixed(3)}[${outputLabel}]`,
  );
  previousLabel = outputLabel;
  elapsedSeconds += frames[index].seconds;
}

mkdirSync(outputDirectory, { recursive: true });

const result = spawnSync(
  ffmpegPath,
  [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    ...inputs,
    "-filter_complex",
    [...frameFilters, ...transitionFilters].join(";"),
    "-map",
    `[${previousLabel}]`,
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputPath,
  ],
  {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: "inherit",
  },
);

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Animatic written to ${outputPath}`);
