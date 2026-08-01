import type { Metadata } from "next";
import "@/styles/globals.css";
import { siteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: "Mandegar",
  description: "Mandegar creates complete events and exhibitions through interaction, technology and content.",
};

export default function RootRedirectLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fa" dir="rtl" data-scroll-behavior="smooth"><body>{children}</body></html>;
}
