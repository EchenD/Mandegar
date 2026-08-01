import { notFound } from "next/navigation";
import { StudioClient } from "@/components/studio/StudioClient";

export default function StudioPage() {
  const enabled = process.env.NODE_ENV !== "production" || process.env.ENABLE_EMBEDDED_STUDIO === "true";
  if (!enabled) notFound();
  return <StudioClient />;
}
