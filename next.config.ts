import type { NextConfig } from "next";

/**
 * Cache Components (PPR-style) is intentionally disabled for the demo:
 * nearly every route reads the demo session cookie. Re-enable when
 * adopting Suspense shells + cached public segments.
 */
const nextConfig: NextConfig = {
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
