import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
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
  const payload = eventSchema.parse(await request.json());

  try {
    await connectDB();
    const event = await EventLog.create(payload);
    return NextResponse.json({ event }, { status: 201 });
  } catch {
    return NextResponse.json({ queued: false, reason: "database_not_configured" }, { status: 202 });
  }
}
