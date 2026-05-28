import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { extractOutputText } from "@/lib/openai";
import { filterFaqsByChannel } from "@/lib/faqVisibility";
import { getPublishedFaqs } from "@/lib/repositories/faqRepository";
import { EventLog } from "@/models/EventLog";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-5.2-pro";

const aiQuerySchema = z.object({
  channel: z.string().min(1),
  sessionId: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  query: z.string().min(1),
});

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s/]+/gu, " ").replace(/\s+/g, " ").trim();
}

function compactText(value: string) {
  return normalizeText(value).replace(/\s+/g, "");
}

const weakIntentTokens = new Set([
  "싶어요",
  "알고",
  "문의",
  "질문",
  "가능",
  "가능한가요",
  "되나요",
  "할까요",
  "해주세요",
  "어떻게",
]);

function tokenize(value: string) {
  return Array.from(
    new Set(
      normalizeText(value)
        .split(" ")
        .filter((token) => token.length >= 2 && !weakIntentTokens.has(token)),
    ),
  );
}

function hasTokenMatch(text: string, token: string) {
  const textTokens = tokenize(text);

  return textTokens.some((textToken) => {
    if (textToken === token) {
      return true;
    }

    if (token.length >= 3 && textToken.length >= 2 && token.includes(textToken)) {
      return true;
    }

    return textToken.length >= 3 && token.length >= 2 && textToken.includes(token);
  });
}

function inferQuerySubcategory(query: string) {
  if (/365|케어/.test(query)) {
    return "365 케어서비스";
  }

  if (/보증|불량|하자|손상|가루|냄새|변색|오염|이염/.test(query)) {
    return "제품 하자/보증";
  }

  if (/충전|리필|비즈|꺼졌|숨이 죽/.test(query)) {
    return "충전재/리필";
  }

  if (/지퍼|슬라이더|부품/.test(query)) {
    return "지퍼/부품";
  }

  if (/폐기|관리|유의/.test(query)) {
    return "제품 관리/폐기";
  }

  if (/접수|신청|제품명|사진|영상|방문/.test(query)) {
    return "A/S 접수";
  }

  return "";
}

function scoreFaq(
  query: string,
  faq: Awaited<ReturnType<typeof getPublishedFaqs>>[number],
  category?: string,
  subcategory?: string,
) {
  const queryTokens = tokenize(query);
  const querySubcategory = inferQuerySubcategory(query);
  const keywordText = faq.keywords.join(" ");
  const questionText = normalizeText(faq.question);
  const titleText = normalizeText(`${faq.category} ${faq.subcategory ?? ""} ${faq.question} ${keywordText}`);
  const answerText = normalizeText(faq.answer);
  const fullText = `${titleText} ${answerText}`;
  let score = 0;

  if (category && faq.category === category) {
    score += 2;
  }

  // 고객이 보던 세부 유형 안에서 우선 매칭 (막힌 지점의 정확도↑)
  if (subcategory && faq.subcategory === subcategory) {
    score += 4;
  }

  if (querySubcategory && faq.category === "A/S문의") {
    score += faq.subcategory === querySubcategory ? 30 : -10;
  }

  for (const token of queryTokens) {
    if (hasTokenMatch(titleText, token)) {
      score += 5;
    } else if (hasTokenMatch(answerText, token)) {
      score += 2;
    }
  }

  if (fullText.includes(normalizeText(query))) {
    score += 8;
  }

  if (compactText(questionText).includes(compactText(query))) {
    score += 30;
  } else if (compactText(answerText).includes(compactText(query))) {
    score += 6;
  }

  return score;
}

function assessHandoffNeed(query: string, bestFaq?: Awaited<ReturnType<typeof getPublishedFaqs>>[number]) {
  const source = `${query} ${bestFaq?.category ?? ""} ${bestFaq?.subcategory ?? ""} ${bestFaq?.question ?? ""}`;

  if (/사진|영상|기사|방문|하자\s*확인|불량\s*확인|제품\s*상태|접수하고|신청하고|A\/S\s*접수/i.test(source)) {
    return {
      level: "required" as const,
      message:
        "상담톡에서 확인이 필요한 문의입니다.\n\n정확한 확인을 위해 아래 정보를 준비해 주세요.\n- 구매처\n- 주문번호\n- 제품명\n- 증상 사진\n- 문의 내용\n\n아래 버튼을 눌러 상담톡으로 이어가 주세요.",
    };
  }

  if (/불량|하자|손상|터짐|찢|가루|변색|오염|이염|냄새|보증|환불|교환/.test(source)) {
    return {
      level: "recommended" as const,
      message:
        "제품 상태에 따라 안내가 달라질 수 있어요.\n\n아래 FAQ를 먼저 확인하시고, 사진 확인이나 접수가 필요하면 상담톡으로 이어가 주세요.",
    };
  }

  return { level: "none" as const, message: "" };
}

