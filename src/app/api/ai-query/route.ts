import { z } from "zod";
import { connectDB } from "@/lib/db";
import { filterFaqsByChannel } from "@/lib/faqVisibility";
import { getLiveClaims, type ClaimItem } from "@/lib/repositories/claimRepository";
import { getPublishedFaqs } from "@/lib/repositories/faqRepository";
import { EventLog } from "@/models/EventLog";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
// 고객 답변은 응답 속도·비용이 중요하므로 가벼운 Claude 모델(Haiku)로 근거 기반 짧게 재서술.
const ANSWER_MODEL = process.env.ANTHROPIC_ANSWER_MODEL ?? "claude-haiku-4-5";

// 고객 대면 엔드포인트 레이트 리밋 (IP당 1분 N회) — 남용/비용 폭주 방지.
// 주의: 인메모리라 단일 인스턴스 기준. 다중 인스턴스 배포면 Redis/DB로 승격 권장.
const RATE_LIMIT = Number(process.env.AI_QUERY_RATE_LIMIT ?? 15);
const RATE_WINDOW_MS = 60_000;
const rateBuckets = new Map<string, number[]>();
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (rateBuckets.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_LIMIT) {
    rateBuckets.set(ip, hits);
    return true;
  }
  hits.push(now);
  rateBuckets.set(ip, hits);
  return false;
}

// 메이트 상품 캐릭터/동물 이름 — 검색어에 포함되면 '메이트' 관련 FAQ를 우선 매칭한다.
const MATE_NAMES = [
  "일각고래", "고래", "우파루파", "도롱뇽", "테디", "크앙이", "유니크", "유니콘", "오스왈드",
  "문어딜라일라", "돌고래", "버트랜드", "곰", "어니스트", "엘리", "오파", "부엉이", "조젯",
  "기린", "디포", "하마", "모리슨", "원숭이", "데릭", "공룡", "디오고", "강아지", "케빈",
  "코알라", "셸비", "판다", "펄", "펭귄", "지그프리트", "상어", "휴고", "고슴도치", "로미",
  "너구리", "다니엘", "용", "야머스", "예티", "페스터스", "여우", "칼리스타", "고양이",
  "코스모", "사울", "나무늘보",
];

