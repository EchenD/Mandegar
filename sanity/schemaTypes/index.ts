import { defineField, defineType } from "sanity";

const localizedFields = (type: "string" | "text" = "string") => [
  defineField({ name: "fa", title: "فارسی", type }),
  defineField({ name: "en", title: "English", type }),
  defineField({ name: "ar", title: "العربية", type }),
];

const localized = (name: string, title: string, type: "string" | "text" = "string") => defineField({ name, title, type: "object", fields: localizedFields(type) });

const mediaAsset = defineType({
  name: "mediaAsset",
  title: "Media asset",
  type: "object",
  fields: [
    defineField({ name: "image", title: "Image", type: "image", options: { hotspot: true } }),
    defineField({ name: "videoUrl", title: "Video URL", type: "url" }),
    defineField({ name: "kind", title: "Kind", type: "string", options: { list: ["image", "video", "video-placeholder"] } }),
    defineField({ name: "isPlaceholder", title: "Temporary placeholder", type: "boolean", initialValue: false }),
    defineField({ name: "mobileCrop", title: "Mobile crop", type: "image", options: { hotspot: true } }),
    localized("alt", "Alt text"),
    defineField({ name: "caption", title: "Caption", type: "object", fields: localizedFields("text") }),
    defineField({ name: "copyrightStatus", title: "Copyright status", type: "string" }),
  ],
});

const siteSettings = defineType({
  name: "siteSettings",
  title: "Site settings",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string", initialValue: "Mandegar" }),
    defineField({ name: "brandMark", title: "Brand mark", type: "image" }),
    defineField({ name: "defaultLocale", type: "string", initialValue: "fa" }),
    defineField({ name: "enabledLocales", type: "array", of: [{ type: "string" }], initialValue: ["fa", "en", "ar"] }),
    defineField({ name: "navigation", type: "array", of: [{ type: "object", fields: [defineField({ name: "label", type: "string" }), defineField({ name: "path", type: "string" }), defineField({ name: "order", type: "number" })] }] }),
    defineField({ name: "socialLinks", type: "array", of: [{ type: "url" }] }),
    defineField({ name: "seoDefaults", type: "object", fields: [localized("title", "Title"), localized("description", "Description", "text"), defineField({ name: "socialImage", type: "image" })] }),
    defineField({ name: "featureFlags", type: "object", fields: [defineField({ name: "callbackForm", type: "boolean" }), defineField({ name: "immersiveCanvas", type: "boolean", initialValue: true }), defineField({ name: "lenis", type: "boolean", initialValue: false })] }),
  ],
});

const homepage = defineType({
  name: "homepage",
  title: "Homepage",
  type: "document",
  fields: [
    defineField({ name: "locale", type: "string", options: { list: ["fa", "en", "ar"] } }),
    defineField({ name: "translationGroup", type: "string" }),
    localized("title", "SEO title"),
    localized("intro", "Intro", "text"),
    defineField({ name: "sections", type: "array", of: [{ type: "object", fields: [defineField({ name: "key", type: "string" }), defineField({ name: "variant", type: "string" }), defineField({ name: "visible", type: "boolean", initialValue: true }), defineField({ name: "order", type: "number" }), localized("title", "Title"), localized("body", "Body", "text"), defineField({ name: "media", type: "mediaAsset" }), defineField({ name: "projects", type: "array", of: [{ type: "reference", to: [{ type: "project" }] }] })] }] }),
  ],
});

const projectCategory = defineType({ name: "projectCategory", title: "Project category", type: "document", fields: [defineField({ name: "locale", type: "string" }), defineField({ name: "translationGroup", type: "string" }), localized("label", "Label"), defineField({ name: "slug", type: "slug", options: { source: "label.en" } }), localized("description", "Description", "text"), defineField({ name: "order", type: "number" })] });

