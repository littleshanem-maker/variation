import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/calculator',
        destination: '/calculator.html',
      },
    ];
  },
};

export default nextConfig;
