import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const sourceDirectory = path.resolve(
  process.argv[2]
    ?? process.env.MANDEGAR_TEXTURE_SOURCE
    ?? path.join(projectRoot, "..", "mandegar3d", "Texture", "Update"),
);
const outputDirectory = path.join(projectRoot, "public", "textures", "mandegar", "baked");
const mobileDirectory = path.join(outputDirectory, "mobile");
const textureNames = [
  "env_quiet",
  "env_peak",
  "exhibit_quiet",
  "exhibit_peak",
];

function findExecutable(name) {
  const explicit = process.env.KTX_TOKTX_PATH;
  const candidates = [
    explicit,
    process.platform === "win32" ? `C:\\Program Files\\KTX-Software\\bin\\${name}.exe` : null,
    name,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (path.isAbsolute(candidate) && !existsSync(candidate)) continue;
    const result = spawnSync(candidate, ["--version"], {
      encoding: "utf8",
      shell: false,
      windowsHide: true,
    });
    if (result.status === 0) return candidate;
  }

  throw new Error(
    "Khronos toktx was not found. Install KTX-Software or set KTX_TOKTX_PATH.",
  );
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error([
      `Command failed: ${command} ${args.join(" ")}`,
      result.stdout,
      result.stderr,
    ].filter(Boolean).join("\n"));
  }
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

async function normalizePng(input, output, size) {
  await sharp(input)
    .rotate()
    .resize(size, size, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: true,
    })
    .toColourspace("srgb")
    .removeAlpha()
    .png({ bitdepth: 8, compressionLevel: 9, palette: false })
    .toFile(output);
}

async function writeWebp(input, output, quality) {
  await sharp(input)
    .webp({
      quality,
      effort: 6,
      smartSubsample: true,
      preset: "picture",
    })
    .toFile(output);
}

function writeKtx2(toktx, input, output) {
  run(toktx, [
    "--t2",
    "--2d",
    "--genmipmap",
    "--filter", "lanczos4",
    "--encode", "uastc",
    "--uastc_quality", "2",
    "--uastc_rdo_l", "0.75",
    "--zcmp", "18",
    "--assign_oetf", "srgb",
    "--assign_primaries", "srgb",
    "--target_type", "RGB",
    "--",
    output,
    input,
  ]);
}

async function main() {
  const toktx = findExecutable("toktx");
  const ktx = path.join(path.dirname(toktx), process.platform === "win32" ? "ktx.exe" : "ktx");
  mkdirSync(outputDirectory, { recursive: true });
  mkdirSync(mobileDirectory, { recursive: true });
  const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "mandegar-baked-textures-"));

  try {
    for (const name of textureNames) {
      const source = path.join(sourceDirectory, `${name}.png`);
      if (!existsSync(source)) throw new Error(`Missing source texture: ${source}`);
      const metadata = await sharp(source).metadata();
      if (metadata.width !== 4096 || metadata.height !== 4096) {
        throw new Error(`${name}.png must be 4096x4096; received ${metadata.width}x${metadata.height}.`);
      }

      const desktopPng = path.join(temporaryDirectory, `${name}-4096.png`);
      const mobilePng = path.join(temporaryDirectory, `${name}-2048.png`);
      const desktopWebp = path.join(outputDirectory, `${name}.webp`);
      const mobileWebp = path.join(mobileDirectory, `${name}.webp`);
      const desktopKtx2 = path.join(outputDirectory, `${name}.ktx2`);
      const mobileKtx2 = path.join(mobileDirectory, `${name}.ktx2`);

      console.log(`Preparing ${name}...`);
      await normalizePng(source, desktopPng, 4096);
      await normalizePng(source, mobilePng, 2048);
      await Promise.all([
        writeWebp(desktopPng, desktopWebp, 90),
        writeWebp(mobilePng, mobileWebp, 86),
      ]);
      writeKtx2(toktx, desktopPng, desktopKtx2);
      writeKtx2(toktx, mobilePng, mobileKtx2);
      if (existsSync(ktx)) {
        run(ktx, ["validate", desktopKtx2]);
        run(ktx, ["validate", mobileKtx2]);
      }

      console.log([
        `  desktop WebP ${formatBytes(statSync(desktopWebp).size)}`,
        `KTX2 ${formatBytes(statSync(desktopKtx2).size)}`,
        `mobile WebP ${formatBytes(statSync(mobileWebp).size)}`,
        `KTX2 ${formatBytes(statSync(mobileKtx2).size)}`,
      ].join(" | "));
    }
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

await main();
