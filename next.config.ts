import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "yogibo.openhost.cafe24.com",
        pathname: "/web/test/**",
      },
    ],
  },
};

export default nextConfig;
