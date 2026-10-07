import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { documentInternationalization } from "@sanity/document-internationalization";
import { schemaTypes } from "./sanity/schemaTypes";

export default defineConfig({
  name: "mandegar-studio",
  title: "Mandegar Studio",
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "replace-me",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  plugins: [
    structureTool(),
    documentInternationalization({
      supportedLanguages: [{ id: "fa", title: "Persian" }, { id: "en", title: "English" }, { id: "ar", title: "Arabic" }],
      languageField: "locale",
      schemaTypes: ["homepage", "editorialPage", "project", "projectCategory", "service", "testimonial", "legalPage"],
    }),
  ],
  schema: { types: schemaTypes },
});
