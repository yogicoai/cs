import { connectDB } from "@/lib/db";
import { Claim } from "@/models/Claim";

export type ClaimStatus = "review" | "live" | "hold";

export type ClaimItem = {
  id: string;
  category: string;
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
