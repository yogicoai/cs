import path from "node:path";
import type { NextConfig } from "next";

// 자사몰(cafe24 mall) iframe embed 허용을 위한 화이트리스트.
// yogibo.kr 및 yogibo.openhost.cafe24.com (프리뷰) 도메인만 허용한다.
// 필요 시 CAFE24_IFRAME_PARENTS 환경변수로 공백 구분 도메인을 덧붙일 수 있다.
const DEFAULT_IFRAME_PARENTS = [
  "https://yogibo.kr",
  "https://*.yogibo.kr",
  "https://yogibo.openhost.cafe24.com",
];
const EXTRA_IFRAME_PARENTS = (process.env.CAFE24_IFRAME_PARENTS ?? "")
  .split(/\s+/)
  .map((s) => s.trim())
  .filter(Boolean);
const FRAME_ANCESTORS = ["'self'", ...DEFAULT_IFRAME_PARENTS, ...EXTRA_IFRAME_PARENTS].join(" ");

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
        pathname: "/web/**",
      },
    ],
  },
  async headers() {
    return [
      {
        // /guide/* 경로만 cafe24 mall 에서 iframe embed 허용.
        // X-Frame-Options 는 화이트리스트를 표현할 수 없으므로 아예 보내지 않고
        // CSP frame-ancestors 로만 통제한다 (X-Frame-Options 가 있으면 대부분 우선 적용됨).
        source: "/guide/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${FRAME_ANCESTORS};`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
