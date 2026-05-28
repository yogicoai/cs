import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Faq } from "@/models/Faq";
import { FaqRevision } from "@/models/FaqRevision";

const faqUpdateSchema = z.object({
  category: z.string().min(1),
  subcategory: z.string().optional().default(""),
  question: z.string().min(1),
  answer: z.string().min(1),
  keywords: z.array(z.string()).default([]),
  status: z.enum(["draft", "published", "archived"]).default("published"),
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(request: Request, context: RouteContext) {
  await connectDB();
  const { id } = await context.params;
  const payload = faqUpdateSchema.parse(await request.json());
  const before = await Faq.findById(id).lean();

  if (!before) {
    return NextResponse.json({ message: "FAQ not found" }, { status: 404 });
  }

  const faq = await Faq.findByIdAndUpdate(
    id,
    { $set: payload, $inc: { revision: 1 }, updatedBy: "admin" },
    { new: true },
  );

  await FaqRevision.create({
    faqId: id,
    before,
    after: faq?.toObject(),
    changedBy: "admin",
    changeReason: "admin_update",
  });

  return NextResponse.json({ faq });
}

export async function DELETE(_request: Request, context: RouteContext) {
  await connectDB();
  const { id } = await context.params;
  const before = await Faq.findById(id).lean();

  if (!before) {
    return NextResponse.json({ message: "FAQ not found" }, { status: 404 });
  }

  const faq = await Faq.findByIdAndUpdate(
    id,
    { $set: { status: "archived", updatedBy: "admin" }, $inc: { revision: 1 } },
    { new: true },
  );

  await FaqRevision.create({
    faqId: id,
    before,
    after: faq?.toObject(),
    changedBy: "admin",
    changeReason: "admin_archive",
  });

  return NextResponse.json({ faq });
}
