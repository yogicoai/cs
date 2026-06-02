import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 상위 디렉터리에 stray lockfile이 있을 때 Next가 워크스페이스 루트를 잘못 추정해
  // 모듈 해석이 깨지는 문제를 방지하려고 프로젝트 디렉터리를 명시한다.
  turbopack: {
    root: path.resolve(__dirname),
  },
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
