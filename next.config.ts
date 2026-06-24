import type { NextConfig } from "next";

// Vercel production build: fail early if service role key is missing (CRITICAL_REVIEW B6).
// Local/CI builds are unaffected — CI has no Vercel env; local dev uses .env.local at runtime.
if (process.env.VERCEL === "1" && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is required for Vercel builds. Add it in Project Settings → Environment Variables.",
  );
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.1.220"],
  poweredByHeader: false,
  compress: true,
  experimental: {
    optimizePackageImports: [
      "@supabase/supabase-js",
      "@supabase/ssr",
      // "leaflet",
      // "react-leaflet",
      "tailwind-merge",
      "clsx",
    ],
  },
};

export default nextConfig;
