import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { extractOutputText } from "@/lib/openai";
import { getPublishedFaqs } from "@/lib/repositories/faqRepository";
import { invalidateLiveClaims } from "@/lib/repositories/claimRepository";
import { Claim } from "@/models/Claim";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// 추천 생성은 비실시간·단순 작업이므로 저비용 모델을 기본값으로 둔다.
const SUGGEST_MODEL = process.env.OPENAI_SUGGEST_MODEL ?? "gpt-4o-mini";

type RouteContext = { params: Promise<{ id: string }> };

function parseJson(text: string): { category?: string; answer?: string } {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return {};
  }
  try {
    return JSON.parse(match[0]);
  } catch {
    return {};
  }
}

// 상황과 토큰이 겹치는 게시판 FAQ 상위 N개를 근거로 뽑는다.
function relevantFaqs(
  situation: string,
  faqs: Awaited<ReturnType<typeof getPublishedFaqs>>,
  limit = 3,
) {
  const tokens = Array.from(
    new Set(
      situation
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((t) => t.length >= 2),
    ),
  );
  return faqs
    .map((faq) => {
      const haystack = `${faq.question} ${faq.keywords.join(" ")} ${faq.answer}`.toLowerCase();
      const score = tokens.reduce((sum, token) => (haystack.includes(token) ? sum + 1 : sum), 0);
      return { faq, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.faq);
}

export async function POST(_request: Request, context: RouteContext) {
  await connectDB();
  const { id } = await context.params;
  const claim = await Claim.findById(id);

  if (!claim) {
    return NextResponse.json({ message: "Claim not found" }, { status: 404 });
  }
  if (!OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY가 설정되지 않았습니다." }, { status: 503 });
  }

  const faqs = await getPublishedFaqs();
  const categories = Array.from(new Set(faqs.map((faq) => faq.category)));
  const refFaqs = relevantFaqs(claim.situation, faqs);
  const faqContext = refFaqs.length
    ? refFaqs.map((faq, i) => `[FAQ ${i + 1}] (${faq.category}) ${faq.question}\n${faq.answer}`).join("\n\n")
    : "(관련 게시판 FAQ 없음)";

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: SUGGEST_MODEL,
        instructions:
          "당신은 Yogibo 고객센터 응대 표준화 담당입니다. 고객 문의를 보고, 아래 'FAQ 게시판 내용'에 등록된 답변을 최대한 그대로 활용해 답변을 작성하세요. CS 실제 응대는 보조 참고용이며, FAQ와 충돌하면 반드시 FAQ를 따릅니다. FAQ에 없는 내용은 추측하지 말고 상담 연결을 안내하세요. 개인정보(이름·주문번호·연락처)는 답변에 넣지 마세요. 핵심만 3문장 이내로 친절하게 쓰세요. 카테고리는 주어진 목록 중 가장 적합한 하나를 고르세요. 반드시 JSON만 출력하세요.",
        input: `고객 문의:
${claim.situation}

관련 FAQ 게시판 내용(최우선 근거):
${faqContext}

CS 실제 응대(참고):
${claim.csAnswer || "(없음)"}

카테고리 후보: ${categories.join(", ") || "없음"}

출력 형식(JSON만): {"category": "<후보 중 하나>", "answer": "<게시판 FAQ와 일관된 표준 답변>"}`,
        max_output_tokens: 400,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ error: "AI 추천 생성 실패", detail: detail.slice(0, 200) }, { status: 502 });
    }

    const parsed = parseJson(extractOutputText(await response.json()));
    if (!parsed.answer) {
      return NextResponse.json({ error: "AI 추천 답변이 비어 있습니다." }, { status: 502 });
    }

    claim.aiSuggestedAnswer = parsed.answer;
    if (!claim.category && parsed.category && categories.includes(parsed.category)) {
      claim.category = parsed.category;
    }
    await claim.save();
    invalidateLiveClaims();

    return NextResponse.json({ claim });
  } catch {
    return NextResponse.json({ error: "AI 추천 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}
