import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { ADMIN_COOKIE, SESSION_TTL_MS, createSession, verifyPin } from "@/lib/adminAuth";

const schema = z.object({ pin: z.string().min(1) });

export async function POST(request: Request) {
  const { pin } = schema.parse(await request.json());

  if (!(await verifyPin(pin))) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const { token, expiresAt } = await createSession();
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });

  return NextResponse.json({ ok: true });
}
