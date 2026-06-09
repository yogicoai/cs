import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { connectDB } from "@/lib/db";
import { invalidatePublishedFaqs } from "@/lib/repositories/faqRepository";
import { Faq } from "@/models/Faq";

const faqSchema = z.object({
  category: z.string().min(1),
  subcategory: z.string().optional().default(""),
  question: z.string().min(1),
  answer: z.string().min(1),
  keywords: z.array(z.string()).default([]),
  channelVisibility: z.array(z.string()).default([]),
  status: z.enum(["draft", "published", "archived"]).default("published"),
});

export async function GET() {
  await connectDB();
  const faqs = await Faq.find({ status: { $ne: "archived" } }).sort({
    category: 1,
    subcategory: 1,
    updatedAt: -1,
  });
  return NextResponse.json({ faqs });
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  await connectDB();
  const payload = faqSchema.parse(await request.json());
  const faq = await Faq.create(payload);
  invalidatePublishedFaqs();
  revalidatePath("/guide/[channel]", "page");
  return NextResponse.json({ faq }, { status: 201 });
}
