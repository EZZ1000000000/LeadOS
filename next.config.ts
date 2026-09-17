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
};

export default nextConfig;
