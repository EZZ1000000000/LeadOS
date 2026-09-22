import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  experimental: {
    // سقف ذاكرة Turbopack — الأجهزة الصغيرة (4GB) بتقتل السيرفر OOM بدونه
    turbopackMemoryLimit: 1024,
  },
  // SPA fallback: أي مسار مش API/ملف ثابت يرجع للواجهة — عشان الـdeep links
  // والـrefresh على /leads وغيرها ما يرجعوش 404 (التطبيق صفحة واحدة)
  async rewrites() {
    return [
      {
        source: "/((?!api/|_next/|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
        destination: "/",
      },
    ];
  },
};

export default nextConfig;
