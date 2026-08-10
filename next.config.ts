import type { NextConfig } from "next";

const staticExport = process.env.MANDEGAR_STATIC_EXPORT === "1";
const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const basePath = !configuredBasePath || configuredBasePath === "/"
  ? ""
  : `/${configuredBasePath.replace(/^\/+|\/+$/g, "")}`;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: staticExport ? "export" : undefined,
  distDir: staticExport ? ".next-static" : ".next",
  basePath: staticExport ? basePath : undefined,
  trailingSlash: staticExport,
  typescript: staticExport ? { tsconfigPath: "tsconfig.pages.json" } : undefined,
  images: {
    formats: ["image/avif", "image/webp"],
    unoptimized: staticExport,
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
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