function mentionsMate(query: string) {
  const normalized = query.toLowerCase().replace(/\s+/g, "");
  return MATE_NAMES.some((name) => normalized.includes(name));
}

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
  isMateQuery?: boolean,
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

  // 메이트 이름이 검색어에 있으면 '메이트'를 다루는 FAQ에 강한 보너스를 준다.
  if (isMateQuery && /메이트/.test(fullText)) {
    score += 20;
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
  const source = `${query} ${bestFaq?.question ?? ""}`;

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

// 고객 클레임(사례) 매칭 점수.
function scoreClaim(
  query: string,
  claim: ClaimItem,
  category?: string,
  subcategory?: string,
  isMateQuery?: boolean,
) {
  const queryTokens = tokenize(query);
  const querySubcategory = inferQuerySubcategory(query);
  const keywordText = claim.keywords.join(" ");
  const situationText = normalizeText(claim.situation);
  const titleText = normalizeText(`${claim.category} ${claim.subcategory ?? ""} ${claim.situation} ${keywordText}`);
  const answerText = normalizeText(claim.answer);
  const fullText = `${titleText} ${answerText}`;
  let score = 0;

  if (category && claim.category === category) {
    score += 2;
  }
  if (subcategory && claim.subcategory === subcategory) {
    score += 4;
  }
  if (isMateQuery && /메이트/.test(fullText)) {
    score += 20;
  }
  if (querySubcategory && claim.category === "A/S문의") {
    score += claim.subcategory === querySubcategory ? 30 : -10;
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

  if (compactText(situationText).includes(compactText(query))) {
    score += 30;
  } else if (compactText(answerText).includes(compactText(query))) {
    score += 6;
  }

  return score;
}

// 근거 컨텍스트가 길수록 첫 토큰 지연(prefill)이 커지므로 답변 길이를 제한한다.
function clipAnswer(answer: string) {
  return answer.length > 700 ? `${answer.slice(0, 700)}…` : answer;
}

function buildClaimContext(claims: ClaimItem[]) {
  return claims
    .map(
      (claim, index) => `사례 ${index + 1}
상황: ${claim.situation}
응대: ${clipAnswer(claim.answer)}`,
    )
    .join("\n\n---\n\n");
}

function buildGroundingContext(rankedFaqs: Array<{ faq: Awaited<ReturnType<typeof getPublishedFaqs>>[number]; score: number }>) {
  return rankedFaqs
    .map(
      (item, index) => `FAQ ${index + 1}
카테고리: ${item.faq.category}
문의 유형: ${item.faq.subcategory || "없음"}
질문: ${item.faq.question}
답변: ${clipAnswer(item.faq.answer)}`,
    )
    .join("\n\n---\n\n");
}

const ANSWER_INSTRUCTIONS =
  "당신은 Yogibo 고객센터 FAQ 안내 AI입니다. 반드시 제공된 FAQ 근거와 고객 사례 응대 안에서만 한국어로 답변하세요. 근거에 없는 내용은 추측하지 말고 상담 연결을 안내하세요. 서로 충돌하면 가장 직접적으로 관련된 근거를 우선하고, 불확실하면 단정하지 마세요. 가격, 일정, 정책은 근거에 적힌 내용만 말하세요. URL이 있으면 새로 만들거나 바꾸지 말고 원문 URL만 유지하세요. 핵심만 3문장 이내로, 군더더기 없이 친절하게 답하세요.";

// Claude(Anthropic) 스트리밍을 받아 텍스트 델타를 콜백으로 흘려보낸다. 토큰이 하나라도 오면 true.
// 실패하면 false → 호출부에서 원본 FAQ 답변으로 폴백한다.
async function streamGroundedAnswer(query: string, grounding: string, onDelta: (text: string) => void) {
  if (!ANTHROPIC_API_KEY) {
    return false;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: ANSWER_MODEL,
        max_tokens: 300,
        system: ANSWER_INSTRUCTIONS,
        stream: true,
        messages: [
          {
            role: "user",
            content: `고객 질문: ${query}

아래 근거만 사용하세요.

${grounding}

답변 형식: 첫 문장에 질문에 대한 직접 답변, 필요하면 1~2문장만 보충. 인사말이나 맺음말은 넣지 마세요.`,
          },
        ],
      }),
    });

    if (!response.ok || !response.body) {
      return false;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let got = false;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) {
          continue;
        }
        const data = trimmed.slice(5).trim();
        if (!data) {
          continue;
        }
        try {
          const event = JSON.parse(data) as {
            type?: string;
            delta?: { type?: string; text?: string };
          };
          // Claude 스트림: content_block_delta → delta.text_delta 의 text
          if (
            event.type === "content_block_delta" &&
            event.delta?.type === "text_delta" &&
            typeof event.delta.text === "string"
          ) {
            onDelta(event.delta.text);
            got = true;
          }
        } catch {
          // 불완전한 SSE 조각은 건너뛴다.
        }
      }
    }

    return got;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  // 레이트 리밋 — 고객 대면 AI 남용/비용 폭주 방지 (IP당 1분 RATE_LIMIT회)
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (isRateLimited(ip)) {
    const enc = new TextEncoder();
    const ln = (obj: unknown) => enc.encode(`${JSON.stringify(obj)}\n`);
    const body = new Blob([
      ln({
        type: "meta",
        status: "rate_limited",
        answer: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.",
        sources: [],
        suggestions: [],
      }),
      ln({ type: "done" }),
    ]).stream();
    return new Response(body, {
      status: 429,
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const payload = aiQuerySchema.parse(await request.json());
  const [allFaqs, allClaims] = await Promise.all([getPublishedFaqs(), getLiveClaims()]);
  const faqs = filterFaqsByChannel(allFaqs, payload.channel);
  const isMateQuery = mentionsMate(payload.query);
  const rankedFaqs = faqs
    .map((faq) => ({ faq, score: scoreFaq(payload.query, faq, payload.category, payload.subcategory, isMateQuery) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  // 클레임은 고객 탐색에는 절대 노출되지 않고, AI 응답 근거로만 쓰인다.
  // 임계값 5: 한 토큰만 매치돼도(5점) 후보에 포함되도록 낮춤 — 클레임 답변이
  // 누락되는 사례가 잦아 진입 장벽을 완화한다.
  const rankedClaims = allClaims
    .map((claim) => ({ claim, score: scoreClaim(payload.query, claim, payload.category, payload.subcategory, isMateQuery) }))
    .filter((item) => item.score >= 5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const bestMatch = rankedFaqs[0];
  const hasConfidentFaq = Boolean(bestMatch && bestMatch.score >= 6);
  const hasConfidentAnswer = hasConfidentFaq || rankedClaims.length > 0;
  const handoff = assessHandoffNeed(payload.query, bestMatch?.faq);

  await logAiQuery(payload, hasConfidentAnswer, {
    subcategory: payload.subcategory ?? "",
    matchedFaqIds: rankedFaqs.map((item) => item.faq.id),
    matchedClaimIds: rankedClaims.map((item) => item.claim.id),
    topScore: bestMatch?.score ?? 0,
    handoffLevel: handoff.level,
  });

  const sourceList = rankedFaqs.map((item) => ({
    id: item.faq.id,
    question: item.faq.question,
    category: item.faq.category,
    subcategory: item.faq.subcategory,
    score: item.score,
  }));
  const suggestionList = rankedFaqs.map((item) => ({
    id: item.faq.id,
    question: item.faq.question,
    category: item.faq.category,
    subcategory: item.faq.subcategory,
  }));

  const encoder = new TextEncoder();
  const line = (obj: unknown) => encoder.encode(`${JSON.stringify(obj)}\n`);
  const headers = { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" };

  if (!hasConfidentAnswer || handoff.level === "required") {
    const answer = hasConfidentAnswer
      ? handoff.message
      : "보유한 FAQ 안에서 확실한 답변을 찾지 못했습니다.\n\n상담톡에서 문의 내용을 남겨주시면 더 정확히 확인해 드릴게요.";
    const body = line({
      type: "meta",
      status: "needs_handoff",
      answer,
      sources: handoff.level === "required" ? sourceList : [],
      suggestions: suggestionList,
    });
    return new Response(new Blob([body, line({ type: "done" })]).stream(), { headers });
  }

  const status = handoff.level === "recommended" ? "answered_handoff" : "answered";
  const prefix = handoff.level === "recommended" ? `${handoff.message}\n\n` : "";

  const faqGrounding = buildGroundingContext(rankedFaqs.slice(0, 2));
  // 클레임 답변은 같은 상황에서 CS가 실제로 보낸 검증된 응대 — FAQ 와 동등한 근거로
  // 취급해야 한다. 점수가 더 높으면 FAQ 보다 먼저 노출해 무게를 실어준다.
  const claimGrounding = rankedClaims.length
    ? `[검증된 CS 응대 사례 — 위 FAQ 와 동등한 근거. 상황이 거의 같으면 이 응대를 우선 인용해 동일한 정보를 빠짐없이 전달]\n${buildClaimContext(rankedClaims.map((item) => item.claim))}`
    : "";
  const topClaimScore = rankedClaims[0]?.score ?? 0;
  const topFaqScore = bestMatch?.score ?? 0;
  const claimFirst = topClaimScore >= topFaqScore;
  const grounding = (claimFirst ? [claimGrounding, faqGrounding] : [faqGrounding, claimGrounding])
    .filter(Boolean)
    .join("\n\n");
  // 클레임 점수가 더 높으면 클레임 답변을 fallback 으로 우선 사용한다.
  const fallbackAnswer = claimFirst
    ? rankedClaims[0]?.claim.answer ?? bestMatch?.faq.answer ?? ""
    : bestMatch?.faq.answer ?? rankedClaims[0]?.claim.answer ?? "";

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        line({ type: "meta", status, answer: prefix, sources: sourceList, suggestions: suggestionList.slice(1) }),
      );
      const got = await streamGroundedAnswer(payload.query, grounding, (text) =>
        controller.enqueue(line({ type: "delta", text })),
      );
      if (!got && fallbackAnswer) {
        controller.enqueue(line({ type: "delta", text: fallbackAnswer }));
      }
      controller.enqueue(line({ type: "done" }));
      controller.close();
    },
  });

  return new Response(stream, { headers });
}
