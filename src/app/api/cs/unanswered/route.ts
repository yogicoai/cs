import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

// onlineData(cloudtype MCP HTTP 서버)의 /api/cs/unanswered 를 서버에서 프록시한다.
// - 브라우저에 MCP_TOKEN 을 노출하지 않고(서버 env 로만 보관), CORS 도 회피.
// - onlineData 가 이미 cafe24 토큰 공유 DB + 네이버 커머스 API 인증을 갖고 있어 그대로 재사용.
const ONLINEDATA_BASE_URL =
  process.env.ONLINEDATA_BASE_URL ??
  "https://port-0-yogibo-onmcp-lzgmwhc4d9883c97.sel4.cloudtype.app";
const ONLINEDATA_MCP_TOKEN = process.env.ONLINEDATA_MCP_TOKEN;

export async function GET(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!ONLINEDATA_MCP_TOKEN) {
    return NextResponse.json(
      { error: "ONLINEDATA_MCP_TOKEN 이 설정되지 않아 미답변 조회를 사용할 수 없습니다." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const channel = url.searchParams.get("channel") ?? "both";
  const days = url.searchParams.get("days") ?? "7";

  const target = `${ONLINEDATA_BASE_URL}/api/cs/unanswered?channel=${encodeURIComponent(
    channel,
  )}&days=${encodeURIComponent(days)}`;

  try {
    // onlineData 는 cafe24/네이버 API 를 실시간 호출하므로 응답이 느릴 수 있어 타임아웃을 넉넉히.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    const response = await fetch(target, {
      headers: { Authorization: `Bearer ${ONLINEDATA_MCP_TOKEN}` },
      cache: "no-store",
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return NextResponse.json(
        { error: `미답변 조회에 실패했습니다 (상태 ${response.status})`, detail: detail.slice(0, 300) },
        { status: 502 },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    const isTimeout = message.includes("aborted") || message.includes("abort");
    return NextResponse.json(
      {
        error: isTimeout
          ? "미답변 조회가 지연되고 있습니다. 잠시 후 다시 시도해 주세요."
          : "미답변 조회 중 오류가 발생했습니다.",
        detail: message.slice(0, 200),
      },
      { status: 502 },
    );
  }
}
