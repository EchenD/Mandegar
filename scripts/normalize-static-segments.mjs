import { constants } from "node:fs";
import { copyFile, lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";

// Next's Windows exporter leaves native separators in segment filenames.
// Preserve those files and add the dotted names requested by the client router.
// https://github.com/vercel/next.js/issues/92339
async function normalizeStaticSegments(exportDirectory) {
  const root = await realpath(exportDirectory);
  if (!(await lstat(path.join(root, "index.html"))).isFile()) {
    throw new Error("The static export must contain index.html.");
  }
  const aliases = [];

  async function collectSegmentFiles(directory, routeDirectory, filenameParts) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error(`Unexpected segment symlink: ${entry.name}`);
      const source = path.join(directory, entry.name);
      const parts = [...filenameParts, entry.name];
      if (entry.isDirectory()) {
        await collectSegmentFiles(source, routeDirectory, parts);
      } else if (entry.isFile() && entry.name.endsWith(".txt")) {
        aliases.push({ source, target: path.join(routeDirectory, parts.join(".")) });
      }
    }
  }

  async function collectRoutes(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const isRoute = entries.some((entry) => entry.isFile() && entry.name === "index.html")
      && entries.some((entry) => entry.isFile() && entry.name === "__next._tree.txt");
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const child = path.join(directory, entry.name);
      if (entry.name.startsWith("__next.")) {
        if (isRoute) await collectSegmentFiles(child, directory, [entry.name]);
      } else {
        await collectRoutes(child);
      }
    }
  }

  await collectRoutes(root);
  const pending = new Map();
  // Validate the complete plan before adding files; never replace an export.
  for (const alias of aliases) {
    const key = process.platform === "win32" ? alias.target.toLowerCase() : alias.target;
    const contents = await readFile(alias.source);
    const previous = pending.get(key);
    if (previous && !contents.equals(previous.contents)) {
      throw new Error(`Conflicting static segment aliases: ${path.relative(root, alias.target)}`);
    }
    try {
      if (!(await lstat(alias.target)).isFile() || !contents.equals(await readFile(alias.target))) {
        throw new Error(`Conflicting static segment file: ${path.relative(root, alias.target)}`);
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      pending.set(key, { ...alias, contents });
    }
  }
  for (const alias of pending.values()) {
    await copyFile(alias.source, alias.target, constants.COPYFILE_EXCL);
  }
  console.log(`Static segment filenames verified: ${aliases.length} nested files, ${pending.size} aliases added.`);
}

if (process.argv.length !== 3) {
  console.error("Usage: node scripts/normalize-static-segments.mjs <static-export-directory>");
  process.exitCode = 1;
} else {
  normalizeStaticSegments(path.resolve(process.argv[2])).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
