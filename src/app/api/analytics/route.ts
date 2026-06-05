import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import {
  getEngagementAnalytics,
  normalizeDateRange,
  normalizeDays,
  normalizeGroupBy,
} from "@/lib/analytics";

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const params = request.nextUrl.searchParams;
  const groupBy = normalizeGroupBy(params.get("groupBy"));
  const days = normalizeDays(params.get("days"), groupBy);
  const { since, until } = normalizeDateRange(params.get("from"), params.get("to"), days);
  const channel = params.get("channel")?.trim() || undefined;

  const analytics = await getEngagementAnalytics({ groupBy, since, until, channel });
  return NextResponse.json(analytics);
}
