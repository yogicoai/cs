import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { connectDB } from "@/lib/db";
import { Claim } from "@/models/Claim";
import { invalidateLiveClaims } from "@/lib/repositories/claimRepository";

const updateSchema = z.object({
  category: z.string().optional(),
  subcategory: z.string().optional(),
  situation: z.string().min(1).optional(),
  keywords: z.array(z.string()).optional(),
  csAnswer: z.string().optional(),
  aiSuggestedAnswer: z.string().optional(),
  answer: z.string().optional(),
  status: z.enum(["review", "live", "hold"]).optional(),
  note: z.string().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;
  await connectDB();
  const { id } = await context.params;
  const payload = updateSchema.parse(await request.json());

  // 라이브로 전환되는데 최종답변(answer)이 비어있으면, 동일 PATCH 본문 또는 기존 문서의
  // csAnswer 를 answer 로 자동 승계한다. 어드민이 CS답변만 적고 상태만 라이브로 바꾸는
  // 흔한 케이스에서 AI 응답 근거가 빠지는 문제를 막는다.
  const set: Record<string, unknown> = { ...payload };
  if (payload.status === "live" && (!payload.answer || !payload.answer.trim())) {
    const existing = await Claim.findById(id).lean<{ answer?: string; csAnswer?: string } | null>();
    const currentAnswer = (payload.answer ?? existing?.answer ?? "").trim();
    const fallbackCs = (payload.csAnswer ?? existing?.csAnswer ?? "").trim();
    if (!currentAnswer && fallbackCs) {
      set.answer = fallbackCs;
    }
  }

  const claim = await Claim.findByIdAndUpdate(id, { $set: set }, { new: true });

  if (!claim) {
    return NextResponse.json({ message: "Claim not found" }, { status: 404 });
  }

  invalidateLiveClaims();
  revalidatePath("/guide/[channel]", "page");
  revalidatePath("/guide/[channel]/answer/[faqId]", "page");
  return NextResponse.json({ claim });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;
  await connectDB();
  const { id } = await context.params;
  const claim = await Claim.findByIdAndDelete(id);

  if (!claim) {
    return NextResponse.json({ message: "Claim not found" }, { status: 404 });
  }

  invalidateLiveClaims();
  revalidatePath("/guide/[channel]", "page");
  revalidatePath("/guide/[channel]/answer/[faqId]", "page");
  return NextResponse.json({ ok: true });
}