async function logAiQuery(payload: z.infer<typeof aiQuerySchema>, hasResult: boolean, metadata = {}) {
  // 의미 토큰이 없는 단편(단독 자모, 1글자 등)은 미해결 검색어 노이즈가 되므로 기록하지 않는다.
  if (!hasResult && tokenize(payload.query).length === 0) {
    return;
  }

  try {
    await connectDB();
    await EventLog.create({
      channel: payload.channel,
      sessionId: payload.sessionId,
      category: payload.category,
      query: payload.query,
      eventType: hasResult ? "ai_query" : "no_result",
      metadata,
    });
  } catch {
    return;
  }
}

function buildGroundingContext(rankedFaqs: Array<{ faq: Awaited<ReturnType<typeof getPublishedFaqs>>[number]; score: number }>) {
  return rankedFaqs
    .map(
      (item, index) => `FAQ ${index + 1}
카테고리: ${item.faq.category}
문의 유형: ${item.faq.subcategory || "없음"}
질문: ${item.faq.question}
답변: ${item.faq.answer}`,
    )
    .join("\n\n---\n\n");
}

async function generateGroundedAnswer(
  query: string,
  rankedFaqs: Array<{ faq: Awaited<ReturnType<typeof getPublishedFaqs>>[number]; score: number }>,
) {
  if (!OPENAI_API_KEY) {
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        reasoning: { effort: "high" },
        instructions:
          "당신은 Yogibo 고객센터 FAQ 안내 AI입니다. 반드시 제공된 FAQ 근거 안에서만 한국어로 답변하세요. 근거에 없는 내용은 추측하지 말고 상담 연결을 안내하세요. 서로 충돌하는 FAQ가 있으면 가장 직접적으로 관련된 FAQ를 우선하고, 불확실하면 단정하지 마세요. 가격, 일정, 정책은 FAQ에 적힌 내용만 말하세요. FAQ 안에 URL이 있으면 URL을 새로 만들거나 바꾸지 말고 원문 URL만 유지하세요. 고객에게 친절하고 짧게 답변하세요.",
        input: `고객 질문: ${query}

아래 FAQ 근거만 사용하세요.

${buildGroundingContext(rankedFaqs)}

답변 형식:
- 첫 문장은 고객 질문에 대한 직접 답변
- 필요한 경우 2~4개의 짧은 안내 문장
- 마지막에 "아래 참고 FAQ도 확인해 주세요."라고 자연스럽게 마무리`,
        max_output_tokens: 420,
      }),
    });

    if (!response.ok) {
      return null;
    }

    return extractOutputText(await response.json()) || null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const payload = aiQuerySchema.parse(await request.json());
  const faqs = filterFaqsByChannel(await getPublishedFaqs(), payload.channel);
  const rankedFaqs = faqs
    .map((faq) => ({ faq, score: scoreFaq(payload.query, faq, payload.category, payload.subcategory) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const bestMatch = rankedFaqs[0];
  const hasConfidentAnswer = Boolean(bestMatch && bestMatch.score >= 6);
  const handoff = assessHandoffNeed(payload.query, bestMatch?.faq);

  await logAiQuery(payload, hasConfidentAnswer, {
    subcategory: payload.subcategory ?? "",
    matchedFaqIds: rankedFaqs.map((item) => item.faq.id),
    topScore: bestMatch?.score ?? 0,
    handoffLevel: handoff.level,
  });

  if (!hasConfidentAnswer || handoff.level === "required") {
    return NextResponse.json({
      status: "needs_handoff",
      answer: hasConfidentAnswer
        ? handoff.message
        : "보유한 FAQ 안에서 확실한 답변을 찾지 못했습니다.\n\n상담톡에서 문의 내용을 남겨주시면 더 정확히 확인해 드릴게요.",
      sources: handoff.level === "required"
        ? rankedFaqs.map((item) => ({
            id: item.faq.id,
            question: item.faq.question,
            category: item.faq.category,
            subcategory: item.faq.subcategory,
            score: item.score,
          }))
        : [],
      suggestions: rankedFaqs.map((item) => ({
        id: item.faq.id,
        question: item.faq.question,
        category: item.faq.category,
        subcategory: item.faq.subcategory,
      })),
    });
  }

  const generatedAnswer = await generateGroundedAnswer(payload.query, rankedFaqs);
  const answer = generatedAnswer ?? `확인된 FAQ 기준으로 안내드릴게요.\n\n${bestMatch.faq.answer}`;

  return NextResponse.json({
    status: handoff.level === "recommended" ? "answered_handoff" : "answered",
    answer: handoff.level === "recommended" ? `${handoff.message}\n\n${answer}` : answer,
    answerMode: generatedAnswer ? "openai_grounded" : "faq_grounded",
    sources: rankedFaqs.map((item) => ({
      id: item.faq.id,
      question: item.faq.question,
      category: item.faq.category,
      subcategory: item.faq.subcategory,
      score: item.score,
    })),
    suggestions: rankedFaqs.slice(1).map((item) => ({
      id: item.faq.id,
      question: item.faq.question,
      category: item.faq.category,
      subcategory: item.faq.subcategory,
    })),
  });
}
