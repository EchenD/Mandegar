import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";

const runNode = promisify(execFile);
const script = path.resolve("scripts/normalize-static-segments.mjs");
const fixturePrefix = "mandegar-static-segments-";

async function withFixture(run: (root: string) => Promise<void>) {
  const temporaryRoot = path.resolve(os.tmpdir());
  const root = await mkdtemp(path.join(temporaryRoot, fixturePrefix));
  try {
    await run(root);
  } finally {
    const resolvedRoot = path.resolve(root);
    if (path.dirname(resolvedRoot) !== temporaryRoot || !path.basename(resolvedRoot).startsWith(fixturePrefix)) {
      throw new Error(`Refusing to remove an unexpected fixture directory: ${resolvedRoot}`);
    }
    await rm(resolvedRoot, { recursive: true, force: true });
  }
}

async function write(root: string, relative: string, contents: string | Buffer) {
  const file = path.join(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, contents);
}

async function route(root: string, relative = "") {
  await write(root, path.join(relative, "index.html"), "<!doctype html><title>Export fixture</title>");
  await write(root, path.join(relative, "__next._tree.txt"), "0:[\"fixture route tree\"]\n");
}

async function normalize(root: string) {
  return runNode(process.execPath, [script, root]);
}

async function snapshot(root: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  async function walk(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(file);
      else files[path.relative(root, file)] = (await readFile(file)).toString("base64");
    }
  }
  await walk(root);
  return files;
}

test("static exports serve flat segment filenames for locale, slug, parallel and encoded root keys", async () => {
  await withFixture(async (root) => {
    await route(root);
    await route(root, "fa");
    await route(root, path.join("en", "projects", "project.with-dots"));
    const segments = [
      {
        source: path.join("fa", "__next.$d$locale", "__PAGE__.txt"),
        requested: path.join("fa", "__next.$d$locale.__PAGE__.txt"),
        payload: Buffer.from("0:[\"صفحه فارسی\",\"ماندگار\"]\r\n", "utf8"),
      },
      {
        source: path.join("en", "projects", "project.with-dots", "__next.$d$locale", "projects", "$d$slug", "__PAGE__.txt"),
        requested: path.join("en", "projects", "project.with-dots", "__next.$d$locale.projects.$d$slug.__PAGE__.txt"),
        payload: Buffer.from("0:[\"Deep project page\",\"project.with-dots\"]\n", "utf8"),
      },
      {
        source: path.join("fa", "__next.$d$locale", "@modal", "$d$slug", "__PAGE__.txt"),
        requested: path.join("fa", "__next.$d$locale.@modal.$d$slug.__PAGE__.txt"),
        payload: Buffer.from("0:[\"parallel slot\",\"@modal\"]\r\n", "utf8"),
      },
      {
        source: path.join("__next.!KHJvb3Qp", "__PAGE__.txt"),
        requested: "__next.!KHJvb3Qp.__PAGE__.txt",
        payload: Buffer.from([0, 255, 13, 10, 36, 33, 64]),
      },
    ];
    for (const segment of segments) await write(root, segment.source, segment.payload);
    await write(root, path.join("fa", "__next.$d$locale", "notes.json"), "{\"retained\":true}");
    await write(root, path.join("media", "__next.unrelated", "__PAGE__.txt"), "not a route segment\n");

    await normalize(root);
    for (const segment of segments) {
      // Next's browser requests use dotted segment keys, independently of
      // the separators in the operating system's exported directory tree.
      expect(await readFile(path.join(root, segment.requested))).toEqual(segment.payload);
      expect(await readFile(path.join(root, segment.source))).toEqual(segment.payload);
    }
    expect(await readFile(path.join(root, "fa", "__next.$d$locale", "notes.json"), "utf8")).toBe("{\"retained\":true}");
    const normalized = await snapshot(root);
    expect(normalized[path.join("media", "__next.unrelated.__PAGE__.txt")]).toBeUndefined();
    await normalize(root);
    expect(await snapshot(root)).toEqual(normalized);
  });
});

test("already flat exports and identical aliases remain byte-for-byte unchanged", async () => {
  await withFixture(async (root) => {
    await route(root);
    await route(root, "en");
    const payload = Buffer.from("0:[\"Flat Linux export\"]\r\n", "utf8");
    await write(root, path.join("en", "__next.$d$locale.projects.__PAGE__.txt"), payload);
    const flatExport = await snapshot(root);
    await normalize(root);
    expect(await snapshot(root)).toEqual(flatExport);

    await write(root, path.join("en", "__next.$d$locale", "projects", "__PAGE__.txt"), payload);
    const withIdenticalSource = await snapshot(root);
    await normalize(root);
    expect(await snapshot(root)).toEqual(withIdenticalSource);
  });
});

test("conflicting segment aliases reject the export before overwriting or copying any files", async () => {
  await withFixture(async (root) => {
    await route(root);
    await route(root, "fa");
    await route(root, "en");
    // The valid candidate precedes the conflict in route and filename order,
    // so a script that copies while scanning would leave a partial export.
    await write(root, path.join("en", "__next.$d$locale", "__PAGE__.txt"), "new English alias\n");
    await write(root, path.join("fa", "__next.$d$locale", "__PAGE__.txt"), "nested Persian payload\n");
    await write(root, path.join("fa", "__next.$d$locale.__PAGE__.txt"), "existing canonical payload\n");
    const original = await snapshot(root);
    await expect(normalize(root)).rejects.toThrow();
    expect(await snapshot(root)).toEqual(original);
  });
});

test("a directory without the root export page is rejected without creating aliases", async () => {
  await withFixture(async (root) => {
    await route(root, "fa");
    await write(root, path.join("fa", "__next.$d$locale", "__PAGE__.txt"), "nested locale payload\n");
    const original = await snapshot(root);
    await expect(normalize(root)).rejects.toThrow();
    expect(await snapshot(root)).toEqual(original);
  });
});
