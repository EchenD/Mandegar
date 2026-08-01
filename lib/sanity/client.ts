import { createClient } from "next-sanity";
import { draftMode } from "next/headers";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";

export const sanityClient = projectId
  ? createClient({
      projectId,
      dataset,
      apiVersion: process.env.SANITY_API_VERSION || "2025-01-01",
      useCdn: true,
      perspective: "published",
    })
  : null;

export async function sanityFetch<T>(query: string, params: Record<string, unknown> = {}) {
  if (!sanityClient) return null;
  const preview = (await draftMode()).isEnabled;
  const token = preview ? process.env.SANITY_API_READ_TOKEN : undefined;
  const client = sanityClient.withConfig({
    useCdn: !preview,
    perspective: preview && token ? "previewDrafts" : "published",
    token,
  });
  return client.fetch<T>(query, params, preview ? { cache: "no-store" } : { next: { revalidate: 60 } });
}
