import { test, expect } from "@playwright/test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repository = process.cwd();
const validator = join(repository, "scripts", "validate-content.mjs");

function validateFixture(mutate?: (directory: string) => void, strict = false) {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "mandegar-content-test-"));
  const contentDirectory = join(temporaryDirectory, "content");
  try {
    cpSync(join(repository, "content"), contentDirectory, { recursive: true });
    mutate?.(contentDirectory);
    return spawnSync(process.execPath, [validator, "--dir", contentDirectory, ...(strict ? ["--strict"] : [])], {
      cwd: repository,
      encoding: "utf8",
      timeout: 15_000,
    });
  } finally {
    const target = resolve(temporaryDirectory);
    // Delete only the unique direct child created for this test.
    expect(dirname(target)).toBe(resolve(tmpdir()));
    expect(basename(target)).toMatch(/^mandegar-content-test-/);
    rmSync(target, { recursive: true, force: true });
  }
}

function editJson<T>(directory: string, filename: string, edit: (document: T) => void) {
  const file = join(directory, filename);
  const document = JSON.parse(readFileSync(file, "utf8")) as T;
  edit(document);
  writeFileSync(file, JSON.stringify(document), "utf8");
}

test("local content validates without a content server", () => {
  const result = validateFixture();
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain("Content validation passed:");
  expect(result.stdout).toContain("fa/en/ar complete.");
});

test("duplicate project URLs are rejected before publishing", () => {
  const result = validateFixture((directory) => editJson<Array<{ slug: string }>>(directory, "projects.json", (projects) => {
    projects[1].slug = projects[0].slug;
  }));
  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(/projects\[1\]\.slug: duplicate slug/);
});

test("missing Arabic project text identifies its field", () => {
  const result = validateFixture((directory) => editJson<Array<{ title: { ar?: string } }>>(directory, "projects.json", (projects) => {
    delete projects[0].title.ar;
  }));
  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(/projects\[0\]\.title\.ar: must be a translated string/);
});

test("media paths cannot escape the public directory", () => {
  const result = validateFixture((directory) => editJson<Record<string, { src: string }>>(directory, "media.json", (media) => {
    media.exhibition.src = "/../package.json";
  }));
  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(/media\.exhibition\.src:.*traversal/);
});

test("executable media URLs are rejected", () => {
  const result = validateFixture((directory) => editJson<Record<string, { src: string }>>(directory, "media.json", (media) => {
    media.exhibition.src = "javascript:alert(1)";
  }));
  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(/media\.exhibition\.src:.*root-relative public file path/);
});

test("related projects must reference real records", () => {
  const result = validateFixture((directory) => editJson<Array<{ relatedProjectSlugs: string[] }>>(directory, "projects.json", (projects) => {
    projects[0].relatedProjectSlugs = ["unknown-project"];
  }));
  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(/relatedProjectSlugs: unknown relationship: unknown-project/);
});

test("navigation cannot link to an archived project", () => {
  const result = validateFixture((directory) => {
    editJson<Array<{ publicationState: string }>>(directory, "projects.json", (projects) => {
      projects[0].publicationState = "archived";
    });
    editJson<{ navigation: Array<{ path: string }> }>(directory, "site.json", (site) => {
      site.navigation[0].path = "projects/placeholder-exhibition-01";
    });
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(/site\.navigation\[0\]\.path: references an unknown or unpublished detail page/);
});

test("navigation rejects an unknown homepage section", () => {
  const result = validateFixture((directory) => editJson<{ navigation: Array<{ path: string }> }>(directory, "site.json", (site) => {
    site.navigation[0].path = "#unknown";
  }));
  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(/site\.navigation\[0\]\.path: must be a safe internal route path/);
});

test("placeholder contacts cannot create active enquiry links", () => {
  const result = validateFixture((directory) => editJson<Array<{ email?: string }>>(directory, "contacts.json", (contacts) => {
    contacts[0].email = "contact@example.com";
  }));
  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(/contacts\[0\]: placeholder contacts must not publish usable/);
});

test("approved legal content requires a review date", () => {
  const result = validateFixture((directory) => editJson<{ status: string; updatedAt?: string }>(directory, "legal.json", (legal) => {
    legal.status = "approved";
    delete legal.updatedAt;
  }));
  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(/legal\.updatedAt: approved legal text needs an update date/);
});

test("strict launch validation flags labelled placeholder content", () => {
  const result = validateFixture(undefined, true);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Public launch blocker:");
  expect(result.stderr).toContain("legal information is still a review draft");
});
