import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const source = path.join(projectRoot, "Docs/CreativeProduction/3d/services");
const target = path.join(projectRoot, "public/media/services");
const names = ["events", "exhibitions", "web-apps", "content", "advertising"];

await mkdir(target, { recursive: true });
const posters = {};
for (const name of names) {
  const destination = path.join(target, `${name}.webp`);
  await sharp(path.join(source, `${name}.png`))
    .webp({ quality: 85, alphaQuality: 90, effort: 6 })
    .toFile(destination);
  posters[name] = (await stat(destination)).size;
}
const manifestPath = path.join(source, "asset-manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
await writeFile(manifestPath, `${JSON.stringify({ ...manifest, posters }, null, 2)}\n`);
console.log(`Prepared five service posters (${Object.values(posters).reduce((sum, size) => sum + size, 0)} bytes).`);