const project = defineType({
  name: "project",
  title: "Project",
  type: "document",
  fields: [
    defineField({ name: "locale", type: "string", options: { list: ["fa", "en", "ar"] } }),
    defineField({ name: "translationGroup", type: "string" }),
    localized("title", "Title"),
    defineField({ name: "slug", type: "slug", options: { source: "title.en" } }),
    localized("summary", "Summary", "text"),
    defineField({ name: "year", type: "string" }),
    localized("client", "Client"),
    localized("sector", "Sector"),
    localized("location", "Location"),
    defineField({ name: "categories", type: "array", of: [{ type: "reference", to: [{ type: "projectCategory" }] }] }),
    defineField({ name: "services", type: "array", of: [{ type: "reference", to: [{ type: "service" }] }] }),
    localized("challenge", "Challenge", "text"), localized("concept", "Concept", "text"), localized("scope", "Scope", "text"), localized("outcomes", "Outcomes", "text"),
    defineField({ name: "heroMedia", type: "mediaAsset" }),
    defineField({ name: "mediaGallery", type: "array", of: [{ type: "mediaAsset" }] }),
    localized("credits", "Credits", "text"),
    defineField({ name: "featured", type: "boolean", initialValue: false }), defineField({ name: "featuredRank", type: "number" }),
    defineField({ name: "publicationState", type: "string", options: { list: ["draft", "published", "archived"] }, initialValue: "draft" }),
  ],
});

const service = defineType({ name: "service", title: "Service", type: "document", fields: [defineField({ name: "locale", type: "string" }), defineField({ name: "translationGroup", type: "string" }), localized("title", "Title"), defineField({ name: "slug", type: "slug", options: { source: "title.en" } }), localized("summary", "Summary", "text"), localized("detail", "Detail", "text"), defineField({ name: "capabilities", type: "array", of: [{ type: "object", fields: localizedFields() }] }), defineField({ name: "media", type: "mediaAsset" }), defineField({ name: "order", type: "number" }), defineField({ name: "status", type: "string", options: { list: ["current", "emerging", "archived"] } })] });

const testimonial = defineType({ name: "testimonial", title: "Testimonial", type: "document", fields: [defineField({ name: "locale", type: "string" }), localized("quote", "Quote", "text"), localized("person", "Person"), localized("role", "Role"), localized("organization", "Organization"), defineField({ name: "project", type: "reference", to: [{ type: "project" }] }), defineField({ name: "approved", type: "boolean" })] });
const client = defineType({ name: "client", title: "Client", type: "document", fields: [defineField({ name: "name", type: "string" }), defineField({ name: "logo", type: "image" }), defineField({ name: "url", type: "url" }), defineField({ name: "sector", type: "string" }), defineField({ name: "visibility", type: "string", options: { list: ["visible", "hidden", "pending-permission"] } })] });
const metric = defineType({ name: "metric", title: "Metric", type: "document", fields: [localized("label", "Label"), defineField({ name: "value", type: "string" }), defineField({ name: "unit", type: "string" }), localized("context", "Context", "text"), defineField({ name: "sourceNote", type: "text" }), defineField({ name: "project", type: "reference", to: [{ type: "project" }] })] });
const contactChannel = defineType({ name: "contactChannel", title: "Contact channel", type: "document", fields: [defineField({ name: "purpose", type: "string", options: { list: ["sales", "general", "international", "whatsapp"] } }), localized("label", "Label"), defineField({ name: "department", type: "string" }), defineField({ name: "phone", type: "string" }), defineField({ name: "whatsapp", type: "string" }), defineField({ name: "email", type: "email" }), defineField({ name: "country", type: "string" }), defineField({ name: "availability", type: "string" }), defineField({ name: "priority", type: "number" })] });
const teamPartner = defineType({ name: "teamPartner", title: "Team / partner", type: "document", fields: [defineField({ name: "name", type: "string" }), localized("role", "Role"), localized("biography", "Biography", "text"), defineField({ name: "image", type: "image" }), defineField({ name: "location", type: "string" }), defineField({ name: "partnerType", type: "string" })] });
const redirect = defineType({ name: "redirect", title: "Redirect", type: "document", fields: [defineField({ name: "oldPath", type: "string" }), defineField({ name: "newPath", type: "string" }), defineField({ name: "statusCode", type: "number", initialValue: 301 })] });

export const schemaTypes = [mediaAsset, siteSettings, homepage, projectCategory, project, service, testimonial, client, metric, contactChannel, teamPartner, redirect];
