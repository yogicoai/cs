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

export async function getPublishedFaqs(): Promise<FaqItem[]> {
  try {
    await connectDB();
    const docs = await Faq.find({ status: "published" }).sort({ category: 1, question: 1 }).lean();

    if (docs.length === 0) {
      return getSampleFaqs();
    }

    return docs.map((doc) => toFaqItem(doc as Parameters<typeof toFaqItem>[0]));
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
  } catch {
    const sampleFaq = getSampleFaqs().find((faq) => faq.id === id);
    return sampleFaq ?? null;
  }

  return getSampleFaqs().find((faq) => faq.id === id) ?? null;
}
