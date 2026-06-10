import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { connectDB } from "@/lib/db";
import { invalidateLiveClaims } from "@/lib/repositories/claimRepository";
import { invalidatePublishedFaqs } from "@/lib/repositories/faqRepository";
import { Claim } from "@/models/Claim";
import { Faq } from "@/models/Faq";

const schema = z.object({
  category: z.string().min(1),
  from: z.string().min(1),
  to: z.string().max(40),
});

// 카테고리 내 문의 유형(subcategory) 이름 일괄 변경.
// 해당 (category, subcategory) 조합의 모든 FAQ + 클레임이 동시에 갱신된다.
export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { category, from, to } = schema.parse(await request.json());
  if (from === to) {
    return NextResponse.json({ faqsUpdated: 0, claimsUpdated: 0 });
  }

  await connectDB();
  const faqResult = await Faq.updateMany(
    { category, subcategory: from },
    { $set: { subcategory: to } },
  );
  const claimResult = await Claim.updateMany(
    { category, subcategory: from },
    { $set: { subcategory: to } },
  );

  invalidatePublishedFaqs();
  invalidateLiveClaims();

  return NextResponse.json({
    faqsUpdated: faqResult.modifiedCount ?? 0,
    claimsUpdated: claimResult.modifiedCount ?? 0,
  });
}
