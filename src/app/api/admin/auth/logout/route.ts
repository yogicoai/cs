import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, clearSession } from "@/lib/adminAuth";

export async function POST() {
  await clearSession();
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return NextResponse.json({ ok: true });
}
