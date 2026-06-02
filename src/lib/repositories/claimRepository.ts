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
  return {
    id: String(doc._id),
    category: doc.category ?? "",
    subcategory: doc.subcategory ?? "",
    situation: doc.situation,
    keywords: doc.keywords ?? [],
    csAnswer: doc.csAnswer ?? "",
    aiSuggestedAnswer: doc.aiSuggestedAnswer ?? "",
    answer: doc.answer ?? "",
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
    const docs = (await Claim.find({ status: "live", answer: { $nin: ["", null] } }).lean()) as ClaimDoc[];
    const data = docs.map(toClaimItem);
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
