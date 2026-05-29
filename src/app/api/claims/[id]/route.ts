import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Claim } from "@/models/Claim";
import { invalidateLiveClaims } from "@/lib/repositories/claimRepository";

const updateSchema = z.object({
  category: z.string().optional(),
  situation: z.string().min(1).optional(),
  keywords: z.array(z.string()).optional(),
  csAnswer: z.string().optional(),
  aiSuggestedAnswer: z.string().optional(),
  answer: z.string().optional(),
  status: z.enum(["review", "live", "hold"]).optional(),
  note: z.string().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  await connectDB();
  const { id } = await context.params;
  const payload = updateSchema.parse(await request.json());
  const claim = await Claim.findByIdAndUpdate(id, { $set: payload }, { new: true });

  if (!claim) {
    return NextResponse.json({ message: "Claim not found" }, { status: 404 });
  }

  invalidateLiveClaims();
  return NextResponse.json({ claim });
}

export async function DELETE(_request: Request, context: RouteContext) {
  await connectDB();
  const { id } = await context.params;
  const claim = await Claim.findByIdAndDelete(id);

  if (!claim) {
    return NextResponse.json({ message: "Claim not found" }, { status: 404 });
  }

  invalidateLiveClaims();
  return NextResponse.json({ ok: true });
}
