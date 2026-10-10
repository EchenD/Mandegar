import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const dirIndex = args.indexOf("--dir");
const directoryArgument = dirIndex >= 0 ? args[dirIndex + 1] : args.find((arg) => arg.startsWith("--dir="))?.slice(6);
if (dirIndex >= 0 && (!directoryArgument || directoryArgument.startsWith("--"))) {
  console.error("Content validation: --dir requires a directory path.");
  process.exit(1);
}
const contentDirectory = resolve(root, directoryArgument || "content");
const publicDirectory = resolve(root, "public");
const strict = args.includes("--strict");
const locales = ["fa", "en", "ar"];
const errors = [];
const warnings = [];
const files = ["projects", "services", "media", "homepage", "site", "contacts", "people", "trust", "pages", "legal", "page-copy", "journey", "seo", "ui"];
const data = {};
const error = (path, message) => errors.push(`${path}: ${message}`);
const warn = (path, message) => warnings.push(`${path}: ${message}`);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const requiredString = (value, path) => {
  if (typeof value !== "string" || !value.trim()) error(path, "must be a non-empty string");
};
const requiredBoolean = (value, path) => {
  if (typeof value !== "boolean") error(path, "must explicitly be true or false");
};

for (const filename of files) {
  try {
    data[filename] = JSON.parse(readFileSync(resolve(contentDirectory, `${filename}.json`), "utf8"));
  } catch (cause) {
    error(`${filename}.json`, cause.message);
  }
}

// Only the optional CDN origin is read from local configuration, never tokens.
const localEnvironment = existsSync(resolve(root, ".env.local")) ? readFileSync(resolve(root, ".env.local"), "utf8") : "";
const configuredOrigin = process.env.MEDIA_CDN_ORIGIN || localEnvironment.match(/^\s*MEDIA_CDN_ORIGIN\s*=\s*["']?([^\s"'#]+)/m)?.[1];
let cdnOrigin;
if (configuredOrigin) {
  try {
    const url = new URL(configuredOrigin);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error();
    cdnOrigin = url.origin;
  } catch {
    error("MEDIA_CDN_ORIGIN", "must be an HTTPS origin without a path, credentials or query");
  }
}

function localized(value, path, allowEmpty = false) {
  if (!isRecord(value)) return error(path, "must provide fa, en and ar strings");
  for (const locale of locales) {
    if (typeof value[locale] !== "string" || (!allowEmpty && !value[locale].trim())) error(`${path}.${locale}`, "must be a translated string");
  }
}

function checkText(value, path) {
  if (typeof value === "string") {
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) error(path, "contains control characters");
    if (/[ØÙÛ]|â€|ï¿½|\uFFFD/.test(value)) error(path, "contains possible damaged text encoding");
    if (/<\s*(script|iframe|object|embed)\b/i.test(value)) error(path, "contains executable markup; content must be plain text");
    return;
  }
  if (Array.isArray(value)) return value.forEach((item, index) => checkText(item, `${path}[${index}]`));
  if (!isRecord(value)) return;
  if (locales.some((locale) => own(value, locale))) {
    for (const locale of locales) if (!own(value, locale)) error(path, `is missing the ${locale} translation`);
    const structures = locales.map((locale) => value[locale]);
    if (structures.every(isRecord)) {
      const keys = new Set(structures.flatMap((item) => Object.keys(item)));
      for (const locale of locales) {
        for (const key of keys) if (!own(value[locale], key)) error(`${path}.${locale}`, `is missing the ${key} field`);
      }
    }
  }
  for (const [key, item] of Object.entries(value)) checkText(item, `${path}.${key}`);
}

function safeHttps(value, path, media = false) {
  if (typeof value !== "string") return error(path, "must be a URL string");
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || /[\s\\]/.test(value)) throw new Error();
    if (media && (!cdnOrigin || url.origin !== cdnOrigin)) error(path, "remote media must match the configured MEDIA_CDN_ORIGIN");
    if (/(^|\.)(example\.(com|org|net)|invalid|test|localhost)$/.test(url.hostname)) error(path, "placeholder hosts must not be published as usable links");
  } catch {
    error(path, "must be a safe HTTPS URL without credentials or whitespace");
  }
}

