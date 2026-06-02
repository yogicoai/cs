import { connectDB } from "@/lib/db";
import { Faq } from "@/models/Faq";
import { getSampleFaqs, type FaqItem } from "@/lib/sample-data";
import { inferFaqSubcategory } from "@/lib/faqGrouping";

function toFaqItem(document: {
  _id: unknown;
  category: string;
  subcategory?: string;
  question: string;
  answer: string;
  keywords?: string[];
  status?: "draft" | "published" | "archived";
  updatedAt?: Date;
}): FaqItem {
  const keywords = document.keywords ?? [];

  return {
    id: String(document._id),
    category: document.category,
    subcategory: document.subcategory || inferFaqSubcategory(document.category, document.question, keywords),
    question: document.question,
    answer: document.answer,
    keywords,
    status: document.status,
    updatedAt: document.updatedAt?.toISOString(),
  };
}

// 공개 FAQ는 자주 바뀌지 않으므로 짧게 캐시해 AI 검색마다 DB를 다시 치지 않게 한다.
let publishedCache: { data: FaqItem[]; at: number } | null = null;
const PUBLISHED_TTL_MS = 60_000;

export function invalidatePublishedFaqs() {
  publishedCache = null;
}

export async function getPublishedFaqs(): Promise<FaqItem[]> {
  if (publishedCache && Date.now() - publishedCache.at < PUBLISHED_TTL_MS) {
    return publishedCache.data;
  }

  try {
    await connectDB();
    const docs = await Faq.find({ status: "published" }).sort({ category: 1, question: 1 }).lean();

    if (docs.length === 0) {
      return getSampleFaqs();
    }

    const data = docs.map((doc) => toFaqItem(doc as Parameters<typeof toFaqItem>[0]));
    publishedCache = { data, at: Date.now() };
    return data;
  } catch {
    return getSampleFaqs();
  }
}

export async function getAdminFaqs(): Promise<FaqItem[]> {
  try {
    await connectDB();
    const docs = await Faq.find({ status: { $ne: "archived" } }).sort({ updatedAt: -1 }).lean();

    if (docs.length === 0) {
      return getSampleFaqs();
    }

    return docs.map((doc) => toFaqItem(doc as Parameters<typeof toFaqItem>[0]));
  } catch {
    return getSampleFaqs();
  }
}

export async function getFaqById(id: string): Promise<FaqItem | null> {
  try {
    await connectDB();
    const doc = await Faq.findOne({ _id: id, status: { $ne: "archived" } }).lean();

    if (doc) {
      return toFaqItem(doc as Parameters<typeof toFaqItem>[0]);
    }

    // 일반 FAQ에 없으면 라이브 클레임에서 같은 ID를 찾아 FAQ 형태로 반환한다.
    const { getLiveClaimsAsFaqs } = await import("@/lib/repositories/claimRepository");
    const claimFaq = (await getLiveClaimsAsFaqs()).find((c) => c.id === id);
    if (claimFaq) {
      return claimFaq;
    }
  } catch {
    const sampleFaq = getSampleFaqs().find((faq) => faq.id === id);
    return sampleFaq ?? null;
  }

  return getSampleFaqs().find((faq) => faq.id === id) ?? null;
}
