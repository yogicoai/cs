import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { connectDB } from "@/lib/db";
import { invalidateLiveClaims } from "@/lib/repositories/claimRepository";
import { invalidatePublishedFaqs } from "@/lib/repositories/faqRepository";
import { Claim } from "@/models/Claim";
import { Faq } from "@/models/Faq";

const schema = z.object({
  from: z.string().min(1),
  to: z.string().min(1).max(40),
});

// 카테고리 이름 일괄 변경 — 해당 카테고리에 속한 모든 FAQ와 클레임이 동시에 갱신된다.
export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { from, to } = schema.parse(await request.json());
  if (from === to) {
    return NextResponse.json({ faqsUpdated: 0, claimsUpdated: 0 });
  }

  await connectDB();
  const faqResult = await Faq.updateMany({ category: from }, { $set: { category: to } });
  const claimResult = await Claim.updateMany({ category: from }, { $set: { category: to } });

  invalidatePublishedFaqs();
  invalidateLiveClaims();

  return NextResponse.json({
    faqsUpdated: faqResult.modifiedCount ?? 0,
    claimsUpdated: claimResult.modifiedCount ?? 0,
  });
}
