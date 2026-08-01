import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedPath = url.searchParams.get("redirect") || "/fa";
  const redirectPath = requestedPath.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/fa";
  const draft = await draftMode();
  draft.disable();
  redirect(redirectPath);
}
