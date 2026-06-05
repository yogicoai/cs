import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { connectDB } from "@/lib/db";
import { Claim } from "@/models/Claim";
import { getAllClaims, invalidateLiveClaims } from "@/lib/repositories/claimRepository";

const claimRowSchema = z.object({
  category: z.string().optional().default(""),
  situation: z.string().min(1),
  keywords: z.array(z.string()).optional().default([]),
  csAnswer: z.string().optional().default(""),
  note: z.string().optional().default(""),
});

const bulkSchema = z.object({ rows: z.array(claimRowSchema).min(1) });

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const claims = await getAllClaims();
  return NextResponse.json({ claims });
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { rows } = bulkSchema.parse(await request.json());
  await connectDB();
  const docs = await Claim.insertMany(rows.map((row) => ({ ...row, status: "review", source: "upload" })));
  invalidateLiveClaims();
  return NextResponse.json({ inserted: docs.length }, { status: 201 });
}
