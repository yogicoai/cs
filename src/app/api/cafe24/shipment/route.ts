import { NextResponse } from "next/server";
import { z } from "zod";
import { isCafe24Configured } from "@/lib/cafe24/api";
import { getRecentOrdersWithShipments, getShipmentDetail } from "@/lib/cafe24/service";

// 자사몰(ownmall) 채널에서 iframe embed 된 자식 페이지가 호출한다.
// 부모 페이지(cafe24 자사몰)가 postMessage 로 넘긴 memberId 를 body 로 그대로 전달.
// - memberId 만 있으면 최근 14일 주문 + 각 주문의 배송 상태를 반환
// - orderId 가 지정되면 그 주문의 배송 상세만 조회
// 인증은 cafe24 admin API 를 서버에서 대신 호출하는 구조이므로 클라이언트에 토큰이 노출되지 않는다.

const requestSchema = z.object({
  memberId: z.string().trim().min(1).max(80).optional(),
  orderId: z
    .string()
    .trim()
    .regex(/^\d{8}-\d{7}$/, "주문번호 형식은 YYYYMMDD-XXXXXXX 입니다.")
    .optional(),
}).refine((data) => data.memberId || data.orderId, {
  message: "memberId 또는 orderId 중 하나는 필요합니다.",
});

export async function POST(request: Request) {
  if (!isCafe24Configured()) {
    return NextResponse.json(
      { error: "Cafe24 연동이 설정되어 있지 않습니다. 관리자에게 문의해 주세요." },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문(JSON 파싱 실패)" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "유효하지 않은 요청", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { memberId, orderId } = parsed.data;

  try {
    if (orderId) {
      const shipment = await getShipmentDetail(orderId);
      if (!shipment) {
        return NextResponse.json({ error: "해당 주문번호의 배송 정보를 찾을 수 없습니다." }, { status: 404 });
      }
      return NextResponse.json({ mode: "order", shipment });
    }

    // memberId 기반 조회
    const orders = await getRecentOrdersWithShipments(memberId!);
    return NextResponse.json({ mode: "member", memberId, orders });
  } catch (error) {
    console.error("[api/cafe24/shipment] 조회 실패", error);
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json(
      { error: "배송 조회 중 오류가 발생했습니다.", detail: message.slice(0, 300) },
      { status: 502 },
    );
  }
}
