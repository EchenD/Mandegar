import type { Metadata } from "next";
import "@fontsource-variable/vazirmatn";
import "@/styles/globals.css";
import { RouteFeedback } from "@/components/editorial/RouteFeedback";
import { getPageCopy } from "@/lib/page-copy";

export const metadata: Metadata = {
  title: getPageCopy("fa").notFoundTitle,
  robots: { index: false, follow: true },
};

export default function GlobalNotFound() {
  return (
    <html lang="fa" dir="rtl">
      <body><main id="main-content"><RouteFeedback /></main></body>
    </html>
  );
}
