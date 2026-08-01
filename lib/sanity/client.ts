import { createClient } from "next-sanity";

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
  return sanityClient.fetch<T>(query, params, { next: { revalidate: 60 } });
}