function assetPath(value, path) {
  if (typeof value !== "string") return error(path, "must be a local asset path or an approved CDN URL");
  if (/^https:\/\//.test(value)) return safeHttps(value, path, true);
  if (!value.startsWith("/") || value.startsWith("//") || /[\\?#\s]/.test(value) || /(?:^|\/)\.\.(?:\/|$)/.test(value) || value.includes("%")) {
    return error(path, "must be a root-relative public file path without traversal, query or base path");
  }
  const resolved = resolve(publicDirectory, `.${value}`);
  const distance = relative(publicDirectory, resolved);
  if (distance.startsWith("..") || isAbsolute(distance)) return error(path, "must remain inside public/");
  if (!existsSync(resolved)) error(path, `file does not exist in public/: ${value}`);
}

function publication(value, path) {
  if (!["draft", "published", "archived"].includes(value)) error(path, "must be draft, published or archived");
}

function records(value, path) {
  if (!Array.isArray(value)) {
    error(path, "must be an array");
    return [];
  }
  return value;
}

const allProjects = records(data.projects, "projects");
const allServices = records(data.services, "services");
const mediaAssets = isRecord(data.media) ? data.media : {};
if (!isRecord(data.media)) error("media", "must be a keyed asset object");
const projectSlugs = new Set();
const serviceSlugs = new Set();

function validateCollection(collection, label, slugs) {
  for (const [index, item] of collection.entries()) {
    const path = `${label}[${index}]`;
    if (!isRecord(item)) { error(path, "must be a content object"); continue; }
    if (typeof item.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)) error(`${path}.slug`, "must use lowercase URL-safe words separated by single hyphens");
    if (slugs.has(item.slug)) error(`${path}.slug`, "duplicate slug");
    slugs.add(item.slug);
    publication(item.publicationState, `${path}.publicationState`);
    requiredBoolean(item.isPlaceholder, `${path}.isPlaceholder`);
    for (const field of label === "projects" ? ["title", "eyebrow", "summary", "category", "location", "challenge", "approach", "scope", "outcome"] : ["title", "summary", "detail"]) localized(item[field], `${path}.${field}`);
    for (const field of label === "projects" ? ["services"] : ["capabilities", "deliverables"]) {
      const values = records(item[field], `${path}.${field}`);
      if (!values.length) error(`${path}.${field}`, "must include at least one item");
      values.forEach((entry, entryIndex) => localized(entry, `${path}.${field}[${entryIndex}]`));
    }
    if (!own(mediaAssets, item.media)) error(`${path}.media`, "references an unknown media key");
    if (item.isPlaceholder && item.publicationState === "published") warn(path, "published concept / generic copy remains to be replaced");
    if (label === "projects") {
      requiredString(item.year, `${path}.year`);
      if (item.client) localized(item.client, `${path}.client`);
      if (item.credits) localized(item.credits, `${path}.credits`);
      if (item.categories) records(item.categories, `${path}.categories`).forEach((category, n) => localized(category, `${path}.categories[${n}]`));
      const gallery = records(item.gallery, `${path}.gallery`);
      if (!gallery.length) error(`${path}.gallery`, "must include at least one media key");
      gallery.forEach((key, n) => { if (!own(mediaAssets, key)) error(`${path}.gallery[${n}]`, "references an unknown media key"); });
    } else {
      requiredString(item.number, `${path}.number`);
      if (item.status && !["current", "emerging"].includes(item.status)) error(`${path}.status`, "must be current or emerging");
      for (const [n, step] of records(item.process, `${path}.process`).entries()) {
        localized(step?.title, `${path}.process[${n}].title`);
        localized(step?.body, `${path}.process[${n}].body`);
      }
      for (const [n, faq] of records(item.faq, `${path}.faq`).entries()) {
        localized(faq?.question, `${path}.faq[${n}].question`);
        localized(faq?.answer, `${path}.faq[${n}].answer`);
      }
    }
    if (item.publicationState === "published") {
      for (const key of [item.media, ...(label === "projects" && Array.isArray(item.gallery) ? item.gallery : [])]) {
        const asset = mediaAssets[key];
        if (asset && !asset.isPlaceholder && asset.rightsStatus !== "approved") error(`${path}.media`, `asset ${key} requires approved publication rights`);
      }
    }
  }
}

validateCollection(allProjects, "projects", projectSlugs);
validateCollection(allServices, "services", serviceSlugs);

function relationship(slugs, known, path, ownSlug) {
  if (slugs === undefined) return;
  const entries = records(slugs, path);
  const seen = new Set();
  for (const slug of entries) {
    if (!known.has(slug)) error(path, `unknown relationship: ${slug}`);
    if (seen.has(slug)) error(path, `duplicate relationship: ${slug}`);
    if (slug === ownSlug) error(path, "must not reference itself");
    seen.add(slug);
  }
}
for (const project of allProjects) {
  if (!isRecord(project)) continue;
  relationship(project.relatedProjectSlugs, projectSlugs, `projects.${project.slug}.relatedProjectSlugs`, project.slug);
  relationship(project.serviceSlugs, serviceSlugs, `projects.${project.slug}.serviceSlugs`);
}
for (const service of allServices) if (isRecord(service)) relationship(service.relatedProjectSlugs, projectSlugs, `services.${service.slug}.relatedProjectSlugs`);

for (const [key, asset] of Object.entries(mediaAssets)) {
  const path = `media.${key}`;
  if (!isRecord(asset)) { error(path, "must be an asset object"); continue; }
  if (!["image", "video", "video-placeholder"].includes(asset.kind)) error(`${path}.kind`, "must be image, video or video-placeholder");
  requiredBoolean(asset.isPlaceholder, `${path}.isPlaceholder`);
  localized(asset.alt, `${path}.alt`);
  if (asset.caption) localized(asset.caption, `${path}.caption`);
  for (const field of ["src", "mobileSrc", "poster", "captionsSrc"]) if (field === "src" || asset[field]) assetPath(asset[field], `${path}.${field}`);
  if (asset.kind === "video" && !asset.poster) error(`${path}.poster`, "a video needs an image poster for linked previews and reduced motion");
  if (!["placeholder", "pending", "approved"].includes(asset.rightsStatus)) error(`${path}.rightsStatus`, "must be placeholder, pending or approved");
  if (asset.isPlaceholder && asset.rightsStatus !== "placeholder") error(`${path}.rightsStatus`, "placeholder media must carry placeholder rights status");
  if (!asset.isPlaceholder && asset.rightsStatus === "placeholder") error(`${path}.rightsStatus`, "real media must have pending or approved rights status");
  if (!asset.isPlaceholder) requiredString(asset.sourceNote, `${path}.sourceNote`);
  if (asset.isPlaceholder) warn(path, "placeholder media remains to be replaced");
}

const publishedProjectSlugs = new Set(allProjects.filter((project) => isRecord(project) && project.publicationState === "published").map((project) => project.slug));
const publishedServiceSlugs = new Set(allServices.filter((service) => isRecord(service) && service.publicationState === "published").map((service) => service.slug));

function publicRoute(value, path, localeRequired = false) {
  const homeSections = ["#showcase", "#services", "#about", "#partners", "#contact"];
  if (!localeRequired && homeSections.includes(value)) return;
  if (typeof value !== "string" || /[\s\\?#%:]/.test(value) || value.startsWith("//") || value.includes("..")) return error(path, "must be a safe internal route path");
  const segments = value.replace(/^\//, "").split("/").filter(Boolean);
  if (locales.includes(segments[0])) {
    if (!localeRequired) error(path, "navigation paths must be locale-free suffixes; the site adds the locale");
    segments.shift();
  }
  else if (localeRequired) error(path, "homepage CTA paths must include fa, en or ar");
  const [page, slug, ...extra] = segments;
  if (extra.length || (page && !["projects", "services", "about", "partners", "contact", "legal"].includes(page))) return error(path, "must point to an existing public page");
  if (slug && (page === "projects" ? !publishedProjectSlugs.has(slug) : page === "services" ? !publishedServiceSlugs.has(slug) : true)) error(path, "references an unknown or unpublished detail page");
}

if (isRecord(data.site)) {
  requiredString(data.site.title, "site.title");
  requiredString(data.site.copyrightHolder, "site.copyrightHolder");
  localized(data.site.footerLine, "site.footerLine");
  localized(data.site.globalLine, "site.globalLine");
  if (data.site.address) localized(data.site.address, "site.address", true);
  if (data.site.brandMark) assetPath(data.site.brandMark, "site.brandMark");
  if (data.site.socialImage) assetPath(data.site.socialImage, "site.socialImage");
  records(data.site.navigation, "site.navigation").forEach((item, index) => {
    if (!isRecord(item)) return error(`site.navigation[${index}]`, "must be a navigation object");
    localized(item.label, `site.navigation[${index}].label`);
    publicRoute(item.path, `site.navigation[${index}].path`);
    if (!Number.isFinite(item.order)) error(`site.navigation[${index}].order`, "must be a numeric order");
  });
  records(data.site.socialLinks, "site.socialLinks").forEach((item, index) => {
    if (!isRecord(item)) return error(`site.socialLinks[${index}]`, "must be a social link object");
    requiredString(item.label, `site.socialLinks[${index}].label`);
    safeHttps(item.url, `site.socialLinks[${index}].url`);
  });
  for (const flag of ["callbackForm", "immersiveCanvas", "lenis"]) requiredBoolean(data.site.featureFlags?.[flag], `site.featureFlags.${flag}`);
} else error("site", "must be an object");

if (isRecord(data.homepage)) {
  requiredBoolean(data.homepage.useContentOverrides, "homepage.useContentOverrides");
  const homeKeys = ["kicker", "title", "intro", "conceptTitle", "conceptBody", "spaceTitle", "spaceBody", "interactiveTitle", "interactiveBody", "proofTitle", "proofBody", "systemTitle", "systemBody", "intelligenceTitle", "intelligenceBody", "trustTitle", "trustBody", "memoryTitle", "memoryBody", "ctaTitle", "ctaBody"];
  for (const locale of locales) for (const key of homeKeys) requiredString(data.homepage.copy?.[locale]?.[key], `homepage.copy.${locale}.${key}`);
  relationship(data.homepage.featuredProjectSlugs, projectSlugs, "homepage.featuredProjectSlugs");
  for (const [key, value] of Object.entries(data.homepage.mediaOverrides || {})) if (!own(mediaAssets, value)) error(`homepage.mediaOverrides.${key}`, "references an unknown media key");
  for (const [key, value] of Object.entries(data.homepage.ctaOverrides || {})) {
    if (!isRecord(value)) { error(`homepage.ctaOverrides.${key}`, "must be a CTA object"); continue; }
    if (value.label) localized(value.label, `homepage.ctaOverrides.${key}.label`);
    if (value.href) publicRoute(value.href, `homepage.ctaOverrides.${key}.href`, true);
  }
} else error("homepage", "must be an object");

for (const [index, channel] of records(data.contacts, "contacts").entries()) {
  const path = `contacts[${index}]`;
  if (!isRecord(channel)) { error(path, "must be a contact object"); continue; }
  if (!["sales", "general", "international", "whatsapp"].includes(channel.purpose)) error(`${path}.purpose`, "must be sales, general, international or whatsapp");
  localized(channel.label, `${path}.label`);
  if (channel.description) localized(channel.description, `${path}.description`);
  if (channel.availabilityText) localized(channel.availabilityText, `${path}.availabilityText`);
  requiredBoolean(channel.isPlaceholder, `${path}.isPlaceholder`);
  if (channel.isPlaceholder) {
    warn(path, "verified contact information remains to be added");
    if (channel.phone || channel.email || channel.whatsapp) error(path, "placeholder contacts must not publish usable phone, email or WhatsApp links");
  } else if (!channel.phone && !channel.email && !channel.whatsapp) error(path, "a verified contact needs at least one usable channel");
  if (channel.email && (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(channel.email) || /@(example\.(com|org|net)|.*\.(invalid|test))$/i.test(channel.email))) error(`${path}.email`, "must be a verified, valid email address without placeholder domains");
  if (channel.phone && !/^\+[1-9]\d{6,14}$/.test(channel.phone)) error(`${path}.phone`, "must use E.164 international format, such as + followed by country code and digits");
  if (channel.whatsapp) {
    if (/^https:\/\//.test(channel.whatsapp)) {
      safeHttps(channel.whatsapp, `${path}.whatsapp`);
      try { if (new URL(channel.whatsapp).hostname !== "wa.me") error(`${path}.whatsapp`, "must use a wa.me link"); } catch {}
    } else if (!/^\+?[1-9]\d{6,14}$/.test(channel.whatsapp)) error(`${path}.whatsapp`, "must use an international number or a safe wa.me link");
  }
}

for (const [index, person] of records(data.people, "people").entries()) {
  const path = `people[${index}]`;
  if (!isRecord(person)) { error(path, "must be a profile object"); continue; }
  requiredString(person.name, `${path}.name`);
  localized(person.role, `${path}.role`);
  localized(person.biography, `${path}.biography`);
  publication(person.publicationState, `${path}.publicationState`);
  requiredBoolean(person.isPlaceholder, `${path}.isPlaceholder`);
  if (person.isPlaceholder) warn(path, "placeholder profile is hidden until confirmed");
}

if (isRecord(data.trust)) {
  for (const key of ["clients", "metrics", "testimonials"]) {
    records(data.trust[key], `trust.${key}`).forEach((item, index) => {
      const path = `trust.${key}[${index}]`;
      if (!isRecord(item)) return error(path, "must be an evidence object");
      requiredString(item.approvalNote, `${path}.approvalNote`);
      publication(item.publicationState, `${path}.publicationState`);
      requiredBoolean(item.isPlaceholder, `${path}.isPlaceholder`);
      if (item.isPlaceholder) warn(path, "placeholder evidence is hidden until approved");
      if (key === "clients") {
        requiredString(item.name, `${path}.name`);
        if (item.logo) assetPath(item.logo, `${path}.logo`);
        if (item.url) safeHttps(item.url, `${path}.url`);
      } else if (key === "metrics") {
        localized(item.label, `${path}.label`);
        localized(item.context, `${path}.context`);
        requiredString(item.value, `${path}.value`);
        requiredString(item.sourceNote, `${path}.sourceNote`);
      } else for (const field of ["quote", "person", "role", "organization"]) localized(item[field], `${path}.${field}`);
    });
  }
} else error("trust", "must be an object");

for (const pageKey of ["projects", "services", "about", "partners", "contact"]) {
  const page = data.pages?.[pageKey];
  if (!isRecord(page)) { error(`pages.${pageKey}`, "must be an editorial page object"); continue; }
  for (const field of ["heroKicker", "title", "intro"]) localized(page[field], `pages.${pageKey}.${field}`);
  localized(page.seo?.title, `pages.${pageKey}.seo.title`);
  localized(page.seo?.description, `pages.${pageKey}.seo.description`);
  const keys = new Set();
  records(page.sections, `pages.${pageKey}.sections`).forEach((section, index) => {
    const path = `pages.${pageKey}.sections[${index}]`;
    if (!isRecord(section)) return error(path, "must be a section object");
    requiredString(section.key, `${path}.key`);
    if (keys.has(section.key)) error(`${path}.key`, "duplicate section key");
    keys.add(section.key);
    for (const field of ["kicker", "title", "body"]) if (section[field]) localized(section[field], `${path}.${field}`);
    records(section.items, `${path}.items`).forEach((item, n) => localized(item, `${path}.items[${n}]`));
  });
}

if (isRecord(data.legal)) {
  localized(data.legal.title, "legal.title");
  localized(data.legal.intro, "legal.intro");
  if (!["draft", "approved"].includes(data.legal.status)) error("legal.status", "must be draft or approved");
  if (data.legal.status === "draft") warn("legal", "legal information is still a review draft");
  if (data.legal.status === "approved" && !data.legal.updatedAt) error("legal.updatedAt", "approved legal text needs an update date");
  if (data.legal.updatedAt) {
    const updated = new Date(data.legal.updatedAt);
    if (typeof data.legal.updatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.legal.updatedAt) || Number.isNaN(updated.getTime()) || updated.toISOString().slice(0, 10) !== data.legal.updatedAt) error("legal.updatedAt", "must use a valid YYYY-MM-DD date");
  }
  const sections = records(data.legal.sections, "legal.sections");
  if (!sections.length) error("legal.sections", "must include at least one section");
  sections.forEach((section, index) => {
    localized(section?.heading, `legal.sections[${index}].heading`);
    localized(section?.body, `legal.sections[${index}].body`);
  });
} else error("legal", "must be an object");

for (const locale of locales) {
  if (!isRecord(data["page-copy"]?.[locale])) error(`page-copy.${locale}`, "must provide translated interface content");
  else {
    for (const [key, value] of Object.entries(data["page-copy"][locale])) {
      if (key === "briefFields") records(value, `page-copy.${locale}.${key}`).forEach((field, index) => requiredString(field, `page-copy.${locale}.${key}[${index}]`));
      else if (["aboutWorkflowSteps", "aboutTeamRoles"].includes(key)) records(value, `page-copy.${locale}.${key}`).forEach((step, index) => {
        const path = `page-copy.${locale}.${key}[${index}]`;
        requiredString(step?.title, `${path}.title`);
        requiredString(step?.body, `${path}.body`);
        if (key === "aboutTeamRoles" && !mediaAssets[step?.media]) error(`${path}.media`, "must reference a media key in media.json");
      });
      else requiredString(value, `page-copy.${locale}.${key}`);
    }
  }
  if (!isRecord(data.ui?.[locale])) error(`ui.${locale}`, "must provide translated navigation and interface text");
  for (const page of ["home", "projects", "services", "about", "partners", "contact", "legal"]) {
    const tuple = data.seo?.[locale]?.[page];
    if (!Array.isArray(tuple) || tuple.length !== 2) error(`seo.${locale}.${page}`, "must provide [title, description]");
    else tuple.forEach((value, index) => requiredString(value, `seo.${locale}.${page}[${index}]`));
  }
}

const journeyCopy = data.journey;
for (const locale of locales) {
  const copy = journeyCopy?.copy?.[locale];
  for (const field of ["work", "entry", "aboutLabel", "aboutBody", "more", "partners", "partnersLabel", "placeholder", "finale", "contact", "demo", "scroll", "detail", "genericPartnersLabel", "genericPartnersNote"]) {
    requiredString(copy?.[field], `journey.copy.${locale}.${field}`);
  }
  for (const field of ["about", "disciplines"]) {
    const items = records(copy?.[field], `journey.copy.${locale}.${field}`);
    if (!items.length) error(`journey.copy.${locale}.${field}`, "must include at least one item");
    items.forEach((value, index) => requiredString(value, `journey.copy.${locale}.${field}[${index}]`));
  }
  const typing = journeyCopy?.aboutTyping?.[locale];
  requiredString(typing?.base, `journey.aboutTyping.${locale}.base`);
  const words = records(typing?.words, `journey.aboutTyping.${locale}.words`);
  if (!words.length) error(`journey.aboutTyping.${locale}.words`, "must include at least one word");
  words.forEach((value, index) => requiredString(value, `journey.aboutTyping.${locale}.words[${index}]`));
}

for (const [filename, value] of Object.entries(data)) checkText(value, filename);
if (strict && warnings.length) for (const message of warnings) errors.push(`Public launch blocker: ${message}`);

if (errors.length) {
  console.error(`Content validation failed (${errors.length} issue${errors.length === 1 ? "" : "s"}):`);
  for (const message of errors) console.error(`- ${message}`);
  process.exit(1);
}

console.log(`Content validation passed: ${allProjects.length} projects, ${allServices.length} services, ${Object.keys(mediaAssets).length} media assets; fa/en/ar complete.`);
if (warnings.length) console.log(`${warnings.length} labelled placeholders or review drafts remain. Use --strict to require approved launch content.`);
