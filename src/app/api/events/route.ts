import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { isRequestBlocked } from "@/lib/ipBlock";
import { EventLog } from "@/models/EventLog";

const eventSchema = z.object({
  channel: z.string().min(1),
  sessionId: z.string().optional(),
  eventType: z.enum([
    "visit",
    "category_view",
    "subcategory_view",
    "question_view",
    "feedback_positive",
    "feedback_negative",
    "ai_query",
    "no_result",
    "contact_click",
    "resolved",
  ]),
  category: z.string().optional(),
  faqId: z.string().optional(),
  query: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export async function POST(request: Request) {
  // 회사 IP 등 차단 목록(BLOCKED_IPS)에 해당하면 방문/이벤트를 기록하지 않는다.
  // 클라이언트에는 정상(200)으로 응답해 동작에는 영향을 주지 않되, 통계에서만 제외한다.
  if (isRequestBlocked(request)) {
    return NextResponse.json({ skipped: true, reason: "blocked_ip" }, { status: 200 });
  }

  const payload = eventSchema.parse(await request.json());

  try {
    await connectDB();
    const event = await EventLog.create(payload);
    return NextResponse.json({ event }, { status: 201 });
  } catch {
    return NextResponse.json({ queued: false, reason: "database_not_configured" }, { status: 202 });
  }
}
