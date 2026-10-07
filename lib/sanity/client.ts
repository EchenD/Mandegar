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

export type SanityFetchOptions = { publishedOnly?: boolean };

export async function sanityFetch<T>(query: string, params: Record<string, unknown> = {}, options: SanityFetchOptions = {}) {
  if (!sanityClient) return null;
  // Build-time URL enumeration runs without a request or draft mode.
  // Refresh slugs from the source on every build, bypassing persistent and CDN caches.
  if (options.publishedOnly) {
    return sanityClient.withConfig({ useCdn: false }).fetch<T>(query, params, { cache: "no-store" });
  }
  if (process.env.MANDEGAR_STATIC_EXPORT === "1") {
    return sanityClient.fetch<T>(query, params, { cache: "force-cache" });
  }
  const preview = (await draftMode()).isEnabled;
  const token = preview ? process.env.SANITY_API_READ_TOKEN : undefined;
  const client = sanityClient.withConfig({
    useCdn: !preview,
    perspective: preview && token ? "previewDrafts" : "published",
    token,
  });
  return client.fetch<T>(query, params, preview ? { cache: "no-store" } : { next: { revalidate: 60 } });
}
