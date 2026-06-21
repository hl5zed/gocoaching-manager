import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.1.220"],
  poweredByHeader: false,
  compress: true,
  experimental: {
    optimizePackageImports: [
      "@supabase/supabase-js",
      "@supabase/ssr",
      "leaflet",
      "react-leaflet",
      "@xyflow/react",
      "tailwind-merge",
      "clsx",
    ],
  },
};

export default nextConfig;
