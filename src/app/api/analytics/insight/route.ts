import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import {
  getEngagementAnalytics,
  normalizeDateRange,
  normalizeDays,
  normalizeGroupBy,
} from "@/lib/analytics";

// 어드민 AI 데이터 분석은 Anthropic Claude Haiku 4.5 로 호출한다.
// Haiku 4.5 는 현재 활성 모델 중 가장 저렴하고 응답이 빠르며, 짧은 마크다운 요약에 적합하다.
// 주의: Haiku 4.5 는 output_config.effort 와 adaptive thinking 을 지원하지 않으므로
// 그 파라미터들을 보내면 400 이 난다 — 보내지 않는다.
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";

const insightSchema = z.object({
  groupBy: z.string().optional(),
  days: z.number().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  channel: z.string().optional(),
});

const SYSTEM_PROMPT = `당신은 Yogibo 고객센터의 데이터 분석가입니다. 이 앱의 목적은 'CS 전화 콜 진입 시 고객이 앱에서 스스로 답을 찾아 통화를 줄이는 것'이며, 가장 좋은 결과는 전화 연결 없이 해결되는 것입니다. 주어진 이용 데이터를 바탕으로 콜 감소 관점에서 한국어로 분석하세요. 데이터에 근거해서만 말하고, 수치가 적으면 '표본이 적다'고 솔직히 밝히세요. 반드시 아래 형식의 마크다운으로 간결하게 답하세요:

## 핵심 요약
- (3~5개 불릿)

## 콜을 유발하는 약점
- (검색 실패 키워드, 낮은 만족도, 전화 클릭 등 근거와 함께)

## 우선 개선 액션
1. (효과 큰 순서대로 3~5개, 구체적으로)

## 추세 코멘트
- (기간별 변화 한두 줄)`;

function buildPrompt(data: Awaited<ReturnType<typeof getEngagementAnalytics>>) {
  const periodLabel = { day: "일별", week: "주별", month: "월별" }[data.range.groupBy];
  const s = data.summary;

  return `다음은 Yogibo CS 셀프 상담 앱의 이용 데이터입니다.
기간: ${data.range.since.slice(0, 10)} ~ ${data.range.until.slice(0, 10)} (${periodLabel} 집계)

[요약]
- 방문(앱 진입): ${s.visits} / 세션: ${s.sessions}
- 질문·답변 열람: ${s.questionViews}
- AI 직접 질문: ${s.aiQueries} (검색 결과 없음: ${s.noResults})
- "해결됐어요" 클릭: ${s.resolved}
- 상담 연결 클릭: 총 ${s.contactClicks} (카카오 ${s.kakaoClicks} / 전화 ${s.phoneClicks})
- 만족도(좋아요 비율): ${s.satisfactionRate}% (좋아요 ${s.feedbackPositive} / 아쉬워요 ${s.feedbackNegative})
- 자가해결률(세션 중 상담 미연결): ${s.deflectionRate}%
- 해결 전환율(세션 중 '해결됐어요'): ${s.resolutionRate}%

[채널별]
${data.byChannel.map((c) => `- ${c.channel}: 방문 ${c.visits}, 상담클릭 ${c.contactClicks}, 만족도 ${c.satisfactionRate}%`).join("\n") || "- 데이터 없음"}

[검색 결과 없음 키워드 (FAQ 공백 후보)]
${data.topNoResults.map((n, i) => `${i + 1}. "${n.query}" (${n.count}회)`).join("\n") || "- 없음"}

[전체 인기 검색어 (수요)]
${data.topSearchKeywords.map((n, i) => `${i + 1}. "${n.query}" (${n.count}회)`).join("\n") || "- 없음"}

[많이 본 질문]
${data.topQuestions.map((q, i) => `${i + 1}. [${q.category}] ${q.question} (${q.views}회)`).join("\n") || "- 없음"}

[${periodLabel} 추세]
${data.trend.map((t) => `- ${t.date.slice(0, 10)}: 방문 ${t.visit}, 열람 ${t.question_view}, AI ${t.ai_query}, 해결 ${t.resolved}, 상담클릭 ${t.contact_click}`).join("\n") || "- 없음"}`;
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = insightSchema.parse(await request.json().catch(() => ({})));
  const groupBy = normalizeGroupBy(body.groupBy ?? null);
  const days = normalizeDays(body.days != null ? String(body.days) : null, groupBy);
  const { since, until } = normalizeDateRange(body.from ?? null, body.to ?? null, days);
  const channel = body.channel?.trim() || undefined;

  const data = await getEngagementAnalytics({ groupBy, since, until, channel });

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY가 설정되지 않아 AI 분석을 사용할 수 없습니다." },
      { status: 503 },
    );
  }

  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildPrompt(data) }],
    });

    let insight = "";
    for (const block of response.content) {
      if (block.type === "text") insight += block.text;
    }
    insight = insight.trim();

    if (!insight) {
      return NextResponse.json({ error: "AI 응답이 비어 있습니다." }, { status: 502 });
    }

    return NextResponse.json({ insight, range: data.range, summary: data.summary });
  } catch (error) {
    console.error("[api/analytics/insight] Claude 호출 실패", error);
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY 인증 실패." }, { status: 401 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "AI 호출 한도 초과. 잠시 후 다시 시도하세요." }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "unknown";
    return NextResponse.json(
      { error: "AI 분석 요청에 실패했습니다.", detail: message.slice(0, 300) },
      { status: 502 },
    );
  }
}
