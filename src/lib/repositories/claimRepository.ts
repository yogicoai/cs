import { connectDB } from "@/lib/db";
import { Claim } from "@/models/Claim";
import type { FaqItem } from "@/lib/sample-data";

export type ClaimStatus = "review" | "live" | "hold";

export type ClaimItem = {
  id: string;
  category: string;
  subcategory: string;
  situation: string;
  keywords: string[];
  csAnswer: string;
  aiSuggestedAnswer: string;
  answer: string;
  status: ClaimStatus;
  note: string;
  updatedAt?: string;
};

type ClaimDoc = {
  _id: unknown;
  category?: string;
  subcategory?: string;
  situation: string;
  keywords?: string[];
  csAnswer?: string;
  aiSuggestedAnswer?: string;
  answer?: string;
  status?: ClaimStatus;
  note?: string;
  updatedAt?: Date;
};

function toClaimItem(doc: ClaimDoc): ClaimItem {
  // 라이브용 effective answer: 최종답변(answer)이 있으면 그것을, 없으면 CS답변(csAnswer)을 사용.
  // 어드민이 "최종 답변" 칸을 따로 채우지 않고 라이브로 전환해도 csAnswer 가 자동 승계되도록 한다.
  const effectiveAnswer = doc.answer && doc.answer.trim() ? doc.answer : (doc.csAnswer ?? "");
  return {
    id: String(doc._id),
    category: doc.category ?? "",
    subcategory: doc.subcategory ?? "",
    situation: doc.situation,
    keywords: doc.keywords ?? [],
    csAnswer: doc.csAnswer ?? "",
    aiSuggestedAnswer: doc.aiSuggestedAnswer ?? "",
    answer: effectiveAnswer,
    status: doc.status ?? "review",
    note: doc.note ?? "",
    updatedAt: doc.updatedAt?.toISOString(),
  };
}

// 고객 탐색용: 라이브 + 카테고리 보유 + 최종답변 있는 클레임을 FAQ 형태로 노출.
// 출처(고객 클레임)는 라벨로 노출하지 않는다 — 일반 FAQ처럼 보이게 한다.
export async function getLiveClaimsAsFaqs(): Promise<FaqItem[]> {
  const claims = await getLiveClaims();
  return claims
    .filter((c) => c.category && c.answer)
    .map((c) => ({
      id: c.id,
      category: c.category,
      subcategory: c.subcategory,
      question: c.situation,
      answer: c.answer,
      keywords: c.keywords,
      status: "published" as const,
    }));
}

// AI가 사용할 수 있는 클레임: 라이브 상태 + 최종답변이 작성된 것만.
let liveCache: { data: ClaimItem[]; at: number } | null = null;
const LIVE_TTL_MS = 60_000;

export function invalidateLiveClaims() {
  liveCache = null;
}

export async function getLiveClaims(): Promise<ClaimItem[]> {
  if (liveCache && Date.now() - liveCache.at < LIVE_TTL_MS) {
    return liveCache.data;
  }
  try {
    await connectDB();
    // 라이브 + (answer 또는 csAnswer 둘 중 하나라도 채워진 클레임)을 가져온다.
    // toClaimItem 에서 effectiveAnswer 로 fallback 하므로, answer 만 보던 이전과 달리
    // CS답변만 적고 라이브 전환한 케이스도 포함된다.
    const docs = (await Claim.find({
      status: "live",
      $or: [
        { answer: { $nin: ["", null] } },
        { csAnswer: { $nin: ["", null] } },
      ],
    }).lean()) as ClaimDoc[];
    // effectiveAnswer 가 빈 문자열로 떨어지는 잔존 케이스는 한 번 더 거른다.
    const data = docs.map(toClaimItem).filter((c) => c.answer.trim().length > 0);
    liveCache = { data, at: Date.now() };
    return data;
  } catch {
    return [];
  }
}

export async function getAllClaims(): Promise<ClaimItem[]> {
  try {
    await connectDB();
    const docs = (await Claim.find({}).sort({ updatedAt: -1 }).lean()) as ClaimDoc[];
    return docs.map(toClaimItem);
  } catch {
    return [];
  }
}
