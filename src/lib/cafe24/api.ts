import { getCafe24TokenModel } from "@/models/Cafe24Token";

// ─────────────────────────────────────────────────────────────
// Cafe24 Admin API 클라이언트 (yogiChat 의 config/cafe24Api.js 이식)
// ─────────────────────────────────────────────────────────────
// 특징
//  • 서버리스 환경에서 안전하도록 매 호출마다 DB 에서 최신 토큰을 조회
//  • 401 발생 시 토큰 refresh 후 1회 재시도
//  • refresh 는 in-process mutex + DB 저장 시 최신 값 재확인으로 stampede 방지
//  • yogiChat 이 같은 tokens 컬렉션에 저장·갱신 중 → 둘이 공존
// ─────────────────────────────────────────────────────────────

const CAFE24_MALLID = process.env.CAFE24_MALLID;
const CAFE24_CLIENT_ID = process.env.CAFE24_CLIENT_ID;
const CAFE24_CLIENT_SECRET = process.env.CAFE24_CLIENT_SECRET;
const CAFE24_API_VERSION = process.env.CAFE24_API_VERSION ?? "2025-12-01";
const INITIAL_ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const INITIAL_REFRESH_TOKEN = process.env.REFRESH_TOKEN;

let refreshPromise: Promise<string> | null = null;

export function isCafe24Configured() {
  return Boolean(CAFE24_MALLID && CAFE24_CLIENT_ID && CAFE24_CLIENT_SECRET);
}

type Tokens = { accessToken: string; refreshToken: string };

async function readTokens(): Promise<Tokens | null> {
  const Token = await getCafe24TokenModel();
  const doc = await Token.findOne({}).sort({ updatedAt: -1 }).lean<{
    accessToken?: string;
    refreshToken?: string;
  } | null>();

  if (doc?.accessToken && doc?.refreshToken) {
    return { accessToken: doc.accessToken, refreshToken: doc.refreshToken };
  }

  // DB 가 비어 있으면 최초 seed (env 로부터) 후 반환.
  // 프로덕션에서는 yogiChat DB 를 공유하므로 이 코드는 첫 부트스트랩 시에만 동작.
  if (INITIAL_ACCESS_TOKEN && INITIAL_REFRESH_TOKEN) {
    await Token.updateOne(
      {},
      { $set: { accessToken: INITIAL_ACCESS_TOKEN, refreshToken: INITIAL_REFRESH_TOKEN } },
      { upsert: true },
    );
    return { accessToken: INITIAL_ACCESS_TOKEN, refreshToken: INITIAL_REFRESH_TOKEN };
  }

  return null;
}

async function writeTokens(tokens: Tokens) {
  const Token = await getCafe24TokenModel();
  await Token.updateOne({}, { $set: { ...tokens } }, { upsert: true });
}

async function refreshAccessToken(reason: string): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      if (!CAFE24_CLIENT_ID || !CAFE24_CLIENT_SECRET) {
        throw new Error("CAFE24_CLIENT_ID/SECRET 미설정");
      }

      // yogiChat 이 이미 갱신했을 수 있으므로 refresh 직전에 DB 최신본을 다시 읽는다.
      const latest = await readTokens();
      if (!latest) {
        throw new Error("Cafe24 refresh_token 없음");
      }

      const authHeader = Buffer.from(`${CAFE24_CLIENT_ID}:${CAFE24_CLIENT_SECRET}`).toString("base64");
      const body = new URLSearchParams();
      body.append("grant_type", "refresh_token");
      body.append("refresh_token", latest.refreshToken);

      console.log(`🔄 [cafe24] 토큰 갱신 시도 (${reason})`);
      const response = await fetch(`https://${CAFE24_MALLID}.cafe24api.com/api/v2/oauth/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Cafe24 refresh 실패: ${response.status} ${detail.slice(0, 200)}`);
      }

      const data = (await response.json()) as { access_token: string; refresh_token: string };
      await writeTokens({ accessToken: data.access_token, refreshToken: data.refresh_token });
      console.log("✅ [cafe24] 토큰 갱신 성공");
      return data.access_token;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

type QueryValue = string | number | boolean | undefined;

// GET 쿼리 파라미터 조립
function buildQuery(params: Record<string, QueryValue>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.append(k, String(v));
  }
  return sp.toString();
}

export type Cafe24RequestOptions = {
  method?: "GET" | "POST";
  params?: Record<string, QueryValue>;
  body?: unknown;
};

// 인증 헤더 붙여 cafe24 admin API 호출. 401 발생 시 refresh 후 1회 재시도.
export async function cafe24Request<T>(path: string, opts: Cafe24RequestOptions = {}): Promise<T> {
  if (!isCafe24Configured()) {
    throw new Error("Cafe24 환경변수 미설정 (CAFE24_MALLID / CLIENT_ID / CLIENT_SECRET)");
  }

  const { method = "GET", params, body } = opts;
  const query = params ? `?${buildQuery(params)}` : "";
  const url = `https://${CAFE24_MALLID}.cafe24api.com${path}${query}`;

  const tokens = await readTokens();
  if (!tokens) throw new Error("Cafe24 access_token 없음 (초기 seed 필요)");

  const performRequest = async (accessToken: string) =>
    fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Cafe24-Api-Version": CAFE24_API_VERSION,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

  let response = await performRequest(tokens.accessToken);

  if (response.status === 401) {
    // yogiChat 이 방금 갱신했을 수도 있으니 먼저 DB 재조회
    const latest = await readTokens();
    if (latest && latest.accessToken !== tokens.accessToken) {
      response = await performRequest(latest.accessToken);
    }
  }

  if (response.status === 401) {
    // 그래도 실패면 직접 refresh 후 재시도
    const newAccessToken = await refreshAccessToken("401 감지");
    response = await performRequest(newAccessToken);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Cafe24 API ${response.status}: ${detail.slice(0, 300)}`);
  }

  return (await response.json()) as T;
}
