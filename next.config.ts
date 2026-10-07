import type { NextConfig } from "next";

const staticExport = process.env.MANDEGAR_STATIC_EXPORT === "1";
const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const basePath = !configuredBasePath || configuredBasePath === "/"
  ? ""
  : `/${configuredBasePath.replace(/^\/+|\/+$/g, "")}`;
const mediaCdnOrigin = process.env.MEDIA_CDN_ORIGIN ? new URL(process.env.MEDIA_CDN_ORIGIN) : null;
if (mediaCdnOrigin && (mediaCdnOrigin.protocol !== "https:" || mediaCdnOrigin.username || mediaCdnOrigin.password)) {
  throw new Error("MEDIA_CDN_ORIGIN must be a public HTTPS origin without credentials.");
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  poweredByHeader: false,
  // The locale lives in the root layout, so unmatched routes need a global 404.
  experimental: { globalNotFound: true },
  output: staticExport ? "export" : undefined,
  distDir: staticExport ? ".next-static" : ".next",
  basePath: staticExport ? basePath : undefined,
  trailingSlash: staticExport,
  typescript: staticExport ? { tsconfigPath: "tsconfig.pages.json" } : undefined,
  images: {
    formats: ["image/avif", "image/webp"],
    unoptimized: staticExport,
    remotePatterns: mediaCdnOrigin ? [{ protocol: "https", hostname: mediaCdnOrigin.hostname, port: mediaCdnOrigin.port }] : [],
  },
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    if (process.env.NODE_ENV === "production") headers.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
