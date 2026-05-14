import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.westra.in",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
