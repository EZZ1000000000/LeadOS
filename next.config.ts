import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  /* جذر Turbopack مثبّت صراحة — بدونه لو فيه lockfile في مجلد أعلى (زي مجلد المستخدم
     على ويندوز) بيختار جذر غلط ويبوّظ مسارات الـstandalone ويبوّظ البناء */
  turbopack: {
    root: path.resolve(),
  },
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
