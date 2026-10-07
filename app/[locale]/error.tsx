"use client";

import { RouteFeedback } from "@/components/editorial/RouteFeedback";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteFeedback reset={reset} />;
}
