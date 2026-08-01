import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  const redirectPath = url.searchParams.get("redirect") || "/fa";
  if (!process.env.SANITY_REVALIDATE_SECRET || secret !== process.env.SANITY_REVALIDATE_SECRET) {
    return new Response("Invalid secret", { status: 401 });
  }
  const draft = await draftMode();
  draft.enable();
  redirect(redirectPath);
}
