import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Không bật cacheComponents: dự án tự quản lý cache trong Supabase (xem Docs/tech-stack.md, mục 4b).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
