import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { connectDB } from "@/lib/db";
import { inferFaqSubcategory } from "@/lib/faqGrouping";
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
// 어드민 화면에 보이는 유형은 DB의 subcategory 값이 비어있을 때
// inferFaqSubcategory(category, question, keywords)로 추정된 값일 수 있다.
// 따라서 "from"과 매칭할 때는 DB subcategory가 from 인 경우 + DB가 비어있고
// 추정 결과가 from 인 경우 모두를 포함해야 한다. 그렇지 않으면 modifiedCount=0
// 으로 보이지만 화면은 잠시 갱신되었다가 새로고침 시 원복된다.
export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { category, from, to } = schema.parse(await request.json());
  if (from === to) {
    return NextResponse.json({ faqsUpdated: 0, claimsUpdated: 0 });
  }

  await connectDB();

  const candidates = await Faq.find(
    { category, status: { $ne: "archived" } },
    { _id: 1, subcategory: 1, question: 1, keywords: 1 },
  ).lean<Array<{ _id: unknown; subcategory?: string; question: string; keywords?: string[] }>>();

  const matchingIds = candidates
    .filter((doc) => {
      const stored = (doc.subcategory ?? "").trim();
      if (stored) return stored === from;
      const inferred = inferFaqSubcategory(category, doc.question, doc.keywords ?? []);
      return inferred === from;
    })
    .map((doc) => doc._id);

  const faqResult = matchingIds.length
    ? await Faq.updateMany({ _id: { $in: matchingIds } }, { $set: { subcategory: to } })
    : { modifiedCount: 0 };

  // 클레임은 inferFaqSubcategory를 사용하지 않으므로 DB 값 그대로 매칭한다.
  const claimResult = await Claim.updateMany(
    { category, subcategory: from },
    { $set: { subcategory: to } },
  );

  invalidatePublishedFaqs();
  invalidateLiveClaims();

  return NextResponse.json({
    faqsUpdated: faqResult.modifiedCount ?? 0,
    claimsUpdated: claimResult.modifiedCount ?? 0,
    matched: matchingIds.length,
  });
}
