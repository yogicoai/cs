import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { connectDB } from "@/lib/db";
import { inferFaqSubcategory } from "@/lib/faqGrouping";
import { invalidateLiveClaims } from "@/lib/repositories/claimRepository";
import { invalidatePublishedFaqs } from "@/lib/repositories/faqRepository";
import { Claim } from "@/models/Claim";
import { Faq } from "@/models/Faq";

// from === ""  → 추정값도 비었던 단일 FAQ 한 건만 갱신 (faqId 필수).
// from !== ""  → 카테고리 내 from 과 일치하는(저장값 또는 추정값) 모든 FAQ 일괄 갱신.
const schema = z
  .object({
    category: z.string().min(1),
    from: z.string(),
    to: z.string().max(40),
    faqId: z.string().optional(),
  })
  .refine((data) => data.from.length > 0 || (data.faqId && data.faqId.length > 0), {
    message: "빈 유형을 변경하려면 faqId가 필요합니다.",
    path: ["faqId"],
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

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문(JSON 파싱 실패)" }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "유효하지 않은 요청", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { category, from, to, faqId } = parsed.data;
  if (from === to) {
    return NextResponse.json({ faqsUpdated: 0, claimsUpdated: 0, matched: 0 });
  }

  try {
    await connectDB();

    // 빈 유형(from === "") → 단일 FAQ 한 건만 갱신.
    if (from === "" && faqId) {
      const faqResult = await Faq.updateOne(
        { _id: faqId, category },
        { $set: { subcategory: to } },
      );
      invalidatePublishedFaqs();
      return NextResponse.json({
        faqsUpdated: faqResult.modifiedCount ?? 0,
        claimsUpdated: 0,
        matched: faqResult.matchedCount ?? 0,
      });
    }

    // 일반 경로: 카테고리 내 from 과 일치하는(저장값 또는 추정값) 모든 FAQ + 클레임 일괄 갱신.
    const candidates = await Faq.find(
      { category, status: { $ne: "archived" } },
      { _id: 1, subcategory: 1, question: 1, keywords: 1 },
    ).lean();

    const matchingIds = (candidates as Array<{ _id: unknown; subcategory?: string; question: string; keywords?: string[] }>)
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
  } catch (error) {
    console.error("[api/faqs/subcategories] PATCH failed", error);
    const message = error instanceof Error ? error.message : "unknown";
    return NextResponse.json({ error: `문의 유형 변경 실패: ${message}` }, { status: 500 });
  }
}
