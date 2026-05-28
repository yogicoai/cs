import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { EventLog } from "@/models/EventLog";

const feedbackSchema = z.object({
  channel: z.string().min(1),
  sessionId: z.string().optional(),
  faqId: z.string().min(1),
  helpful: z.boolean(),
});

export async function POST(request: Request) {
  const payload = feedbackSchema.parse(await request.json());

  try {
    await connectDB();
    const event = await EventLog.create({
      channel: payload.channel,
      sessionId: payload.sessionId,
      faqId: payload.faqId,
      eventType: payload.helpful ? "feedback_positive" : "feedback_negative",
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch {
    return NextResponse.json({ queued: false, reason: "database_not_configured" }, { status: 202 });
  }
}
